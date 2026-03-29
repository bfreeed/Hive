import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { LayoutGrid, List, Plus, ArrowUpDown, X, Lock, ChevronRight, FolderOpen } from 'lucide-react';
import type { Task } from '../types';
import { isPast } from 'date-fns';
import TaskRow from '../components/TaskRow';
import BoardView from '../components/BoardView';
import DocEditor from '../components/DocEditor';
import ProjectWorkspace from '../components/ProjectWorkspace';
import DriveFolderView from '../components/DriveFolderView';
import { buildGroups, sortTasks } from '../utils/buildGroups';
import type { BoardGroupBy, BoardSortBy, BoardSortOrder } from '../utils/buildGroups';
import { GOOGLE_CLIENT_ID_KEY } from '../lib/storageKeys';

const PROJECT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

export default function ProjectHub({ projectId, onNavigate, onOpenTask }: { projectId: string; onNavigate: (page: string, id?: string) => void; onOpenTask: (id: string) => void }) {
  const { projects, tasks, users, contacts, addTask, updateProject, addUser, addProject, userSettings } = useStore();
  const [inviteEmail, setInviteEmail] = useState('');
  const inviteRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'workspace' | 'docs' | 'contacts' | 'members'>('tasks');
  const [viewType, setViewType] = useState<'list' | 'board'>('list');
  const [showSort, setShowSort] = useState(false);
  const [groupBy, setGroupBy] = useState<BoardGroupBy>('none');
  const [sortBy, setSortBy] = useState<BoardSortBy>('date');
  const [sortOrder, setSortOrder] = useState<BoardSortOrder>('asc');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const addTaskRef = useRef<HTMLInputElement>(null);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  // Sub-project section collapsed state
  const [subProjectsCollapsed, setSubProjectsCollapsed] = useState(false);

  // Sub-project creation
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubColor, setNewSubColor] = useState(PROJECT_COLORS[0]);
  const newSubRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddSub) newSubRef.current?.focus();
  }, [showAddSub]);

  const handleAddSubProject = () => {
    if (!newSubName.trim()) { setShowAddSub(false); return; }
    addProject({
      name: newSubName.trim(),
      color: newSubColor,
      status: 'active',
      memberIds: project?.memberIds ?? ['lev'],
      isPrivate: project?.isPrivate ?? false,
      parentId: projectId,
    });
    setNewSubName('');
    setNewSubColor(PROJECT_COLORS[0]);
    setShowAddSub(false);
  };

  useEffect(() => {
    if (showAddTask) addTaskRef.current?.focus();
  }, [showAddTask]);

  // Close share popover on outside click
  useEffect(() => {
    if (!showSharePopover) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShowSharePopover(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSharePopover]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) { setShowAddTask(false); return; }
    addTask({
      title: newTaskTitle.trim(),
      projectIds: [projectId],
      status: 'todo',
      priority: 'medium',
      assigneeIds: ['lev'],
      flags: [],
      isPrivate: project?.isPrivate ?? false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setNewTaskTitle('');
    setShowAddTask(false);
  };

  const project = projects.find((p) => p.id === projectId);
  if (!project) return <div className="flex-1 flex items-center justify-center text-white/30">Project not found</div>;

  const parentProject = project.parentId ? projects.find(p => p.id === project.parentId) : null;
  const subProjects = projects.filter(p => p.parentId === projectId);

  const allProjectTasks = tasks.filter((t) => t.projectIds?.includes(projectId));
  const projectTasks = allProjectTasks.filter((t) => t.status !== 'done');
  const doneTasks = allProjectTasks.filter((t) => t.status === 'done');
  const overdue = projectTasks.filter((t) => t.dueDate && isPast(new Date(t.dueDate)));
  const projectContacts = contacts.filter((c) => c.projectIds.includes(projectId));
  const progress = allProjectTasks.length > 0
    ? Math.round((doneTasks.length / allProjectTasks.length) * 100)
    : 0;

  const sortActive = groupBy !== 'none' || sortBy !== 'date' || sortOrder !== 'asc';
  // List: active tasks only, sorted
  const sortedActive = sortTasks(projectTasks, sortBy, sortOrder, projects, users);
  // Board: all statuses, sorted, grouped
  const boardGroups = buildGroups(
    sortTasks(allProjectTasks, sortBy, sortOrder, projects, users),
    groupBy === 'none' ? 'status' : groupBy,
    projects,
    users,
  );
  // List grouped (for when groupBy is set)
  const listGroups = buildGroups(sortedActive, groupBy, projects, users);

  const SelectFilter = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none cursor-pointer hover:border-white/20 transition-colors"
    >
      {children}
    </select>
  );

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Breadcrumb — only shown for sub-projects */}
        {parentProject && (
          <div className="flex items-center gap-1.5 mb-4 text-xs text-white/30">
            <button
              onClick={() => onNavigate('project', parentProject.id)}
              className="flex items-center gap-1.5 hover:text-white/60 transition-colors"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: parentProject.color }} />
              {parentProject.name}
            </button>
            <ChevronRight size={11} />
            <span className="text-white/50">{project.name}</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                <h1 className="text-2xl font-semibold text-white tracking-tight">{project.name}</h1>

                {/* Share button + popover */}
                <div className="relative" ref={shareRef}>
                  <button
                    onClick={() => setShowSharePopover(s => !s)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${project.isPrivate ? 'bg-amber-500/15 text-amber-400/80 hover:bg-amber-500/25' : 'bg-white/[0.04] text-white/20 hover:text-white/50 hover:bg-white/[0.08]'}`}
                  >
                    {project.isPrivate ? (
                      <><Lock size={11} /> Private</>
                    ) : (
                      <>
                        {/* Member avatar stack */}
                        <div className="flex -space-x-1">
                          {project.memberIds.slice(0, 3).map(mid => {
                            const u = users.find(u => u.id === mid);
                            return u ? (
                              <span key={mid} className="w-4 h-4 rounded-full bg-brand-600/60 border border-white/10 flex items-center justify-center text-[9px] font-semibold text-white/80">
                                {u.name[0]}
                              </span>
                            ) : null;
                          })}
                        </div>
                        Shared
                        {project.memberIds.length > 1 && (
                          <span className="text-white/30">· {project.memberIds.length}</span>
                        )}
                      </>
                    )}
                  </button>

                  {showSharePopover && (
                    <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#1a1a2e] border border-white/[0.10] rounded-xl shadow-2xl z-50 p-3">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Sharing</p>

                      {/* Private toggle */}
                      <button
                        onClick={() => updateProject(projectId, { isPrivate: !project.isPrivate })}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs mb-3 transition-colors ${project.isPrivate ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08]'}`}
                      >
                        <Lock size={12} />
                        {project.isPrivate ? 'Private — only you can see this' : 'Make private'}
                      </button>

                      {!project.isPrivate && (
                        <>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 px-0.5">Members</p>
                          <div className="space-y-1 mb-2">
                            {project.memberIds.map(mid => {
                              const u = users.find(u => u.id === mid);
                              if (!u) return null;
                              const isOwner = mid === 'lev';
                              return (
                                <div key={mid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
                                  <span className="w-6 h-6 rounded-full bg-brand-600/40 flex items-center justify-center text-xs font-semibold text-white/70 flex-shrink-0">
                                    {u.name[0]}
                                  </span>
                                  <span className="flex-1 text-sm text-white/70 truncate">{u.name}</span>
                                  {isOwner
                                    ? <span className="text-[10px] text-white/20">Owner</span>
                                    : <button
                                        onClick={() => updateProject(projectId, { memberIds: project.memberIds.filter(id => id !== mid) })}
                                        className="text-white/20 hover:text-red-400 transition-colors"
                                      >
                                        <X size={12} />
                                      </button>
                                  }
                                </div>
                              );
                            })}
                          </div>

                          {/* Existing users not yet in project */}
                          {users.filter(u => !project.memberIds.includes(u.id)).length > 0 && (
                            <div className="space-y-1 mb-2">
                              {users.filter(u => !project.memberIds.includes(u.id)).map(u => (
                                <button
                                  key={u.id}
                                  onClick={() => updateProject(projectId, { memberIds: [...project.memberIds, u.id] })}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
                                >
                                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/40 flex-shrink-0">
                                    {u.name[0]}
                                  </span>
                                  <span className="flex-1 text-sm text-white/40 group-hover:text-white/70 text-left truncate">{u.name}</span>
                                  <span className="text-[10px] text-white/20 group-hover:text-white/40">{u.email}</span>
                                  <Plus size={12} className="text-white/20 group-hover:text-brand-400 flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Invite by email */}
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 px-0.5">Invite by email</p>
                          <div className="flex gap-1.5">
                            <input
                              ref={inviteRef}
                              type="email"
                              value={inviteEmail}
                              onChange={e => setInviteEmail(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && inviteEmail.trim()) {
                                  const user = addUser(inviteEmail.trim());
                                  if (!project.memberIds.includes(user.id)) {
                                    updateProject(projectId, { memberIds: [...project.memberIds, user.id] });
                                  }
                                  setInviteEmail('');
                                }
                              }}
                              placeholder="name@example.com"
                              className="flex-1 min-w-0 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/40"
                            />
                            <button
                              onClick={() => {
                                if (!inviteEmail.trim()) return;
                                const user = addUser(inviteEmail.trim());
                                if (!project.memberIds.includes(user.id)) {
                                  updateProject(projectId, { memberIds: [...project.memberIds, user.id] });
                                }
                                setInviteEmail('');
                              }}
                              className="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-colors flex-shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {project.description && <p className="text-white/40 text-sm">{project.description}</p>}
            </div>
            <button
              onClick={() => { setActiveTab('tasks'); setShowAddTask(true); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus size={14} /> Add Task
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <Stat label="Active" value={projectTasks.length} color="text-white/70" />
            <Stat label="Overdue" value={overdue.length} color={overdue.length > 0 ? 'text-red-400' : 'text-white/30'} />
            <Stat label="Done" value={doneTasks.length} color="text-emerald-400" />
            <Stat label="Contacts" value={projectContacts.length} color="text-white/50" />
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-white/40">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Sub-projects — shown for any project that has or can have sub-projects */}
        {(subProjects.length > 0 || !project.parentId) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setSubProjectsCollapsed(v => !v)}
                className="flex items-center gap-1.5 group"
              >
                <ChevronRight
                  size={13}
                  className={`text-white/25 transition-transform ${subProjectsCollapsed ? '' : 'rotate-90'}`}
                />
                <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider group-hover:text-white/50 transition-colors">
                  Sub-projects {subProjects.length > 0 && <span className="font-normal text-white/20">({subProjects.length})</span>}
                </h2>
              </button>
              {!showAddSub && !subProjectsCollapsed && (
                <button
                  onClick={() => setShowAddSub(true)}
                  className="flex items-center gap-1 text-xs text-white/25 hover:text-white/60 transition-colors"
                >
                  <Plus size={11} /> Add
                </button>
              )}
            </div>

            {!subProjectsCollapsed && <div className="flex flex-wrap gap-3">
              {subProjects.map(sub => {
                const subActive = tasks.filter(t => (t.projectIds ?? []).includes(sub.id) && t.status !== 'done').length;
                const subDone = tasks.filter(t => (t.projectIds ?? []).includes(sub.id) && t.status === 'done').length;
                const subTotal = subActive + subDone;
                const subProgress = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;
                return (
                  <button
                    key={sub.id}
                    onClick={() => onNavigate('project', sub.id)}
                    className="flex flex-col gap-2 w-44 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-white/[0.15] hover:bg-white/[0.05] transition-all text-left group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                      <span className="text-sm font-medium text-white/80 truncate flex-1 group-hover:text-white">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/30">
                      <FolderOpen size={10} />
                      <span>{subActive} active</span>
                      {subDone > 0 && <span>· {subDone} done</span>}
                    </div>
                    {subTotal > 0 && (
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500/60" style={{ width: `${subProgress}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Inline new sub-project form */}
              {showAddSub && (
                <div className="w-44 p-3 bg-white/[0.04] border border-white/[0.10] rounded-xl space-y-2">
                  <input
                    ref={newSubRef}
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSubProject();
                      if (e.key === 'Escape') { setShowAddSub(false); setNewSubName(''); }
                    }}
                    placeholder="Sub-project name"
                    className="w-full bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PROJECT_COLORS.map(c => (
                      <button key={c} onClick={() => setNewSubColor(c)}
                        className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }}
                      >
                        {newSubColor === c && <span className="block w-1.5 h-1.5 rounded-full bg-white/80" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={handleAddSubProject} className="flex-1 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-colors">Create</button>
                    <button onClick={() => { setShowAddSub(false); setNewSubName(''); }} className="flex-1 py-1 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {subProjects.length === 0 && !showAddSub && (
                <button
                  onClick={() => setShowAddSub(true)}
                  className="flex flex-col items-center justify-center gap-1.5 w-44 h-20 border border-dashed border-white/[0.08] rounded-xl text-white/20 hover:text-white/40 hover:border-white/[0.15] transition-all"
                >
                  <Plus size={14} />
                  <span className="text-xs">New sub-project</span>
                </button>
              )}
            </div>}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center border-b border-white/[0.06] mb-6">
          {(['tasks', 'workspace', 'docs', 'contacts', 'members'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm transition-colors relative capitalize ${activeTab === tab ? 'text-white font-medium' : 'text-white/40 hover:text-white/70'}`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>
          ))}
          {/* List/Board + Sort — only when tasks tab is active */}
          {activeTab === 'tasks' && (
            <div className="ml-auto flex items-center gap-1">
              {([
                { id: 'list' as const,  icon: <List size={14} />,       label: 'List'  },
                { id: 'board' as const, icon: <LayoutGrid size={14} />, label: 'Board' },
              ]).map(v => (
                <button
                  key={v.id}
                  onClick={() => setViewType(v.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    viewType === v.id ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
                >
                  {v.icon}{v.label}
                </button>
              ))}
              <span className="w-px h-4 bg-white/[0.08] mx-1" />
              <button
                onClick={() => setShowSort(s => !s)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  sortActive ? 'bg-brand-600/20 text-brand-300' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                <ArrowUpDown size={13} />
                Sort
                {sortActive && <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />}
              </button>
            </div>
          )}
        </div>

        {/* Task Tab */}
        {activeTab === 'tasks' && (
          <>

            {/* Sort/Group panel */}
            {showSort && (
              <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30 font-medium w-12">Group</span>
                  <SelectFilter value={groupBy} onChange={v => setGroupBy(v as BoardGroupBy)}>
                    <option value="none">No Grouping</option>
                    <option value="priority">Priority</option>
                    <option value="date">Date</option>
                    <option value="assignee">Assignee</option>
                    <option value="status">Status</option>
                  </SelectFilter>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30 font-medium w-8">Sort</span>
                  <SelectFilter value={sortBy} onChange={v => setSortBy(v as BoardSortBy)}>
                    <option value="date">Date</option>
                    <option value="priority">Priority</option>
                    <option value="assignee">Assignee</option>
                    <option value="status">Status</option>
                  </SelectFilter>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
                  {[{ id: 'asc', label: '↑ Asc' }, { id: 'desc', label: '↓ Desc' }].map(o => (
                    <button
                      key={o.id}
                      onClick={() => setSortOrder(o.id as BoardSortOrder)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${sortOrder === o.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {sortActive && (
                  <button
                    onClick={() => { setGroupBy('none'); setSortBy('date'); setSortOrder('asc'); }}
                    className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            {viewType === 'list' && (
              <div className="space-y-0.5">
                {groupBy === 'none' ? (
                  <>
                    {sortedActive.length === 0 && !showAddTask
                      ? <p className="text-white/20 text-sm py-8 text-center">No active tasks</p>
                      : sortedActive.map((t) => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} />)
                    }
                  </>
                ) : (
                  <div className="space-y-6">
                    {listGroups.map((group, gi) => (
                      <div key={gi}>
                        {group.label && (
                          <div className="flex items-center gap-2 mb-1 px-1">
                            {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
                            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{group.label}</span>
                            <span className="text-xs text-white/20">{group.tasks.length}</span>
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {group.tasks.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Inline add-task */}
                {showAddTask ? (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="w-4 h-4 rounded border-2 border-white/20 flex-shrink-0" />
                    <input
                      ref={addTaskRef}
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTask();
                        if (e.key === 'Escape') { setShowAddTask(false); setNewTaskTitle(''); }
                      }}
                      onBlur={() => { if (!newTaskTitle.trim()) setShowAddTask(false); }}
                      placeholder="New task name..."
                      className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 focus:outline-none"
                    />
                    <button onClick={handleAddTask} className="px-2.5 py-1 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-500 transition-colors">Add</button>
                    <button onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }} className="p-1 text-white/20 hover:text-white/50 transition-colors"><X size={13} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddTask(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-white/20 hover:text-white/50 hover:bg-white/[0.03] rounded-lg text-sm transition-colors"
                  >
                    <Plus size={13} /> Add task
                  </button>
                )}
              </div>
            )}
            {viewType === 'board' && <BoardView groups={boardGroups} onOpenTask={onOpenTask} addTask={addTask} filterProject={projectId} />}
          </>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="space-y-2">
            {projectContacts.length === 0
              ? <p className="text-white/20 text-sm py-8 text-center">No contacts in this project</p>
              : projectContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/10 cursor-pointer transition-colors"
                  onClick={() => onNavigate('contact', c.id)}>
                  <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-sm font-semibold text-brand-300">
                    {c.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/80">{c.name}</p>
                    {c.email && <p className="text-xs text-white/30">{c.email}</p>}
                  </div>
                  <span className="ml-auto text-xs text-white/20">{c.linkedTaskIds.length} tasks</span>
                </div>
              ))
            }
          </div>
        )}

        {/* Workspace Tab */}
        {activeTab === 'workspace' && (
          <div className="-mx-6 -mb-6 h-[calc(100vh-220px)] flex flex-col">
            <ProjectWorkspace
              content={project.docContent ?? null}
              onChange={(json) => updateProject(projectId, { docContent: json })}
            />
          </div>
        )}

        {/* Docs Tab */}
        {activeTab === 'docs' && (() => {
          const clientId = userSettings?.googleClientId || localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || undefined;
          if (clientId || project.googleDriveFolderId) {
            return (
              <div>
                <DriveFolderView
                  folderId={project.googleDriveFolderId}
                  folderName={project.googleDriveFolderName}
                  clientId={clientId}
                  onLink={(folderId, folderName) => updateProject(projectId, { googleDriveFolderId: folderId, googleDriveFolderName: folderName })}
                  onUnlink={() => updateProject(projectId, { googleDriveFolderId: undefined, googleDriveFolderName: undefined })}
                />
              </div>
            );
          }
          return (
            <DocEditor
              content={project.docContent ?? null}
              onChange={(json) => updateProject(projectId, { docContent: json })}
            />
          );
        })()}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-semibold ${color}`}>{value}</span>
      <span className="text-xs text-white/30">{label}</span>
    </div>
  );
}
