import React from 'react';

export const COMMON_EMOJIS = ['\u{1F4DD}','\u{1F4CB}','\u{1F680}','\u{1F3AF}','\u26A1','\u{1F50D}','\u{1F4A1}','\u2696\uFE0F','\u{1F393}','\u{1F3E0}','\u{1F331}','\u{1F4CA}','\u{1F91D}','\u{1F501}','\u{1F4D6}','\u{1F5C2}','\u{1F4CC}','\u{1F525}','\u2705','\u{1F4AC}','\u{1F399}','\u{1F4C5}','\u{1F4B0}','\u{1F517}','\u{1F30D}','\u{1F6E0}','\u{1F4E3}','\u{1F9E0}'];

export function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div className="bg-[#1c1c21] border border-white/10 rounded-xl shadow-2xl p-3 w-64">
      <div className="flex flex-wrap gap-1.5">
        {COMMON_EMOJIS.map(e => (
          <button key={e} onClick={() => { onSelect(e); onClose(); }}
            className="text-xl hover:bg-white/10 rounded-lg p-1 transition-colors">{e}</button>
        ))}
      </div>
      <button onClick={onClose} className="mt-2 text-xs text-white/30 hover:text-white/60 w-full text-center">Cancel</button>
    </div>
  );
}
