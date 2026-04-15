import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import {
  Plus, Search, ArrowUpDown, GripVertical, List, LayoutGrid,
  ChevronDown, ChevronRight, X, Trash2, Pencil, Lock, RotateCcw,
  Users, Check,
} from 'lucide-react';
import type { Task, Priority, Section } from '../types';
import TaskRow from '../components/TaskRow';
import InlineCapture, { type InlineCaptureHandle } from '../components/InlineCapture';
import BoardView from '../components/BoardView';
import { buildGroups, sortTasks } from '../utils/buildGroups';
import type { BoardGroupBy, BoardSortBy, BoardSortOrder } from '../utils/buildGroups';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ActiveTab = 'status' | 'priority' | 'project' | 'date' | 'today' | 'completed' | 'flag';

// ---------------------------------------------------------------------------
// Sortable task row (used in manual DnD mode)
// ---------------------------------------------------------------------------
function SortableTaskRow({ task, onOpenTask, showProject, focused, focusRef }: {
  task: Task; onOpenTask: (id: string) => void; showProject: boolean; focused: boolean; focusRef?: React.Ref<HTMLDivElement>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center group/drag">
      <div {...attributes} {...listeners} className="px-1 py-2.5 cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors flex-shrink-0">
        <GripVertical size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <TaskRow task={task} onOpenTask={onOpenTask} showProject={showProject} focused={focused} ref={focusRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable tab (used in tab reorder mode)
// ---------------------------------------------------------------------------
function SortableTab({ id, label, active, onClick }: {
  id: string; label: string; active: boolean; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      {...attributes}
      {...listeners}
      className={`px-3 py-2 text-sm transition-colors relative select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${active ? 'text-white font-medium' : 'text-white/40 hover:text-white/70'}`}
    >
      {label}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable section row (used in sections DnD mode)
// ---------------------------------------------------------------------------
function SortableSection({ section, children, onDragHandleProps }: {
  section: Section;
  children: React.ReactNode;
  onDragHandleProps: Record<string, unknown>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        dragHandleProps: { ...attributes, ...listeners, ...onDragHandleProps },
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: format relative completed time
// ---------------------------------------------------------------------------
function formatCompletedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffMs / 86400000);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function TasksPage({ onOpenTask, filterProject: filterProjectProp }: {
  onOpenTask: (id: string) => void;
  filterProject?: string;
}) {
  const {
    tasks, projects, users, currentUser, addTask, updateTask,
    manualOrder, setManualOrder,
    sections, addSection, updateSection, deleteSection,
  } = useStore();

  const captureRef = useRef<InlineCaptureHandle>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const tabSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Tab state — persisted to localStorage
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    return (localStorage.getItem('hive_tasks_activeTab') as ActiveTab) ?? 'status';
  });
  const handleSetActiveTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    localStorage.setItem('hive_tasks_activeTab', tab);
  };

  // Filters
  const [search, setSearch] = useState('');
  const [filterFlag, setFilterFlag] = useState('');
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<string[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const assigneePickerRef = useRef<HTMLDivElement>(null);
  const filterProject = filterProjectProp ?? 'all';

  // All unique flags across all users (for the flag filter dropdown)
  const allFlags = useMemo(() => {
    const seen = new Set<string>();
    return users.flatMap(u => u.flags).filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
  }, [users]);

  // Per-tab settings: each tab stores its own viewMode + sort
  type TabSettings = { viewMode: 'list' | 'board'; sortBy: BoardSortBy; sortOrder: BoardSortOrder };
  const DEFAULT_TAB_SETTINGS: Record<ActiveTab, TabSettings> = {
    status:    { viewMode: 'board', sortBy: 'priority', sortOrder: 'asc' },
    priority:  { viewMode: 'board', sortBy: 'date',     sortOrder: 'asc' },
    project:   { viewMode: 'board', sortBy: 'priority', sortOrder: 'asc' },
    date:      { viewMode: 'list',  sortBy: 'date',     sortOrder: 'asc' },
    flag:      { viewMode: 'list',  sortBy: 'flag',     sortOrder: 'asc' },
    today:     { viewMode: 'list',  sortBy: 'priority', sortOrder: 'asc' },
    completed: { viewMode: 'list',  sortBy: 'date',     sortOrder: 'desc' },
  };
  const [tabSettings, setTabSettings] = useState<Record<ActiveTab, TabSettings>>(() => {
    try {
      const saved = localStorage.getItem('tasks-tab-settings');
      return saved ? { ...DEFAULT_TAB_SETTINGS, ...JSON.parse(saved) } : DEFAULT_TAB_SETTINGS;
    } catch { return DEFAULT_TAB_SETTINGS; }
  });
  const updateTabSettings = (updates: Partial<TabSettings>) => {
    setTabSettings(prev => {
      const next = { ...prev, [activeTab]: { ...prev[activeTab], ...updates } };
      localStorage.setItem('tasks-tab-settings', JSON.stringify(next));
      return next;
    });
  };
  const { viewMode, sortBy, sortOrder } = tabSettings[activeTab];
  const setSortBy = (v: BoardSortBy) => updateTabSettings({ sortBy: v });
  const setSortOrder = (v: BoardSortOrder) => updateTabSettings({ sortOrder: v });
  const setViewMode = (v: 'list' | 'board') => updateTabSettings({ viewMode: v });

  const [showSort, setShowSort] = useState(false);

  // Keyboard navigation
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const focusedRowRef = useRef<HTMLDivElement>(null);

  // New task

  // Subtask state
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Set<string>>(new Set());
  const [newSubtaskParent, setNewSubtaskParent] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Section state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addTaskSectionId, setAddTaskSectionId] = useState<string | null>(null);
  const [addTaskSectionTitle, setAddTaskSectionTitle] = useState('');

  // ---------------------------------------------------------------------------
  // Derive view settings from activeTab
  // ---------------------------------------------------------------------------
  const isBoard = viewMode === 'board';
  const boardGroupBy: BoardGroupBy =
    activeTab === 'priority' ? 'priority' :
    activeTab === 'project' ? 'project' :
    activeTab === 'date' ? 'date' :
    activeTab === 'flag' ? 'flag' :
    'status';
  const filterToday = activeTab === 'today';
  // Tab definitions
  const ALL_TABS = [
    { id: 'status' as ActiveTab,    label: 'By Status'   },
    { id: 'priority' as ActiveTab,  label: 'By Priority' },
    { id: 'project' as ActiveTab,   label: 'By Project'  },
    { id: 'date' as ActiveTab,      label: 'By Date'     },
    { id: 'flag' as ActiveTab,      label: 'By Flag'     },
    { id: 'today' as ActiveTab,     label: 'Today'       },
    { id: 'completed' as ActiveTab, label: 'Done'        },
  ];
  const DEFAULT_TAB_ORDER = ALL_TABS.map(t => t.id);
  const [tabOrder, setTabOrder] = useState<ActiveTab[]>(() => {
    try {
      const saved = localStorage.getItem('hive_tasks_tabOrder');
      if (saved) {
        const parsed: ActiveTab[] = JSON.parse(saved);
        // Ensure all tabs are present (in case new ones added later)
        const merged = [...parsed.filter(id => DEFAULT_TAB_ORDER.includes(id))];
        DEFAULT_TAB_ORDER.forEach(id => { if (!merged.includes(id)) merged.push(id); });
        return merged;
      }
    } catch {}
    return DEFAULT_TAB_ORDER;
  });
  const tabs = tabOrder.map(id => ALL_TABS.find(t => t.id === id)!).filter(Boolean);

  // ---------------------------------------------------------------------------
  // Filter helpers
  // ---------------------------------------------------------------------------
  // Base filter without assignee — used to compute which assignees are available
  const baseFilterNoAssignee = (t: Task) => {
    if (filterProject !== 'all' && !(t.projectIds ?? []).includes(filterProject)) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterFlag && !t.flags?.some(tf => tf.flagId === filterFlag)) return false;
    return true;
  };

  const baseFilter = (t: Task) => {
    if (!baseFilterNoAssignee(t)) return false;
    if (filterAssigneeIds.length > 0 && !filterAssigneeIds.some(id => (t.assigneeIds ?? []).includes(id))) return false;
    return true;
  };

  // Relevant assignees = unique users with tasks in the current view (ignoring assignee filter)
  const relevantAssignees = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof users = [];
    tasks.forEach(t => {
      if (!baseFilterNoAssignee(t)) return;
      (t.assigneeIds ?? []).forEach(id => {
        if (seen.has(id)) return;
        seen.add(id);
        const user = users.find(u => u.id === id) ?? (id === currentUser.id ? currentUser : null);
        if (user) result.push(user as typeof users[0]);
      });
    });
    return result.sort((a, b) => {
      if (a.id === currentUser.id) return -1;
      if (b.id === currentUser.id) return 1;
      return a.name.localeCompare(b.name);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filterProject, search, filterFlag, users, currentUser]);

  // Close assignee picker on outside click
  useEffect(() => {
    if (!showAssigneePicker) return;
    const handler = (e: MouseEvent) => {
      if (assigneePickerRef.current && !assigneePickerRef.current.contains(e.target as Node)) {
        setShowAssigneePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAssigneePicker]);

  const filtered = tasks.filter((t) => {
    if (!baseFilter(t)) return false;
    if (activeTab === 'completed') return t.status === 'done';
    if (activeTab === 'flag') return t.status !== 'done' && (t.flags?.length ?? 0) > 0;
    if (filterToday) {
      if (t.status === 'done' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      const today = new Date(); today.setHours(0,0,0,0);
      return d <= today || d.toDateString() === today.toDateString();
    }
    return t.status !== 'done';
  });

  // All-status list for board views (status/priority/project boards show all statuses)
  const filteredAllStatuses = tasks.filter(baseFilter);

  // Feature: filter out subtasks from top-level list
  const filteredTopLevel = filtered.filter(t => !t.parentId);
  const filteredAllTopLevel = filteredAllStatuses.filter(t => !t.parentId);

  // Build subtask map
  const subtasksByParent: Record<string, Task[]> = {};
  tasks.forEach(t => {
    if (t.parentId) {
      if (!subtasksByParent[t.parentId]) subtasksByParent[t.parentId] = [];
      subtasksByParent[t.parentId].push(t);
    }
  });

  // ---------------------------------------------------------------------------
  // Sort
  // ---------------------------------------------------------------------------
  const isManual = sortBy === ('manual' as BoardSortBy);
  const baseSorted = sortTasks(filteredTopLevel, isManual ? 'date' : sortBy, sortOrder, projects, users);
  const sorted = isManual
    ? [...baseSorted].sort((a, b) => {
        const ai = manualOrder.indexOf(a.id);
        const bi = manualOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : baseSorted;
  const sortedAllStatuses = sortTasks(filteredAllTopLevel, isManual ? 'date' : sortBy, sortOrder, projects, users);

  // ---------------------------------------------------------------------------
  // Groups (for regular list view — date grouping)
  // ---------------------------------------------------------------------------
  const dateGroups = buildGroups(sorted, 'date', projects, users);
  const boardGroups = buildGroups(sorted, boardGroupBy, projects, users);

  // ---------------------------------------------------------------------------
  // Assignee grouping — current user first, then teammates
  // Only active when tasks from multiple assignees are present.
  // ---------------------------------------------------------------------------
  const assigneeGroups = useMemo(() => {
    const myTasks = sorted.filter(t => (t.assigneeIds ?? []).includes(currentUser.id));
    const otherTasks = sorted.filter(t => !(t.assigneeIds ?? []).includes(currentUser.id));
    // Group other tasks by their first non-current-user assignee
    const otherMap = new Map<string, Task[]>();
    otherTasks.forEach(t => {
      const aid = (t.assigneeIds ?? []).find(id => id !== currentUser.id) ?? '__none__';
      if (!otherMap.has(aid)) otherMap.set(aid, []);
      otherMap.get(aid)!.push(t);
    });
    const groups: { userId: string; name: string; tasks: Task[] }[] = [];
    if (myTasks.length > 0) groups.push({ userId: currentUser.id, name: 'My Tasks', tasks: myTasks });
    otherMap.forEach((tasks, userId) => {
      const u = users.find(x => x.id === userId);
      groups.push({ userId, name: u ? `${u.name}'s Tasks` : 'Unassigned', tasks });
    });
    return groups;
  }, [sorted, currentUser.id, users]);
  const isMultiAssignee = assigneeGroups.length > 1;

  // ---------------------------------------------------------------------------
  // Dependency blocked helper
  // ---------------------------------------------------------------------------
  const isBlocked = (task: Task): boolean =>
    (task.dependsOn ?? []).some(depId => tasks.find(t => t.id === depId)?.status !== 'done');

  // ---------------------------------------------------------------------------
  // Keyboard navigation (list view only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isBoard) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') {
        if (sorted.length === 0) return;
        e.preventDefault();
        setFocusedIdx(prev => prev === null ? 0 : Math.min(prev + 1, sorted.length - 1));
      } else if (e.key === 'p' || e.key === 'P') {
        if (sorted.length === 0) return;
        e.preventDefault();
        setFocusedIdx(prev => prev === null ? 0 : Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (focusedIdx !== null && sorted[focusedIdx]) {
          e.preventDefault();
          onOpenTask(sorted[focusedIdx].id);
        }
      } else if (e.key === 'Escape') {
        setFocusedIdx(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isBoard, sorted, focusedIdx, onOpenTask]);

  useEffect(() => {
    focusedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  useEffect(() => {
    setFocusedIdx(null);
  }, [filterProject, activeTab, search, sortBy, sortOrder]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleAddTask = (title: string, sectionId?: string) => {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      projectIds: filterProject && filterProject !== 'all' ? [filterProject] : [],
      sectionId,
      status: 'todo',
      priority: 'medium',
      assigneeIds: [currentUser.id],
      flags: [],
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
  };

  const handleAddTaskFromBoard = (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    addTask(t);
  };

  const handleAddSubtask = (parentTask: Task) => {
    if (!newSubtaskTitle.trim()) return;
    addTask({
      title: newSubtaskTitle.trim(),
      parentId: parentTask.id,
      projectIds: parentTask.projectIds,
      sectionId: parentTask.sectionId,
      status: 'todo',
      priority: 'medium',
      assigneeIds: [currentUser.id],
      flags: [],
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setNewSubtaskTitle('');
    setNewSubtaskParent(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sorted.map(t => t.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    setManualOrder(arrayMove(ids, oldIdx, newIdx));
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const projectSections = sections
      .filter(s => s.projectId === filterProject)
      .sort((a, b) => a.order - b.order);
    const ids = projectSections.map(s => s.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    const reordered = arrayMove(ids, oldIdx, newIdx);
    reordered.forEach((id, idx) => {
      updateSection(id, { order: idx });
    });
  };

  const handleAddSection = () => {
    if (!newSectionName.trim() || filterProject === 'all') return;
    const projectSections = sections.filter(s => s.projectId === filterProject);
    addSection({ name: newSectionName.trim(), projectId: filterProject, order: projectSections.length });
    setNewSectionName('');
    setShowAddSection(false);
  };

  const handleAddTaskToSection = (sectionId: string | undefined) => {
    if (!addTaskSectionTitle.trim() || filterProject === 'all') return;
    addTask({
      title: addTaskSectionTitle.trim(),
      projectIds: [filterProject],
      sectionId,
      status: 'todo',
      priority: 'medium',
      assigneeIds: [currentUser.id],
      flags: [],
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setAddTaskSectionTitle('');
    setAddTaskSectionId(null);
  };

  const toggleSubtasks = (taskId: string) => {
    setCollapsedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const sortActive = sortBy !== 'date' || sortOrder !== 'asc';

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderTaskWithSubtasks = (
    task: Task,
    opts: {
      focused?: boolean;
      focusRef?: React.Ref<HTMLDivElement>;
      showProject?: boolean;
      showCompletedAt?: boolean;
      onReopen?: () => void;
    } = {},
  ) => {
    const subs = subtasksByParent[task.id] ?? [];
    const hasSubs = subs.length > 0;
    const isCollapsed = collapsedSubtasks.has(task.id);
    const doneSubs = subs.filter(s => s.status === 'done').length;
    const blocked = isBlocked(task);

    return (
      <div key={task.id}>
        {/* Parent task row */}
        <div className="relative group/taskrow flex items-center gap-1">
          {/* Subtask collapse chevron */}
          {hasSubs ? (
            <button
              onClick={() => toggleSubtasks(task.id)}
              className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors p-0.5"
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}

          {/* Progress indicator */}
          {hasSubs && (
            <span className="flex-shrink-0 text-[10px] text-white/25 font-medium tabular-nums mr-0.5">
              {doneSubs}/{subs.length}
            </span>
          )}

          <div className="flex-1 min-w-0">
            <TaskRow
              task={task}
              onOpenTask={onOpenTask}
              showProject={opts.showProject ?? true}
              focused={opts.focused ?? false}
              ref={opts.focusRef}
            />
          </div>

          {/* Blocked indicator */}
          {blocked && (
            <div className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-amber-400/70" title="Blocked by incomplete dependency">
              <Lock size={10} />
            </div>
          )}

          {/* Add subtask button (hover) */}
          <button
            onClick={() => { setNewSubtaskParent(task.id); setNewSubtaskTitle(''); }}
            className="flex-shrink-0 opacity-0 group-hover/taskrow:opacity-100 transition-opacity text-white/30 hover:text-white/70 p-0.5"
            title="Add subtask"
          >
            <Plus size={12} />
          </button>

          {/* Reopen button for completed log */}
          {opts.onReopen && (
            <button
              onClick={opts.onReopen}
              className="flex-shrink-0 opacity-0 group-hover/taskrow:opacity-100 transition-opacity text-white/30 hover:text-white/60 p-0.5"
              title="Reopen task"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>

        {/* Completed label */}
        {opts.showCompletedAt && task.completedAt && (
          <div className="ml-5 text-[10px] text-white/20 mb-0.5">
            Completed {formatCompletedAt(task.completedAt)}
          </div>
        )}

        {/* Inline subtask creation form */}
        {newSubtaskParent === task.id && (
          <div className="ml-6 pl-3 border-l border-white/[0.06] mt-0.5 mb-1 flex items-center gap-2">
            <input
              autoFocus
              value={newSubtaskTitle}
              onChange={e => setNewSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddSubtask(task);
                if (e.key === 'Escape') { setNewSubtaskParent(null); setNewSubtaskTitle(''); }
              }}
              placeholder="Subtask title..."
              className="flex-1 bg-transparent text-xs text-white placeholder-white/20 focus:outline-none py-1"
            />
            <button onClick={() => handleAddSubtask(task)} className="text-xs text-brand-400 hover:text-brand-300">Add</button>
            <button onClick={() => { setNewSubtaskParent(null); setNewSubtaskTitle(''); }} className="text-white/30 hover:text-white/60">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Subtasks */}
        {hasSubs && !isCollapsed && (
          <div className="ml-6 pl-3 border-l border-white/[0.06] space-y-0.5 mt-0.5">
            {subs.map(sub => {
              const subBlocked = isBlocked(sub);
              return (
                <div key={sub.id} className="relative group/subtaskrow flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <TaskRow task={sub} onOpenTask={onOpenTask} showProject={false} focused={false} />
                  </div>
                  {subBlocked && (
                    <div className="flex-shrink-0 text-amber-400/70" title="Blocked">
                      <Lock size={10} />
                    </div>
                  )}
                  {opts.onReopen && sub.status === 'done' && (
                    <button
                      onClick={() => updateTask(sub.id, { status: 'todo', completedAt: undefined })}
                      className="flex-shrink-0 opacity-0 group-hover/subtaskrow:opacity-100 transition-opacity text-white/30 hover:text-white/60 p-0.5"
                      title="Reopen"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Sections view (project view)
  // ---------------------------------------------------------------------------
  const renderSectionsView = () => {
    const projectSections = sections
      .filter(s => s.projectId === filterProject)
      .sort((a, b) => a.order - b.order);

    const tasksInProject = filteredTopLevel.filter(t => (t.projectIds ?? []).includes(filterProject));

    const renderSectionBody = (sectionIdFilter: string | undefined, sectionKey: string) => {
      const rawSectionTasks = tasksInProject.filter(t =>
        sectionIdFilter === undefined ? !t.sectionId : t.sectionId === sectionIdFilter,
      );
      const sectionTasks = sortTasks(rawSectionTasks, isManual ? 'date' : sortBy, sortOrder, projects, users);

      if (collapsedSections.has(sectionKey)) return null;

      return (
        <div className="space-y-0.5 mt-1">
          {sectionTasks.map(task => renderTaskWithSubtasks(task, { showProject: false }))}
          {/* Add task to this section */}
          {addTaskSectionId === sectionKey ? (
            <div className="flex items-center gap-2 px-2 py-1">
              <input
                autoFocus
                value={addTaskSectionTitle}
                onChange={e => setAddTaskSectionTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddTaskToSection(sectionIdFilter);
                  if (e.key === 'Escape') { setAddTaskSectionId(null); setAddTaskSectionTitle(''); }
                }}
                placeholder="Task title..."
                className="flex-1 bg-transparent text-xs text-white placeholder-white/20 focus:outline-none py-1"
              />
              <button onClick={() => handleAddTaskToSection(sectionIdFilter)} className="text-xs text-brand-400 hover:text-brand-300">Add</button>
              <button onClick={() => { setAddTaskSectionId(null); setAddTaskSectionTitle(''); }} className="text-white/30 hover:text-white/60">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAddTaskSectionId(sectionKey); setAddTaskSectionTitle(''); }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/25 hover:text-white/50 transition-colors"
            >
              <Plus size={11} /> Add task
            </button>
          )}
        </div>
      );
    };

    const renderSectionHeader = (
      label: string,
      taskCount: number,
      sectionKey: string,
      section?: Section,
      dragHandleProps?: Record<string, unknown>,
    ) => {
      const isCollapsed = collapsedSections.has(sectionKey);
      const isEditing = editingSectionId === sectionKey;

      return (
        <div className="flex items-center gap-2 group/section py-1">
          {/* Drag handle for real sections */}
          {section && dragHandleProps && (
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors flex-shrink-0">
              <GripVertical size={13} />
            </div>
          )}

          {/* Collapse toggle */}
          <button onClick={() => toggleSection(sectionKey)} className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors">
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Section name */}
          {isEditing ? (
            <input
              autoFocus
              value={editingSectionName}
              onChange={e => setEditingSectionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && section) {
                  updateSection(section.id, { name: editingSectionName });
                  setEditingSectionId(null);
                }
                if (e.key === 'Escape') setEditingSectionId(null);
              }}
              onBlur={() => {
                if (section && editingSectionName.trim()) {
                  updateSection(section.id, { name: editingSectionName });
                }
                setEditingSectionId(null);
              }}
              className="bg-transparent border-b border-white/20 text-xs font-semibold text-white/70 focus:outline-none"
            />
          ) : (
            <span
              className="text-xs font-semibold text-white/40 uppercase tracking-wider cursor-default"
              onDoubleClick={() => {
                if (section) {
                  setEditingSectionId(sectionKey);
                  setEditingSectionName(section.name);
                }
              }}
            >
              {label}
            </span>
          )}

          <span className="text-xs text-white/20">{taskCount}</span>

          {/* Separator line */}
          <div className="flex-1 h-px bg-white/[0.06]" />

          {/* Section actions (hover) */}
          {section && (
            <div className="opacity-0 group-hover/section:opacity-100 transition-opacity flex items-center gap-1">
              <button
                onClick={() => { setEditingSectionId(sectionKey); setEditingSectionName(section.name); }}
                className="p-1 text-white/25 hover:text-white/60 transition-colors"
                title="Rename section"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => deleteSection(section.id)}
                className="p-1 text-white/25 hover:text-red-400/70 transition-colors"
                title="Delete section"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={projectSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {projectSections.map(section => {
              const sectionTasks = tasksInProject.filter(t => t.sectionId === section.id);
              return (
                <SortableSectionWrapper key={section.id} section={section}>
                  {(dragHandleProps: Record<string, unknown>) => (
                    <div>
                      {renderSectionHeader(section.name, sectionTasks.length, section.id, section, dragHandleProps)}
                      {renderSectionBody(section.id, section.id)}
                    </div>
                  )}
                </SortableSectionWrapper>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Unsectioned */}
        {(() => {
          const unsectionedTasks = tasksInProject.filter(t => !t.sectionId);
          if (unsectionedTasks.length === 0 && projectSections.length > 0) return null;
          return (
            <div>
              {renderSectionHeader('No Section', unsectionedTasks.length, '__unsectioned__')}
              {renderSectionBody(undefined, '__unsectioned__')}
            </div>
          );
        })()}

        {/* Add section */}
        {showAddSection ? (
          <div className="flex items-center gap-2 px-1">
            <input
              autoFocus
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddSection();
                if (e.key === 'Escape') { setShowAddSection(false); setNewSectionName(''); }
              }}
              placeholder="Section name..."
              className="flex-1 bg-transparent border-b border-white/20 text-xs text-white placeholder-white/20 focus:outline-none py-1"
            />
            <button onClick={handleAddSection} className="text-xs text-brand-400 hover:text-brand-300">Add</button>
            <button onClick={() => { setShowAddSection(false); setNewSectionName(''); }} className="text-white/30 hover:text-white/60">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddSection(true)}
            className="flex items-center gap-1.5 px-1 py-1 text-xs text-white/20 hover:text-white/50 transition-colors"
          >
            <Plus size={11} /> Add section
          </button>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Completed log
  // ---------------------------------------------------------------------------
  const renderCompletedLog = () => {
    const doneTasks = tasks
      .filter(t => t.status === 'done' && baseFilter(t) && !t.parentId)
      .sort((a, b) => {
        const aAt = a.completedAt ?? a.updatedAt;
        const bAt = b.completedAt ?? b.updatedAt;
        return bAt.localeCompare(aAt);
      });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000);

    const buckets: { label: string; tasks: Task[] }[] = [
      { label: 'Today', tasks: [] },
      { label: 'Yesterday', tasks: [] },
      { label: 'This Week', tasks: [] },
      { label: 'Earlier', tasks: [] },
    ];

    doneTasks.forEach(t => {
      const at = new Date(t.completedAt ?? t.updatedAt);
      if (at >= startOfToday) buckets[0].tasks.push(t);
      else if (at >= startOfYesterday) buckets[1].tasks.push(t);
      else if (at >= startOfWeek) buckets[2].tasks.push(t);
      else buckets[3].tasks.push(t);
    });

    if (doneTasks.length === 0) {
      return (
        <div className="py-16 text-center">
          <p className="text-white/20">No completed tasks</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {buckets.filter(b => b.tasks.length > 0).map(bucket => (
          <div key={bucket.label}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{bucket.label}</span>
              <span className="text-xs text-white/20">{bucket.tasks.length}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="space-y-1">
              {bucket.tasks.map(task =>
                renderTaskWithSubtasks(task, {
                  showProject: true,
                  showCompletedAt: true,
                  onReopen: () => updateTask(task.id, { status: 'todo', completedAt: undefined }),
                }),
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Determine which list rendering to use
  // ---------------------------------------------------------------------------
  const showSectionsView =
    !isBoard &&
    activeTab === 'status' &&
    filterProject !== 'all';

  const SelectFilter = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none cursor-pointer hover:border-white/20 transition-colors"
    >
      {children}
    </select>
  );

  // ---------------------------------------------------------------------------
  // New task inline input (for non-section, non-board views)
  // ---------------------------------------------------------------------------


  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide animate-fade-in">
      <div className={`${isBoard ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-5 py-8`}>

        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {filterProject && filterProject !== 'all'
              ? projects.find(p => p.id === filterProject)?.name ?? 'Project'
              : 'My Tasks'}
          </h1>
        </div>

        {/* Tabs + View/Sort controls on the same row */}
        <div className="flex items-center justify-between mb-6 border-b border-white/[0.06] pb-0">
          <div className="flex items-center gap-0.5">
            <DndContext
              sensors={tabSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (over && active.id !== over.id) {
                  setTabOrder(prev => {
                    const oldIdx = prev.indexOf(active.id as ActiveTab);
                    const newIdx = prev.indexOf(over.id as ActiveTab);
                    const next = arrayMove(prev, oldIdx, newIdx);
                    localStorage.setItem('hive_tasks_tabOrder', JSON.stringify(next));
                    return next;
                  });
                }
              }}
            >
              <SortableContext items={tabs.filter(t => t.id !== 'project' || !filterProject || filterProject === 'all').map(t => t.id)} strategy={horizontalListSortingStrategy}>
                {tabs
                  .filter(t => t.id !== 'project' || !filterProject || filterProject === 'all')
                  .map(tab => (
                    <SortableTab
                      key={tab.id}
                      id={tab.id}
                      label={tab.label}
                      active={activeTab === tab.id}
                      onClick={() => handleSetActiveTab(tab.id)}
                    />
                  ))}
              </SortableContext>
            </DndContext>
          </div>
          {/* View toggle + Sort */}
          <div className="hidden sm:flex items-center gap-1 pb-1">
            {/* Assignee filter */}
            <div className="relative" ref={assigneePickerRef}>
              <button
                onClick={() => setShowAssigneePicker(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  filterAssigneeIds.length > 0
                    ? 'bg-brand-600/20 text-brand-300'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                <Users size={13} />
                Assignee
                {filterAssigneeIds.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-brand-500/30 text-brand-300 text-[10px] flex items-center justify-center font-semibold">
                    {filterAssigneeIds.length}
                  </span>
                )}
                <ChevronDown size={11} className="opacity-50" />
              </button>
              {showAssigneePicker && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[#1c1c1f] border border-white/[0.08] rounded-xl shadow-xl z-30 py-1">
                  <button
                    onClick={() => setFilterAssigneeIds([])}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-white/[0.06] ${filterAssigneeIds.length === 0 ? 'text-white/90' : 'text-white/50'}`}
                  >
                    <span className="flex-1 text-left">All</span>
                    {filterAssigneeIds.length === 0 && <Check size={11} className="text-brand-400 flex-shrink-0" />}
                  </button>
                  {relevantAssignees.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setFilterAssigneeIds(prev =>
                        prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-white/[0.06] ${filterAssigneeIds.includes(u.id) ? 'text-white/90' : 'text-white/50'}`}
                    >
                      <span className="w-5 h-5 rounded-full bg-brand-600/40 border border-brand-500/30 flex items-center justify-center text-[9px] font-semibold text-brand-300 flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 text-left truncate">{u.id === currentUser.id ? 'Me' : u.name}</span>
                      {filterAssigneeIds.includes(u.id) && <Check size={11} className="text-brand-400 flex-shrink-0" />}
                    </button>
                  ))}
                  {relevantAssignees.length === 0 && (
                    <p className="text-xs text-white/30 px-3 py-2.5">No assignees</p>
                  )}
                </div>
              )}
            </div>
            <span className="w-px h-4 bg-white/[0.08] mx-1" />
            {([
              { id: 'list' as const,  icon: <List size={14} />,       label: 'List'  },
              { id: 'board' as const, icon: <LayoutGrid size={14} />, label: 'Board' },
            ]).map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === v.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {v.icon}{v.label}
              </button>
            ))}
            <span className="w-px h-4 bg-white/[0.08] mx-1" />
            <button
              onClick={() => setShowSort(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                sortActive
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
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
                <option value="flag">Flag</option>
                <option value="assignee">Assignee</option>
                <option value="status">Status</option>
                <option value="project">Project</option>
                {!showSectionsView && <option value={'manual' as BoardSortBy}>Manual Order</option>}
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
                onClick={() => { setSortBy('date'); setSortOrder('asc'); }}
                className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-3 mb-6">
          {/* Flag filter dropdown */}
          {activeTab === 'flag' && allFlags.length > 0 && (
            <div className="flex-shrink-0">
              <select
                value={filterFlag}
                onChange={e => setFilterFlag(e.target.value)}
                className="h-10 px-3 bg-white/[0.04] border border-white/40 hover:border-white/55 rounded-xl text-sm text-white/60 focus:outline-none focus:border-brand-500/50 transition-colors cursor-pointer"
              >
                <option value="">All Flags</option>
                {allFlags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
          {/* Search bar — fixed height, never expands */}
          <div className="relative flex-shrink-0 w-44">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="h-10 w-full bg-white/[0.04] border border-white/40 hover:border-white/55 rounded-xl pl-8 pr-3 text-sm text-white/70 placeholder-white/30 focus:outline-none focus:border-brand-500/50 transition-colors"
            />
          </div>
          {/* New Task inline capture — expands on click */}
          <div className="w-96 flex-shrink-0">
            <InlineCapture ref={captureRef} onOpenDetail={id => onOpenTask(id)} />
          </div>
        </div>

        {/* Task list / board */}
        {isBoard ? (
          <BoardView
            groups={boardGroups}
            onOpenTask={onOpenTask}
            addTask={handleAddTaskFromBoard}
            filterProject={filterProject}
          />
        ) : activeTab === 'completed' ? (
          renderCompletedLog()
        ) : showSectionsView ? (
          renderSectionsView()
        ) : activeTab === 'priority' ? (
          // By Priority — grouped list (Urgent → High → Medium → Low)
          filteredTopLevel.length === 0 ? (
            <div className="py-16 text-center"><p className="text-white/20">No tasks found</p></div>
          ) : (
            <div className="space-y-6">
              {([
                { value: 'urgent', label: 'Urgent',      color: '#f87171' },
                { value: 'high',   label: 'High',        color: '#fb923c' },
                { value: 'medium', label: 'Medium',      color: '#facc15' },
                { value: 'low',    label: 'Low',         color: undefined  },
              ] as { value: string; label: string; color?: string }[]).map(pg => {
                const groupTasks = sorted.filter(t => (t.priority ?? 'low') === pg.value);
                if (groupTasks.length === 0) return null;
                return (
                  <div key={pg.value}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {pg.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pg.color }} />}
                      <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{pg.label}</span>
                      <span className="text-xs text-white/20">{groupTasks.length}</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>
                    <div className="space-y-1">
                      {groupTasks.map(task => {
                        const idx = sorted.findIndex(t => t.id === task.id);
                        const isFocused = focusedIdx === idx;
                        return renderTaskWithSubtasks(task, {
                          focused: isFocused,
                          focusRef: isFocused ? focusedRowRef : undefined,
                          showProject: true,
                        });
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === 'project' ? (
          // By Project — grouped list, one section per project
          filteredTopLevel.length === 0 ? (
            <div className="py-16 text-center"><p className="text-white/20">No tasks found</p></div>
          ) : (
            <div className="space-y-6">
              {boardGroups.map((group, gi) => {
                if (group.tasks.length === 0) return null;
                return (
                  <div key={gi}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
                      <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{group.label || 'No Project'}</span>
                      <span className="text-xs text-white/20">{group.tasks.length}</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>
                    <div className="space-y-1">
                      {group.tasks.map(task => {
                        const idx = sorted.findIndex(t => t.id === task.id);
                        const isFocused = focusedIdx === idx;
                        return renderTaskWithSubtasks(task, {
                          focused: isFocused,
                          focusRef: isFocused ? focusedRowRef : undefined,
                          showProject: false,
                        });
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === 'date' ? (
          // By Date — grouped list, with assignee super-groups when multi-user
          filteredTopLevel.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white/20">No tasks found</p>
            </div>
          ) : isMultiAssignee ? (
            <div className="space-y-8">
              {assigneeGroups.map(ag => {
                const agDateGroups = buildGroups(ag.tasks, 'date', projects, users);
                return (
                  <div key={ag.userId}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{ag.name}</span>
                      <span className="text-xs text-white/20">{ag.tasks.length}</span>
                    </div>
                    <div className="space-y-6 pl-0">
                      {agDateGroups.map((group, gi) => (
                        <div key={gi}>
                          {group.label && (
                            <div className="flex items-center gap-2 mb-1 px-1 pl-3">
                              {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
                              <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">{group.label}</span>
                              <span className="text-xs text-white/15">{group.tasks.length}</span>
                            </div>
                          )}
                          <div className="space-y-1">
                            {group.tasks.map(task => {
                              const idx = sorted.findIndex(t => t.id === task.id);
                              const isFocused = focusedIdx === idx;
                              return renderTaskWithSubtasks(task, {
                                focused: isFocused,
                                focusRef: isFocused ? focusedRowRef : undefined,
                                showProject: true,
                              });
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {dateGroups.map((group, gi) => (
                <div key={gi}>
                  {group.label && (
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
                      <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{group.label}</span>
                      <span className="text-xs text-white/20">{group.tasks.length}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    {group.tasks.map(task => {
                      const idx = sorted.findIndex(t => t.id === task.id);
                      const isFocused = focusedIdx === idx;
                      return renderTaskWithSubtasks(task, {
                        focused: isFocused,
                        focusRef: isFocused ? focusedRowRef : undefined,
                        showProject: true,
                      });
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredTopLevel.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/20">No tasks found</p>
          </div>
        ) : isManual ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {sorted.map((task, idx) => {
                  const isFocused = focusedIdx === idx;
                  return (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      onOpenTask={onOpenTask}
                      showProject
                      focused={isFocused}
                      focusRef={isFocused ? focusedRowRef : undefined}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : isMultiAssignee ? (
          <div className="space-y-6">
            {assigneeGroups.map(group => (
              <div key={group.userId}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{group.name}</span>
                  <span className="text-xs text-white/20">{group.tasks.length}</span>
                </div>
                <div className="space-y-1">
                  {group.tasks.map(task => {
                    const idx = sorted.findIndex(t => t.id === task.id);
                    const isFocused = focusedIdx === idx;
                    return renderTaskWithSubtasks(task, {
                      focused: isFocused,
                      focusRef: isFocused ? focusedRowRef : undefined,
                      showProject: true,
                    });
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {sorted.map((task, idx) => {
              const isFocused = focusedIdx === idx;
              return renderTaskWithSubtasks(task, {
                focused: isFocused,
                focusRef: isFocused ? focusedRowRef : undefined,
                showProject: true,
              });
            })}
          </div>
        )}

        <p className="text-xs text-white/20 mt-6 text-center">
          {filteredTopLevel.length} task{filteredTopLevel.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableSectionWrapper — separate component so useSortable hook rules are satisfied
// ---------------------------------------------------------------------------
function SortableSectionWrapper({
  section,
  children,
}: {
  section: Section;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const dragHandleProps: Record<string, unknown> = { ...attributes, ...listeners };
  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  );
}
