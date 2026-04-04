import React, { useState } from 'react';
import { Plus, Layout, X } from 'lucide-react';
import { useStore } from '../store';
import type { HivePage } from '../types';
import { PAGE_TEMPLATES } from '../data/pageTemplates';
import { PageTreeItem } from '../components/workspace/PageTreeItem';
import { SpaceEditor } from '../components/workspace/SpaceEditor';

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
          <span className="w-10 h-10 bg-white/[0.06] rounded-lg flex items-center justify-center text-xl">{'\u{1F4C4}'}</span>
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
// Main WorkspacePage
// ─────────────────────────────────────────────
export default function WorkspacePage({ initialPageId, projectId }: { initialPageId?: string; projectId?: string }) {
  const { pages: allPages, addPage, updatePage, deletePage } = useStore();
  const pages = projectId
    ? allPages.filter(p => p.projectId === projectId)
    : allPages;
  const [activePageId, setActivePageId] = useState<string | null>(initialPageId ?? null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null | undefined>(undefined);

  const activePage = activePageId ? pages.find(p => p.id === activePageId) ?? null : null;

  const rootPages = pages.filter(p => !p.parentId);
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
