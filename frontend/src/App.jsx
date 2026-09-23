import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { VideoStage } from './components/VideoStage';
import { SilentSidebar } from './components/SilentSidebar';
import { ControlBar } from './components/ControlBar';
import { SettingsModal } from './components/SettingsModal';
import { GuideModal } from './components/GuideModal';
import { JoinModal } from './components/JoinModal';
import {
  createPeerConnection,
  addTracksToPeer,
  closePeerConnection,
} from './utils/webrtc';

// Compute dynamic host so two devices on the same Wi-Fi / LAN connect to the correct machine
const currentHost = window.location.hostname || 'localhost';
const BACKEND_WS_URL = `ws://${currentHost}:8000/ws/gestures`;
const BACKEND_API_BASE = `http://${currentHost}:8000/api`;
const BACKEND_SIGNALING_BASE = `ws://${currentHost}:8000/ws/meeting`;

export function App() {
  // Room State
  const [inMeeting, setInMeeting] = useState(false);
  const [userName, setUserName] = useState('Sarthak');
  const [roomId, setRoomId] = useState('CODE26');
  const [peerId] = useState(() => 'peer_' + Math.random().toString(36).substring(2, 9));

  // Media State
  const [userStream, setUserStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // WebRTC Peer State
  const [remotePeer, setRemotePeer] = useState(null);
  // remotePeer: { peer_id, name, stream, camera: true, mic: true, recentGesture: null }
  const [webrtcState, setWebrtcState] = useState('waiting'); // 'waiting' | 'connecting' | 'connected' | 'disconnected'

  // UI State
  const [showSidebar, setShowSidebar] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [duration, setDuration] = useState('00:00:00');
  const [serverConnected, setServerConnected] = useState(false);

  // Gesture & Lip Engine State
  const [mappings, setMappings] = useState([]);
  const [lipMappings, setLipMappings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [latestBanner, setLatestBanner] = useState(null);
  const [simulatedEnabled, setSimulatedEnabled] = useState(false);

  // References
  const gestureWsRef = useRef(null);
  const signalingWsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remotePeerRef = useRef(null);
  const offscreenCanvasRef = useRef(document.createElement('canvas'));
  const frameIntervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const bannerTimerRef = useRef(null);
  const userStreamRef = useRef(null);

  // Keep userStreamRef in sync
  useEffect(() => {
    userStreamRef.current = userStream;
  }, [userStream]);

  // Keep remotePeerRef in sync
  useEffect(() => {
    remotePeerRef.current = remotePeer;
  }, [remotePeer]);

  // 1. Chime effect on receiving a silent gesture
  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio context may require user interaction first
    }
  }, []);

  // 2. Gesture WebSocket (for MediaPipe AI telemetry, mappings & silent feed)
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    function connectGestures() {
      ws = new WebSocket(BACKEND_WS_URL);
      gestureWsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to SilentMeet Gestures WebSocket');
        setServerConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'init') {
            if (data.mappings) setMappings(data.mappings);
            if (data.lip_mappings) setLipMappings(data.lip_mappings);
            if (data.history) setMessages(data.history);
          } else if (data.type === 'telemetry') {
            setTelemetry(data);
          } else if (data.type === 'gesture_fired') {
            setMessages((prev) => [data, ...prev]);
            playChime();

            // Trigger visual banner
            setLatestBanner(data);
            if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
            bannerTimerRef.current = setTimeout(() => setLatestBanner(null), 3500);

            // Confetti for positive reactions
            if (data.gesture_id === 0 || data.gesture_id === 6 || data.gesture_id === 'AGREE') {
              confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
            }

            // If gesture is from remote peer, show badge on remote peer tile
            const cleanSender = (data.user || '').trim().toLowerCase();
            const cleanLocalUser = (userName || '').trim().toLowerCase();
            const isFromOtherParticipant = cleanSender !== cleanLocalUser;

            if (isFromOtherParticipant) {
              setRemotePeer((prev) => (prev ? { ...prev, recentGesture: data } : null));
              setTimeout(() => {
                setRemotePeer((prev) => (prev ? { ...prev, recentGesture: null } : null));
              }, 4500);
            }
          }
        } catch (e) {
          console.error('Error handling WS message:', e);
        }
      };

      ws.onclose = () => {
        setServerConnected(false);
        reconnectTimeout = setTimeout(connectGestures, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectGestures();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [playChime]);

  // 3. WebRTC Signaling Connection & Peer Management
  useEffect(() => {
    if (!inMeeting || !roomId || !peerId) return;

    let signalingWs = null;
    let pendingCandidates = [];

    const setupPeerConnection = (targetPeerId, targetName) => {
      if (peerConnectionRef.current) {
        closePeerConnection(peerConnectionRef.current);
      }

      setWebrtcState('connecting');

      const pc = createPeerConnection({
        onTrack: (remoteStream) => {
          console.log('Received remote track/stream:', remoteStream);
          setRemotePeer((prev) => ({
            peer_id: targetPeerId,
            name: targetName || prev?.name || 'Remote Peer',
            camera: prev?.camera ?? true,
            mic: prev?.mic ?? true,
            recentGesture: prev?.recentGesture ?? null,
            stream: remoteStream,
          }));
          setWebrtcState('connected');
        },
        onIceCandidate: (candidate) => {
          if (signalingWs && signalingWs.readyState === WebSocket.OPEN) {
            signalingWs.send(
              JSON.stringify({
                type: 'ice_candidate',
                target: targetPeerId,
                candidate,
              })
            );
          }
        },
        onConnectionStateChange: (state) => {
          console.log('WebRTC Connection State changed:', state);
          if (state === 'connected') {
            setWebrtcState('connected');
          } else if (state === 'disconnected' || state === 'failed') {
            setWebrtcState('waiting');
            setRemotePeer(null);
          }
        },
      });

      // Add local audio and video tracks
      if (userStreamRef.current) {
        addTracksToPeer(pc, userStreamRef.current);
      }

      peerConnectionRef.current = pc;
      return pc;
    };

    const signalingUrl = `${BACKEND_SIGNALING_BASE}/${roomId}/${peerId}`;
    signalingWs = new WebSocket(signalingUrl);
    signalingWsRef.current = signalingWs;

    signalingWs.onopen = () => {
      console.log('Connected to Meeting Signaling WebSocket:', signalingUrl);
      signalingWs.send(
        JSON.stringify({
          type: 'join',
          name: userName,
        })
      );
    };

    signalingWs.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Signaling message received:', data.type);

        if (data.type === 'room_joined') {
          // If other peers already in room, initiate call to the first peer
          if (data.peers && data.peers.length > 0) {
            const firstPeer = data.peers[0];
            setRemotePeer({
              peer_id: firstPeer.peer_id,
              name: firstPeer.name,
              camera: firstPeer.camera ?? true,
              mic: firstPeer.mic ?? true,
              recentGesture: null,
              stream: null,
            });

            const pc = setupPeerConnection(firstPeer.peer_id, firstPeer.name);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            signalingWs.send(
              JSON.stringify({
                type: 'offer',
                target: firstPeer.peer_id,
                offer,
              })
            );
          } else {
            setWebrtcState('waiting');
          }
        } else if (data.type === 'participant_joined') {
          setRemotePeer({
            peer_id: data.peer_id,
            name: data.name,
            camera: data.camera ?? true,
            mic: data.mic ?? true,
            recentGesture: null,
            stream: null,
          });
          setWebrtcState('connecting');
        } else if (data.type === 'offer') {
          const pc = setupPeerConnection(data.sender, data.name);
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

          // Process queued ICE candidates if any
          for (const cand of pendingCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidates = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          signalingWs.send(
            JSON.stringify({
              type: 'answer',
              target: data.sender,
              answer,
            })
          );
        } else if (data.type === 'answer') {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            for (const cand of pendingCandidates) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
            }
            pendingCandidates = [];
          }
        } else if (data.type === 'ice_candidate') {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            } catch (err) {
              console.warn('Error adding ICE candidate:', err);
            }
          } else {
            pendingCandidates.push(data.candidate);
          }
        } else if (data.type === 'track_state') {
          setRemotePeer((prev) => {
            if (!prev || prev.peer_id !== data.peer_id) return prev;
            return {
              ...prev,
              camera: data.camera !== undefined ? data.camera : prev.camera,
              mic: data.mic !== undefined ? data.mic : prev.mic,
            };
          });
        } else if (data.type === 'participant_left') {
          console.log('Participant left:', data.name);
          closePeerConnection(peerConnectionRef.current);
          peerConnectionRef.current = null;
          setRemotePeer(null);
          setWebrtcState('waiting');
        } else if (data.type === 'room_full') {
          alert(data.message || 'Room is already full.');
          handleLeaveMeeting();
        }
      } catch (err) {
        console.error('Signaling message error:', err);
      }
    };

    signalingWs.onclose = () => {
      console.log('Meeting Signaling WebSocket closed');
    };

    return () => {
      if (signalingWs) {
        try {
          signalingWs.send(JSON.stringify({ type: 'leave' }));
        } catch (e) {
          // ignore
        }
        signalingWs.close();
      }
      if (peerConnectionRef.current) {
        closePeerConnection(peerConnectionRef.current);
        peerConnectionRef.current = null;
      }
    };
  }, [inMeeting, roomId, peerId, userName]);

  // 4. Start Local Media on Room Entry
  const handleJoinMeeting = async ({ name, roomId: selectedRoom }) => {
    setUserName(name);
    setRoomId(selectedRoom);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
      });

      // Initially microphone is muted to prevent echo/feedback
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      setIsMicOn(false);
      setIsCameraOn(true);

      setUserStream(stream);
      userStreamRef.current = stream;
      setInMeeting(true);
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error('Camera/Microphone access error:', err);
      alert(
        'Could not access camera or microphone. Please ensure permissions are allowed.'
      );
    }
  };

  // 5. Leave Meeting
  const handleLeaveMeeting = useCallback(() => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((t) => t.stop());
      setUserStream(null);
      userStreamRef.current = null;
    }
    if (signalingWsRef.current && signalingWsRef.current.readyState === WebSocket.OPEN) {
      try {
        signalingWsRef.current.send(JSON.stringify({ type: 'leave' }));
      } catch (e) {
        // ignore
      }
      signalingWsRef.current.close();
    }
    if (peerConnectionRef.current) {
      closePeerConnection(peerConnectionRef.current);
      peerConnectionRef.current = null;
    }
    setRemotePeer(null);
    setWebrtcState('waiting');
    setInMeeting(false);
  }, []);

  // 6. Camera Toggle
  const toggleCamera = useCallback(() => {
    if (userStream) {
      const videoTrack = userStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newState = videoTrack.enabled;
        setIsCameraOn(newState);

        // Broadcast camera state via signaling
        if (signalingWsRef.current && signalingWsRef.current.readyState === WebSocket.OPEN) {
          signalingWsRef.current.send(
            JSON.stringify({
              type: 'track_state',
              camera: newState,
            })
          );
        }
      }
    } else {
      setIsCameraOn((prev) => !prev);
    }
  }, [userStream]);

  // 7. Mic Toggle
  const toggleMic = useCallback(() => {
    if (userStream) {
      const audioTrack = userStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newState = audioTrack.enabled;
        setIsMicOn(newState);

        // Broadcast mic state via signaling
        if (signalingWsRef.current && signalingWsRef.current.readyState === WebSocket.OPEN) {
          signalingWsRef.current.send(
            JSON.stringify({
              type: 'track_state',
              mic: newState,
            })
          );
        }
      }
    } else {
      setIsMicOn((prev) => !prev);
    }
  }, [userStream]);

  // 8. Meeting Duration Timer
  useEffect(() => {
    if (!inMeeting) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      setDuration(`${hours}:${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [inMeeting]);

  // 9. Client Video Frame Analyzer Loop (MediaPipe continuous detection)
  useEffect(() => {
    if (!inMeeting || !isCameraOn || !userStream) return;

    const videoTrack = userStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const hiddenVideo = document.createElement('video');
    hiddenVideo.srcObject = userStream;
    hiddenVideo.play();

    const canvas = offscreenCanvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    let isProcessing = false;

    frameIntervalRef.current = setInterval(async () => {
      if (isProcessing || hiddenVideo.readyState < 2) return;
      isProcessing = true;

      try {
        ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.6);

        const res = await fetch(`${BACKEND_API_BASE}/detect_frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64Image,
            user_name: userName,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          setTelemetry({
            hand_detected: result.hand_detected,
            gesture_id: result.gesture_id,
            gesture_info: result.gesture_info,
            candidate_progress: result.candidate_progress,
            lip_detected: result.lip_detected,
            lip_buffer_progress: result.lip_buffer_progress,
            lip_raw_prediction: result.lip_raw_prediction,
            lip_confidence: result.lip_confidence,
            lip_command_info: result.lip_command_info,
            lip_available: result.lip_available,
          });
        }
      } catch (err) {
        // Suppress continuous network catch
      } finally {
        isProcessing = false;
      }
    }, 150); // ~7 FPS continuous frame analysis for responsive gestures

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      hiddenVideo.pause();
      hiddenVideo.srcObject = null;
    };
  }, [inMeeting, isCameraOn, userStream, userName]);

  // 10. Manual Gesture / Lip Trigger
  const handleSimulateGesture = async (id, source = 'hand') => {
    try {
      const payload = { user_name: userName, source };
      if (source === 'lip') {
        payload.lip_command = id;
      } else {
        payload.gesture_id = id;
      }
      await fetch(`${BACKEND_API_BASE}/trigger_gesture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Trigger gesture error:', err);
    }
  };

  // 11. Update Custom Gesture Mapping
  const handleUpdateMapping = async (gestureId, newMsg) => {
    try {
      const res = await fetch(`${BACKEND_API_BASE}/gestures/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gesture_id: gestureId, message: newMsg }),
      });
      if (res.ok) {
        setMappings((prev) =>
          prev.map((m) => (m.id === gestureId ? { ...m, message: newMsg } : m))
        );
      }
    } catch (err) {
      console.error('Update mapping error:', err);
    }
  };

  // 11b. Update Custom Lip Command Mapping
  const handleUpdateLipMapping = async (cmdId, newMsg) => {
    try {
      const res = await fetch(`${BACKEND_API_BASE}/lip/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command_id: cmdId, message: newMsg }),
      });
      if (res.ok) {
        setLipMappings((prev) =>
          prev.map((m) => (m.id === cmdId ? { ...m, message: newMsg } : m))
        );
      }
    } catch (err) {
      console.error('Update lip mapping error:', err);
    }
  };

  // 12. Clear History
  const handleClearHistory = async () => {
    try {
      await fetch(`${BACKEND_API_BASE}/meeting/clear`, { method: 'POST' });
      setMessages([]);
    } catch (err) {
      console.error('Clear history error:', err);
    }
  };

  // Participant count: Local (1) + Remote Peer (1 if present)
  const participantCount = inMeeting ? (remotePeer ? 2 : 1) : 0;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 select-none">
      {/* Join Screen Modal if not yet entered */}
      {!inMeeting && (
        <JoinModal
          onJoin={handleJoinMeeting}
          defaultName={userName}
          defaultRoom={roomId}
        />
      )}

      {/* Top Navigation Bar */}
      <Header
        meetingId={roomId}
        participantCount={participantCount}
        duration={duration}
        serverConnected={serverConnected}
        webrtcState={webrtcState}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Video & Sidebar Stage */}
      <div className="flex-1 flex min-h-0 relative">
        <VideoStage
          userStream={userStream}
          isCameraOn={isCameraOn}
          isMicOn={isMicOn}
          currentTelemetry={telemetry}
          userName={userName}
          remotePeer={remotePeer}
          latestGestureBanner={latestBanner}
          roomId={roomId}
        />

        {showSidebar && (
          <SilentSidebar
            messages={messages}
            userName={userName}
            onClearHistory={handleClearHistory}
            onSimulateGesture={handleSimulateGesture}
            simulatedEnabled={simulatedEnabled}
            onToggleSimulated={() => setSimulatedEnabled((p) => !p)}
          />
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <ControlBar
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        isHandRaised={isHandRaised}
        showSidebar={showSidebar}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={() => setIsScreenSharing((p) => !p)}
        onToggleRaiseHand={() => setIsHandRaised((p) => !p)}
        onToggleSidebar={() => setShowSidebar((p) => !p)}
        onToggleParticipants={() => setShowSidebar(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLeaveMeeting={handleLeaveMeeting}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mappings={mappings}
        lipMappings={lipMappings}
        onUpdateMapping={handleUpdateMapping}
        onUpdateLipMapping={handleUpdateLipMapping}
      />

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        mappings={mappings}
        lipMappings={lipMappings}
      />
    </div>
  );
}

export default App;

