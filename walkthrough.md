# SilentMeet Two-Participant Meeting & Hand Gesture Resolution

## Problem Solved
When two people entered the video call simultaneously over LAN (Device 1: Host/Sarthak, Device 2: Remote/Rahul), hand gestures stopped triggering on the video call cards and in the Live Silent Feed.

### Root Cause Analysis
1. **Single Shared `GestureEngine` State on Backend**:
   - `server.py` had a single global `engine = GestureEngine(stable_frames=6, cooldown=2.0)`.
   - The `GestureEngine` tracks stateful frame history (`wrist_history`, `point_history`, `candidate_id`, `candidate_count`) across frames.
   - When both Sarthak and Rahul streamed video frames simultaneously at ~7 FPS, their frames interleaved rapidly on the single engine. Each new frame from one user would reset or clobber the candidate counter and landmark trajectories of the other user, preventing either user from ever reaching the 6 stable frames needed to fire a gesture.
2. **Remote Peer Gesture Badge Matching**:
   - In `App.jsx`, remote gesture matching strictly checked exact case and string identity (`data.user === remotePeerRef.current.name`). Any subtle differences in whitespace or casing prevented the floating badge on the peer video tile from showing.
3. **Hardcoded User Check in Sidebar**:
   - In `SilentSidebar.jsx`, the "You" badge was hardcoded to `msg.user === 'Sarthak'`.

---

## Changes Implemented
1. **Per-Participant Dedicated Gesture Engines (`server.py`)**:
   - Implemented `user_engines: Dict[str, GestureEngine] = {}` with thread-safe retrieval `get_gesture_engine_for_user(user_name)`.
   - Each meeting participant now has their own isolated MediaPipe landmark tracker, wrist history, and debounce candidate counter.
   - Sarthak and Rahul can now hold gestures independently without interfering with each other's candidate progress.
   - Dynamic custom mappings are synchronized across all active per-user engines.
2. **Robust Remote Peer Badge & Floating Banners (`App.jsx` & `VideoStage.jsx`)**:
   - In `App.jsx`, updated remote gesture detection to match any gesture originating from the other participant (`cleanSender !== cleanLocalUser`), displaying the floating badge on the remote peer's video tile for 4.5 seconds.
   - In `VideoStage.jsx`, updated the central confirmed gesture banner to clearly display the participant's name (e.g., `"Silent Message • Rahul"` or `"Silent Message • Sarthak"` with a `"You"` tag).
3. **Dynamic Sidebar Matching (`SilentSidebar.jsx`)**:
   - Added `userName` prop and dynamic case-insensitive comparison `(msg.user || '').trim().toLowerCase() === (userName || '').trim().toLowerCase()`.

## 🚀 Running Services

| Service | Port / URL | Status |
|---|---|---|
| **FastAPI WebSocket Backend** | `http://127.0.0.1:8000` | 🟢 **RUNNING** (`server.py`) |
| **SilentMeet Frontend App** | `http://localhost:5173/` | 🟢 **RUNNING** (`npm run dev`) |

---

## ✋ Supported Gestures & Mappings

The existing model classification logic (`classify_command`) is wrapped in `gesture_engine.py` without modifying any weights or core models:

| Gesture | Icon | Default Silent Message |
|---|---|---|
| **Thumbs Up** | 👍 | `"I Agree"` |
| **Thumbs Down** | 👎 | `"I Disagree"` |
| **Open Palm** | 🖐️ | `"I Have a Question"` |
| **Wave** | 👋 | `"Hello Everyone"` |
| **Fist** | ✊ | `"Stop / Hold On"` |
| **Pointer / One** | ☝️ | `"I Need Help"` |
| **Love / Rock** | 🤟 | `"Thank You!"` |
| **Victory / Peace** | ✌️ | `"Request to Speak"` |

---

## 🌟 Features Implemented

1. **Dark Meeting Aesthetic**:
   - High-contrast conference layout with clean slate-950/900 palette, subtle borders, and rounded cards.
   - Distinct brand identity: **SilentMeet** (speech bubble with hand gesture).
2. **Real-time Video & HUD**:
   - Local webcam video tile with interactive tracking badge and debouncing progress bar.
   - Remote participant tiles (Rahul, Aman, Priya) with active speaker detection and silent reaction badges.
3. **Live Silent Responses Sidebar**:
   - Real-time stream of non-verbal messages showing user name, emoji icon, timestamp, and sound cue chime.
   - Instant gesture trigger chips for quick hackathon demonstration.
   - Automatic room AI simulation toggle for simulated remote participant reactions.
4. **Meeting Controls Dock**:
   - Microphone mute/unmute, Camera toggle, Screen share toggle, Raise Hand button, Participants & Silent Chat drawers, and Leave button.
5. **Customizable Gesture Mappings**:
   - Click the **"Customize"** button in the header or control dock to open the modal and edit any gesture's text message on the fly.
6. **Built-in Gesture Cheatsheet**:
   - Click the **"Gestures"** button in the header to view the full cheat sheet of supported hand signs.

---

## 🛠️ How to Start the App in the Future

### 1. Start the Backend:
```powershell
cd "d:\project\hand-gesture-recognition-using-mediapipe-main - Copy - Copy - Copy\hand-gesture-recognition-using-mediapipe-main"
.\.venv\Scripts\python.exe server.py
```

### 2. Start the Frontend:
```powershell
cd "d:\project\hand-gesture-recognition-using-mediapipe-main - Copy - Copy - Copy\frontend"
npm run dev
```

Navigate to [http://localhost:5173/](http://localhost:5173/) in your browser, grant webcam access, and show gestures to your camera!

hand-gesture-recognition-using-mediapipe-main - Copy - Copy


----------------------------------------------------------------------------------------------
⚠️ Important Browser Security Requirement (Webcam over LAN)
Modern web browsers (Chrome, Edge, Brave, etc.) block camera and microphone access over plain http:// unless it is localhost.

To allow the second laptop to use its camera & microphone over HTTP without needing SSL certificates, do this one-time setup on the second laptop:

On Laptop 2 (Chrome or Edge):
Open a new tab and go to:
For Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure
For Edge: edge://flags/#unsafely-treat-insecure-origin-as-secure
Set the dropdown to Enabled.
In the text box right below it, enter:
http://10.177.248.83:5173
Click Relaunch at the bottom right of the browser.


🚀 Step-by-Step Instructions to Join
On Your First Laptop (Host):
Keep both servers running (they are already running right now on 0.0.0.0):
Frontend dev server: listening on http://localhost:5173 and http://10.177.248.83:5173
Python backend: listening on 0.0.0.0:8000
Open http://localhost:5173/ on your laptop.
Enter:
Name: Sarthak
Room ID: CODE26
Click Join Meeting and grant camera & microphone permissions.


On the Second Laptop (Participant):
Connect to the same Wi-Fi network.
Open your browser and navigate to:
http://10.177.248.83:5173
Enter:
Name: Rahul (or any other name)
Room ID: CODE26 (must match the host's Room ID)
Click Join Meeting and grant camera & microphone permissions.