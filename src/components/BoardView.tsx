import React, { useState } from 'react';
import { useStore } from '../store';
import { isPast, isToday, isTomorrow, format } from 'date-fns';
import { Plus, X } from 'lucide-react';
import type { Task, Priority } from '../types';
import type { TaskGroup } from '../utils/buildGroups';

const PRIORITY_PILL: Record<Priority, string> = {
  urgent: 'bg-red-500/20 text-red-300 border border-red-500/30',
  high:   'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  low:    'bg-white/[0.06] text-white/40 border border-white/10',
};

const STATUS_PILL: Record<string, string> = {
  todo:    'bg-white/[0.06] text-white/50 border border-white/10',
  doing:   'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  waiting: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  review:  'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  done:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', doing: 'Doing', waiting: 'Waiting', review: 'In Review', done: 'Done',
};

interface BoardViewProps {
  groups: TaskGroup[];
  onOpenTask: (id: string) => void;
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  filterProject?: string;
}

function BoardColumn({
  group,
  onOpenTask,
  onAddTask,
}: {
  group: TaskGroup;
  onOpenTask: (id: string) => void;
  onAddTask: (title: string) => void;
}) {
  const { updateTask } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim());
    setNewTitle('');
    setShowAdd(false);
  };

  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-3">
        {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{group.label || 'Tasks'}</span>
        <span className="text-xs text-white/30">{group.tasks.length}</span>
      </div>
      <div className="space-y-2">
        {group.tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onOpenTask(task.id)}
            className="bg-white/[0.03] rounded-xl p-3.5 border border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.05] cursor-pointer transition-all"
          >
            {/* Title row */}
            <div className="flex items-start gap-2 mb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, {
                    status: task.status === 'done' ? 'todo' : 'done',
                    completedAt: task.status !== 'done' ? new Date().toISOString() : undefined,
                  });
                }}
                className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
                  task.status === 'done' ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20 hover:border-brand-400'
                }`}
              >
                {task.status === 'done' && (
                  <span className="block w-full h-full text-emerald-400 text-[8px] flex items-center justify-center">✓</span>
                )}
              </button>
              <p className={`text-sm flex-1 leading-snug font-medium ${task.status === 'done' ? 'line-through text-white/30' : 'text-white/85'}`}>
                {task.title}
              </p>
            </div>

            {/* Chips row */}
            <div className="flex items-center gap-1.5 flex-wrap ml-6">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_PILL[task.priority]}`}>
                {task.priority}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[task.status]}`}>
                {STATUS_LABELS[task.status] ?? task.status}
              </span>
              {task.dueDate && (() => {
                const d = new Date(task.dueDate);
                const overdue = isPast(d) && task.status !== 'done' && !isToday(d);
                return (
                  <span className={`text-[11px] ml-auto ${overdue ? 'text-red-400' : 'text-white/40'}`}>
                    {isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d')}
                  </span>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Add task */}
      {showAdd ? (
        <div className="mt-2 flex items-center gap-2 p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.07]">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setShowAdd(false); setNewTitle(''); }
            }}
            placeholder="Task title..."
            className="flex-1 bg-transparent text-xs text-white placeholder-white/20 focus:outline-none"
          />
          <button onClick={handleAdd} className="text-xs text-brand-400 hover:text-brand-300 flex-shrink-0">Add</button>
          <button onClick={() => { setShowAdd(false); setNewTitle(''); }} className="text-white/30 hover:text-white/60 flex-shrink-0">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-2 flex items-center gap-1.5 w-full px-2 py-2 text-xs text-white/25 hover:text-white/50 transition-colors rounded-lg hover:bg-white/[0.03]"
        >
          <Plus size={12} /> New task
        </button>
      )}
    </div>
  );
}

export default function BoardView({ groups, onOpenTask, addTask, filterProject }: BoardViewProps) {
  const { currentUser, projects } = useStore();

  const handleAddTaskInColumn = (group: TaskGroup, title: string) => {
    // Determine status/priority/project from the group label
    const statusMap: Record<string, Task['status']> = {
      'To Do': 'todo', 'Doing': 'doing', 'Waiting': 'waiting', 'In Review': 'review', 'Done': 'done',
    };
    const priorityMap: Record<string, Priority> = {
      'Urgent': 'urgent', 'High': 'high', 'Medium': 'medium', 'Low': 'low',
    };

    const status: Task['status'] = statusMap[group.label] ?? 'todo';
    const priority: Priority = priorityMap[group.label] ?? 'medium';

    // For project grouping, find the matching project
    const matchedProject = projects.find(p => p.name === group.label);
    const projectIds =
      matchedProject ? [matchedProject.id] :
      filterProject && filterProject !== 'all' ? [filterProject] :
      [];

    addTask({
      title,
      projectIds,
      status,
      priority,
      assigneeIds: [currentUser.id],
      flags: [],
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
      {groups.map((group) => (
        <BoardColumn
          key={group.label || 'all'}
          group={group}
          onOpenTask={onOpenTask}
          onAddTask={(title) => handleAddTaskInColumn(group, title)}
        />
      ))}
    </div>
  );
}
