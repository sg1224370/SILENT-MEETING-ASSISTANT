import os
import cv2
from lipnet_engine import LipReader

model_candidates = [
    os.path.join('..', 'new_lip_model', 'model', 'model_weights.h5'),
    os.path.join('new_lip_model', 'model', 'model_weights.h5'),
    'lipnet_repo/evaluation/models/unseen-weights178.h5',
    'lipnet_repo/evaluation/models/overlapped-weights368.h5',
]
weight_path = next((p for p in model_candidates if os.path.exists(p)), model_candidates[0])

reader = LipReader(
    weight_path=weight_path,
    face_model_path='face_landmarker.task',
    sequence_length=75,
    cooldown=2.0,
    min_confidence=0.15,
    step_stride=5
)

cap = cv2.VideoCapture('lipnet_repo/evaluation/samples/id2_vcd_swwp2s.mpg')
frames_processed = 0
last_res = None
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    res = reader.process_frame(frame)
    frames_processed += 1
    if res['fired']:
        print(f"FIRED! at frame {frames_processed}: {res['command_info']['name']} -> {res['command_info']['message']}")
    elif res['raw_prediction']:
        print(f"Frame {frames_processed} raw: {res['raw_prediction']}, conf: {res['confidence']}")
    last_res = res
cap.release()

print(f"Done. Processed {frames_processed} frames. Last raw: '{last_res['raw_prediction']}'")
