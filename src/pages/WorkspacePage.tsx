import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Plus, ChevronRight, ChevronDown, FileText, Trash2,
  MoreHorizontal, Layout, X, Check,
} from 'lucide-react';
import { useEditor, EditorContent, Extension, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Suggestion } from '@tiptap/suggestion';
import { Node, mergeAttributes } from '@tiptap/core';
import { useStore } from '../store';
import type { HivePage } from '../types';
import { PAGE_TEMPLATES } from '../data/pageTemplates';

// ─────────────────────────────────────────────
// Callout block — custom TipTap node
// ─────────────────────────────────────────────
const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { type: { default: 'info' } };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout-node' }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

function CalloutView({ node, updateAttributes, editor }: any) {
  const icons: Record<string, string> = { info: '💡', warning: '⚠️', tip: '✅', note: '📝' };
  const colors: Record<string, string> = {
    info: 'border-blue-500/40 bg-blue-500/[0.07]',
    warning: 'border-amber-500/40 bg-amber-500/[0.07]',
    tip: 'border-emerald-500/40 bg-emerald-500/[0.07]',
    note: 'border-white/20 bg-white/[0.04]',
  };
  const t = node.attrs.type ?? 'info';
  return (
    <NodeViewWrapper>
      <div className={`flex gap-3 rounded-lg border-l-4 px-4 py-3 my-2 ${colors[t] ?? colors.info}`}>
        <span className="text-lg flex-shrink-0 mt-0.5">{icons[t]}</span>
        <NodeViewContent className="flex-1 min-w-0" />
        {editor.isEditable && (
          <div className="flex gap-1 flex-shrink-0">
            {Object.keys(icons).map(k => (
              <button
                key={k}
                onClick={() => updateAttributes({ type: k })}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors ${t === k ? 'bg-white/20 text-white' : 'text-white/30 hover:text-white/60'}`}
              >{icons[k]}</button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─────────────────────────────────────────────
// Toggle block — custom TipTap node
// ─────────────────────────────────────────────
const ToggleNode = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { open: { default: true } };
  },
  parseHTML() { return [{ tag: 'details' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },
});

function ToggleView({ node, updateAttributes }: any) {
  const open = node.attrs.open ?? true;
  return (
    <NodeViewWrapper>
      <div className="my-1">
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => updateAttributes({ open: !open })}
        >
          <span className={`text-white/30 transition-transform text-xs ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-sm text-white/60">Toggle section</span>
        </div>
        {open && (
          <div className="pl-5 border-l border-white/10 ml-1.5 mt-1">
            <NodeViewContent />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─────────────────────────────────────────────
// Slash command extension
// ─────────────────────────────────────────────
const SLASH_COMMANDS = [
  { id: 'h1',       label: 'Heading 1',      icon: 'H1', desc: 'Large heading' },
  { id: 'h2',       label: 'Heading 2',      icon: 'H2', desc: 'Medium heading' },
  { id: 'h3',       label: 'Heading 3',      icon: 'H3', desc: 'Small heading' },
  { id: 'bullet',   label: 'Bullet List',    icon: '•', desc: 'Unordered list' },
  { id: 'ordered',  label: 'Ordered List',   icon: '1.', desc: 'Numbered list' },
  { id: 'todo',     label: 'To-do List',     icon: '☑', desc: 'Checkboxes' },
  { id: 'quote',    label: 'Quote',          icon: '"', desc: 'Block quote' },
  { id: 'code',     label: 'Code Block',     icon: '<>', desc: 'Monospace code' },
  { id: 'divider',  label: 'Divider',        icon: '—', desc: 'Horizontal rule' },
  { id: 'table',    label: 'Table',          icon: '⊞', desc: '3×3 table' },
  { id: 'callout',  label: 'Callout',        icon: '💡', desc: 'Highlighted note' },
  { id: 'toggle',   label: 'Toggle',         icon: '▶', desc: 'Collapsible section' },
];

function applySlashCommand(id: string, editor: any) {
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

function SlashMenu({
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

// ─────────────────────────────────────────────
// Emoji picker (lightweight)
// ─────────────────────────────────────────────
const COMMON_EMOJIS = ['📝','📋','🚀','🎯','⚡','🔍','💡','⚖️','🎓','🏠','🌱','📊','🤝','🔁','📖','🗂','📌','🔥','✅','💬','🎙','📅','💰','🔗','🌍','🛠','📣','🧠'];

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
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

// ─────────────────────────────────────────────
// Template picker modal
// ─────────────────────────────────────────────
function TemplatePicker({ onSelect, onClose }: { onSelect: (templateId: string | null) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-[640px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-700 text-white">New page</h2>
            <p className="text-sm text-white/40 mt-0.5">Start from a template or blank</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06]"><X size={16} /></button>
        </div>

        {/* Blank */}
        <button
          onClick={() => onSelect(null)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all text-left mb-4"
        >
          <span className="w-10 h-10 bg-white/[0.06] rounded-lg flex items-center justify-center text-xl">📄</span>
          <div>
            <div className="text-sm font-semibold text-white">Blank page</div>
            <div className="text-xs text-white/40">Start with an empty canvas</div>
          </div>
        </button>

        <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Templates</div>
        <div className="grid grid-cols-2 gap-2">
          {PAGE_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.07] hover:border-brand-500/40 hover:bg-brand-500/[0.05] transition-all text-left group"
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{t.icon}</span>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">{t.name}</div>
                <div className="text-xs text-white/40 mt-0.5 leading-relaxed">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page tree item
// ─────────────────────────────────────────────
function PageTreeItem({
  page, depth, isActive, children, onSelect, onDelete, onAddChild,
}: {
  page: HivePage; depth: number; isActive: boolean; children?: React.ReactNode;
  onSelect: () => void; onDelete: () => void; onAddChild: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-brand-500/10 text-brand-300' : 'text-white/55 hover:bg-white/[0.05] hover:text-white/80'}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={onSelect}
      >
        {/* Expand toggle */}
        <button
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 text-white/20 hover:text-white/50 ${!hasChildren ? 'invisible' : ''}`}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Icon + title */}
        <span className="text-sm flex-shrink-0">{page.icon ?? <FileText size={14} className="opacity-50" />}</span>
        <span className="text-[13px] truncate flex-1">{page.title || 'Untitled'}</span>

        {/* Actions (show on hover) */}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button
            className="p-0.5 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
            title="Add sub-page"
            onClick={e => { e.stopPropagation(); onAddChild(); }}
          ><Plus size={12} /></button>
          <button
            className="p-0.5 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
            title="More"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          ><MoreHorizontal size={12} /></button>
        </div>

        {menuOpen && (
          <div className="absolute right-2 z-50 bg-[#1c1c21] border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px]">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/[0.05] transition-colors"
              onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
            ><Trash2 size={13} /> Delete page</button>
          </div>
        )}
      </div>
      {expanded && children && <div>{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page editor panel
// ─────────────────────────────────────────────
function PageEditor({ page, onUpdate }: { page: HivePage; onUpdate: (u: Partial<HivePage>) => void }) {
  const [title, setTitle] = useState(page.title);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{ open: boolean; pos: { x: number; y: number }; query: string } | null>(null);
  const slashQueryRef = useRef('');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync title when page changes
  useEffect(() => { setTitle(page.title); }, [page.id, page.title]);

  const debouncedSave = useCallback((updates: Partial<HivePage>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => onUpdate(updates), 600);
  }, [onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: {} }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      TextStyle, Color,
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Image,
      CalloutNode,
      ToggleNode,
      Placeholder.configure({ placeholder: ({ node }) => {
        if (node.type.name === 'heading') return 'Heading';
        return 'Type \'/\' for commands…';
      }}),
      Extension.create({
        name: 'slashCommands',
        addKeyboardShortcuts() {
          return {
            '/': () => {
              const { view } = this.editor;
              const { from } = view.state.selection;
              const coords = view.coordsAtPos(from);
              slashQueryRef.current = '';
              setSlashMenu({ open: true, pos: { x: coords.left, y: coords.bottom + 6 }, query: '' });
              return false; // still insert the /
            },
          };
        },
      }),
    ],
    content: page.content && Object.keys(page.content).length > 0 ? page.content : undefined,
    onUpdate: ({ editor }) => {
      debouncedSave({ content: editor.getJSON() });
    },
    editorProps: {
      attributes: { class: 'workspace-editor prose prose-invert max-w-none focus:outline-none' },
    },
  }, [page.id]);

  // Update content when page changes
  useEffect(() => {
    if (!editor) return;
    const incoming = page.content;
    if (incoming && Object.keys(incoming).length > 0) {
      editor.commands.setContent(incoming);
    }
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track slash menu query via DOM keydown
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!slashMenu?.open) return;
      if (e.key === 'Escape') { setSlashMenu(null); return; }
      if (e.key === 'Backspace') {
        if (slashQueryRef.current.length === 0) { setSlashMenu(null); }
        else {
          const q = slashQueryRef.current.slice(0, -1);
          slashQueryRef.current = q;
          setSlashMenu(s => s ? { ...s, query: q } : null);
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const q = slashQueryRef.current + e.key;
        slashQueryRef.current = q;
        setSlashMenu(s => s ? { ...s, query: q } : null);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [slashMenu?.open]);

  const filteredSlash = slashMenu
    ? SLASH_COMMANDS.filter(c =>
        !slashMenu.query || c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
      )
    : [];

  const handleSlashSelect = useCallback((id: string) => {
    if (!editor) return;
    // Delete the slash + query text
    const { from } = editor.state.selection;
    const deleteLen = 1 + slashQueryRef.current.length; // '/' + query
    editor.chain().focus().deleteRange({ from: from - deleteLen, to: from }).run();
    applySlashCommand(id, editor);
    setSlashMenu(null);
  }, [editor]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    debouncedSave({ title: e.target.value });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start'); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 max-w-3xl">
          {/* Icon */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              className="text-3xl hover:bg-white/[0.06] rounded-lg p-1 transition-colors leading-none"
              title="Change icon"
            >
              {page.icon ?? '📄'}
            </button>
            {showEmojiPicker && (
              <div className="absolute top-12 left-0 z-50">
                <EmojiPicker onSelect={(e) => onUpdate({ icon: e })} onClose={() => setShowEmojiPicker(false)} />
              </div>
            )}
          </div>
          {/* Title */}
          <input
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-white/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Editor */}
      <div
        className="flex-1 overflow-y-auto px-8 py-6"
        onClick={() => editor?.commands.focus()}
      >
        <div className="max-w-3xl">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Slash menu */}
      {slashMenu?.open && (
        <SlashMenu
          items={filteredSlash}
          position={slashMenu.pos}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main WorkspacePage
// ─────────────────────────────────────────────
export default function WorkspacePage({ initialPageId, projectId }: { initialPageId?: string; projectId?: string }) {
  const { pages: allPages, addPage, updatePage, deletePage } = useStore();
  // When scoped to a project, show only that project's pages. Otherwise show all.
  const pages = projectId
    ? allPages.filter(p => p.projectId === projectId)
    : allPages;
  const [activePageId, setActivePageId] = useState<string | null>(initialPageId ?? null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null | undefined>(undefined);

  const activePage = activePageId ? pages.find(p => p.id === activePageId) ?? null : null;

  // Root pages (no parent)
  const rootPages = pages.filter(p => !p.parentId);
  // Children map
  const childrenOf = (id: string) => pages.filter(p => p.parentId === id);

  const openTemplatePicker = (parentId?: string | null) => {
    setPendingParentId(parentId);
    setShowTemplatePicker(true);
  };

  const handleCreatePage = async (templateId: string | null) => {
    setShowTemplatePicker(false);
    const template = templateId ? PAGE_TEMPLATES.find(t => t.id === templateId) : null;
    const newPage = await addPage({
      title: template ? template.name : 'Untitled',
      icon: template?.icon,
      content: template ? template.content : {},
      parentId: pendingParentId ?? undefined,
      templateId: templateId ?? undefined,
      projectId: projectId ?? undefined,
    });
    setActivePageId(newPage.id);
    setPendingParentId(undefined);
  };

  const handleDelete = async (id: string) => {
    if (activePageId === id) setActivePageId(null);
    await deletePage(id);
  };

  const handleUpdate = async (id: string, u: Partial<HivePage>) => {
    await updatePage(id, u);
  };

  function renderTree(pageList: HivePage[], depth = 0): React.ReactNode {
    return pageList.map(page => (
      <PageTreeItem
        key={page.id}
        page={page}
        depth={depth}
        isActive={activePageId === page.id}
        onSelect={() => setActivePageId(page.id)}
        onDelete={() => handleDelete(page.id)}
        onAddChild={() => openTemplatePicker(page.id)}
      >
        {renderTree(childrenOf(page.id), depth + 1)}
      </PageTreeItem>
    ));
  }

  return (
    <div className="flex h-full bg-[#0f0f10]">
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-white/[0.06] flex flex-col bg-[#111113]">
        <div className="flex items-center justify-between px-3 h-12 border-b border-white/[0.06] flex-shrink-0">
          <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Workspace</span>
          <button
            onClick={() => openTemplatePicker(null)}
            className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            title="New page"
          ><Plus size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5 px-1">
          {pages.length === 0 ? (
            <button
              onClick={() => openTemplatePicker(null)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors text-sm mt-1"
            >
              <Plus size={14} /> New page
            </button>
          ) : (
            renderTree(rootPages)
          )}
        </div>

        {/* New page button at bottom */}
        {pages.length > 0 && (
          <div className="border-t border-white/[0.06] p-2">
            <button
              onClick={() => openTemplatePicker(null)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors text-xs"
            >
              <Plus size={12} /> New page
            </button>
          </div>
        )}
      </div>

      {/* Main area */}
      {activePage ? (
        <PageEditor
          key={activePage.id}
          page={activePage}
          onUpdate={(u) => handleUpdate(activePage.id, u)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mb-4">
            <Layout size={28} className="text-white/20" />
          </div>
          <h2 className="text-lg font-semibold text-white/60 mb-2">Your workspace</h2>
          <p className="text-sm text-white/30 max-w-sm mb-6">
            Pages, project hubs, and notes — all in one place. Start from a template or blank.
          </p>
          <button
            onClick={() => openTemplatePicker(null)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} /> New page
          </button>
        </div>
      )}

      {/* Template picker */}
      {showTemplatePicker && (
        <TemplatePicker onSelect={handleCreatePage} onClose={() => setShowTemplatePicker(false)} />
      )}
    </div>
  );
}
