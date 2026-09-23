import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  Users,
  MessageSquare,
  SlidersHorizontal,
  PhoneOff,
  Sparkles,
} from 'lucide-react';

export const ControlBar = ({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isHandRaised,
  showSidebar,
  showParticipantsModal,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleRaiseHand,
  onToggleSidebar,
  onToggleParticipants,
  onOpenSettings,
  onLeaveMeeting,
}) => {
  return (
    <div className="h-20 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 px-6 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left Info / Live Mode */}
      <div className="hidden sm:flex items-center space-x-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
          <span className="font-medium text-[11px] text-slate-200">Continuous AI Vision Active</span>
        </div>
      </div>

      {/* Main Center Controls Pill */}
      <div className="flex items-center space-x-2.5 mx-auto">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-lg cursor-pointer ${
            isMicOn
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
          }`}
          title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-lg cursor-pointer ${
            isCameraOn
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
          }`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-lg cursor-pointer ${
            isScreenSharing
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isScreenSharing ? 'Stop Presenting' : 'Share Screen'}
        >
          <MonitorUp className="w-5 h-5" />
        </button>

        {/* Raise Hand Toggle */}
        <button
          onClick={onToggleRaiseHand}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-lg cursor-pointer ${
            isHandRaised
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Custom Gesture Mappings */}
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition shadow-lg cursor-pointer"
          title="Gesture Mapping Settings"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>

        {/* Leave Meeting (End Call) */}
        <button
          onClick={onLeaveMeeting}
          className="px-5 h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer ml-2"
          title="Leave Meeting"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="text-xs font-semibold">Leave</span>
        </button>
      </div>

      {/* Right Panels Toggle */}
      <div className="hidden sm:flex items-center space-x-2">
        <button
          onClick={onToggleParticipants}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          title="Participants"
        >
          <Users className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleSidebar}
          className={`p-2.5 rounded-xl border transition cursor-pointer ${
            showSidebar
              ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
          }`}
          title="Toggle Silent Feed"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
