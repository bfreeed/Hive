import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, FolderPlus, Plus, MoreHorizontal, Trash2 } from 'lucide-react';
import type { HivePage } from '../../types';

export function PageTreeItem({
  page, depth, isActive, children, onSelect, onDelete, onAddChild, onAddSubfolder, onRename,
}: {
  page: HivePage; depth: number; isActive: boolean; children?: React.ReactNode;
  onSelect: () => void; onDelete: () => void; onAddChild: () => void;
  onAddSubfolder?: () => void; onRename?: (title: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(page.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = React.Children.count(children) > 0;
  const isFolder = page.type === 'folder';

  const FolderIcon = expanded ? FolderOpen : Folder;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Sync title if page changes externally
  useEffect(() => { setEditTitle(page.title); }, [page.title]);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const commitRename = () => {
    setEditing(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== page.title) {
      onRename?.(trimmed);
    } else {
      setEditTitle(page.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { e.preventDefault(); setEditTitle(page.title); setEditing(false); }
  };

  return (
    <div>
      <div
        className={`group relative flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-brand-500/10 text-brand-300' : 'text-white/55 hover:bg-white/[0.05] hover:text-white/80'}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={isFolder ? () => setExpanded(v => !v) : onSelect}
      >
        {/* Expand toggle */}
        <button
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 text-white/20 hover:text-white/50 ${!hasChildren && !isFolder ? 'invisible' : ''}`}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Icon + title */}
        {isFolder ? (
          <FolderIcon size={14} className="flex-shrink-0 opacity-50" />
        ) : (
          <span className="text-sm flex-shrink-0">{page.icon ?? <FileText size={14} className="opacity-50" />}</span>
        )}

        {editing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            className="text-[13px] truncate flex-1 bg-white/[0.08] border border-white/20 rounded px-1 py-0 text-white focus:outline-none focus:border-brand-500/50 min-w-0"
          />
        ) : (
          <span
            className="text-[13px] truncate flex-1"
            onDoubleClick={startEditing}
          >
            {page.title || 'Untitled'}
          </span>
        )}

        {/* Three-dot menu trigger (show on hover or when menu is open) */}
        {!editing && (
          <div className={`relative items-center flex-shrink-0 ${menuOpen ? 'flex' : 'hidden group-hover:flex'}`}>
            <button
              className="p-0.5 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
              title="More"
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            ><MoreHorizontal size={12} /></button>
          </div>
        )}

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-2 top-7 z-50 bg-[#1c1c21] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
          >
            {isFolder && (
              <>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.05] transition-colors"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onAddSubfolder?.(); }}
                ><FolderPlus size={13} /> Add subfolder</button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.05] transition-colors"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onAddChild(); }}
                ><Plus size={13} /> Add new space</button>
                <div className="my-1 border-t border-white/[0.06]" />
              </>
            )}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/[0.05] transition-colors"
              onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
            ><Trash2 size={13} /> Delete</button>
          </div>
        )}
      </div>
      {expanded && children && <div>{children}</div>}
    </div>
  );
}
