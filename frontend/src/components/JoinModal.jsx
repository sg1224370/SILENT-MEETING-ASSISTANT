import React, { useState } from 'react';
import { Video, Mic, ShieldCheck, ArrowRight, Sparkles, User, Hash } from 'lucide-react';

export const JoinModal = ({ onJoin, defaultName = 'Sarthak', defaultRoom = 'CODE26' }) => {
  const [name, setName] = useState(defaultName);
  const [roomId, setRoomId] = useState(defaultRoom);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    onJoin({
      name: name.trim(),
      roomId: roomId.trim().toUpperCase(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 sm:p-8 relative">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/30 mb-3">
            ✋
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            SilentMeet
            <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              Live Call
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Real-time P2P WebRTC video calling with AI-powered gesture communication.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {/* User Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Sarthak"
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              autoFocus
            />
          </div>

          {/* Room ID Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              Room ID (Share with peer)
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="e.g. CODE26"
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider uppercase text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          {/* Quick Info */}
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              <span>Camera & microphone will be requested upon entry.</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>MediaPipe hand gestures generate live silent meeting messages.</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>Join Meeting</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security badge */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Peer-to-Peer WebRTC Encryption Enabled</span>
        </div>
      </div>
    </div>
  );
};
