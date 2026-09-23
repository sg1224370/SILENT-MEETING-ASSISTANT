import React, { useState } from 'react';
import { ShieldCheck, Users, Radio, SlidersHorizontal, HelpCircle, Copy, Check } from 'lucide-react';

export const Header = ({
  meetingId = 'CODE26',
  participantCount = 1,
  duration = '00:00:00',
  serverConnected = false,
  webrtcState = 'disconnected', // 'connected' | 'connecting' | 'waiting' | 'disconnected'
  onOpenSettings,
  onOpenGuide,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyRoom = () => {
    navigator.clipboard?.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (webrtcState) {
      case 'connected':
        return {
          color: 'text-emerald-400',
          dot: 'bg-emerald-500',
          label: 'Connected',
        };
      case 'connecting':
        return {
          color: 'text-amber-400',
          dot: 'bg-amber-400 animate-ping',
          label: 'Connecting P2P...',
        };
      case 'waiting':
        return {
          color: 'text-cyan-400',
          dot: 'bg-cyan-400 animate-pulse',
          label: 'Waiting for Peer',
        };
      default:
        return {
          color: 'text-slate-400',
          dot: 'bg-slate-500',
          label: 'Standby',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Product Identity */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-md shadow-indigo-500/20">
          <span className="text-lg">✋</span>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              SilentMeet
              <span className="text-[10px] uppercase font-semibold tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">
                WebRTC Call
              </span>
            </h1>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <button
              onClick={handleCopyRoom}
              className="flex items-center gap-1 font-mono text-slate-300 font-semibold hover:text-white bg-slate-800/60 hover:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 transition cursor-pointer"
              title="Click to copy Room ID"
            >
              <span>{meetingId}</span>
              {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5 text-slate-400" />}
            </button>
            <span>•</span>
            <span className="flex items-center text-emerald-400 gap-1">
              <ShieldCheck className="w-3 h-3" /> P2P WebRTC
            </span>
          </div>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="hidden md:flex items-center space-x-3 bg-slate-950/60 border border-slate-800/80 rounded-full px-4 py-1.5 text-xs text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-mono font-medium text-slate-200">{duration}</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
          <span className={`font-medium ${status.color}`}>{status.label}</span>
        </div>
        <span className="text-slate-600">|</span>
        {/* Hand AI Pill */}
        <div className="flex items-center gap-1 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="font-medium text-[11px]">Hand AI</span>
        </div>
        {/* Lip AI Pill */}
        <div className="flex items-center gap-1 text-slate-300">
          <span className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`}></span>
          <span className="font-medium text-[11px]">Lip AI</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{participantCount}</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
          title="View Recognizable Gestures"
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>Gestures</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
          title="Customize Gesture Mappings"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Customize</span>
        </button>
      </div>
    </header>
  );
};

