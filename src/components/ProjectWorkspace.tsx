import React, { useState, useEffect, useMemo } from 'react';
import { Plus, FolderPlus, Layout } from 'lucide-react';
import { useStore } from '../store';
import type { HivePage } from '../types';
import { PageTreeItem } from './workspace/PageTreeItem';
import { SpaceEditor } from './workspace/SpaceEditor';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, DragOverlay, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface FlatItem { id: string; parentId?: string; depth: number; page: HivePage }

function flattenTree(
  pageList: HivePage[],
  childrenOf: (id: string) => HivePage[],
  depth = 0,
): FlatItem[] {
  const sorted = [...pageList].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
  const result: FlatItem[] = [];
  for (const page of sorted) {
    result.push({ id: page.id, parentId: page.parentId, depth, page });
    if (page.type === 'folder') {
      result.push(...flattenTree(childrenOf(page.id), childrenOf, depth + 1));
    }
  }
  return result;
}

export default function ProjectWorkspace({ projectId }: { projectId: string }) {
  const { pages: allPages, addPage, updatePage, deletePage, projects, updateProject } = useStore();
  const pages = allPages.filter(p => p.projectId === projectId);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Auto-migrate existing project.docContent into a space (one-time)
  const project = projects.find(p => p.id === projectId);
  useEffect(() => {
    if (migrated) return;
    if (!project) return;
    const projectPages = allPages.filter(p => p.projectId === projectId);
    if (projectPages.length === 0 && project.docContent && Object.keys(project.docContent).length > 0) {
      addPage({
        title: 'Notes',
        icon: '\u{1F4DD}',
        content: project.docContent,
        projectId,
        type: 'space',
      }).then(newPage => {
        setActiveSpaceId(newPage.id);
        updateProject(projectId, { docContent: undefined });
      });
    }
    setMigrated(true);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activePage = activeSpaceId ? pages.find(p => p.id === activeSpaceId) ?? null : null;

  const rootPages = pages.filter(p => !p.parentId);
  const childrenOf = (id: string) => pages.filter(p => p.parentId === id);

  const flatItems = useMemo(() => flattenTree(rootPages, childrenOf), [pages]); // eslint-disable-line react-hooks/exhaustive-deps
  const flatIds = useMemo(() => flatItems.map(fi => fi.id), [flatItems]);

  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const overId = over.id as string;
    const draggedPage = pages.find(p => p.id === draggedId);
    const overPage = pages.find(p => p.id === overId);
    if (!draggedPage || !overPage) return;

    // If dropping onto a folder, nest inside it
    if (overPage.type === 'folder' && draggedPage.parentId !== overId) {
      const folderChildren = childrenOf(overId);
      await updatePage(draggedId, { parentId: overId, sortOrder: folderChildren.length });
      return;
    }

    // Otherwise, reorder: move dragged item to the same parent as the over item
    const newParentId = overPage.parentId;
    const siblings = newParentId ? childrenOf(newParentId) : rootPages;
    const filtered = siblings.filter(p => p.id !== draggedId);
    const overIndex = filtered.findIndex(p => p.id === overId);
    const newOrder = [...filtered];
    newOrder.splice(overIndex >= 0 ? overIndex : newOrder.length, 0, draggedPage);

    // Batch update sortOrder for all siblings + update parentId if changed
    const updates: Promise<void>[] = [];
    for (let i = 0; i < newOrder.length; i++) {
      const p = newOrder[i];
      const needsUpdate = p.sortOrder !== i || (p.id === draggedId && p.parentId !== newParentId);
      if (needsUpdate) {
        updates.push(updatePage(p.id, {
          sortOrder: i,
          ...(p.id === draggedId ? { parentId: newParentId } : {}),
        }));
      }
    }
    await Promise.all(updates);
  };

  const handleCreateSpace = async (parentId?: string) => {
    const newPage = await addPage({
      title: 'Untitled',
      projectId,
      type: 'space',
      parentId: parentId ?? undefined,
    });
    setActiveSpaceId(newPage.id);
  };

  const handleCreateFolder = async (parentId?: string) => {
    await addPage({
      title: 'New folder',
      icon: '\u{1F4C1}',
      projectId,
      type: 'folder',
      parentId: parentId ?? undefined,
    });
  };

  const handleDelete = async (id: string) => {
    if (activeSpaceId === id) setActiveSpaceId(null);
    // Also unparent children
    const children = childrenOf(id);
    for (const child of children) {
      await updatePage(child.id, { parentId: undefined });
    }
    await deletePage(id);
  };

  const handleUpdate = async (id: string, u: Partial<HivePage>) => {
    await updatePage(id, u);
  };

  function renderTree(pageList: HivePage[], depth = 0): React.ReactNode {
    const sorted = [...pageList].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
    return sorted.map(page => (
      <PageTreeItem
        key={page.id}
        page={page}
        depth={depth}
        isActive={activeSpaceId === page.id}
        isOverFolder={page.type === 'folder' && dragActiveId !== null && dragActiveId !== page.id}
        onSelect={() => { if (page.type !== 'folder') setActiveSpaceId(page.id); }}
        onDelete={() => handleDelete(page.id)}
        onAddChild={() => handleCreateSpace(page.id)}
        onAddSubfolder={() => handleCreateFolder(page.id)}
        onRename={(title) => handleUpdate(page.id, { title })}
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
          <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Spaces</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleCreateFolder()}
              className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              title="New folder"
            ><FolderPlus size={14} /></button>
            <button
              onClick={() => handleCreateSpace()}
              className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              title="New space"
            ><Plus size={14} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5 px-1">
          {pages.length === 0 ? (
            <button
              onClick={() => handleCreateSpace()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors text-sm mt-1"
            >
              <Plus size={14} /> New space
            </button>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
                {renderTree(rootPages)}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {pages.length > 0 && (
          <div className="border-t border-white/[0.06] p-2">
            <button
              onClick={() => handleCreateSpace()}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors text-xs"
            >
              <Plus size={12} /> New space
            </button>
          </div>
        )}
      </div>

      {/* Main area */}
      {activePage && activePage.type !== 'folder' ? (
        <SpaceEditor
          key={activePage.id}
          page={activePage}
          onUpdate={(u) => handleUpdate(activePage.id, u)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mb-4">
            <Layout size={28} className="text-white/20" />
          </div>
          <h2 className="text-lg font-semibold text-white/60 mb-2">Project spaces</h2>
          <p className="text-sm text-white/30 max-w-sm mb-6">
            Create spaces to organize notes, docs, and content for this project. Use folders to keep things tidy.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCreateSpace()}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} /> New space
            </button>
            <button
              onClick={() => handleCreateFolder()}
              className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <FolderPlus size={14} /> New folder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
