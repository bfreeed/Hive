import React, { useState } from 'react';
import { useStore } from '../store';
import { Plus, Search, ArrowUpDown, List, LayoutGrid } from 'lucide-react';
import type { Task } from '../types';
import TaskRow from '../components/TaskRow';
import BoardView from '../components/BoardView';
import InlineCapture from '../components/InlineCapture';
import { buildGroups, sortTasks } from '../utils/buildGroups';
import type { BoardGroupBy, BoardSortBy, BoardSortOrder } from '../utils/buildGroups';

type ActiveTab = 'status' | 'priority' | 'project' | 'date' | 'today' | 'completed';

type TabSettings = { viewMode: 'list' | 'board'; sortBy: BoardSortBy; sortOrder: BoardSortOrder };

const DEFAULT_TAB_SETTINGS: Record<ActiveTab, TabSettings> = {
  status:    { viewMode: 'board', sortBy: 'priority', sortOrder: 'asc' },
  priority:  { viewMode: 'board', sortBy: 'date',     sortOrder: 'asc' },
  project:   { viewMode: 'board', sortBy: 'priority', sortOrder: 'asc' },
  date:      { viewMode: 'list',  sortBy: 'date',     sortOrder: 'asc' },
  today:     { viewMode: 'list',  sortBy: 'priority', sortOrder: 'asc' },
  completed: { viewMode: 'list',  sortBy: 'date',     sortOrder: 'desc' },
};

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'status',    label: 'By Status'   },
  { id: 'priority',  label: 'By Priority' },
  { id: 'project',   label: 'By Project'  },
  { id: 'date',      label: 'By Date'     },
  { id: 'today',     label: 'Today'       },
  { id: 'completed', label: 'Completed'   },
];

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

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];
  let hash = 0;
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  const avatarColor = COLORS[hash % COLORS.length];

  // Base: tasks assigned to this member
  const memberTasks = tasks.filter((t) => {
    if (!t.assigneeIds.includes(userId)) return false;
    if (t.isPrivate && !t.assigneeIds.includes(currentUser.id)) return false;
    const isInPrivateProject = (t.projectIds ?? []).some(pid => projects.find(p => p.id === pid)?.isPrivate);
    if (isInPrivateProject) return false;
    return true;
  });

  // Tab + per-tab settings
  const [activeTab, setActiveTab] = useState<ActiveTab>('status');
  const storageKey = `member-tab-settings-${userId}`;
  const [tabSettings, setTabSettings] = useState<Record<ActiveTab, TabSettings>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...DEFAULT_TAB_SETTINGS, ...JSON.parse(saved) } : DEFAULT_TAB_SETTINGS;
    } catch { return DEFAULT_TAB_SETTINGS; }
  });
  const updateTabSettings = (updates: Partial<TabSettings>) => {
    setTabSettings(prev => {
      const next = { ...prev, [activeTab]: { ...prev[activeTab], ...updates } };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };
  const { viewMode, sortBy, sortOrder } = tabSettings[activeTab];
  const setSortBy = (v: BoardSortBy) => updateTabSettings({ sortBy: v });
  const setSortOrder = (v: BoardSortOrder) => updateTabSettings({ sortOrder: v });
  const setViewMode = (v: 'list' | 'board') => updateTabSettings({ viewMode: v });

  // Derived
  const isBoard = viewMode === 'board';
  const boardGroupBy: BoardGroupBy =
    activeTab === 'priority' ? 'priority' :
    activeTab === 'project'  ? 'project'  :
    activeTab === 'date'     ? 'date'     :
    'status';

  // Search + sort panel
  const [search, setSearch] = useState('');
  const [showSort, setShowSort] = useState(false);

  // New task
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');

  // Filter tasks by tab
  const filtered = memberTasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeTab === 'completed') return t.status === 'done';
    if (activeTab === 'today') {
      if (t.status === 'done' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return d <= today;
    }
    return t.status !== 'done';
  });

  const sorted = sortTasks(filtered, sortBy, sortOrder, projects, users);
  const listGroups = buildGroups(sorted, activeTab === 'date' ? 'date' : 'none', projects, users);
  const boardGroups = buildGroups(
    sortTasks(memberTasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return t.status !== 'done';
    }), sortBy, sortOrder, projects, users),
    boardGroupBy,
    projects,
    users,
  );

  const sortActive = sortBy !== 'priority' || sortOrder !== 'asc';

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
      <div className={`mx-auto px-8 py-8 ${isBoard ? 'max-w-full' : 'max-w-4xl'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
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
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/50 w-40"
              />
            </div>
            <button
              onClick={() => setShowNewTask(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-colors"
            >
              <Plus size={13} /> New Task
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-white/[0.06] mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm transition-colors relative ${
                activeTab === tab.id ? 'text-white font-medium' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
              )}
            </button>
          ))}
          {/* View + Sort */}
          <div className="ml-auto flex items-center gap-1">
            {([
              { id: 'list' as const,  icon: <List size={14} />,       label: 'List'  },
              { id: 'board' as const, icon: <LayoutGrid size={14} />, label: 'Board' },
            ]).map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === v.id ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {v.icon}{v.label}
              </button>
            ))}
            <span className="w-px h-4 bg-white/[0.08] mx-1" />
            <button
              onClick={() => setShowSort(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                sortActive ? 'bg-brand-600/20 text-brand-300' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <ArrowUpDown size={13} />
              Sort
              {sortActive && <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />}
            </button>
          </div>
        </div>

        {/* Sort panel */}
        {showSort && (
          <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
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
                onClick={() => { setSortBy('priority'); setSortOrder('asc'); }}
                className="ml-auto text-xs text-white/30 hover:text-white/60"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* New task input */}
        {showNewTask && (
          <div className="max-w-3xl mx-auto">
            <InlineCapture
              initialAssigneeId={userId}
              showCollapsedButton={false}
              onCreated={() => setShowNewTask(false)}
              onCancel={() => setShowNewTask(false)}
              onOpenDetail={id => { setShowNewTask(false); onOpenTask(id); }}
            />
          </div>
        )}

        {/* Content */}
        {isBoard ? (
          <BoardView groups={boardGroups} onOpenTask={onOpenTask} addTask={addTask} filterProject="all" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/20">No tasks</p>
          </div>
        ) : activeTab === 'completed' ? (
          // Completed log grouped by date
          <div className="space-y-5">
            {listGroups.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div className="flex items-center gap-2 mb-1 px-3">
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
        ) : (
          <div className="space-y-0.5">
            {sorted.map(task => (
              <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} showProject />
            ))}
          </div>
        )}

        <p className="text-xs text-white/20 mt-6 text-center">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
