# -*- coding: utf-8 -*-
"""
Mouth Extraction and Preprocessing Module.
Uses MediaPipe FaceLandmarker to detect face and lips, performing the exact
100x50 crop and horizontal padding normalization expected by LipNet.
"""

from typing import Optional, Tuple
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Outer lips landmark indices in MediaPipe 468/478 face mesh
LIPS_OUTER_INDICES = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95
]


class MouthExtractor:
    def __init__(
        self,
        model_asset_path: str,
        target_width: int = 100,
        target_height: int = 50,
        horizontal_pad: float = 0.19,
    ):
        self.target_width = target_width
        self.target_height = target_height
        self.horizontal_pad = horizontal_pad

        base_options = python.BaseOptions(model_asset_path=model_asset_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.detector = vision.FaceLandmarker.create_from_options(options)

    def extract_mouth(self, frame: np.ndarray) -> Tuple[bool, Optional[np.ndarray]]:
        """
        Detects primary face in frame, crops mouth region to (50, 100, 3) BGR image.
        Returns (face_detected, mouth_crop).
        """
        if frame is None or frame.size == 0:
            return False, None

        h, w, _ = frame.shape
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        result = self.detector.detect(mp_image)

        if not result.face_landmarks or len(result.face_landmarks) == 0:
            return False, None

        landmarks = result.face_landmarks[0]
        mouth_points = []
        for idx in LIPS_OUTER_INDICES:
            lm = landmarks[idx]
            mouth_points.append([lm.x * w, lm.y * h])
        mouth_points = np.array(mouth_points, dtype=np.float32)

        centroid = np.mean(mouth_points, axis=0)
        mouth_left = np.min(mouth_points[:, 0]) * (1.0 - self.horizontal_pad)
        mouth_right = np.max(mouth_points[:, 0]) * (1.0 + self.horizontal_pad)
        mouth_span = max(mouth_right - mouth_left, 1.0)

        # Normalization scale factor matching LipNet training
        norm_ratio = self.target_width / float(mouth_span)
        new_w = max(1, int(w * norm_ratio))
        new_h = max(1, int(h * norm_ratio))
        resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

        c_x = int(centroid[0] * norm_ratio)
        c_y = int(centroid[1] * norm_ratio)

        l = c_x - self.target_width // 2
        r = l + self.target_width
        t = c_y - self.target_height // 2
        b = t + self.target_height

        # Safe crop with boundary checking
        crop = np.zeros((self.target_height, self.target_width, 3), dtype=np.uint8)
        src_l, src_r = max(0, l), min(new_w, r)
        src_t, src_b = max(0, t), min(new_h, b)
        dst_l, dst_r = max(0, -l), max(0, -l) + (src_r - src_l)
        dst_t, dst_b = max(0, -t), max(0, -t) + (src_b - src_t)

        if src_r > src_l and src_b > src_t:
            crop[dst_t:dst_b, dst_l:dst_r] = resized[src_t:src_b, src_l:src_r]

        return True, crop

    def extract_mouth_3dcnn(self, frame: np.ndarray, target_width: int = 112, target_height: int = 80) -> Tuple[bool, Optional[np.ndarray]]:
        """Extract the mouth crop expected by the GitHub 3D-CNN model."""
        if frame is None or frame.size == 0:
            return False, None

        h, w, _ = frame.shape
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        result = self.detector.detect(mp_image)

        if not result.face_landmarks or len(result.face_landmarks) == 0:
            return False, None

        landmarks = result.face_landmarks[0]
        mouth_points = np.array([
            [landmarks[idx].x * w, landmarks[idx].y * h]
            for idx in LIPS_OUTER_INDICES
        ], dtype=np.float32)

        left = float(np.min(mouth_points[:, 0]))
        right = float(np.max(mouth_points[:, 0]))
        top = float(np.min(mouth_points[:, 1]))
        bottom = float(np.max(mouth_points[:, 1]))

        # Preserve the training crop's 112:80 aspect ratio instead of stretching
        # the narrow lip landmarks directly into the model input.
        crop_width = max(right - left, 1.0)
        crop_height = max(bottom - top, 1.0)
        center_x = (left + right) / 2.0
        center_y = (top + bottom) / 2.0
        crop_width *= 1.35
        crop_height *= 1.55
        target_ratio = target_width / float(target_height)
        if crop_width / crop_height < target_ratio:
            crop_width = crop_height * target_ratio
        else:
            crop_height = crop_width / target_ratio

        left = max(0, int(round(center_x - crop_width / 2.0)))
        right = min(w, int(round(center_x + crop_width / 2.0)))
        top = max(0, int(round(center_y - crop_height / 2.0)))
        bottom = min(h, int(round(center_y + crop_height / 2.0)))

        if right <= left or bottom <= top:
            return False, None

        crop = frame[top:bottom, left:right]
        crop = cv2.resize(crop, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)

        lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(3, 3))
        l_channel = clahe.apply(l_channel)
        crop = cv2.cvtColor(cv2.merge((l_channel, a_channel, b_channel)), cv2.COLOR_LAB2BGR)
        crop = cv2.GaussianBlur(crop, (7, 7), 0)
        crop = cv2.bilateralFilter(crop, 5, 75, 75)
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]], dtype=np.float32)
        crop = cv2.filter2D(crop, -1, kernel)
        crop = cv2.GaussianBlur(crop, (5, 5), 0)

        return True, crop
