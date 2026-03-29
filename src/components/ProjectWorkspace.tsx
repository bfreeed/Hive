import React, { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, CheckSquare, Link, Table2, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Code, Minus, Undo2, Redo2, Highlighter,
  TableRowsSplit, Columns2, Trash2,
  PanelLeftOpen, PanelLeftClose, GripVertical,
} from 'lucide-react';
import { PAGE_TEMPLATES } from '../data/pageTemplates';

// ─── Toolbar helpers (same as DocEditor) ──────────────────────────
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

// ─── Template panel ────────────────────────────────────────────────
function TemplatePanel({ onInsert }: { onInsert: (templateId: string) => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Templates</div>
        <div className="text-[11px] text-white/25 mt-0.5">Drag into editor or click to insert</div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {PAGE_TEMPLATES.map(t => (
          <div
            key={t.id}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('hive-template-id', t.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onInsert(t.id)}
            className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04] cursor-grab active:cursor-grabbing transition-all group"
          >
            <span className="text-base flex-shrink-0 mt-0.5">{t.icon}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white/70 group-hover:text-white/90 truncate transition-colors">{t.name}</div>
              <div className="text-[11px] text-white/30 leading-snug mt-0.5 line-clamp-2">{t.description}</div>
            </div>
            <GripVertical size={12} className="text-white/20 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────
interface ProjectWorkspaceProps {
  content: any;
  onChange: (json: any) => void;
}

export default function ProjectWorkspace({ content, onChange }: ProjectWorkspaceProps) {
  const [showTemplates, setShowTemplates] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const editorWrapRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      TextStyle, Color,
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Start writing, or drag a template from the left…' }),
    ],
    content: content ?? undefined,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: 'doc-editor bg-transparent text-white/85 text-sm leading-relaxed focus:outline-none min-h-[400px] px-1 py-2',
      },
    },
  });

  // Update content when project changes
  useEffect(() => {
    if (!editor || !content) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming) editor.commands.setContent(content);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Insert template content at cursor (or end of doc)
  const insertTemplate = (templateId: string, dropPos?: number) => {
    const template = PAGE_TEMPLATES.find(t => t.id === templateId);
    if (!template || !editor) return;

    const nodes = template.content?.content ?? [];
    if (!nodes.length) return;

    // If we have a drop position, insert there; otherwise insert at end
    if (dropPos !== undefined) {
      editor.chain().focus().insertContentAt(dropPos, nodes).run();
    } else {
      const end = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(end, nodes).run();
    }
  };

  // Drag and drop handlers on the editor wrapper
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('hive-template-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the wrapper entirely
    if (!editorWrapRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const templateId = e.dataTransfer.getData('hive-template-id');
    if (!templateId || !editor) { setIsDragOver(false); return; }
    e.preventDefault();
    setIsDragOver(false);

    // Get the TipTap doc position closest to the drop coordinates
    const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    insertTemplate(templateId, pos?.pos);
  };

  if (!editor) return null;

  // Toolbar state helpers
  const currentHeading = (() => {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    return 'paragraph';
  })();

  const handleHeadingChange = (value: string) => {
    if (value === 'paragraph') editor.chain().focus().setParagraph().run();
    else if (value === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (value === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (value === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  return (
    <div className="flex h-full">
      {/* Template panel */}
      {showTemplates && (
        <div className="w-52 flex-shrink-0 border-r border-white/[0.06] bg-[#111113]">
          <TemplatePanel onInsert={(id) => insertTemplate(id)} />
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/[0.06] flex-wrap bg-[#111113] flex-shrink-0">
          {/* Toggle templates panel */}
          <ToolBtn onClick={() => setShowTemplates(v => !v)} active={showTemplates} title="Templates">
            {showTemplates ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </ToolBtn>
          <Divider />

          {/* Heading selector */}
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

          <ToolBtn
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            active={editor.isActive('table')} title="Insert table"
          ><Table2 size={14} /></ToolBtn>
          {editor.isActive('table') && <>
            <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} active={false} title="Add row"><TableRowsSplit size={14} /></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} active={false} title="Add column"><Columns2 size={14} /></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} active={false} title="Delete table"><Trash2 size={14} /></ToolBtn>
          </>}
          <Divider />

          <ToolBtn onClick={() => editor.chain().focus().undo().run()} active={false} disabled={!editor.can().undo()} title="Undo"><Undo2 size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} active={false} disabled={!editor.can().redo()} title="Redo"><Redo2 size={14} /></ToolBtn>
        </div>

        {/* Editor area with drop target */}
        <div
          ref={editorWrapRef}
          className={`flex-1 overflow-y-auto px-6 py-4 transition-colors ${isDragOver ? 'bg-brand-500/[0.05] ring-1 ring-inset ring-brand-500/30' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => editor.commands.focus()}
        >
          {isDragOver && (
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-10">
              <div className="bg-brand-500/20 border-2 border-dashed border-brand-500/60 rounded-xl px-8 py-4 text-brand-300 text-sm font-medium">
                Drop to insert template
              </div>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
