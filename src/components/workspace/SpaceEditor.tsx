import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
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
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, CheckSquare, Quote, Table2,
  AlignLeft, AlignCenter, AlignRight,
  Code, Minus, Undo2, Redo2, Highlighter,
  TableRowsSplit, Columns2, Trash2,
} from 'lucide-react';
import type { HivePage } from '../../types';
import { CalloutNode } from './CalloutNode';
import { ToggleNode } from './ToggleNode';
import { SLASH_COMMANDS, applySlashCommand, SlashMenu } from './SlashCommands';
import { EmojiPicker } from './EmojiPicker';

function Divider() {
  return <div className="w-px h-4 bg-white/10 mx-0.5 flex-shrink-0" />;
}
function ToolBtn({ onClick, active, title, children, disabled }: {
  onClick: () => void; active?: boolean; title: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex-shrink-0 p-1.5 rounded transition-colors ${
        disabled ? 'text-white/15 cursor-not-allowed' :
        active ? 'bg-white/10 text-white' :
        'text-white/40 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}

export function SpaceEditor({ page, onUpdate }: { page: HivePage; onUpdate: (u: Partial<HivePage>) => void }) {
  const [title, setTitle] = useState(page.title);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{ open: boolean; pos: { x: number; y: number }; query: string } | null>(null);
  const slashQueryRef = useRef('');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        return "Type '/' for commands\u2026";
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
              return false;
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

  useEffect(() => {
    if (!editor) return;
    const incoming = page.content;
    if (incoming && Object.keys(incoming).length > 0) {
      editor.commands.setContent(incoming);
    }
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track slash menu query
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
    const { from } = editor.state.selection;
    const deleteLen = 1 + slashQueryRef.current.length;
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

  const currentHeading = (() => {
    if (!editor) return 'paragraph';
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    return 'paragraph';
  })();

  const handleHeadingChange = (value: string) => {
    if (!editor) return;
    if (value === 'paragraph') editor.chain().focus().setParagraph().run();
    else if (value === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (value === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 max-w-3xl">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              className="text-3xl hover:bg-white/[0.06] rounded-lg p-1 transition-colors leading-none"
              title="Change icon"
            >
              {page.icon ?? '\u{1F4C4}'}
            </button>
            {showEmojiPicker && (
              <div className="absolute top-12 left-0 z-50">
                <EmojiPicker onSelect={(e) => onUpdate({ icon: e })} onClose={() => setShowEmojiPicker(false)} />
              </div>
            )}
          </div>
          <input
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-white/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Toolbar */}
      {editor && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/[0.06] flex-wrap bg-[#111113] flex-shrink-0">
          <select
            value={currentHeading}
            onChange={e => handleHeadingChange(e.target.value)}
            className="text-xs bg-transparent text-white/50 hover:text-white border border-white/10 rounded px-1.5 py-1 focus:outline-none cursor-pointer mr-0.5"
          >
            <option value="paragraph">Text</option>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
          </select>
          <Divider />

          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike"><Strikethrough size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight"><Highlighter size={14} /></ToolBtn>
          <Divider />

          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list"><ListOrdered size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist"><CheckSquare size={14} /></ToolBtn>
          <Divider />

          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left"><AlignLeft size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center"><AlignCenter size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right"><AlignRight size={14} /></ToolBtn>
          <Divider />

          <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block"><Code size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider"><Minus size={14} /></ToolBtn>
          <Divider />

          <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={editor.isActive('table')} title="Insert table"><Table2 size={14} /></ToolBtn>
          {editor.isActive('table') && <>
            <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} active={false} title="Add row"><TableRowsSplit size={14} /></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} active={false} title="Add column"><Columns2 size={14} /></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} active={false} title="Delete table"><Trash2 size={14} /></ToolBtn>
          </>}
          <Divider />

          <ToolBtn onClick={() => editor.chain().focus().undo().run()} active={false} disabled={!editor.can().undo()} title="Undo"><Undo2 size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} active={false} disabled={!editor.can().redo()} title="Redo"><Redo2 size={14} /></ToolBtn>
        </div>
      )}

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
