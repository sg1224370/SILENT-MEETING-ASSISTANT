import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Sparkles, Volume2, UserPlus } from 'lucide-react';

export const VideoStage = ({
  userStream,
  isCameraOn,
  isMicOn,
  currentTelemetry,
  userName = 'Sarthak',
  remotePeer = null, // { peer_id, name, stream, camera, mic, recentGesture }
  activeSpeaker = '',
  latestGestureBanner = null,
  roomId = '',
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Bind local webcam stream
  useEffect(() => {
    if (localVideoRef.current && userStream) {
      localVideoRef.current.srcObject = userStream;
    }
  }, [userStream, isCameraOn]);

  // Bind remote peer stream
  useEffect(() => {
    if (remoteVideoRef.current && remotePeer && remotePeer.stream) {
      remoteVideoRef.current.srcObject = remotePeer.stream;
    }
    if (remoteAudioRef.current && remotePeer && remotePeer.stream) {
      remoteAudioRef.current.srcObject = remotePeer.stream;
    }
  }, [remotePeer, remotePeer?.stream]);

  const hasRemotePeer = Boolean(remotePeer);

  return (
    <div className="flex-1 p-3 bg-slate-950 flex flex-col gap-3 min-h-0 overflow-hidden select-none">
      {/* Hidden audio element to guarantee remote audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Primary Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 min-h-0">
        
        {/* Local User Tile (Active Hand Detection Camera) */}
        <div className="relative bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl flex flex-col items-center justify-center group">
          {isCameraOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20 mb-3">
                {userName.charAt(0).toUpperCase()}
              </div>
              <p className="text-slate-200 font-semibold">{userName} (You)</p>
              <p className="text-xs text-slate-500 mt-1">Camera is switched off</p>
            </div>
          )}

          {/* Hand Detection HUD Overlay */}
          {isCameraOn && currentTelemetry && currentTelemetry.hand_detected && (
            <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs shadow-lg transition-all animate-slide-in">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hand Active</span>
              </div>
              {currentTelemetry.gesture_info && (
                <div className="flex items-center gap-1 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30 text-white font-medium">
                  <span>{currentTelemetry.gesture_info.icon}</span>
                  <span className="text-[11px]">{currentTelemetry.gesture_info.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Lip Reading HUD Overlay */}
          {isCameraOn && currentTelemetry && currentTelemetry.lip_detected && (
            <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md border border-pink-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs shadow-lg transition-all animate-slide-in">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></span>
              <div className="flex items-center gap-1.5 text-pink-300 font-medium">
                <span>👄</span>
                <span>Lip Tracking</span>
              </div>
              {currentTelemetry.lip_command_info && (
                <div className="flex items-center gap-1 bg-pink-950/80 px-2 py-0.5 rounded border border-pink-500/30 text-white font-medium">
                  <span className="text-[11px]">{currentTelemetry.lip_command_info.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Progress Bar (Hand hold progress or Lip buffer progress) */}
          {isCameraOn && currentTelemetry && (currentTelemetry.candidate_progress > 0 || currentTelemetry.lip_buffer_progress > 0) && (
            <div className="absolute bottom-12 left-4 right-4 bg-slate-950/70 backdrop-blur-sm rounded-full h-1.5 overflow-hidden border border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-pink-500 transition-all duration-75"
                style={{
                  width: `${Math.round(
                    Math.max(
                      currentTelemetry.candidate_progress || 0,
                      currentTelemetry.lip_buffer_progress || 0
                    ) * 100
                  )}%`
                }}
              />
            </div>
          )}

          {/* Live Confirmed Floating Banner */}
          {latestGestureBanner && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 backdrop-blur-lg border border-indigo-500/50 rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-slide-in pointer-events-none z-20">
              <div className="text-3xl p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                {latestGestureBanner.icon || (latestGestureBanner.source === 'lip' ? '👄' : '✋')}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wider">
                    {latestGestureBanner.source === 'lip' ? '👄 Lip Reading' : '✋ Hand Gesture'} • {latestGestureBanner.user || 'Participant'}
                  </p>
                  {(latestGestureBanner.user || '').trim().toLowerCase() === userName.trim().toLowerCase() && (
                    <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1 rounded">
                      You
                    </span>
                  )}
                </div>
                <p className="text-base font-bold text-white">"{latestGestureBanner.message}"</p>
              </div>
            </div>
          )}

          {/* User Status Bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
            <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-slate-200">
              <span className="font-semibold">{userName} (You)</span>
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1 rounded">Local</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800">
              {isMicOn ? (
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-rose-400" />
              )}
              {isCameraOn ? (
                <Video className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <VideoOff className="w-3.5 h-3.5 text-rose-400" />
              )}
            </div>
          </div>
        </div>

        {/* Remote Participant Tile */}
        {hasRemotePeer ? (
          <div className="relative bg-slate-900/90 rounded-2xl border border-slate-800 transition-all duration-300 overflow-hidden shadow-lg flex flex-col items-center justify-center">
            {remotePeer.camera && remotePeer.stream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-cyan-700 flex items-center justify-center text-white text-2xl font-bold shadow-xl mb-3">
                  {remotePeer.name.charAt(0).toUpperCase()}
                </div>
                <p className="text-slate-200 font-semibold">{remotePeer.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {!remotePeer.camera ? 'Camera is switched off' : 'Connecting stream...'}
                </p>
              </div>
            )}

            {/* Remote Peer Floating Gesture Badge if active */}
            {remotePeer.recentGesture && (
              <div className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur-md border border-indigo-500/40 rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-xs shadow-xl animate-slide-in">
                <span className="text-lg">{remotePeer.recentGesture.icon}</span>
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 leading-tight">Silent Response</p>
                  <p className="text-xs font-semibold text-white leading-tight">
                    {remotePeer.recentGesture.message}
                  </p>
                </div>
              </div>
            )}

            {/* Remote Peer Info Bar */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
              <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-slate-200">
                <span className="font-semibold">{remotePeer.name}</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                  REAL PEER
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800">
                {remotePeer.mic ? (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                {remotePeer.camera ? (
                  <Video className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <VideoOff className="w-3.5 h-3.5 text-rose-400" />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Waiting for second participant card */
          <div className="relative bg-slate-900/60 rounded-2xl border border-dashed border-slate-800 overflow-hidden shadow-inner flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
              <UserPlus className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Waiting for Participant...</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Open another browser or device, enter the same Room ID to join this call.
            </p>
            <div className="mt-4 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/60 text-xs font-mono text-cyan-400 font-bold">
              Room ID: {roomId || 'CODE26'}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

