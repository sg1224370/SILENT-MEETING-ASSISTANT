import React from 'react';
import { X, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';

export const GuideModal = ({ isOpen, onClose, mappings = [], lipMappings = [] }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Recognizable Gestures & Lip Reading
              </h3>
              <p className="text-xs text-slate-400">
                Non-verbal communication cheatsheet for SilentMeet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 min-h-0">
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
            <span>
              <strong>Dual AI Channels:</strong> SilentMeet recognizes both hand gestures via MediaPipe and silent lip movements via LipNet. Microphone is never required!
            </span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>✋</span> Hand Gestures
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mappings.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5"
                >
                  <div className="text-xl w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {item.label || item.name}
                    </p>
                    <p className="text-[11px] text-indigo-400 font-medium truncate">
                      "{item.message}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>👄</span> Supported Lip Phrases (GRID Corpus)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lipMappings.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5"
                >
                  <div className="text-xl w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-pink-400">
                    {item.icon || '👄'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-pink-400 font-medium truncate">
                      "{item.message}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
};
