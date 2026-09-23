import React, { useState } from 'react';
import { X, Save, RotateCcw, Check, Sparkles } from 'lucide-react';

export const SettingsModal = ({
  isOpen,
  onClose,
  mappings = [],
  lipMappings = [],
  onUpdateMapping,
  onUpdateLipMapping,
}) => {
  const [activeTab, setActiveTab] = useState('hand'); // 'hand' | 'lip'
  const [editingMappings, setEditingMappings] = useState({});
  const [editingLipMappings, setEditingLipMappings] = useState({});
  const [savedId, setSavedId] = useState(null);

  if (!isOpen) return null;

  const handleMessageChange = (id, newMsg) => {
    setEditingMappings((prev) => ({
      ...prev,
      [id]: newMsg,
    }));
  };

  const handleLipMessageChange = (id, newMsg) => {
    setEditingLipMappings((prev) => ({
      ...prev,
      [id]: newMsg,
    }));
  };

  const handleSave = async (id) => {
    const customMsg = editingMappings[id];
    if (customMsg !== undefined && onUpdateMapping) {
      await onUpdateMapping(id, customMsg);
      setSavedId(id);
      setTimeout(() => setSavedId(null), 1500);
    }
  };

  const handleSaveLip = async (id) => {
    const customMsg = editingLipMappings[id];
    if (customMsg !== undefined && onUpdateLipMapping) {
      await onUpdateLipMapping(id, customMsg);
      setSavedId(id);
      setTimeout(() => setSavedId(null), 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Customize Silent Commands
              </h3>
              <p className="text-xs text-slate-400">
                Change messages triggered by Hand Gestures and Lip Reading.
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

        {/* Channel Selector Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('hand')}
            className={`pb-2 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'hand'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>✋ Hand Gestures</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1 rounded-full">
              {mappings.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('lip')}
            className={`pb-2 px-3 font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lip'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>👄 Lip Reading</span>
            <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1 rounded-full">
              {lipMappings.length}
            </span>
          </button>
        </div>

        {/* Mappings List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 min-h-0">
          {activeTab === 'hand' && mappings.map((item) => {
            const currentVal =
              editingMappings[item.id] !== undefined
                ? editingMappings[item.id]
                : item.message;
            const isSaved = savedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 hover:border-slate-700/80 transition"
              >
                <div className="text-2xl w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 shrink-0">
                  {item.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-300 capitalize">
                      {item.name.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {item.id}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={currentVal}
                    onChange={(e) => handleMessageChange(item.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Enter silent message text..."
                  />
                </div>

                <button
                  onClick={() => handleSave(item.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                    isSaved
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {activeTab === 'lip' && lipMappings.map((item) => {
            const currentVal =
              editingLipMappings[item.id] !== undefined
                ? editingLipMappings[item.id]
                : item.message;
            const isSaved = savedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 hover:border-slate-700/80 transition"
              >
                <div className="text-2xl w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 shrink-0 text-pink-400">
                  {item.icon || '👄'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-300">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-pink-400">
                      GRID Command
                    </span>
                  </div>
                  <input
                    type="text"
                    value={currentVal}
                    onChange={(e) => handleLipMessageChange(item.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    placeholder="Enter silent message text..."
                  />
                </div>

                <button
                  onClick={() => handleSaveLip(item.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                    isSaved
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/20'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <span>All changes update the real-time engine instantly.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
