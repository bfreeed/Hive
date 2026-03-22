import { isPast, isToday, isThisWeek } from 'date-fns';
import type { Task, Priority, TaskStatus, Project, User } from '../types';

export type BoardGroupBy = 'none' | 'priority' | 'status' | 'project' | 'assignee' | 'date';
export type BoardSortBy = 'date' | 'priority' | 'status' | 'assignee' | 'project';
export type BoardSortOrder = 'asc' | 'desc';

export interface TaskGroup { label: string; color?: string; tasks: Task[] }

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do', doing: 'Doing', waiting: 'Waiting', review: 'In Review', done: 'Done',
};
const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<TaskStatus, number> = { todo: 0, doing: 1, waiting: 2, review: 3, done: 4 };

export function sortTasks(
  tasks: Task[],
  sortBy: BoardSortBy,
  sortOrder: BoardSortOrder,
  projects: Project[],
  users: User[],
): Task[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date') {
      const aD = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bD = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      cmp = aD - bD;
    } else if (sortBy === 'priority') {
      cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    } else if (sortBy === 'status') {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    } else if (sortBy === 'assignee') {
      const aName = users.find(u => a.assigneeIds[0] === u.id)?.name || '';
      const bName = users.find(u => b.assigneeIds[0] === u.id)?.name || '';
      cmp = aName.localeCompare(bName);
    } else if (sortBy === 'project') {
      const aP = projects.find(p => p.id === a.projectIds?.[0])?.name || '';
      const bP = projects.find(p => p.id === b.projectIds?.[0])?.name || '';
      cmp = aP.localeCompare(bP);
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });
}

export function buildGroups(
  taskList: Task[],
  groupBy: BoardGroupBy,
  projects: Project[],
  users: User[],
): TaskGroup[] {
  if (groupBy === 'none') return [{ label: '', tasks: taskList }];

  if (groupBy === 'priority') {
    return (['urgent', 'high', 'medium', 'low'] as Priority[])
      .map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), tasks: taskList.filter(t => t.priority === p) }))
      .filter(g => g.tasks.length > 0);
  }

  if (groupBy === 'status') {
    return (['todo', 'doing', 'waiting', 'review', 'done'] as TaskStatus[])
      .map(s => ({ label: STATUS_LABELS[s], tasks: taskList.filter(t => t.status === s) }))
      .filter(g => g.tasks.length > 0);
  }

  if (groupBy === 'project') {
    const grps = projects
      .map(p => ({ label: p.name, color: p.color, tasks: taskList.filter(t => (t.projectIds ?? []).includes(p.id)) }));
    const noProject = taskList.filter(t => !t.projectIds?.length || !t.projectIds.some(id => projects.find(p => p.id === id)));
    if (noProject.length > 0) grps.push({ label: 'No Project', color: undefined, tasks: noProject });
    return grps.filter(g => g.tasks.length > 0);
  }

  if (groupBy === 'assignee') {
    const grps = users.map(u => ({ label: u.name, tasks: taskList.filter(t => t.assigneeIds.includes(u.id)) }));
    const unassigned = taskList.filter(t => t.assigneeIds.length === 0);
    if (unassigned.length > 0) grps.push({ label: 'Unassigned', tasks: unassigned });
    return grps.filter(g => g.tasks.length > 0);
  }

  if (groupBy === 'date') {
    const overdue = taskList.filter(t => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && t.status !== 'done');
    const today = taskList.filter(t => t.dueDate && isToday(new Date(t.dueDate)));
    const thisWeek = taskList.filter(t => t.dueDate && isThisWeek(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && !isPast(new Date(t.dueDate)));
    const later = taskList.filter(t => t.dueDate && !isThisWeek(new Date(t.dueDate)) && !isPast(new Date(t.dueDate)));
    const noDate = taskList.filter(t => !t.dueDate);
    return [
      { label: 'Overdue', tasks: overdue },
      { label: 'Today', tasks: today },
      { label: 'This Week', tasks: thisWeek },
      { label: 'Later', tasks: later },
      { label: 'No Date', tasks: noDate },
    ].filter(g => g.tasks.length > 0);
  }

  return [{ label: '', tasks: taskList }];
}
