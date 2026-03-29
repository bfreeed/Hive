import React, { useState } from 'react';
import { useStore } from '../store';
import { ChevronRight, Lock, Plus, FolderOpen } from 'lucide-react';

export default function MobileProjectsPage({ onNavigate }: { onNavigate: (page: string, id?: string) => void }) {
  const { projects, tasks } = useStore();
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  const topLevel = projects.filter(p => !p.parentId);

  const subMap: Record<string, typeof projects> = {};
  projects.filter(p => p.parentId).forEach(p => {
    if (!subMap[p.parentId!]) subMap[p.parentId!] = [];
    subMap[p.parentId!].push(p);
  });

  const taskCount = (projectId: string) =>
    tasks.filter(t => t.projectIds?.includes(projectId) && t.status !== 'done').length;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="px-4 pt-4 pb-4">
        <h1 className="text-xl font-semibold text-white tracking-tight mb-6">Projects</h1>

        <div className="space-y-1">
          {topLevel.map(project => {
            const subs = subMap[project.id] ?? [];
            const expanded = expandedSubs[project.id] ?? false;
            const count = taskCount(project.id);

            return (
              <div key={project.id}>
                {/* Project row */}
                <div className="flex items-center gap-1">
                  {/* Expand toggle — only if has sub-projects */}
                  {subs.length > 0 ? (
                    <button
                      onClick={() => setExpandedSubs(s => ({ ...s, [project.id]: !expanded }))}
                      className="w-7 h-10 flex items-center justify-center text-white/25 flex-shrink-0"
                    >
                      <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                  ) : (
                    <div className="w-7" />
                  )}

                  {/* Main button */}
                  <button
                    onClick={() => onNavigate('project', project.id)}
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="flex-1 text-sm font-medium text-white/80 truncate">{project.name}</span>
                    {project.isPrivate && <Lock size={11} className="text-white/25 flex-shrink-0" />}
                    {count > 0 && (
                      <span className="text-xs text-white/30 flex-shrink-0">{count}</span>
                    )}
                    <ChevronRight size={14} className="text-white/15 flex-shrink-0" />
                  </button>
                </div>

                {/* Sub-projects */}
                {expanded && subs.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => onNavigate('project', sub.id)}
                    className="w-full flex items-center gap-3 pl-14 pr-4 py-2.5 rounded-xl hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                    <span className="flex-1 text-sm text-white/60 truncate">{sub.name}</span>
                    {(() => {
                      const c = taskCount(sub.id);
                      return c > 0 ? <span className="text-xs text-white/25">{c}</span> : null;
                    })()}
                    <ChevronRight size={13} className="text-white/15 flex-shrink-0" />
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {topLevel.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FolderOpen size={32} className="text-white/15" />
            <p className="text-white/30 text-sm">No projects yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
