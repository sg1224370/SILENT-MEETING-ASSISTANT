# SilentMeet: Real-Time Silent Communication (Hand Gestures + Lip Reading)

SilentMeet is an accessible, real-time, peer-to-peer non-verbal communication platform for video meetings. It empowers users to communicate instantly and silently in meetings without needing to speak out loud or turn on a microphone.

---

## 🌟 Key Features

1. **P2P WebRTC Video & Audio Calling**:
   - Ultra low-latency, two-participant mesh WebRTC video calling.
   - Built-in camera and microphone controls with real-time peer track sync.
   - Dedicated room IDs (e.g. `CODE26`) with instant clipboard invite copying.

2. **Dual-Channel AI Processing (Zero Camera Conflict)**:
   - **Hand Gesture Recognition**: Powered by MediaPipe HandLandmarker + TFLite MLP classifiers for 8 recognizable gesture commands (thumbs up, thumbs down, peace, wave, pointer, etc.).
   - **Silent Lip Reading**: Integrated open-source **LipNet** (3D-CNN + SpatialDropout + Bidirectional GRU + CTC Decoder) trained on the GRID corpus.
   - **Unified Single-Stream Capture**: Only **one** camera stream is opened in the browser. Browser frames are multiplexed to both AI engines simultaneously without conflict.

3. **Microphone is Never Required**:
   - Users can keep their microphone completely **MUTED** and silently mouth supported phrases or make hand gestures.
   - Predictions are translated directly into high-fidelity silent messages.

4. **Live Silent Feed**:
   - Distinct badges distinguishing `✋ Hand Gesture` vs `👄 Lip Reading`.
   - Real-time broadcast to both local and remote meeting participants over WebSocket.

5. **Gesture & Lip Command Customization**:
   - In-app customization modal allowing participants to tailor the displayed message for each hand gesture and lip reading command.

6. **Robust AI Isolation**:
   - If hand AI fails or no hands are shown, Lip AI continues operating.
   - If face is obstructed, Hand AI continues operating.
   - If both AI engines are unavailable, WebRTC video calling remains completely unaffected.

---

## 🏗️ Architecture & Pipeline

```
                              WEBCAM
                                │
                                ▼
                       SINGLE VIDEO STREAM
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
          EXISTING HAND AI                   LIP AI
                 │                             │
        MediaPipe HandLandmarker            MediaPipe FaceLandmarker
                 │                             │
         TFLite Keypoints                Mouth Normalization (100x50)
                 │                             │
          Debounce Filter               Temporal Buffer (75 Frames)
                 │                             │
                 │                      LipNet (3D-CNN + BiGRU)
                 │                             │
                 │                        CTC Decoder
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                         UNIFIED AI EVENT
                 {"source": "hand" | "lip", ...}
                                │
                                ▼
                         MESSAGE MAPPING
                                │
                                ▼
                        LIVE SILENT FEED
                                │
                        WebSocket Broadcast
                                │
                                ▼
                        REMOTE PARTICIPANT
```

---

## 👄 LipNet Integration & Supported Vocabulary

LipNet was integrated from the open-source repository:
- **Repository**: [rizkiarm/LipNet](https://github.com/rizkiarm/LipNet)
- **Model**: Spatiotemporal 3D Convolutional Neural Network followed by two Bi-directional GRU layers and a Dense layer with CTC loss.
- **Pretrained Weights**: `overlapped-weights368.h5`
- **Supported GRID Vocabulary & Controlled Silent Commands**:
  - `set` / `soon` / `green` ➔ **"Yes, I Agree"** (👄 AGREE)
  - `bin` / `now` / `red` ➔ **"No, I Disagree"** (👄 DISAGREE)
  - `place` / `please` / `blue` ➔ **"I Have a Question"** (👄 QUESTION)
  - `lay` / `again` ➔ **"Could You Repeat That?"** (👄 REPEAT)
  - `help` / `white` ➔ **"I Need Assistance"** (👄 HELP)

*Attribution*: LipNet model architecture and weights are developed and published by Yannis M. Assael, Brendan Shillingford, Shimon Whiteson, and Nando de Freitas, implemented in Keras by Rizki Maulana. Integrated into SilentMeet as an isolated PyTorch inference adapter without modifying the original model weights.

---

## 🚀 How to Run SilentMeet

### 1. Start the Backend
Open a terminal (PowerShell) and run:
```powershell
cd "d:\project\hand-gesture-recognition-using-mediapipe-main - Copy - Copy - Copy\hand-gesture-recognition-using-mediapipe-main"
.\.venv\Scripts\python.exe server.py
```
Backend will start on `http://0.0.0.0:8000`.

### 2. Start the Frontend
Open a second terminal and run:
```powershell
cd "d:\project\hand-gesture-recognition-using-mediapipe-main - Copy - Copy - Copy\frontend"
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 👥 How to Test Two Participants

1. Open `http://localhost:5173/` in Browser Window 1 (e.g. Chrome).
   - Enter Name: **Sarthak**
   - Room ID: **CODE26**
   - Click **Join Call**.
2. Open `http://localhost:5173/` in Browser Window 2 (e.g. Incognito or Edge).
   - Enter Name: **Rahul**
   - Room ID: **CODE26**
   - Click **Join Call**.
3. **WebRTC P2P**: Video and audio will connect automatically between Sarthak and Rahul.
4. **Mute Microphone**: In Sarthak's window, click the microphone button to mute audio.
5. **Test Hand Gesture**: Sarthak holds up a thumbs up (`👍`).
   - Sarthak's and Rahul's Live Silent Feed displays: `👍 Sarthak: "I Agree" (✋ Hand Gesture)`.
6. **Test Lip Reading**: Sarthak silently mouths a supported command (or clicks the instant trigger chip in the sidebar).
   - Sarthak's and Rahul's Live Silent Feed displays: `👄 Sarthak: "Yes, I Agree" (👄 Lip Reading)`.
   - The remote user receives the silent message immediately over WebSocket with zero audio required.
