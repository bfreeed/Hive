import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import {
  Home, CheckSquare, Users, Bell, Settings, ChevronDown, ChevronRight,
  Plus, FolderOpen, Mic, Moon, Sun, Menu, MessageSquare, Check, Lock, LogOut
} from 'lucide-react';

const PROJECT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

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

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { projects, tasks, users, notifications, darkMode, toggleDarkMode, toggleVoice, sidebarOpen, toggleSidebar, addProject, currentUser, isLoading } = useStore();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadMentions = notifications.filter((n) => n.type === 'mention' && !n.read).length;
  const questionsCount = tasks.filter((t) => t.flags?.some(f => f.flagId === 'flag-questions')).length;

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
        <NavBtn icon={<Home size={16} />} label="Home" id="home" active={activePage === 'home'} expanded={sidebarOpen} onClick={() => onNavigate('home')} />
        <NavBtn icon={<CheckSquare size={16} />} label="My Tasks" id="tasks" active={activePage === 'tasks'} expanded={sidebarOpen} onClick={() => onNavigate('tasks')} badge={questionsCount || undefined} />
        <NavBtn icon={<Users size={16} />} label="Contacts" id="contacts" active={activePage === 'contacts'} expanded={sidebarOpen} onClick={() => onNavigate('contacts')} />
        <NavBtn icon={<MessageSquare size={16} />} label="Messages" id="messages" active={activePage === 'messages'} expanded={sidebarOpen} onClick={() => onNavigate('messages')} badge={unreadMentions || undefined} />
        <NavBtn icon={<Bell size={16} />} label="Notifications" id="notifications" active={activePage === 'notifications'} expanded={sidebarOpen} onClick={() => onNavigate('notifications')} badge={unreadCount || undefined} />

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

          {(projectsExpanded || !sidebarOpen) && projects.map((project) => {
            const taskCount = tasks.filter((t) => (t.projectIds ?? []).includes(project.id) && t.status !== 'done').length;
            return (
              <button
                key={project.id}
                onClick={() => onNavigate('project', project.id)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group ${activePage === `project-${project.id}` ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                {sidebarOpen && (
                  <>
                    <span className="truncate flex-1 text-left">{project.name}</span>
                    {project.isPrivate && <Lock size={10} className="text-amber-400/50 flex-shrink-0" />}
                    {taskCount > 0 && (
                      <span className="text-xs text-white/30 group-hover:text-white/50">{taskCount}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}

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
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {sidebarOpen && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <Settings size={16} />
          {sidebarOpen && <span>Settings</span>}
        </button>

        {/* Avatar + Sign Out */}
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 px-2 py-2 mt-1 group">
            <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">
                {(currentUser?.name || 'L').charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-white/60 truncate flex-1">{currentUser?.name || 'Lev Freedman'}</span>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all"
            >
              <LogOut size={13} />
            </button>
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

function NavBtn({ icon, label, id, active, expanded, onClick, badge }: {
  icon: React.ReactNode; label: string; id: string; active: boolean;
  expanded: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${active ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}`}
    >
      <span className="flex-shrink-0">{icon}</span>
      {expanded && <span className="flex-1 text-left">{label}</span>}
      {expanded && badge ? (
        <span className="bg-brand-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">{badge}</span>
      ) : null}
    </button>
  );
}
