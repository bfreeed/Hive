import React, { useState } from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { useStore } from '../store';

function daysAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function TrashPage() {
  const { trashedProjects, trashedTasks, projects, restoreProject, permanentDeleteProject, restoreTask, permanentDeleteTask, emptyTrash } = useStore();
  const [tab, setTab] = useState<'projects' | 'tasks'>('projects');
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const totalCount = trashedProjects.length + trashedTasks.length;

  const getProjectName = (projectIds: string[]) => {
    const id = projectIds[0];
    if (!id) return 'No project';
    const fromActive = projects.find(p => p.id === id);
    if (fromActive) return fromActive.name;
    const fromTrashed = trashedProjects.find(p => p.id === id);
    if (fromTrashed) return fromTrashed.name + ' (trashed)';
    return 'Unknown project';
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trash2 size={20} className="text-white/40" />
            <h1 className="text-xl font-semibold text-white tracking-tight">Trash</h1>
          </div>
          {totalCount > 0 && (
            <>
              {!confirmEmptyTrash ? (
                <button
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400/70 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={13} />
                  Empty Trash
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Delete {totalCount} items forever?</span>
                  <button
                    onClick={() => { emptyTrash(); setConfirmEmptyTrash(false); }}
                    className="px-3 py-1.5 rounded-lg text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                  >
                    Yes, delete all
                  </button>
                  <button
                    onClick={() => setConfirmEmptyTrash(false)}
                    className="px-3 py-1.5 rounded-lg text-sm text-white/40 hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'projects' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            Projects
            {trashedProjects.length > 0 && (
              <span className="ml-2 text-xs text-white/30">{trashedProjects.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('tasks')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'tasks' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            Tasks
            {trashedTasks.length > 0 && (
              <span className="ml-2 text-xs text-white/30">{trashedTasks.length}</span>
            )}
          </button>
        </div>

        {/* Projects tab */}
        {tab === 'projects' && (
          <div>
            {trashedProjects.length === 0 ? (
              <div className="text-center py-16 text-white/20 text-sm">No trashed projects</div>
            ) : (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {trashedProjects.map(project => (
                  <div key={project.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white/70 truncate block">{project.name}</span>
                      <span className="text-xs text-white/30">
                        Deleted {project.deletedAt ? daysAgo(project.deletedAt) : 'recently'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => restoreProject(project.id)}
                        title="Restore"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                      <button
                        onClick={() => permanentDeleteProject(project.id)}
                        title="Delete forever"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400/70 hover:bg-red-400/10 transition-colors"
                      >
                        <X size={12} />
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tasks tab */}
        {tab === 'tasks' && (
          <div>
            {trashedTasks.length === 0 ? (
              <div className="text-center py-16 text-white/20 text-sm">No trashed tasks</div>
            ) : (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {trashedTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white/70 truncate block">{task.title}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.projectIds.length > 0 && (
                          <span className="text-xs text-white/30">{getProjectName(task.projectIds)}</span>
                        )}
                        <span className="text-xs text-white/20">
                          Deleted {task.deletedAt ? daysAgo(task.deletedAt) : 'recently'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => restoreTask(task.id)}
                        title="Restore"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                      <button
                        onClick={() => permanentDeleteTask(task.id)}
                        title="Delete forever"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400/70 hover:bg-red-400/10 transition-colors"
                      >
                        <X size={12} />
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {totalCount === 0 && (
          <div className="text-center py-12">
            <Trash2 size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/20">Trash is empty</p>
            <p className="text-xs text-white/15 mt-1">Items are permanently deleted after 30 days</p>
          </div>
        )}
      </div>
    </div>
  );
}
