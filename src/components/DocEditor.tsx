import React from 'react';
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
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Code, Minus, Undo2, Redo2, Highlighter,
  Indent, Outdent,
  TableRowsSplit, Columns2, Trash2,
} from 'lucide-react';

interface DocEditorProps {
  content: any;
  onChange: (json: any) => void;
}

function Divider() {
  return <div className="w-px h-4 bg-white/10 mx-0.5 flex-shrink-0" />;
}

function ToolBtn({
  onClick, active, title, children, disabled,
}: {
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

export default function DocEditor({ content, onChange }: DocEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      Color,
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: content ?? undefined,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: 'doc-editor bg-transparent text-white/85 text-sm leading-relaxed focus:outline-none min-h-[300px] px-1 py-2',
      },
    },
  });

  if (!editor) return null;

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

  const handleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt('Enter URL');
      if (url) editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const inTable = editor.isActive('table');

  return (
    <div className="flex flex-col border border-white/[0.07] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">

        {/* Undo / Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo"
          disabled={!editor.can().undo()}>
          <Undo2 size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo"
          disabled={!editor.can().redo()}>
          <Redo2 size={14} />
        </ToolBtn>

        <Divider />

        {/* Heading */}
        <select
          value={currentHeading}
          onChange={(e) => handleHeadingChange(e.target.value)}
          className="bg-white/[0.05] text-white/60 text-xs px-2 py-1 rounded border border-white/[0.08] focus:outline-none hover:bg-white/[0.08] transition-colors cursor-pointer flex-shrink-0"
        >
          <option value="paragraph" className="bg-[#1c1c1e]">Normal</option>
          <option value="h1" className="bg-[#1c1c1e]">Heading 1</option>
          <option value="h2" className="bg-[#1c1c1e]">Heading 2</option>
          <option value="h3" className="bg-[#1c1c1e]">Heading 3</option>
        </select>

        <Divider />

        {/* Text formatting */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="Bold"><Bold size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="Italic"><Italic size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')} title="Strikethrough"><Strikethrough size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')} title="Highlight"><Highlighter size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')} title="Inline code"><Code size={14} /></ToolBtn>

        <Divider />

        {/* Alignment */}
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })} title="Align left"><AlignLeft size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })} title="Align center"><AlignCenter size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })} title="Align right"><AlignRight size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })} title="Justify"><AlignJustify size={14} /></ToolBtn>

        <Divider />

        {/* Lists */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="Bullet list"><List size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')} title="Checklist"><CheckSquare size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          title="Indent" disabled={!editor.can().sinkListItem('listItem')}><Indent size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          title="Outdent" disabled={!editor.can().liftListItem('listItem')}><Outdent size={14} /></ToolBtn>

        <Divider />

        {/* Blocks */}
        <ToolBtn onClick={handleLink} active={editor.isActive('link')} title="Link"><Link size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')} title="Blockquote"><Quote size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')} title="Code block">
          <span className="text-[11px] font-mono font-bold leading-none">{'</>'}</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider line">
          <Minus size={14} />
        </ToolBtn>

        <Divider />

        {/* Table */}
        <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert table"><Table2 size={14} /></ToolBtn>

        {/* Table management — only shown when cursor is in a table */}
        {inTable && (
          <>
            <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">
              <TableRowsSplit size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">
              <Columns2 size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
              <span className="text-[10px] font-medium text-red-400/70">−row</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
              <span className="text-[10px] font-medium text-red-400/70">−col</span>
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
              <Trash2 size={13} />
            </ToolBtn>
          </>
        )}
      </div>

      {/* Editor content */}
      <div className="px-4 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
