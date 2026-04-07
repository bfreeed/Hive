import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import {
  Home, CheckSquare, Users, Bell, Settings, ChevronDown, ChevronRight,
  Plus, FolderOpen, Mic, Menu, MessageSquare, Check, Lock, LogOut, GripVertical, Calendar, Layout,
  MoreHorizontal, Folder, Trash2, Pencil,
} from 'lucide-react';
import {
  DndContext, closestCenter, rectIntersection, PointerSensor, useSensor, useSensors,
  DragOverlay, type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project } from '../types';

const PROJECT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

const DEFAULT_NAV_ORDER = ['home', 'tasks', 'contacts', 'messages', 'meetings', 'notifications'];
const NAV_ITEMS_MAP: Record<string, { label: string; icon: React.ReactNode; getBadge?: (store: any) => number | undefined }> = {
  home:          { label: 'Home',          icon: <Home size={16} /> },
  tasks:         { label: 'My Tasks',      icon: <CheckSquare size={16} />, getBadge: (s) => s.tasks.filter((t: any) => t.flags?.some((f: any) => f.flagId === 'flag-questions')).length || undefined },
  workspace:     { label: 'Workspace',     icon: <Layout size={16} /> },
  contacts:      { label: 'Contacts',      icon: <Users size={16} /> },
  meetings:      { label: 'Meetings',      icon: <Calendar size={16} />, getBadge: (s) => s.meetings.filter((m: any) => m.reviewed === false && m.provider && m.provider !== 'manual').length || undefined },
  messages:      { label: 'Messages',      icon: <MessageSquare size={16} />, getBadge: (s) => {
    const unread = s.channels
      .filter((c: any) => c.memberIds.includes(s.currentUser.id) && !c.muted)
      .reduce((total: number, ch: any) => {
        const count = s.messages.filter((m: any) =>
          m.channelId === ch.id && m.authorId !== s.currentUser.id &&
          (ch.lastReadAt ? m.createdAt > ch.lastReadAt : true)
        ).length;
        return total + count;
      }, 0);
    return unread || undefined;
  }},
  notifications: { label: 'Notifications', icon: <Bell size={16} />, getBadge: (s) => s.notifications.filter((n: any) => !n.read).length || undefined },
};

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string, projectId?: string) => void;
}

const STATUSES = [
  { value: 'online', label: 'Online', color: 'bg-emerald-400' },
  { value: 'away', label: 'Away', color: 'bg-amber-400' },
  { value: 'busy', label: 'Busy', color: 'bg-red-400' },
  { value: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500' },
];
const STATUS_DOT: Record<string, string> = { online: 'bg-emerald-400', away: 'bg-amber-400', busy: 'bg-red-400', dnd: 'bg-red-500' };

// ── Close a dropdown on Escape or click outside its container ──────
function useMenuClose(
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onMouse = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onMouse, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onMouse, true);
    };
  }, [open, setOpen, containerRef]);
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const store = useStore();
  const { projects, trashedProjects, trashedTasks, tasks, users, notifications, channels, messages, toggleVoice, sidebarOpen, toggleSidebar, addProject, updateProject, deleteProject, currentUser, isLoading, userStatuses, setUserStatus } = store;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const [projectOrder, setProjectOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sidebar-project-order');
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return projects.map(p => p.id);
  });

  const orderedProjects = useMemo(() => {
    const known = new Set(projectOrder);
    const newProjects = projects.filter(p => !known.has(p.id));
    const order = [...projectOrder.filter(id => projects.some(p => p.id === id)), ...newProjects.map(p => p.id)];
    return order.map(id => projects.find(p => p.id === id)!).filter(Boolean);
  }, [projects, projectOrder]);

  // Top-level: no parentId, no folderId
  const topLevelProjects = useMemo(
    () => orderedProjects.filter(p => !p.parentId && !p.folderId),
    [orderedProjects],
  );

  // Track active drag for the DragOverlay visual
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleProjectDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeProj = projects.find(p => p.id === active.id);
    const overProj   = projects.find(p => p.id === over.id);
    if (!activeProj) return;

    // Drop onto a folder → move into it
    if (overProj?.isFolder && !activeProj.isFolder) {
      updateProject(active.id as string, { folderId: over.id as string });
      setExpandedFolders(prev => ({ ...prev, [over.id as string]: true }));
      return;
    }

    // Folder-child dropped onto a top-level item (no folder) → pull out of folder
    if (activeProj.folderId && !overProj?.folderId && !overProj?.isFolder) {
      updateProject(active.id as string, { folderId: undefined });
    }

    // Reorder in the flat project order
    setProjectOrder(prev => {
      const withAll = projects.map(p => p.id).reduce((acc, id) => acc.includes(id) ? acc : [...acc, id], prev);
      const oldIndex = withAll.indexOf(active.id as string);
      const newIndex = withAll.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(withAll, oldIndex, newIndex);
      localStorage.setItem('sidebar-project-order', JSON.stringify(next));
      return next;
    });
  };

  const [navOrder, setNavOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sidebar-nav-order');
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (parsed.every(id => NAV_ITEMS_MAP[id])) {
          return [...parsed, ...DEFAULT_NAV_ORDER.filter(id => !parsed.includes(id))];
        }
      }
    } catch {}
    return DEFAULT_NAV_ORDER;
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleNavDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setNavOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
        localStorage.setItem('sidebar-nav-order', JSON.stringify(next));
        return next;
      });
    }
  };

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [teamExpanded, setTeamExpanded] = useState(true);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [newFolderName, setNewFolderName] = useState('');
  const newProjectRef = useRef<HTMLInputElement>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const projectsMenuRef = useRef<HTMLDivElement>(null);

  useMenuClose(showProjectsMenu, setShowProjectsMenu, projectsMenuRef);

  useEffect(() => { if (showNewProject) newProjectRef.current?.focus(); }, [showNewProject]);
  useEffect(() => { if (showNewFolder) newFolderRef.current?.focus(); }, [showNewFolder]);

  const handleAddProject = () => {
    if (!newProjectName.trim()) { setShowNewProject(false); return; }
    addProject({
      name: newProjectName.trim(),
      color: newProjectColor,
      status: 'active',
      memberIds: [currentUser.id],
      isPrivate: false,
    });
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setShowNewProject(false);
  };

  // Flat list of visible project IDs (top-level + expanded folder children) for drag-out-of-folder
  const visibleProjectIds = useMemo(() => {
    const ids: string[] = [];
    for (const p of topLevelProjects) {
      if (p.isFolder) {
        ids.push(p.id);
        if (expandedFolders[p.id] ?? true) {
          orderedProjects.filter(fp => fp.folderId === p.id && !fp.isFolder).forEach(fp => ids.push(fp.id));
        }
      } else {
        ids.push(p.id);
      }
    }
    return ids;
  }, [topLevelProjects, orderedProjects, expandedFolders]);

  // When dragging a non-folder project, exclude folders from the sortable list so they
  // stay in place and just highlight — no jumping. Folders still sort among themselves.
  const sortableIds = useMemo(() => {
    const activeIsProject = activeDragId ? !projects.find(p => p.id === activeDragId)?.isFolder : false;
    if (activeIsProject) return visibleProjectIds.filter(id => !projects.find(p => p.id === id)?.isFolder);
    return visibleProjectIds;
  }, [activeDragId, visibleProjectIds, projects]);

  // Hybrid collision: rectIntersection for folders, closestCenter otherwise
  const collisionDetection: CollisionDetection = React.useCallback((args) => {
    const folderContainers = args.droppableContainers.filter(c => projects.find(p => p.id === c.id)?.isFolder);
    const folderHits = rectIntersection({ ...args, droppableContainers: folderContainers });
    if (folderHits.length > 0) return folderHits;
    return closestCenter(args);
  }, [projects]);

  const handleAddFolder = () => {
    if (!newFolderName.trim()) { setShowNewFolder(false); return; }
    addProject({
      name: newFolderName.trim(),
      color: '#6366f1',
      status: 'active',
      memberIds: [currentUser.id],
      isPrivate: false,
      isFolder: true,
    });
    setNewFolderName('');
    setShowNewFolder(false);
    setProjectsExpanded(true);
  };

  return (
    <aside className={`flex flex-col h-full bg-[#111113] border-r border-white/[0.06] transition-all duration-200 ${sidebarOpen ? 'w-60' : 'w-14'} flex-shrink-0`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-white/[0.06]">
        {sidebarOpen && <span className="text-sm font-semibold text-white tracking-tight">Hive</span>}
        <button onClick={toggleSidebar} className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors ml-auto">
          <Menu size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-2 px-2 space-y-0.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd}>
          <SortableContext items={navOrder} strategy={verticalListSortingStrategy}>
            {navOrder.map(id => {
              const item = NAV_ITEMS_MAP[id];
              if (!item) return null;
              const badge = item.getBadge ? item.getBadge(store) : undefined;
              return (
                <SortableNavBtn key={id} id={id} icon={item.icon} label={item.label}
                  active={activePage === id} expanded={sidebarOpen}
                  onClick={() => onNavigate(id)} badge={badge} />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Projects */}
        <div className="pt-3">
          {sidebarOpen ? (
            <div ref={projectsMenuRef} className="flex items-center px-2 py-1 group/projheader relative">
              <button
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-white/30 hover:text-white/60 uppercase tracking-wider transition-colors flex-1"
              >
                {projectsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Projects
              </button>
              <button
                onClick={() => setShowProjectsMenu(v => !v)}
                className="p-0.5 rounded text-white/0 group-hover/projheader:text-white/30 hover:!text-white/70 hover:bg-white/[0.06] transition-colors"
              >
                <MoreHorizontal size={13} />
              </button>
              {showProjectsMenu && (
                <div className="absolute right-2 top-full mt-1 bg-[#1c1c1f] border border-white/[0.1] rounded-xl shadow-xl z-50 overflow-hidden w-40">
                  <button onClick={() => { setShowProjectsMenu(false); setProjectsExpanded(true); setShowNewProject(true); setShowNewFolder(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors">
                    <Plus size={12} /> New Project
                  </button>
                  <button onClick={() => { setShowProjectsMenu(false); setProjectsExpanded(true); setShowNewFolder(true); setShowNewProject(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors">
                    <Folder size={12} /> New Folder
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-2 py-1"><FolderOpen size={14} className="text-white/30" /></div>
          )}

          {(projectsExpanded || !sidebarOpen) && (
            <DndContext sensors={sensors} collisionDetection={collisionDetection}
              onDragStart={e => setActiveDragId(e.active.id as string)}
              onDragEnd={e => { setActiveDragId(null); handleProjectDragEnd(e); }}
              onDragCancel={() => setActiveDragId(null)}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {topLevelProjects.map((project) => {
                  if (project.isFolder) {
                    const folderProjects = orderedProjects.filter(p => p.folderId === project.id && !p.isFolder);
                    const folderExpanded = expandedFolders[project.id] ?? true;
                    return (
                      <React.Fragment key={project.id}>
                        <FolderRow
                          folder={project}
                          expanded={sidebarOpen}
                          folderExpanded={folderExpanded}
                          onToggle={() => setExpandedFolders(prev => ({ ...prev, [project.id]: !folderExpanded }))}
                          onRename={(name) => updateProject(project.id, { name })}
                          onDelete={() => deleteProject(project.id)}
                        />
                        {sidebarOpen && folderExpanded && (
                          <div className="ml-3">
                            {folderProjects.map(p => (
                              <ProjectNode key={p.id} project={p} activePage={activePage}
                                onNavigate={onNavigate} allProjects={orderedProjects} />
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }
                  return (
                    <ProjectNode key={project.id} project={project} activePage={activePage}
                      onNavigate={onNavigate} allProjects={orderedProjects} />
                  );
                })}
              </SortableContext>

              {/* Floating drag preview — text only, no box */}
              <DragOverlay dropAnimation={null}>
                {activeDragId ? (() => {
                  const p = projects.find(x => x.id === activeDragId);
                  if (!p) return null;
                  if (p.isFolder) {
                    return (
                      <div className="flex items-center gap-1.5 px-2 text-xs text-white/80 cursor-grabbing">
                        <Folder size={11} />
                        <span className="font-medium uppercase tracking-wide text-[10px]">{p.name}</span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-2 px-2 text-sm text-white/90 cursor-grabbing">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span>{p.name}</span>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* New Project form */}
          {sidebarOpen && showNewProject && (
            <div className="mx-1 mt-1 p-2 bg-white/[0.04] rounded-lg border border-white/[0.08] space-y-2">
              <input ref={newProjectRef} value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddProject(); if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName(''); } }}
                placeholder="Project name"
                className="w-full bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none" />
              <div className="flex items-center gap-1.5">
                {PROJECT_COLORS.map(c => (
                  <button key={c} onClick={() => setNewProjectColor(c)}
                    className="w-4 h-4 rounded-full flex-shrink-0 transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c }}>
                    {newProjectColor === c && <Check size={8} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={handleAddProject} className="flex-1 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded transition-colors">Add</button>
                <button onClick={() => { setShowNewProject(false); setNewProjectName(''); }} className="flex-1 py-1 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* New Folder form */}
          {sidebarOpen && showNewFolder && (
            <div className="mx-1 mt-1 p-2 bg-white/[0.04] rounded-lg border border-white/[0.08] space-y-2">
              <input ref={newFolderRef} value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); } }}
                placeholder="Folder name"
                className="w-full bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none" />
              <div className="flex items-center gap-1.5">
                <button onClick={handleAddFolder} className="flex-1 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded transition-colors">Add</button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="flex-1 py-1 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Team */}
      {sidebarOpen && !isLoading && (() => {
        const teammates = users.filter(u =>
          u.id !== currentUser.id &&
          u.email !== currentUser.email &&
          u.name !== currentUser.name &&
          tasks.some(t => t.assigneeIds.includes(u.id))
        );
        if (teammates.length === 0) return null;
        return (
          <div className="border-t border-white/[0.06] px-2 py-2">
            <button onClick={() => setTeamExpanded(v => !v)}
              className="w-full flex items-center justify-between px-2 py-1 group mb-0.5">
              <span className="text-xs font-medium text-white/30 uppercase tracking-wider">Team</span>
              <ChevronDown size={12} className={`text-white/20 group-hover:text-white/40 transition-transform ${teamExpanded ? '' : '-rotate-90'}`} />
            </button>
            {teamExpanded && teammates.map(u => {
              const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
              let hash = 0;
              for (const c of u.id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
              const color = COLORS[hash % COLORS.length];
              return (
                <button key={u.id} onClick={() => onNavigate('team-member', u.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${activePage === `team-member-${u.id}` ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '33' }}>
                    <span className="text-[10px] font-medium" style={{ color }}>{u.name[0].toUpperCase()}</span>
                  </div>
                  <span>{u.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Bottom */}
      <div className="border-t border-white/[0.06] p-2 space-y-0.5">
        <button onClick={toggleVoice}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors">
          <Mic size={16} className="text-brand-400" />
          {sidebarOpen && <span>Voice AI</span>}
        </button>
        <button onClick={() => onNavigate('trash')}
          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${activePage === 'trash' ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}>
          <div className="relative flex-shrink-0">
            <Trash2 size={16} />
            {(trashedProjects.length + trashedTasks.length) > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500/70 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-medium leading-none">
                {trashedProjects.length + trashedTasks.length > 9 ? '9+' : trashedProjects.length + trashedTasks.length}
              </span>
            )}
          </div>
          {sidebarOpen && <span>Trash</span>}
        </button>
        <button onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${activePage === 'settings' ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}>
          <Settings size={16} />
          {sidebarOpen && <span>Settings</span>}
        </button>

        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 px-2 py-2 mt-1 group relative">
            <button onClick={() => setShowStatusPicker(v => !v)} className="relative flex-shrink-0" title="Set status">
              <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
                <span className="text-xs font-semibold text-white">{(currentUser?.name || 'L').charAt(0).toUpperCase()}</span>
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111113] ${STATUS_DOT[userStatuses[currentUser.id] || 'online']}`} />
            </button>
            <span className="text-sm text-white/60 truncate flex-1">{currentUser?.name || 'Lev Freedman'}</span>
            <button onClick={handleSignOut} title="Sign out"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all">
              <LogOut size={13} />
            </button>
            {showStatusPicker && (
              <div className="absolute left-2 bottom-full mb-1 bg-[#1c1c1f] border border-white/[0.1] rounded-xl shadow-xl overflow-hidden z-50 w-44">
                {STATUSES.map(s => (
                  <button key={s.value} onClick={() => { setUserStatus(currentUser.id, s.value); setShowStatusPicker(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`} />
                    {s.label}
                    {(userStatuses[currentUser.id] || 'online') === s.value && <Check size={11} className="ml-auto text-brand-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleSignOut} title="Sign out"
            className="w-full flex items-center justify-center p-2 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors">
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Nav item (draggable) ──────────────────────────────────────────
function SortableNavBtn({ icon, label, id, active, expanded, onClick, badge }: {
  icon: React.ReactNode; label: string; id: string; active: boolean;
  expanded: boolean; onClick: () => void; badge?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center group/nav">
      {expanded && (
        <span {...attributes} {...listeners}
          className="flex-shrink-0 w-4 flex items-center justify-center text-white/0 group-hover/nav:text-white/20 hover:!text-white/40 cursor-grab active:cursor-grabbing transition-colors mr-0.5">
          <GripVertical size={12} />
        </span>
      )}
      <button onClick={onClick}
        className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${active ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'} ${!expanded ? 'w-full' : ''}`}>
        <span className="flex-shrink-0">{icon}</span>
        {expanded && <span className="flex-1 text-left">{label}</span>}
        {expanded && badge ? (
          <span className="bg-brand-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">{badge}</span>
        ) : null}
      </button>
    </div>
  );
}

// ── Folder row ────────────────────────────────────────────────────
function FolderRow({ folder, expanded, folderExpanded, onToggle, onRename, onDelete }: {
  folder: { id: string; name: string }; expanded: boolean;
  folderExpanded: boolean; onToggle: () => void;
  onRename: (name: string) => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: folder.id });
  const dndStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 };

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine dnd ref + menu-close ref on the same element
  const combinedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  useMenuClose(showMenu, setShowMenu, containerRef);
  useEffect(() => { setEditName(folder.name); }, [folder.name]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) onRename(trimmed);
    else setEditName(folder.name);
  };

  if (!expanded) return null;
  return (
    <div ref={combinedRef} style={dndStyle} className="relative flex items-center group/folder mt-1">
      {/* Drag handle */}
      <span {...attributes} {...listeners}
        className="flex-shrink-0 w-4 flex items-center justify-center text-white/0 group-hover/folder:text-white/20 hover:!text-white/40 cursor-grab active:cursor-grabbing transition-colors mr-0.5">
        <GripVertical size={12} />
      </span>
      <button onClick={onToggle}
        className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${isOver ? 'bg-brand-500/20 text-white/80' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}>
        {folderExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Folder size={11} className="flex-shrink-0" />
        {editing ? (
          <input ref={inputRef} value={editName} onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } if (e.key === 'Escape') { e.preventDefault(); setEditName(folder.name); setEditing(false); } e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-white/[0.08] border border-white/20 rounded px-1 py-0 text-xs text-white focus:outline-none focus:border-brand-500/50 min-w-0" />
        ) : (
          <span className="truncate flex-1 text-left font-medium uppercase tracking-wide text-[10px]">{folder.name}</span>
        )}
      </button>
      {!editing && (
        <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="flex-shrink-0 opacity-0 group-hover/folder:opacity-100 p-0.5 rounded text-white/30 hover:text-white/70 transition-all mr-0.5">
          <MoreHorizontal size={12} />
        </button>
      )}
      {showMenu && (
        <div className="absolute right-0 top-full mt-0.5 bg-[#1c1c1f] border border-white/[0.1] rounded-xl shadow-xl z-50 overflow-hidden w-44">
          <button onClick={e => { e.stopPropagation(); setShowMenu(false); setEditing(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors">
            <Pencil size={11} /> Rename Folder
          </button>
          {!showDeleteConfirm ? (
            <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400/80 hover:bg-white/[0.06] transition-colors">
              <Trash2 size={11} /> Delete Folder
            </button>
          ) : (
            <div className="px-3 py-2 space-y-1.5">
              <p className="text-xs text-white/50">Projects will move to main list.</p>
              <div className="flex gap-1.5">
                <button onClick={e => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(false); onDelete(); }}
                  className="flex-1 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded transition-colors">
                  Delete
                </button>
                <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                  className="flex-1 py-1 bg-white/[0.06] hover:bg-white/[0.10] text-white/50 text-xs rounded transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recursive project node ────────────────────────────────────────
function ProjectNode({
  project,
  activePage,
  onNavigate,
  allProjects,
}: {
  project: Project;
  activePage: string;
  onNavigate: (page: string, id?: string) => void;
  allProjects: Project[];
}) {
  const { updateProject, deleteProject, addProject, currentUser, sidebarOpen } = useStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // DnD — this node is sortable within its parent's SortableContext
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const dndStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 };

  // Children ordering (per-parent localStorage key)
  const [childOrder, setChildOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`sidebar-child-order-${project.id}`);
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return [];
  });

  const children = useMemo(() => {
    const all = allProjects.filter(p => p.parentId === project.id);
    const known = new Set(childOrder);
    const fresh = all.filter(p => !known.has(p.id));
    const order = [...childOrder.filter(id => all.some(p => p.id === id)), ...fresh.map(p => p.id)];
    return order.map(id => all.find(p => p.id === id)!).filter(Boolean);
  }, [allProjects, project.id, childOrder]);

  // Only show non-hidden sub-projects in sidebar
  const visibleChildren = useMemo(() => children.filter(c => !c.hideFromSidebar), [children]);

  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubColor, setNewSubColor] = useState(PROJECT_COLORS[0]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const newSubRef = useRef<HTMLInputElement>(null);

  useMenuClose(showMenu, setShowMenu, containerRef);
  useEffect(() => { setEditName(project.name); }, [project.name]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  useEffect(() => { if (showAddSub) newSubRef.current?.focus(); }, [showAddSub]);

  // Auto-expand if a child/descendant is active
  useEffect(() => {
    const isDescendantActive = (id: string): boolean => {
      const kids = allProjects.filter(p => p.parentId === id);
      return kids.some(k => activePage === `project-${k.id}` || isDescendantActive(k.id));
    };
    if (isDescendantActive(project.id)) setChildrenExpanded(true);
  }, [activePage, allProjects, project.id]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) updateProject(project.id, { name: trimmed });
    else setEditName(project.name);
  };

  const handleAddSub = () => {
    if (!newSubName.trim()) { setShowAddSub(false); return; }
    addProject({
      name: newSubName.trim(),
      color: newSubColor,
      status: 'active',
      memberIds: [currentUser.id],
      isPrivate: false,
      parentId: project.id,
    });
    setNewSubName('');
    setNewSubColor(PROJECT_COLORS[0]);
    setShowAddSub(false);
    setChildrenExpanded(true);
  };

  const handleChildDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setChildOrder(prev => {
        const ids = children.map(p => p.id);
        const oldIdx = ids.indexOf(active.id as string);
        const newIdx = ids.indexOf(over.id as string);
        if (oldIdx === -1 || newIdx === -1) return prev;
        const next = arrayMove(ids, oldIdx, newIdx);
        localStorage.setItem(`sidebar-child-order-${project.id}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const isActive = activePage === `project-${project.id}`;

  if (!sidebarOpen) {
    return (
      <div ref={setNodeRef} style={dndStyle}>
        <button onClick={() => onNavigate('project', project.id)}
          className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      {/* Row */}
      <div ref={setNodeRef} style={dndStyle} className="relative flex items-center group/proj">
        {/* Drag handle */}
        <span {...attributes} {...listeners}
          className="flex-shrink-0 w-4 flex items-center justify-center text-white/0 group-hover/proj:text-white/20 hover:!text-white/40 cursor-grab active:cursor-grabbing transition-colors mr-0.5">
          <GripVertical size={12} />
        </span>
        {/* Expand chevron */}
        {visibleChildren.length > 0 ? (
          <button onClick={e => { e.stopPropagation(); setChildrenExpanded(v => !v); }}
            className="flex-shrink-0 w-4 h-6 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors">
            {childrenExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span className="flex-shrink-0 w-4" />
        )}
        {/* Project button */}
        <button onClick={() => onNavigate('project', project.id)}
          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors min-w-0 ${isActive ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          {editing ? (
            <input ref={inputRef} value={editName} onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                if (e.key === 'Escape') { e.preventDefault(); setEditName(project.name); setEditing(false); }
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              className="truncate flex-1 text-left bg-white/[0.08] border border-white/20 rounded px-1 py-0 text-sm text-white focus:outline-none focus:border-brand-500/50 min-w-0" />
          ) : (
            <>
              <span className="truncate flex-1 text-left">{project.name}</span>
              {project.isPrivate && <Lock size={10} className="text-amber-400/50 flex-shrink-0" />}
            </>
          )}
        </button>
        {/* ... menu button — always visible for folder children, hover-only otherwise */}
        {!editing && (
          <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            className={`flex-shrink-0 p-0.5 rounded text-white/30 hover:text-white/70 transition-all mr-0.5 ${project.folderId ? 'opacity-40 hover:opacity-100' : 'opacity-0 group-hover/proj:opacity-100'}`}>
            <MoreHorizontal size={12} />
          </button>
        )}
        {/* Dropdown */}
        {showMenu && (
          <div className="absolute right-0 top-full mt-0.5 bg-[#1c1c1f] border border-white/[0.1] rounded-xl shadow-xl z-50 overflow-hidden w-44">
            {project.folderId && (
              <>
                <button onClick={e => { e.stopPropagation(); setShowMenu(false); updateProject(project.id, { folderId: undefined }); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/[0.06] transition-colors">
                  <FolderOpen size={11} /> Remove from folder
                </button>
                <div className="border-t border-white/[0.06]" />
              </>
            )}
            <button onClick={e => { e.stopPropagation(); setShowMenu(false); setEditing(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors">
              <Pencil size={11} /> Rename
            </button>
            <button onClick={e => { e.stopPropagation(); setShowMenu(false); setShowAddSub(true); setChildrenExpanded(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors">
              <Plus size={11} /> Add Sub-project
            </button>
            {project.parentId && (
              <button onClick={e => { e.stopPropagation(); setShowMenu(false); updateProject(project.id, { hideFromSidebar: !project.hideFromSidebar }); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors">
                {project.hideFromSidebar ? <><ChevronDown size={11} /> Show in Sidebar</> : <><ChevronRight size={11} /> Hide from Sidebar</>}
              </button>
            )}
            {!showDeleteConfirm ? (
              <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400/80 hover:bg-white/[0.06] transition-colors">
                <Trash2 size={11} /> Move to Trash
              </button>
            ) : (
              <div className="px-3 py-2 space-y-1.5">
                <p className="text-xs text-white/50">Move "{project.name}" to trash?</p>
                <div className="flex gap-1.5">
                  <button onClick={e => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(false); deleteProject(project.id); }}
                    className="flex-1 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded transition-colors">
                    Move to Trash
                  </button>
                  <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                    className="flex-1 py-1 bg-white/[0.06] hover:bg-white/[0.10] text-white/50 text-xs rounded transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {childrenExpanded && visibleChildren.length > 0 && (
        <div className="ml-2 border-l border-white/[0.06] pl-1 space-y-0.5 mb-0.5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd}>
            <SortableContext items={visibleChildren.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {visibleChildren.map(child => (
                <ProjectNode key={child.id} project={child} activePage={activePage}
                  onNavigate={onNavigate} allProjects={allProjects} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add sub-project inline form */}
      {showAddSub && (
        <div className="ml-2 mx-1 mt-1 p-2 bg-white/[0.04] rounded-lg border border-white/[0.08] space-y-2">
          <input ref={newSubRef} value={newSubName} onChange={e => setNewSubName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddSub(); if (e.key === 'Escape') { setShowAddSub(false); setNewSubName(''); } }}
            placeholder="Sub-project name"
            className="w-full bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none" />
          <div className="flex items-center gap-1.5">
            {PROJECT_COLORS.map(c => (
              <button key={c} onClick={() => setNewSubColor(c)}
                className="w-4 h-4 rounded-full flex-shrink-0 transition-transform hover:scale-110 flex items-center justify-center"
                style={{ backgroundColor: c }}>
                {newSubColor === c && <Check size={8} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleAddSub} className="flex-1 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded transition-colors">Add</button>
            <button onClick={() => { setShowAddSub(false); setNewSubName(''); }} className="flex-1 py-1 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
