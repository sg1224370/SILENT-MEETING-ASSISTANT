import React from 'react';
import { MessageSquare, Sparkles, Trash2, ShieldAlert, Bot } from 'lucide-react';

export const SilentSidebar = ({
  messages = [],
  userName = 'Sarthak',
  onClearHistory,
  onSimulateGesture,
  simulatedEnabled,
  onToggleSimulated,
}) => {
  return (
    <aside className="w-80 lg:w-96 bg-slate-900/95 border-l border-slate-800/90 flex flex-col h-full min-h-0 select-none">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              Live Silent Feed
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-indigo-500/30">
                {messages.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Non-verbal meeting messages</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition cursor-pointer"
              title="Clear Feed History"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Demo Simulation Bar */}
      <div className="px-3.5 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-medium">Room AI Simulation</span>
        </div>
        <button
          onClick={onToggleSimulated}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
            simulatedEnabled
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          {simulatedEnabled ? 'Active (Auto)' : 'Disabled'}
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center text-xl mb-3 border border-slate-700/50">
              ✋
            </div>
            <p className="text-xs font-semibold text-slate-300">No Silent Messages Yet</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              Raise a hand gesture in front of your camera to instantly post non-verbal responses.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = (msg.user || '').trim().toLowerCase() === (userName || '').trim().toLowerCase();
            return (
              <div
                key={msg.id || index}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700/80 transition-all shadow-sm animate-slide-in"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl p-1 bg-slate-900 rounded-lg border border-slate-800">
                      {msg.icon || '✋'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200">{msg.user}</span>
                        {isUser && (
                          <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-500/10 px-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    msg.source === 'lip'
                      ? 'bg-pink-950/80 text-pink-300 border-pink-500/30'
                      : 'bg-indigo-950/80 text-indigo-300 border-indigo-500/30'
                  }`}>
                    {msg.source === 'lip' ? '👄 Lip Reading' : '✋ Hand Gesture'}
                  </span>
                </div>

                <div className="mt-2.5 pl-1 border-l-2 border-indigo-500/60 text-xs font-medium text-slate-100">
                  "{msg.message}"
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Trigger Chips for fast hackathon presentation */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1.5 flex items-center gap-1">
            <span>✋</span> Hand Commands
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 0, icon: '👍', label: 'Agree' },
              { id: 1, icon: '👎', label: 'Disagree' },
              { id: 2, icon: '🖐️', label: 'Question' },
              { id: 7, icon: '✌️', label: 'Speak' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onSimulateGesture(item.id, 'hand')}
                className="px-2 py-1.5 rounded-lg bg-slate-800/60 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-500/40 flex flex-col items-center justify-center transition cursor-pointer"
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-[9px] text-slate-300 font-medium mt-0.5">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1.5 flex items-center gap-1">
            <span>👄</span> Lip Commands
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'AGREE', icon: '👄', label: 'Agree' },
              { id: 'DISAGREE', icon: '👄', label: 'Disagree' },
              { id: 'QUESTION', icon: '👄', label: 'Question' },
              { id: 'REPEAT', icon: '👄', label: 'Repeat' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onSimulateGesture(item.id, 'lip')}
                className="px-2 py-1.5 rounded-lg bg-slate-800/60 hover:bg-pink-600/30 border border-slate-700/60 hover:border-pink-500/40 flex flex-col items-center justify-center transition cursor-pointer"
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-[9px] text-pink-300 font-medium mt-0.5">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
