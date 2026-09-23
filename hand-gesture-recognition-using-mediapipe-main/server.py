#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
FastAPI Server with WebSocket for Silent Meeting Assistant (SilentMeet).
Handles:
- Real-time WebSocket connection for live gesture telemetry and fired events
- REST endpoints for gesture mapping customization, history, and client frame analysis
- Threaded background worker for server webcam capture (optional)
- Simulated participant reactions for hackathon demonstration
"""

import asyncio
import base64
import json
import logging
import os
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional

import cv2 as cv
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gesture_engine import GestureEngine, DEFAULT_GESTURE_CONFIG
from lipnet_engine import LipReader, DEFAULT_LIP_COMMANDS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SilentMeetServer")

app = FastAPI(title="Silent Meeting Assistant API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Default & Custom Hand Gesture Mappings Storage
custom_gesture_mappings: Dict[int, str] = {}

# Default & Custom Lip Command Mappings Storage
custom_lip_mappings: Dict[str, str] = {}

# Per-user Gesture Engine instances to isolate candidate debouncing & wrist history
user_engines: Dict[str, GestureEngine] = {}
user_lip_readers: Dict[str, LipReader] = {}
engines_lock = threading.Lock()

# Paths to models
LIPNET_MODEL_CANDIDATES = [
    os.path.join("..", "new_lip_model", "model", "model_weights.h5"),
    os.path.join("new_lip_model", "model", "model_weights.h5"),
    "lipnet_repo/evaluation/models/unseen-weights178.h5",
    "lipnet_repo/evaluation/models/overlapped-weights368.h5",
]
LIPNET_WEIGHTS_PATH = next((path for path in LIPNET_MODEL_CANDIDATES if os.path.exists(path)), LIPNET_MODEL_CANDIDATES[0])
FACE_LANDMARKER_PATH = "face_landmarker.task"
lip_model_available = False
try:
    if os.path.exists(LIPNET_WEIGHTS_PATH) and os.path.exists(FACE_LANDMARKER_PATH):
        lip_model_available = True
    else:
        logger.warning(f"LipNet weights or face model missing: {LIPNET_WEIGHTS_PATH}, {FACE_LANDMARKER_PATH}")
except Exception as e:
    logger.warning(f"Error checking LipNet models: {e}")

def get_gesture_engine_for_user(user_name: Optional[str] = "Sarthak") -> GestureEngine:
    clean_user = (user_name or "Sarthak").strip() or "Sarthak"
    with engines_lock:
        if clean_user not in user_engines:
            logger.info(f"Creating dedicated GestureEngine for participant: '{clean_user}'")
            eng = GestureEngine(stable_frames=6, cooldown=2.0)
            for gid, msg in custom_gesture_mappings.items():
                eng.set_custom_mapping(gid, msg)
            user_engines[clean_user] = eng
        return user_engines[clean_user]

def get_lip_reader_for_user(user_name: Optional[str] = "Sarthak") -> Optional[LipReader]:
    clean_user = (user_name or "Sarthak").strip() or "Sarthak"
    if not lip_model_available:
        return None

    is_3dcnn_model = os.path.basename(LIPNET_WEIGHTS_PATH).lower().startswith("model_weights")
    with engines_lock:
        if clean_user not in user_lip_readers:
            try:
                logger.info(f"Creating dedicated LipReader for participant: '{clean_user}'")
                reader = LipReader(
                    weight_path=LIPNET_WEIGHTS_PATH,
                    face_model_path=FACE_LANDMARKER_PATH,
                    sequence_length=22 if is_3dcnn_model else 75,
                    cooldown=1.5 if is_3dcnn_model else 2.5,
                    min_confidence=0.35 if is_3dcnn_model else 0.30,
                    step_stride=1 if is_3dcnn_model else 5,
                )
                for cid, msg in custom_lip_mappings.items():
                    reader.set_custom_mapping(cid, msg)
                user_lip_readers[clean_user] = reader
            except Exception as e:
                logger.error(f"Failed to create LipReader for {clean_user}: {e}")
                return None
        return user_lip_readers.get(clean_user)

def get_current_gesture_info(command_id: int) -> dict:
    base = DEFAULT_GESTURE_CONFIG.get(command_id, {
        "id": command_id,
        "name": f"gesture_{command_id}",
        "icon": "✋",
        "default_message": "Gesture Detected",
        "label": f"{command_id}: UNKNOWN",
    })
    msg = custom_gesture_mappings.get(command_id, base["default_message"])
    return {
        "id": base["id"],
        "name": base["name"],
        "icon": base["icon"],
        "message": msg,
        "label": base["label"],
    }

def get_current_lip_info(command_id: str) -> dict:
    base = DEFAULT_LIP_COMMANDS.get(command_id, {
        "id": command_id,
        "name": command_id,
        "icon": "👄",
        "default_message": command_id,
    })
    msg = custom_lip_mappings.get(command_id, base["default_message"])
    return {
        "id": base["id"],
        "name": base["name"],
        "icon": base["icon"],
        "message": msg,
    }

# Meeting In-Memory State
meeting_history: List[dict] = []
connected_clients: List[WebSocket] = []
server_cam_running: bool = False
server_cam_thread: Optional[threading.Thread] = None
server_cam_lock = threading.Lock()


class MappingUpdateRequest(BaseModel):
    gesture_id: int
    message: str


class LipMappingUpdateRequest(BaseModel):
    command_id: str
    message: str


class FrameAnalysisRequest(BaseModel):
    image_base64: str
    user_name: Optional[str] = "Sarthak"


class ManualTriggerRequest(BaseModel):
    gesture_id: Optional[int] = None
    lip_command: Optional[str] = None
    source: Optional[str] = "hand"
    user_name: Optional[str] = "Sarthak"


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Error sending message to client: {e}")
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)


manager = ConnectionManager()


def append_and_format_event(
    user: str,
    info: dict,
    source_type: str = "hand",
    delivery_source: str = "camera",
    confidence: Optional[float] = None
) -> dict:
    event = {
        "id": f"msg_{int(time.time() * 1000)}_{len(meeting_history)}",
        "type": "gesture_fired",
        "source": source_type, # "hand" | "lip"
        "user": user,
        "gesture_id": info["id"],
        "gesture_name": info.get("name", str(info["id"])),
        "icon": info.get("icon", "✋" if source_type == "hand" else "👄"),
        "message": info["message"],
        "confidence": confidence,
        "timestamp": datetime.now().strftime("%I:%M:%S %p"),
        "epoch": time.time(),
        "delivery_source": delivery_source,
    }
    meeting_history.append(event)
    if len(meeting_history) > 100:
        meeting_history.pop(0)
    return event


# Background thread for server-side native webcam capture (if local camera is attached)
def server_camera_worker():
    global server_cam_running
    logger.info("Starting native server camera capture worker...")
    cap = cv.VideoCapture(0)
    cap.set(cv.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv.CAP_PROP_FRAME_HEIGHT, 480)

    if not cap.isOpened():
        logger.warning("Could not open native camera index 0.")
        with server_cam_lock:
            server_cam_running = False
        return

    loop = asyncio.new_event_loop()

    try:
        while True:
            with server_cam_lock:
                if not server_cam_running:
                    break

            ret, frame = cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            frame = cv.flip(frame, 1)
            server_eng = get_gesture_engine_for_user("Sarthak")
            result = server_eng.process_frame(frame)

            # Telemetry broadcast
            telemetry = {
                "type": "telemetry",
                "hand_detected": result["hand_detected"],
                "gesture_id": result["gesture_id"],
                "gesture_info": result["gesture_info"],
                "candidate_progress": result["candidate_progress"],
                "confidence": result["confidence"],
            }
            loop.run_until_complete(manager.broadcast(telemetry))

            if result["fired"] and result["gesture_info"]:
                event = append_and_format_event("Sarthak", result["gesture_info"], source="native_cam")
                loop.run_until_complete(manager.broadcast(event))

            time.sleep(0.04)  # ~25 FPS
    except Exception as e:
        logger.error(f"Error in server camera worker: {e}")
    finally:
        cap.release()
        with server_cam_lock:
            server_cam_running = False
        loop.close()
        logger.info("Server camera worker stopped.")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Silent Meeting Assistant API",
        "active_clients": len(manager.active_connections),
        "server_camera_running": server_cam_running,
        "hand_ai_available": True,
        "lip_ai_available": lip_model_available,
    }


@app.get("/api/ai/status")
def get_ai_status():
    return {
        "hand_ai": {
            "name": "MediaPipe HandLandmarker",
            "status": "active",
            "available": True,
        },
        "lip_ai": {
            "name": "LipNet 3D-CNN + BiGRU",
            "status": "active" if lip_model_available else "unavailable",
            "available": lip_model_available,
            "weights": LIPNET_WEIGHTS_PATH,
            "face_model": FACE_LANDMARKER_PATH,
        },
    }


@app.get("/api/gestures/mappings")
def get_gesture_mappings():
    mappings = []
    for gid in sorted(DEFAULT_GESTURE_CONFIG.keys()):
        info = get_current_gesture_info(gid)
        mappings.append(info)
    return {"mappings": mappings}


@app.post("/api/gestures/mappings")
def update_gesture_mapping(payload: MappingUpdateRequest):
    if payload.gesture_id not in DEFAULT_GESTURE_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid gesture ID")
    custom_msg = payload.message.strip()
    custom_gesture_mappings[payload.gesture_id] = custom_msg
    # Update all active per-user engines
    with engines_lock:
        for eng in user_engines.values():
            eng.set_custom_mapping(payload.gesture_id, custom_msg)
    updated_info = get_current_gesture_info(payload.gesture_id)
    return {"status": "success", "updated": updated_info}


@app.get("/api/lip/mappings")
def get_lip_mappings():
    mappings = []
    for cid in sorted(DEFAULT_LIP_COMMANDS.keys()):
        info = get_current_lip_info(cid)
        mappings.append(info)
    return {"mappings": mappings}


@app.post("/api/lip/mappings")
def update_lip_mapping(payload: LipMappingUpdateRequest):
    if payload.command_id not in DEFAULT_LIP_COMMANDS:
        raise HTTPException(status_code=400, detail="Invalid Lip Command ID")
    custom_msg = payload.message.strip()
    custom_lip_mappings[payload.command_id] = custom_msg
    with engines_lock:
        for reader in user_lip_readers.values():
            reader.set_custom_mapping(payload.command_id, custom_msg)
    updated_info = get_current_lip_info(payload.command_id)
    return {"status": "success", "updated": updated_info}


@app.get("/api/meeting/history")
def get_meeting_history():
    return {"history": meeting_history}


@app.post("/api/meeting/clear")
def clear_history():
    global meeting_history
    meeting_history = []
    return {"status": "success", "message": "History cleared"}


@app.post("/api/detect_frame")
async def detect_frame(payload: FrameAnalysisRequest):
    """
    Process a video frame uploaded from the frontend browser webcam.
    Executes MediaPipe Hand Engine AND LipNet Reader simultaneously
    without requiring multiple camera captures.
    """
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(raw_b64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv.imdecode(np_arr, cv.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode frame")

        user_name = (payload.user_name or "Sarthak").strip() or "Sarthak"

        # 1. Process Hand Gesture
        user_engine = get_gesture_engine_for_user(user_name)
        hand_result = user_engine.process_frame(frame)

        hand_event = None
        if hand_result["fired"] and hand_result["gesture_info"]:
            hand_event = append_and_format_event(
                user_name,
                hand_result["gesture_info"],
                source_type="hand",
                delivery_source="browser_cam",
                confidence=hand_result.get("confidence"),
            )
            await manager.broadcast(hand_event)

        # 2. Process Lip Reading (independent, tolerant to failure)
        lip_result = {
            "face_detected": False,
            "buffer_length": 0,
            "buffer_progress": 0.0,
            "raw_prediction": "",
            "confidence": 0.0,
            "command_info": None,
            "fired": False,
        }
        lip_event = None
        user_lip = get_lip_reader_for_user(user_name)
        if user_lip is not None:
            try:
                lip_result = user_lip.process_frame(frame)
                if lip_result["fired"] and lip_result["command_info"]:
                    lip_event = append_and_format_event(
                        user_name,
                        lip_result["command_info"],
                        source_type="lip",
                        delivery_source="browser_cam",
                        confidence=lip_result.get("confidence"),
                    )
                    await manager.broadcast(lip_event)
            except Exception as e:
                logger.error(f"LipReader processing error: {e}")

        return {
            # Hand Telemetry
            "hand_detected": hand_result["hand_detected"],
            "gesture_id": hand_result["gesture_id"],
            "gesture_info": hand_result["gesture_info"],
            "candidate_progress": hand_result["candidate_progress"],
            "fired": hand_result["fired"],
            "event": hand_event,

            # Lip Telemetry
            "lip_detected": lip_result["face_detected"],
            "lip_buffer_progress": lip_result["buffer_progress"],
            "lip_raw_prediction": lip_result["raw_prediction"],
            "lip_confidence": lip_result["confidence"],
            "lip_command_info": lip_result["command_info"],
            "lip_fired": lip_result["fired"],
            "lip_event": lip_event,
            "lip_available": lip_model_available,
        }
    except Exception as e:
        logger.error(f"Error analyzing frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/trigger_gesture")
async def trigger_gesture(payload: ManualTriggerRequest):
    """Manual trigger endpoint for testing or instant reaction trigger for either hand or lip."""
    user_name = (payload.user_name or "Sarthak").strip() or "Sarthak"

    if payload.source == "lip" or payload.lip_command:
        cmd_id = payload.lip_command or "AGREE"
        if cmd_id not in DEFAULT_LIP_COMMANDS:
            raise HTTPException(status_code=400, detail="Invalid Lip Command ID")
        info = get_current_lip_info(cmd_id)
        event = append_and_format_event(
            user_name,
            info,
            source_type="lip",
            delivery_source="manual",
            confidence=0.95,
        )
        await manager.broadcast(event)
        return {"status": "success", "event": event}

    # Default Hand Trigger
    gid = payload.gesture_id if payload.gesture_id is not None else 0
    if gid not in DEFAULT_GESTURE_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid gesture ID")

    info = get_current_gesture_info(gid)
    event = append_and_format_event(
        user_name,
        info,
        source_type="hand",
        delivery_source="manual",
        confidence=0.95,
    )
    await manager.broadcast(event)
    return {"status": "success", "event": event}


@app.post("/api/camera/toggle")
def toggle_server_camera():
    global server_cam_running, server_cam_thread
    with server_cam_lock:
        if server_cam_running:
            server_cam_running = False
            return {"status": "stopped", "running": False}
        else:
            server_cam_running = True
            server_cam_thread = threading.Thread(target=server_camera_worker, daemon=True)
            server_cam_thread.start()
            return {"status": "started", "running": True}


# Meeting Signaling State (In-Memory Room Management for WebRTC)
class RoomManager:
    def __init__(self):
        # room_id -> { peer_id: { "name": str, "ws": WebSocket, "camera": bool, "mic": bool } }
        self.rooms: Dict[str, Dict[str, dict]] = {}

    def get_room_peers(self, room_id: str) -> List[dict]:
        if room_id not in self.rooms:
            return []
        return [
            {
                "peer_id": pid,
                "name": data["name"],
                "camera": data.get("camera", True),
                "mic": data.get("mic", True),
            }
            for pid, data in self.rooms[room_id].items()
        ]

    async def add_peer(self, room_id: str, peer_id: str, name: str, websocket: WebSocket) -> bool:
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        # Limit room to 2 participants for MVP
        if len(self.rooms[room_id]) >= 2:
            return False

        self.rooms[room_id][peer_id] = {
            "name": name,
            "ws": websocket,
            "camera": True,
            "mic": True,
        }
        logger.info(f"Peer {peer_id} ({name}) joined room {room_id}. Total in room: {len(self.rooms[room_id])}")
        return True

    async def remove_peer(self, room_id: str, peer_id: str) -> Optional[dict]:
        if room_id in self.rooms and peer_id in self.rooms[room_id]:
            removed_info = self.rooms[room_id].pop(peer_id)
            logger.info(f"Peer {peer_id} left room {room_id}. Remaining: {len(self.rooms[room_id])}")
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            return removed_info
        return None

    async def send_to_peer(self, room_id: str, target_peer_id: str, message: dict):
        if room_id in self.rooms and target_peer_id in self.rooms[room_id]:
            ws = self.rooms[room_id][target_peer_id]["ws"]
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed sending to peer {target_peer_id}: {e}")

    async def broadcast_to_others(self, room_id: str, sender_peer_id: str, message: dict):
        if room_id not in self.rooms:
            return
        for pid, data in list(self.rooms[room_id].items()):
            if pid != sender_peer_id:
                try:
                    await data["ws"].send_json(message)
                except Exception as e:
                    logger.warning(f"Failed broadcasting to peer {pid}: {e}")


room_manager = RoomManager()


@app.get("/api/rooms/{room_id}")
def get_room_info(room_id: str):
    peers = room_manager.get_room_peers(room_id)
    return {
        "room_id": room_id,
        "count": len(peers),
        "peers": peers,
        "is_full": len(peers) >= 2,
    }


@app.websocket("/ws/meeting/{room_id}/{peer_id}")
async def meeting_signaling_endpoint(websocket: WebSocket, room_id: str, peer_id: str):
    await websocket.accept()
    client_name = "Guest"

    try:
        # First message expected is join
        init_data = await websocket.receive_text()
        parsed_init = json.loads(init_data)
        if parsed_init.get("type") == "join":
            client_name = parsed_init.get("name", "Guest").strip() or "Guest"
        
        joined = await room_manager.add_peer(room_id, peer_id, client_name, websocket)
        if not joined:
            await websocket.send_json({
                "type": "room_full",
                "message": f"Room {room_id} is already full (maximum 2 participants).",
            })
            await websocket.close()
            return

        # Notify joining client of current room state
        current_peers = room_manager.get_room_peers(room_id)
        other_peers = [p for p in current_peers if p["peer_id"] != peer_id]

        await websocket.send_json({
            "type": "room_joined",
            "room_id": room_id,
            "peer_id": peer_id,
            "name": client_name,
            "is_initiator": len(other_peers) > 0, # If someone was already here, joiner initiates connection
            "peers": other_peers,
        })

        # Notify existing peers that a new participant joined
        await room_manager.broadcast_to_others(
            room_id,
            peer_id,
            {
                "type": "participant_joined",
                "peer_id": peer_id,
                "name": client_name,
                "camera": True,
                "mic": True,
            },
        )

        while True:
            text = await websocket.receive_text()
            msg = json.loads(text)
            msg_type = msg.get("type")
            target_id = msg.get("target")

            if msg_type == "offer":
                # Forward SDP offer to target peer
                await room_manager.send_to_peer(
                    room_id,
                    target_id,
                    {
                        "type": "offer",
                        "sender": peer_id,
                        "name": client_name,
                        "offer": msg.get("offer"),
                    },
                )
            elif msg_type == "answer":
                # Forward SDP answer to target peer
                await room_manager.send_to_peer(
                    room_id,
                    target_id,
                    {
                        "type": "answer",
                        "sender": peer_id,
                        "name": client_name,
                        "answer": msg.get("answer"),
                    },
                )
            elif msg_type == "ice_candidate":
                # Forward ICE candidate to target peer
                await room_manager.send_to_peer(
                    room_id,
                    target_id,
                    {
                        "type": "ice_candidate",
                        "sender": peer_id,
                        "candidate": msg.get("candidate"),
                    },
                )
            elif msg_type == "track_state":
                # Broadcast camera / mic toggle state
                cam = msg.get("camera")
                mic = msg.get("mic")
                if room_id in room_manager.rooms and peer_id in room_manager.rooms[room_id]:
                    if cam is not None:
                        room_manager.rooms[room_id][peer_id]["camera"] = cam
                    if mic is not None:
                        room_manager.rooms[room_id][peer_id]["mic"] = mic
                await room_manager.broadcast_to_others(
                    room_id,
                    peer_id,
                    {
                        "type": "track_state",
                        "peer_id": peer_id,
                        "camera": cam,
                        "mic": mic,
                    },
                )
            elif msg_type == "leave":
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"Signaling WS error: {e}")
    finally:
        await room_manager.remove_peer(room_id, peer_id)
        await room_manager.broadcast_to_others(
            room_id,
            peer_id,
            {
                "type": "participant_left",
                "peer_id": peer_id,
                "name": client_name,
            },
        )


@app.websocket("/ws/gestures")
async def websocket_gestures_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # Send initial mappings & recent history upon connection
    mappings = [get_current_gesture_info(gid) for gid in sorted(DEFAULT_GESTURE_CONFIG.keys())]
    lip_mappings = [get_current_lip_info(cid) for cid in sorted(DEFAULT_LIP_COMMANDS.keys())]
    await websocket.send_json({
        "type": "init",
        "mappings": mappings,
        "lip_mappings": lip_mappings,
        "history": meeting_history[-20:],
        "hand_ai_available": True,
        "lip_ai_available": lip_model_available,
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                if parsed.get("type") == "client_ping":
                    await websocket.send_json({"type": "pong", "time": time.time()})
                elif parsed.get("type") == "trigger_gesture":
                    source = parsed.get("source", "hand")
                    user = parsed.get("user", "Sarthak")
                    if source == "lip" or parsed.get("lip_command"):
                        cid = parsed.get("lip_command", "AGREE")
                        if cid in DEFAULT_LIP_COMMANDS:
                            info = get_current_lip_info(cid)
                            event = append_and_format_event(
                                user, info, source_type="lip", delivery_source="client_ws", confidence=0.95
                            )
                            await manager.broadcast(event)
                    else:
                        gid = parsed.get("gesture_id")
                        if gid in DEFAULT_GESTURE_CONFIG:
                            info = get_current_gesture_info(gid)
                            event = append_and_format_event(
                                user, info, source_type="hand", delivery_source="client_ws", confidence=0.95
                            )
                            await manager.broadcast(event)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)

