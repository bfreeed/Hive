import React, { useState } from 'react';
import { useStore } from '../store';
import { Plus, Search, ArrowUpDown, List, LayoutGrid, GitBranch } from 'lucide-react';
import type { Task, Priority } from '../types';
import TaskRow from '../components/TaskRow';
import BoardView from '../components/BoardView';
import { buildGroups, sortTasks } from '../utils/buildGroups';
import type { BoardGroupBy, BoardSortBy, BoardSortOrder } from '../utils/buildGroups';

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-white/20',
};

function MindMapView({ tasks, rootLabel, onOpenTask }: { tasks: Task[]; rootLabel: string; onOpenTask: (id: string) => void }) {
  const { projects } = useStore();
  const groups: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    const key = projects.find(p => p.id === t.projectIds?.[0])?.name || t.priority;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return (
    <div className="flex flex-col items-center py-8">
      <div className="bg-brand-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm mb-8 shadow-lg shadow-brand-600/20">
        {rootLabel}
      </div>
      <div className="flex flex-wrap justify-center gap-8">
        {Object.entries(groups).map(([group, groupTasks]) => (
          <div key={group} className="flex flex-col items-center gap-2 max-w-[200px]">
            <div className="bg-white/[0.08] border border-white/10 px-4 py-2 rounded-xl text-xs font-semibold text-white/60 uppercase tracking-wider">
              {group}
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="space-y-2 w-full">
              {groupTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onOpenTask(task.id)}
                  className="bg-white/[0.04] border border-white/[0.06] hover:border-white/10 rounded-lg px-3 py-2 cursor-pointer transition-colors"
                >
                  <p className="text-xs text-white/70">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-1 h-1 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                    <span className="text-[10px] text-white/30 capitalize">{task.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SelectFilter = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none cursor-pointer hover:border-white/20 transition-colors"
  >
    {children}
  </select>
);

export default function TeamMemberView({ userId, onOpenTask }: { userId: string; onOpenTask: (id: string) => void }) {
  const { tasks, projects, users, currentUser, addTask } = useStore();

  const member = users.find(u => u.id === userId);
  if (!member) return null;

  // Avatar color derived from user id
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
  let hash = 0;
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  const avatarColor = COLORS[hash % COLORS.length];

  // Base: tasks assigned to this member, excluding private ones the viewer shouldn't see
  const memberTasks = tasks.filter((t) => {
    if (!t.assigneeIds.includes(userId)) return false;
    if (t.isPrivate && !t.assigneeIds.includes(currentUser.id)) return false;
    const isInPrivateProject = (t.projectIds ?? []).some(pid => projects.find(p => p.id === pid)?.isPrivate);
    if (isInPrivateProject) return false;
    return true;
  });

  // Filters
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterPriority, setFilterPriority] = useState('all');

  // Sort & Group
  const [showSort, setShowSort] = useState(false);
  const [groupBy, setGroupBy] = useState<BoardGroupBy>('none');
  const [sortBy, setSortBy] = useState<BoardSortBy>('date');
  const [sortOrder, setSortOrder] = useState<BoardSortOrder>('asc');

  // View
  const [viewType, setViewType] = useState<'list' | 'board' | 'mindmap'>('list');

  // New task
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');

  const baseFilter = (t: Task) => {
    if (filterProject !== 'all' && !(t.projectIds ?? []).includes(filterProject)) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const filtered = memberTasks.filter((t) => {
    if (filterStatus === 'active' && t.status === 'done') return false;
    if (filterStatus !== 'active' && filterStatus !== 'all' && t.status !== filterStatus) return false;
    return baseFilter(t);
  });

  const filteredAllStatuses = memberTasks.filter(baseFilter);

  const sorted = sortTasks(filtered, sortBy, sortOrder, projects, users);
  const sortedAllStatuses = sortTasks(filteredAllStatuses, sortBy, sortOrder, projects, users);
  const groups = buildGroups(sorted, groupBy, projects, users);
  const boardGroups = buildGroups(sortedAllStatuses, groupBy === 'none' ? 'status' : groupBy, projects, users);

  const sortActive = groupBy !== 'none' || sortBy !== 'date' || sortOrder !== 'asc';

  const activeTasks = memberTasks.filter(t => t.status !== 'done');
  const doingCount = activeTasks.filter(t => t.status === 'doing' || t.status === 'todo').length;
  const waitingCount = activeTasks.filter(t => t.status === 'waiting').length;
  const reviewCount = activeTasks.filter(t => t.status === 'review').length;

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle.trim(),
      projectIds: newTaskProject ? [newTaskProject] : [],
      status: 'todo',
      priority: 'medium',
      assigneeIds: [userId],
      flags: [],
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setNewTaskTitle('');
    setShowNewTask(false);
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-semibold"
              style={{ backgroundColor: avatarColor + '33', color: avatarColor }}
            >
              {member.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">{member.name}</h1>
              <p className="text-white/40 text-sm">
                {doingCount} active · {waitingCount} waiting · {reviewCount} in review
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus size={14} /> New Task
          </button>
        </div>

        {/* Row 1: filters */}
        <div className="relative mb-1.5">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pr-8">
            <SelectFilter value={filterProject} onChange={setFilterProject}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectFilter>
            <SelectFilter value={filterStatus} onChange={setFilterStatus}>
              <option value="active">Active</option>
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="doing">Doing</option>
              <option value="waiting">Waiting</option>
              <option value="review">In Review</option>
              <option value="done">Done</option>
            </SelectFilter>
            <SelectFilter value={filterPriority} onChange={setFilterPriority}>
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </SelectFilter>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#0d0d0f] to-transparent" />
        </div>

        {/* Row 2: view switcher + search + sort */}
        <div className="flex items-center gap-1 mb-2">
          {[
            { id: 'list', icon: <List size={14} />, label: 'List' },
            { id: 'board', icon: <LayoutGrid size={14} />, label: 'Board' },
            { id: 'mindmap', icon: <GitBranch size={14} />, label: 'Map' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewType(v.id as any)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${viewType === v.id ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}
            >
              {v.icon}{v.label}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-7 pr-3 py-1.5 w-24 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-brand-500/50"
            />
          </div>
          <button
            onClick={() => setShowSort(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              sortActive
                ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70'
            }`}
          >
            <ArrowUpDown size={13} />
            Sort
            {sortActive && <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />}
          </button>
        </div>

        {/* Sort/Group panel */}
        {showSort && (
          <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/30 w-12">Group</span>
              <SelectFilter value={groupBy} onChange={v => setGroupBy(v as BoardGroupBy)}>
                <option value="none">No Grouping</option>
                <option value="priority">Priority</option>
                <option value="date">Date</option>
                <option value="status">Status</option>
                <option value="project">Project</option>
              </SelectFilter>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30 font-medium w-8">Sort</span>
              <SelectFilter value={sortBy} onChange={v => setSortBy(v as BoardSortBy)}>
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
                <option value="project">Project</option>
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

        {/* New task input */}
        {showNewTask && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-white/[0.04] rounded-xl border border-white/[0.08]">
            <input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') setShowNewTask(false); }}
              placeholder="Task title..."
              className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
            />
            <select
              value={newTaskProject}
              onChange={(e) => setNewTaskProject(e.target.value)}
              className="text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/60 focus:outline-none"
            >
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={handleAddTask} className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-500 transition-colors">Add</button>
            <button onClick={() => setShowNewTask(false)} className="text-white/30 hover:text-white/60 text-xs">Cancel</button>
          </div>
        )}

        {/* Task list / board / mindmap */}
        {viewType === 'board' ? (
          <BoardView groups={boardGroups} onOpenTask={onOpenTask} />
        ) : viewType === 'mindmap' ? (
          <MindMapView tasks={sortedAllStatuses} rootLabel={member.name} onOpenTask={onOpenTask} />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/20">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{group.label}</span>
                    <span className="text-xs text-white/20">{group.tasks.length}</span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.tasks.map(task => (
                    <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} showProject />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-white/20 mt-6 text-center">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
