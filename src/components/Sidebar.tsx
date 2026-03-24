import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import {
  Home, CheckSquare, Users, Bell, Settings, ChevronDown, ChevronRight,
  Plus, FolderOpen, Mic, Menu, MessageSquare, Check, Lock, LogOut, GripVertical
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PROJECT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

const DEFAULT_NAV_ORDER = ['home', 'tasks', 'contacts', 'messages', 'notifications'];
const NAV_ITEMS_MAP: Record<string, { label: string; icon: React.ReactNode; getBadge?: (store: any) => number | undefined }> = {
  home:          { label: 'Home',          icon: <Home size={16} /> },
  tasks:         { label: 'My Tasks',      icon: <CheckSquare size={16} />, getBadge: (s) => s.tasks.filter((t: any) => t.flags?.some((f: any) => f.flagId === 'flag-questions')).length || undefined },
  contacts:      { label: 'Contacts',      icon: <Users size={16} /> },
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

interface NavItem {
  label: string;
  icon: React.ReactNode;
  id: string;
  badge?: number;
}

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

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const store = useStore();
  const { projects, tasks, users, notifications, channels, messages, darkMode, toggleDarkMode, toggleVoice, sidebarOpen, toggleSidebar, addProject, currentUser, isLoading, userStatuses, setUserStatus } = store;

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

  // Keep projectOrder in sync when projects are added/removed
  const orderedProjects = React.useMemo(() => {
    const known = new Set(projectOrder);
    const newProjects = projects.filter(p => !known.has(p.id));
    const order = [...projectOrder.filter(id => projects.some(p => p.id === id)), ...newProjects.map(p => p.id)];
    return order.map(id => projects.find(p => p.id === id)!).filter(Boolean);
  }, [projects, projectOrder]);

  const handleProjectDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProjectOrder(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        const next = arrayMove(
          // ensure all current projects are represented
          projects.map(p => p.id).reduce((acc, id) => acc.includes(id) ? acc : [...acc, id], prev),
          oldIndex === -1 ? prev.length : oldIndex,
          newIndex === -1 ? prev.length : newIndex,
        );
        localStorage.setItem('sidebar-project-order', JSON.stringify(next));
        return next;
      });
    }
  };

  const [navOrder, setNavOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sidebar-nav-order');
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // Validate all items are still valid
        if (parsed.length === DEFAULT_NAV_ORDER.length && parsed.every(id => NAV_ITEMS_MAP[id])) return parsed;
      }
    } catch {}
    return DEFAULT_NAV_ORDER;
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleNavDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setNavOrder(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        const next = arrayMove(prev, oldIndex, newIndex);
        localStorage.setItem('sidebar-nav-order', JSON.stringify(next));
        return next;
      });
    }
  };

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [teamExpanded, setTeamExpanded] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const newProjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewProject) newProjectRef.current?.focus();
  }, [showNewProject]);

  const handleAddProject = () => {
    if (!newProjectName.trim()) { setShowNewProject(false); return; }
    addProject({
      name: newProjectName.trim(),
      color: newProjectColor,
      status: 'active',
      memberIds: ['lev'],
      isPrivate: false,
    });
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setShowNewProject(false);
  };

  return (
    <aside className={`flex flex-col h-full bg-[#111113] border-r border-white/[0.06] transition-all duration-200 ${sidebarOpen ? 'w-60' : 'w-14'} flex-shrink-0`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-white/[0.06]">
        {sidebarOpen && (
          <span className="text-sm font-semibold text-white tracking-tight">Hive</span>
        )}
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
                <SortableNavBtn
                  key={id}
                  id={id}
                  icon={item.icon}
                  label={item.label}
                  active={activePage === id}
                  expanded={sidebarOpen}
                  onClick={() => onNavigate(id)}
                  badge={badge}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Projects */}
        <div className="pt-3">
          {sidebarOpen ? (
            <div className="flex items-center px-2 py-1">
              <button
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-white/30 hover:text-white/60 uppercase tracking-wider transition-colors flex-1"
              >
                {projectsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Projects
              </button>
              <button
                onClick={() => { setProjectsExpanded(true); setShowNewProject(true); }}
                className="p-0.5 rounded text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                title="New Project"
              >
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <div className="px-2 py-1">
              <FolderOpen size={14} className="text-white/30" />
            </div>
          )}

          {(projectsExpanded || !sidebarOpen) && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
              <SortableContext items={orderedProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                {orderedProjects.map((project) => {
                  const taskCount = tasks.filter((t) => (t.projectIds ?? []).includes(project.id) && t.status !== 'done').length;
                  return (
                    <SortableProjectBtn
                      key={project.id}
                      project={project}
                      taskCount={taskCount}
                      active={activePage === `project-${project.id}`}
                      expanded={sidebarOpen}
                      onClick={() => onNavigate('project', project.id)}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          )}

          {/* New Project inline form */}
          {sidebarOpen && showNewProject && (
            <div className="mx-1 mt-1 p-2 bg-white/[0.04] rounded-lg border border-white/[0.08] space-y-2">
              <input
                ref={newProjectRef}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddProject();
                  if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName(''); }
                }}
                placeholder="Project name"
                className="w-full bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewProjectColor(c)}
                    className="w-4 h-4 rounded-full flex-shrink-0 transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c }}
                  >
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
        </div>

      </nav>

      {/* Team members — only users who share at least one project */}
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
            <button
              onClick={() => setTeamExpanded(v => !v)}
              className="w-full flex items-center justify-between px-2 py-1 group mb-0.5"
            >
              <span className="text-xs font-medium text-white/30 uppercase tracking-wider">Team</span>
              <ChevronDown size={12} className={`text-white/20 group-hover:text-white/40 transition-transform ${teamExpanded ? '' : '-rotate-90'}`} />
            </button>
            {teamExpanded && teammates.map(u => {
              const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
              let hash = 0;
              for (const c of u.id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
              const color = COLORS[hash % COLORS.length];
              const isActive = activePage === `team-member-${u.id}`;
              return (
                <button
                  key={u.id}
                  onClick={() => onNavigate('team-member', u.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}
                >
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
        <button
          onClick={toggleVoice}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <Mic size={16} className="text-brand-400" />
          {sidebarOpen && <span>Voice AI</span>}
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <Settings size={16} />
          {sidebarOpen && <span>Settings</span>}
        </button>

        {/* Avatar + status + Sign Out */}
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 px-2 py-2 mt-1 group relative">
            <button
              onClick={() => setShowStatusPicker(v => !v)}
              className="relative flex-shrink-0"
              title="Set status"
            >
              <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
                <span className="text-xs font-semibold text-white">
                  {(currentUser?.name || 'L').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111113] ${STATUS_DOT[userStatuses[currentUser.id] || 'online']}`} />
            </button>
            <span className="text-sm text-white/60 truncate flex-1">{currentUser?.name || 'Lev Freedman'}</span>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all"
            >
              <LogOut size={13} />
            </button>
            {showStatusPicker && (
              <div className="absolute left-2 bottom-full mb-1 bg-[#1c1c1f] border border-white/[0.1] rounded-xl shadow-xl overflow-hidden z-50 w-44">
                {STATUSES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => { setUserStatus(currentUser.id, s.value); setShowStatusPicker(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`} />
                    {s.label}
                    {(userStatuses[currentUser.id] || 'online') === s.value && (
                      <Check size={11} className="ml-auto text-brand-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="w-full flex items-center justify-center p-2 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}

function SortableNavBtn({ icon, label, id, active, expanded, onClick, badge }: {
  icon: React.ReactNode; label: string; id: string; active: boolean;
  expanded: boolean; onClick: () => void; badge?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group/nav">
      {expanded && (
        <span
          {...attributes}
          {...listeners}
          className="flex-shrink-0 w-4 flex items-center justify-center text-white/0 group-hover/nav:text-white/20 hover:!text-white/40 cursor-grab active:cursor-grabbing transition-colors mr-0.5"
        >
          <GripVertical size={12} />
        </span>
      )}
      <button
        onClick={onClick}
        className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${active ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'} ${!expanded ? 'w-full' : ''}`}
      >
        <span className="flex-shrink-0">{icon}</span>
        {expanded && <span className="flex-1 text-left">{label}</span>}
        {expanded && badge ? (
          <span className="bg-brand-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">{badge}</span>
        ) : null}
      </button>
    </div>
  );
}

function SortableProjectBtn({ project, taskCount, active, expanded, onClick }: {
  project: { id: string; name: string; color: string; isPrivate?: boolean };
  taskCount: number; active: boolean; expanded: boolean; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group/proj">
      {expanded && (
        <span
          {...attributes}
          {...listeners}
          className="flex-shrink-0 w-4 flex items-center justify-center text-white/0 group-hover/proj:text-white/20 hover:!text-white/40 cursor-grab active:cursor-grabbing transition-colors mr-0.5"
        >
          <GripVertical size={12} />
        </span>
      )}
      <button
        onClick={onClick}
        className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group ${active ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'} ${!expanded ? 'w-full' : ''}`}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
        {expanded && (
          <>
            <span className="truncate flex-1 text-left">{project.name}</span>
            {project.isPrivate && <Lock size={10} className="text-amber-400/50 flex-shrink-0" />}
            {taskCount > 0 && (
              <span className="text-xs text-white/30 group-hover:text-white/50">{taskCount}</span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
