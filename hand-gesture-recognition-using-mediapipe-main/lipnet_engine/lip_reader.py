# -*- coding: utf-8 -*-
"""
LipReader Adapter: Clean interface encapsulating LipNet inference, temporal buffering,
temporal validation, debouncing, and cooldown. Hides LipNet internals from SilentMeet.
"""

import time
import logging
from collections import deque
from pathlib import Path
from typing import Dict, Optional, Tuple, List

import cv2
import numpy as np
import torch
import tensorflow as tf

from .model import LipNet
from .preprocessor import MouthExtractor
from .decoder import ctc_greedy_decode, LipCommandMapper, DEFAULT_LIP_COMMANDS

logger = logging.getLogger("LipReader")


class LipReader:
    def __init__(
        self,
        weight_path: str,
        face_model_path: str,
        sequence_length: Optional[int] = None,
        cooldown: float = 2.0,
        min_confidence: float = 0.20,
        step_stride: int = 2,
    ):
        self.model_family = self._detect_model_family(weight_path)
        if sequence_length is None:
            sequence_length = 22 if self.model_family == "3dcnn" else 75
        self.sequence_length = sequence_length
        self.cooldown = cooldown
        self.min_confidence = min_confidence
        self.step_stride = step_stride

        self.extractor = MouthExtractor(model_asset_path=face_model_path)
        logger.info(f"Loading lip model weights from: {weight_path} ({self.model_family})")
        if self.model_family == "3dcnn":
            self.model = self._build_3dcnn_model(weight_path)
            self.label_map = {
                6: "hello", 5: "dog", 10: "my", 12: "you", 9: "lips", 3: "cat",
                11: "read", 0: "a", 4: "demo", 7: "here", 8: "is", 1: "bye", 2: "can"
            }
        else:
            self.model = LipNet(weight_path=weight_path)
            self.model.eval()
            self.label_map = {}

        self.mapper = LipCommandMapper()
        self.frame_buffer = deque(maxlen=self.sequence_length)
        self.frames_since_last_inference = 0
        self.last_fired_time = 0.0
        self.last_confirmed_command = None
        self.recent_predictions = deque(maxlen=4)
        self.prediction_history = deque(maxlen=3)
        self.is_ready = True
        self.face_detected = False

    def reset(self):
        """Clears temporal frame buffer and recent predictions."""
        self.frame_buffer.clear()
        self.recent_predictions.clear()
        self.prediction_history.clear()
        self.frames_since_last_inference = 0

    @staticmethod
    def _detect_model_family(weight_path: str) -> str:
        try:
            import h5py
            with h5py.File(weight_path, "r") as weights:
                keys = set(weights.keys())
                if {"conv3d", "conv3d_1", "dense", "dense_1"}.issubset(keys):
                    return "3dcnn"
                if any(k.startswith("conv1") or k.startswith("bidirectional") for k in keys):
                    return "lipnet"
        except Exception:
            pass
        lowered = str(weight_path).lower()
        if "model_weights" in lowered or "3dcnn" in lowered:
            return "3dcnn"
        return "lipnet"

    @staticmethod
    def _build_3dcnn_model(weight_path: str):
        label_dict = {6: 'hello', 5: 'dog', 10: 'my', 12: 'you', 9: 'lips', 3: 'cat', 11: 'read', 0: 'a', 4: 'demo', 7: 'here', 8: 'is', 1: 'bye', 2: 'can'}
        input_shape = (22, 80, 112, 3)
        model = tf.keras.Sequential([
            tf.keras.layers.Conv3D(16, (3, 3, 3), activation='relu', input_shape=input_shape),
            tf.keras.layers.MaxPooling3D((2, 2, 2)),
            tf.keras.layers.Conv3D(64, (3, 3, 3), activation='relu'),
            tf.keras.layers.MaxPooling3D((2, 2, 2)),
            tf.keras.layers.Flatten(),
            tf.keras.layers.Dense(128, activation='relu'),
            tf.keras.layers.Dropout(0.5),
            tf.keras.layers.Dense(64, activation='relu'),
            tf.keras.layers.Dropout(0.5),
            tf.keras.layers.Dense(len(label_dict), activation='softmax')
        ])
        model.load_weights(weight_path)
        return model

    def _predict_new_model(self) -> Tuple[str, float]:
        if len(self.frame_buffer) < self.sequence_length:
            return "", 0.0

        seq = np.array(list(self.frame_buffer), dtype=np.float32)
        if seq.shape[0] < self.sequence_length:
            return "", 0.0

        seq = seq[: self.sequence_length]
        input_tensor = seq[np.newaxis, ...]
        prediction = self.model.predict(input_tensor, verbose=0)[0]
        pred_idx = int(np.argmax(prediction))
        confidence = float(prediction[pred_idx])
        raw_label = self.label_map.get(pred_idx, str(pred_idx))
        return raw_label, confidence

    def set_custom_mapping(self, command_id: str, custom_message: str):
        self.mapper.set_custom_mapping(command_id, custom_message)

    def process_frame(self, frame: np.ndarray) -> dict:
        """
        Accepts a single video frame from the existing camera pipeline.
        Extracts mouth, adds to temporal buffer, triggers inference when buffer is sufficiently filled.
        """
        if self.model_family == "3dcnn":
            face_detected, mouth_crop = self.extractor.extract_mouth_3dcnn(frame)
        else:
            face_detected, mouth_crop = self.extractor.extract_mouth(frame)
        self.face_detected = face_detected

        if not face_detected or mouth_crop is None:
            return {
                "face_detected": False,
                "buffer_length": len(self.frame_buffer),
                "buffer_progress": len(self.frame_buffer) / float(self.sequence_length),
                "raw_prediction": "",
                "confidence": 0.0,
                "command_info": None,
                "fired": False,
            }

        if self.model_family == "3dcnn":
            normalized = mouth_crop.astype(np.float32)
        else:
            swapped = mouth_crop.swapaxes(0, 1)
            normalized = swapped.astype(np.float32) / 255.0

        self.frame_buffer.append(normalized)
        self.frames_since_last_inference += 1

        buf_len = len(self.frame_buffer)
        buffer_progress = min(1.0, buf_len / float(self.sequence_length))

        min_required_frames = self.sequence_length if self.model_family == "3dcnn" else 35
        if buf_len < min_required_frames or self.frames_since_last_inference < self.step_stride:
            return {
                "face_detected": True,
                "buffer_length": buf_len,
                "buffer_progress": buffer_progress,
                "raw_prediction": "",
                "confidence": 0.0,
                "command_info": None,
                "fired": False,
            }

        self.frames_since_last_inference = 0

        if self.model_family == "3dcnn":
            raw_text, confidence = self._predict_new_model()
        else:
            raw_seq = list(self.frame_buffer)
            if len(raw_seq) < self.sequence_length:
                pad_count = self.sequence_length - len(raw_seq)
                first_frame = raw_seq[0]
                raw_seq = [first_frame] * pad_count + raw_seq

            sequence_data = np.array(raw_seq)
            tensor = torch.from_numpy(sequence_data).permute(3, 0, 1, 2).unsqueeze(0).float()

            try:
                with torch.no_grad():
                    probs = self.model(tensor).numpy()
                raw_text, confidence = ctc_greedy_decode(probs)
            except Exception as e:
                logger.error(f"Inference exception in LipNet: {e}")
                raw_text, confidence = "", 0.0

        if self.model_family == "3dcnn" and raw_text:
            self.prediction_history.append((raw_text, confidence))
            labels = [label for label, _ in self.prediction_history]
            stable_label = max(set(labels), key=labels.count)
            stable_votes = labels.count(stable_label)
            if stable_votes >= 2:
                stable_confidences = [score for label, score in self.prediction_history if label == stable_label]
                raw_text = stable_label
                confidence = float(np.mean(stable_confidences))

        cmd_info = self.mapper.match_prediction(raw_text) if raw_text else None

        now = time.time()
        fired = False

        if cmd_info and confidence >= self.min_confidence:
            cmd_id = cmd_info["id"]
            if now - self.last_fired_time >= self.cooldown:
                fired = True
                self.last_fired_time = now
                self.last_confirmed_command = cmd_id
                self.frame_buffer.clear()
                self.recent_predictions.clear()
                self.prediction_history.clear()
            else:
                self.recent_predictions.append(cmd_id)
        else:
            self.recent_predictions.append(None)

        return {
            "face_detected": True,
            "buffer_length": len(self.frame_buffer),
            "buffer_progress": buffer_progress,
            "raw_prediction": raw_text,
            "confidence": round(confidence, 2),
            "command_info": cmd_info if (fired or cmd_info) else None,
            "fired": fired,
        }
