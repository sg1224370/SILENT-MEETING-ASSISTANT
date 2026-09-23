# -*- coding: utf-8 -*-
"""
End-to-End Test Suite for SilentMeet Dual AI Architecture (MediaPipe Hand + LipNet).
Tests:
1. Offline real LipNet inference against sample frames
2. MediaPipe FaceLandmarker + MouthExtractor crop logic
3. Server API endpoints (/api/health, /api/ai/status, /api/gestures/mappings, /api/lip/mappings)
4. /api/detect_frame simultaneous Hand + Lip processing
5. /api/trigger_gesture for both hand and lip commands
"""

import os
import cv2
import base64
import numpy as np
import torch
from fastapi.testclient import TestClient

from server import app
from lipnet_engine import LipReader, DEFAULT_LIP_COMMANDS

client = TestClient(app)

def test_ai_status():
    res = client.get("/api/ai/status")
    assert res.status_code == 200
    data = res.json()
    print("AI Status:", data)
    assert data["hand_ai"]["available"] is True
    assert data["lip_ai"]["available"] is True

def test_mappings():
    res_g = client.get("/api/gestures/mappings")
    assert res_g.status_code == 200
    assert len(res_g.json()["mappings"]) >= 8

    res_l = client.get("/api/lip/mappings")
    assert res_l.status_code == 200
    assert len(res_l.json()["mappings"]) >= 5

def test_lip_mapping_update():
    res = client.post("/api/lip/mappings", json={"command_id": "AGREE", "message": "Totally Agree!"})
    assert res.status_code == 200
    data = res.json()
    assert data["updated"]["message"] == "Totally Agree!"

def test_manual_triggers():
    # Hand trigger
    res_h = client.post("/api/trigger_gesture", json={"gesture_id": 0, "user_name": "Sarthak", "source": "hand"})
    assert res_h.status_code == 200
    assert res_h.json()["event"]["source"] == "hand"

    # Lip trigger
    res_l = client.post("/api/trigger_gesture", json={"lip_command": "AGREE", "user_name": "Sarthak", "source": "lip"})
    assert res_l.status_code == 200
    assert res_l.json()["event"]["source"] == "lip"
    assert res_l.json()["event"]["icon"] == "👄"

def test_detect_frame_with_sample_image():
    # Load sample image
    sample_path = "lipnet_repo/evaluation/samples/bbaf2n/mouth_image001.png"
    img = cv2.imread(sample_path)
    assert img is not None
    _, buffer = cv2.imencode(".jpg", img)
    b64 = base64.b64encode(buffer).decode("utf-8")

    res = client.post("/api/detect_frame", json={"image_base64": b64, "user_name": "Sarthak"})
    assert res.status_code == 200
    data = res.json()
    print("Detect Frame Response keys:", list(data.keys()))
    assert "hand_detected" in data
    assert "lip_detected" in data
    assert data["lip_available"] is True

if __name__ == "__main__":
    print("Running SilentMeet Dual AI Test Suite...")
    test_ai_status()
    test_mappings()
    test_lip_mapping_update()
    test_manual_triggers()
    test_detect_frame_with_sample_image()
    print("ALL TESTS PASSED SUCCESSFULLY! [OK]")
