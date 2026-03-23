import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  Plus, Search, ArrowUpDown, List, LayoutGrid, GitBranch, GripVertical,
  ChevronDown, ChevronRight, X, Trash2, Pencil, Lock, RotateCcw, AlertCircle,
} from 'lucide-react';
import type { Task, Priority, Section } from '../types';
import TaskRow from '../components/TaskRow';
import BoardView from '../components/BoardView';
import { buildGroups, sortTasks } from '../utils/buildGroups';
import type { BoardGroupBy, BoardSortBy, BoardSortOrder } from '../utils/buildGroups';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-white/20',
};

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
      {React.cloneElement(children as React.ReactElement, {
        dragHandleProps: { ...attributes, ...listeners, ...onDragHandleProps },
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MindMap view
// ---------------------------------------------------------------------------
function MindMapView({ tasks, onOpenTask }: { tasks: Task[]; onOpenTask: (id: string) => void }) {
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
        My Tasks
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
export default function TasksPage({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const {
    tasks, projects, users, currentUser, addTask, updateTask,
    manualOrder, setManualOrder,
    sections, addSection, updateSection, deleteSection,
  } = useStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Filters
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterFlag, setFilterFlag] = useState('all');

  // Group & Sort — persisted across navigation
  const [showSort, setShowSort] = useState(false);
  const [groupBy, setGroupByRaw] = useState<BoardGroupBy>(() => (localStorage.getItem('tasks-groupBy') as BoardGroupBy) ?? 'none');
  const [sortBy, setSortByRaw] = useState<BoardSortBy>(() => (localStorage.getItem('tasks-sortBy') as BoardSortBy) ?? 'date');
  const [sortOrder, setSortOrderRaw] = useState<BoardSortOrder>(() => (localStorage.getItem('tasks-sortOrder') as BoardSortOrder) ?? 'asc');
  const setGroupBy = (v: BoardGroupBy) => { setGroupByRaw(v); localStorage.setItem('tasks-groupBy', v); };
  const setSortBy = (v: BoardSortBy) => { setSortByRaw(v); localStorage.setItem('tasks-sortBy', v); };
  const setSortOrder = (v: BoardSortOrder) => { setSortOrderRaw(v); localStorage.setItem('tasks-sortOrder', v); };

  // View
  const [viewType, setViewTypeRaw] = useState<'list' | 'board' | 'mindmap'>(() => (localStorage.getItem('tasks-viewType') as 'list' | 'board' | 'mindmap') ?? 'list');
  const setViewType = (v: 'list' | 'board' | 'mindmap') => { setViewTypeRaw(v); localStorage.setItem('tasks-viewType', v); };

  // Keyboard navigation
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const focusedRowRef = useRef<HTMLDivElement>(null);

  // New task
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');

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
  // Filter helpers
  // ---------------------------------------------------------------------------
  const baseFilter = (t: Task) => {
    if (filterProject !== 'all' && !(t.projectIds ?? []).includes(filterProject)) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterAssignee !== 'all' && !t.assigneeIds.includes(filterAssignee)) return false;
    if (filterFlag === 'private' && !t.isPrivate) return false;
    if (filterFlag !== 'all' && filterFlag !== 'private' && !t.flags.some(f => f.flagId === filterFlag)) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const filtered = tasks.filter((t) => {
    if (filterStatus === 'active' && t.status === 'done') return false;
    if (filterStatus === 'done' && t.status !== 'done') return false;
    if (filterStatus === 'todo' && t.status !== 'todo') return false;
    if (filterStatus === 'doing' && t.status !== 'doing') return false;
    if (filterStatus === 'waiting' && t.status !== 'waiting') return false;
    if (filterStatus === 'review' && t.status !== 'review') return false;
    return baseFilter(t);
  });

  // Board/mindmap ignore status filter
  const filteredAllStatuses = tasks.filter(baseFilter);

  // Feature 1: filter out subtasks from top-level list
  const filteredTopLevel = filtered.filter(t => !t.parentId);

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
  const sortedAllStatuses = sortTasks(filteredAllStatuses, isManual ? 'date' : sortBy, sortOrder, projects, users);

  // ---------------------------------------------------------------------------
  // Groups (for regular list view)
  // ---------------------------------------------------------------------------
  const groups = buildGroups(sorted, groupBy, projects, users);
  const boardGroups = buildGroups(sortedAllStatuses, groupBy === 'none' ? 'status' : groupBy, projects, users);

  // ---------------------------------------------------------------------------
  // Dependency blocked helper
  // ---------------------------------------------------------------------------
  const isBlocked = (task: Task): boolean =>
    (task.dependsOn ?? []).some(depId => tasks.find(t => t.id === depId)?.status !== 'done');

  // ---------------------------------------------------------------------------
  // Keyboard navigation (list view only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (viewType !== 'list') return;
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
  }, [viewType, sorted, focusedIdx, onOpenTask]);

  useEffect(() => {
    focusedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  useEffect(() => {
    setFocusedIdx(null);
  }, [filterProject, filterStatus, filterPriority, filterAssignee, filterFlag, search, sortBy, sortOrder, groupBy]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle.trim(),
      projectIds: newTaskProject ? [newTaskProject] : [],
      status: 'todo',
      priority: 'medium',
      assigneeIds: [currentUser.id],
      flags: [],
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setNewTaskTitle('');
    setShowNewTask(false);
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

  const sortActive = groupBy !== 'none' || sortBy !== 'date' || sortOrder !== 'asc';

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  // Render a single task row with subtask expand/collapse, progress, blocked indicator, and subtask form
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
  // Sections view
  // ---------------------------------------------------------------------------
  const renderSectionsView = () => {
    const projectSections = sections
      .filter(s => s.projectId === filterProject)
      .sort((a, b) => a.order - b.order);

    const tasksInProject = filteredTopLevel.filter(t => (t.projectIds ?? []).includes(filterProject));

    const renderSectionBody = (sectionIdFilter: string | undefined, sectionKey: string) => {
      const sectionTasks = tasksInProject.filter(t =>
        sectionIdFilter === undefined ? !t.sectionId : t.sectionId === sectionIdFilter,
      );

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
  // Completed log view (filterStatus === 'done' && viewType === 'list')
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
    viewType === 'list' &&
    filterProject !== 'all' &&
    filterStatus !== 'done';

  const showCompletedLog =
    viewType === 'list' &&
    filterStatus === 'done';

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
      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-white tracking-tight">My Tasks</h1>
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
            <SelectFilter value={filterFlag} onChange={setFilterFlag}>
              <option value="all">All Flags</option>
              {(currentUser.flags || []).map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              <option value="private">Private</option>
            </SelectFilter>
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
            <SelectFilter value={filterAssignee} onChange={setFilterAssignee}>
              <option value="all">All Assignees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
              onClick={() => setViewType(v.id as 'list' | 'board' | 'mindmap')}
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

        {/* Group & Sort panel */}
        {showSort && (
          <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium w-12 ${isManual ? 'text-white/15' : 'text-white/30'}`}>Group</span>
              <SelectFilter value={isManual ? 'none' : groupBy} onChange={v => setGroupBy(v as BoardGroupBy)}>
                <option value="none">No Grouping</option>
                {!isManual && <>
                  <option value="priority">Priority</option>
                  <option value="date">Date</option>
                  <option value="assignee">Assignee</option>
                  <option value="status">Status</option>
                  <option value="project">Project</option>
                </>}
              </SelectFilter>
              {isManual && <span className="text-xs text-white/20 italic">disabled in manual mode</span>}
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30 font-medium w-8">Sort</span>
              <SelectFilter value={sortBy} onChange={v => { setSortBy(v as BoardSortBy); if (v === ('manual' as BoardSortBy)) setGroupBy('none'); }}>
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="assignee">Assignee</option>
                <option value="status">Status</option>
                <option value="project">Project</option>
                <option value={'manual' as BoardSortBy}>Manual Order</option>
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
          <MindMapView tasks={sortedAllStatuses} onOpenTask={onOpenTask} />
        ) : showCompletedLog ? (
          renderCompletedLog()
        ) : showSectionsView ? (
          renderSectionsView()
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
                <div className="space-y-1">
                  {group.tasks.map(task => {
                    const idx = sorted.findIndex(t => t.id === task.id);
                    const isFocused = focusedIdx === idx;
                    return renderTaskWithSubtasks(task, {
                      focused: isFocused,
                      focusRef: isFocused ? focusedRowRef : undefined,
                      showProject: groupBy !== 'project',
                    });
                  })}
                </div>
              </div>
            ))}
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
