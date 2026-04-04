import React, { useState, useEffect } from 'react';

export const SLASH_COMMANDS = [
  { id: 'h1',       label: 'Heading 1',      icon: 'H1', desc: 'Large heading' },
  { id: 'h2',       label: 'Heading 2',      icon: 'H2', desc: 'Medium heading' },
  { id: 'h3',       label: 'Heading 3',      icon: 'H3', desc: 'Small heading' },
  { id: 'bullet',   label: 'Bullet List',    icon: '\u2022', desc: 'Unordered list' },
  { id: 'ordered',  label: 'Ordered List',   icon: '1.', desc: 'Numbered list' },
  { id: 'todo',     label: 'To-do List',     icon: '\u2611', desc: 'Checkboxes' },
  { id: 'quote',    label: 'Quote',          icon: '\u201C', desc: 'Block quote' },
  { id: 'code',     label: 'Code Block',     icon: '<>', desc: 'Monospace code' },
  { id: 'divider',  label: 'Divider',        icon: '\u2014', desc: 'Horizontal rule' },
  { id: 'table',    label: 'Table',          icon: '\u229E', desc: '3\u00D73 table' },
  { id: 'callout',  label: 'Callout',        icon: '\u{1F4A1}', desc: 'Highlighted note' },
  { id: 'toggle',   label: 'Toggle',         icon: '\u25B6', desc: 'Collapsible section' },
];

export function applySlashCommand(id: string, editor: any) {
  const chain = editor.chain().focus();
  switch (id) {
    case 'h1':      chain.toggleHeading({ level: 1 }).run(); break;
    case 'h2':      chain.toggleHeading({ level: 2 }).run(); break;
    case 'h3':      chain.toggleHeading({ level: 3 }).run(); break;
    case 'bullet':  chain.toggleBulletList().run(); break;
    case 'ordered': chain.toggleOrderedList().run(); break;
    case 'todo':    chain.toggleTaskList().run(); break;
    case 'quote':   chain.toggleBlockquote().run(); break;
    case 'code':    chain.toggleCodeBlock().run(); break;
    case 'divider': chain.setHorizontalRule().run(); break;
    case 'table':   chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
    case 'callout': chain.insertContent({ type: 'callout', content: [{ type: 'paragraph' }] }).run(); break;
    case 'toggle':  chain.insertContent({ type: 'toggle', content: [{ type: 'paragraph' }] }).run(); break;
  }
}

export function SlashMenu({
  items, position, onSelect, onClose,
}: { items: typeof SLASH_COMMANDS; position: { x: number; y: number }; onSelect: (id: string) => void; onClose: () => void }) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); if (items[selected]) onSelect(items[selected].id); }
      if (e.key === 'Escape')    { onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, selected, onSelect, onClose]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed z-50 bg-[#1c1c21] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[220px] max-h-[320px] overflow-y-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-widest">Blocks</div>
      {items.map((cmd, i) => (
        <button
          key={cmd.id}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === selected ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'}`}
          onClick={() => onSelect(cmd.id)}
          onMouseEnter={() => setSelected(i)}
        >
          <span className="w-7 h-7 bg-white/[0.06] rounded-md flex items-center justify-center text-xs font-mono flex-shrink-0">{cmd.icon}</span>
          <div>
            <div className="text-sm font-medium">{cmd.label}</div>
            <div className="text-[11px] text-white/40">{cmd.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
