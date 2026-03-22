import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Plus, Search, ArrowUpDown, List, LayoutGrid, GitBranch, GripVertical } from 'lucide-react';
import type { Task, Priority } from '../types';
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

export default function TasksPage({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { tasks, projects, users, addTask, manualOrder, setManualOrder } = useStore();
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

  // Group & Sort
  const [showSort, setShowSort] = useState(false);
  const [groupBy, setGroupBy] = useState<BoardGroupBy>('none');
  const [sortBy, setSortBy] = useState<BoardSortBy>('date');
  const [sortOrder, setSortOrder] = useState<BoardSortOrder>('asc');

  // View
  const [viewType, setViewType] = useState<'list' | 'board' | 'mindmap'>('list');

  // Keyboard navigation
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const focusedRowRef = useRef<HTMLDivElement>(null);

  // New task
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');

  // --- Filter ---
  const baseFilter = (t: Task) => {
    if (filterProject !== 'all' && !(t.projectIds ?? []).includes(filterProject)) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterAssignee !== 'all' && !t.assigneeIds.includes(filterAssignee)) return false;
    if (filterFlag === '72h' && !t.within72Hours) return false;
    if (filterFlag === 'questions' && !t.questionsForLev) return false;
    if (filterFlag === 'checkin' && !t.updateAtCheckin) return false;
    if (filterFlag === 'private' && !t.isPrivate) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  // List view respects status filter; board/mindmap show all statuses as columns
  const filtered = tasks.filter((t) => {
    if (filterStatus === 'active' && t.status === 'done') return false;
    if (filterStatus === 'done' && t.status !== 'done') return false;
    if (filterStatus === 'todo' && t.status !== 'todo') return false;
    if (filterStatus === 'doing' && t.status !== 'doing') return false;
    if (filterStatus === 'waiting' && t.status !== 'waiting') return false;
    if (filterStatus === 'review' && t.status !== 'review') return false;
    return baseFilter(t);
  });

  // Board/mindmap ignore status filter — columns represent statuses
  const filteredAllStatuses = tasks.filter(baseFilter);

  // --- Sort ---
  const isManual = sortBy === 'manual' as any;
  const baseSorted = sortTasks(filtered, isManual ? 'date' : sortBy, sortOrder, projects, users);
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

  // --- Group ---
  // List groups: respect status filter, use selected groupBy
  const groups = buildGroups(sorted, groupBy, projects, users);
  // Board groups: ignore status filter (columns = statuses by default), use selected groupBy
  const boardGroups = buildGroups(sortedAllStatuses, groupBy === 'none' ? 'status' : groupBy, projects, users);

  // Keyboard navigation (list view only)
  useEffect(() => {
    if (viewType !== 'list') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') {
        // 'N' for new task is handled by Home; here N = next task
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

  // Scroll focused row into view
  useEffect(() => {
    focusedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  // Reset focus when filters/sort change
  useEffect(() => { setFocusedIdx(null); }, [filterProject, filterStatus, filterPriority, filterAssignee, filterFlag, search, sortBy, sortOrder, groupBy]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle.trim(),
      projectIds: newTaskProject ? [newTaskProject] : [],
      status: 'todo',
      priority: 'medium',
      assigneeIds: ['lev'],
      within72Hours: false,
      questionsForLev: false,
      updateAtCheckin: false,
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setNewTaskTitle('');
    setShowNewTask(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sorted.map(t => t.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    setManualOrder(arrayMove(ids, oldIdx, newIdx));
  };

  const sortActive = groupBy !== 'none' || sortBy !== 'date' || sortOrder !== 'asc';

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
      <div className="max-w-4xl mx-auto px-8 py-8">

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

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 w-36 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-brand-500/50 focus:w-48 transition-all"
            />
          </div>
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
          <SelectFilter value={filterFlag} onChange={setFilterFlag}>
            <option value="all">All Flags</option>
            <option value="72h">72h Priority</option>
            <option value="questions">Questions for Lev</option>
            <option value="checkin">Sarah's Update</option>
            <option value="private">Private</option>
          </SelectFilter>

          {/* Group & Sort toggle */}
          <button
            onClick={() => setShowSort(v => !v)}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
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
              <SelectFilter value={sortBy} onChange={v => { setSortBy(v as BoardSortBy); if (v !== 'manual' as any) setGroupBy('none'); }}>
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="assignee">Assignee</option>
                <option value="status">Status</option>
                <option value="project">Project</option>
                <option value={'manual' as any}>Manual Order</option>
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

        {/* View switcher */}
        <div className="flex items-center gap-1 mb-3">
          {[
            { id: 'list', icon: <List size={14} />, label: 'List' },
            { id: 'board', icon: <LayoutGrid size={14} />, label: 'Board' },
            { id: 'mindmap', icon: <GitBranch size={14} />, label: 'Mind Map' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewType(v.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${viewType === v.id ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}
            >
              {v.icon}{v.label}
            </button>
          ))}
        </div>

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
        ) : filtered.length === 0 ? (
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
                {/* Group header */}
                {group.label && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{group.label}</span>
                    <span className="text-xs text-white/20">{group.tasks.length}</span>
                  </div>
                )}
                {/* Tasks */}
                <div className="space-y-0.5">
                  {group.tasks.map(task => {
                    const idx = sorted.findIndex(t => t.id === task.id);
                    const isFocused = focusedIdx === idx;
                    return (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onOpenTask={onOpenTask}
                        showProject={groupBy !== 'project'}
                        focused={isFocused}
                        ref={isFocused ? focusedRowRef : undefined}
                      />
                    );
                  })}
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
