import React, { useState } from 'react';
import { useStore } from '../store';
import {
  MessageSquare, HelpCircle, Bell, UserPlus, ArrowRight,
  Zap, Users, Calendar, Mic, Paperclip, CheckCheck, List, LayoutGrid, ArrowUpDown,
} from 'lucide-react';
import type { Notification } from '../types';

interface NotificationsPageProps {
  onNavigate: (page: string) => void;
  onOpenTask: (taskId: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; colorClass: string; group: string }> = {
  mention:         { icon: <MessageSquare size={14} />, colorClass: 'text-blue-400',    group: '@Mentions' },
  comment:         { icon: <MessageSquare size={14} />, colorClass: 'text-emerald-400', group: "Sarah's Activity" },
  questions:       { icon: <HelpCircle size={14} />,    colorClass: 'text-amber-400',   group: "Sarah's Activity" },
  checkin:         { icon: <Bell size={14} />,           colorClass: 'text-amber-400',   group: "Sarah's Activity" },
  assignment:      { icon: <UserPlus size={14} />,       colorClass: 'text-purple-400',  group: "Sarah's Activity" },
  status_change:   { icon: <ArrowRight size={14} />,    colorClass: 'text-white/50',    group: "Sarah's Activity" },
  priority_change: { icon: <Zap size={14} />,            colorClass: 'text-orange-400',  group: "Sarah's Activity" },
  assignee_change: { icon: <Users size={14} />,          colorClass: 'text-white/50',    group: "Sarah's Activity" },
  date_change:     { icon: <Calendar size={14} />,       colorClass: 'text-white/50',    group: "Sarah's Activity" },
  note:            { icon: <Mic size={14} />,            colorClass: 'text-white/50',    group: "Sarah's Activity" },
  attachment:      { icon: <Paperclip size={14} />,      colorClass: 'text-white/50',    group: "Sarah's Activity" },
};

const GROUP_ORDER = ["Sarah's Activity", '@Mentions', 'Other'];

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function NotifCard({ n, config, onClick, onMarkRead }: {
  n: Notification;
  config: typeof TYPE_CONFIG[string] | undefined;
  onClick: () => void;
  onMarkRead: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group"
    >
      <span
        onClick={onMarkRead}
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 cursor-pointer transition-opacity ${
          n.read ? 'bg-transparent' : 'bg-brand-400 hover:opacity-70'
        }`}
      />
      {config && (
        <span className={`flex-shrink-0 ${config.colorClass}`}>{config.icon}</span>
      )}
      <span className={`flex-1 min-w-0 text-sm truncate ${n.read ? 'text-white/40' : 'text-white/80 group-hover:text-white'}`}>
        {n.title}
        {n.body && (
          <span className="text-white/30 font-normal"> — {n.body}</span>
        )}
      </span>
      <span className="flex-shrink-0 text-xs text-white/20">{formatTime(n.createdAt)}</span>
    </button>
  );
}

export default function NotificationsPage({ onNavigate, onOpenTask }: NotificationsPageProps) {
  const { notifications, tasks, projects, markNotificationRead, markAllNotificationsRead } = useStore();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [viewType, setViewType] = useState<'list' | 'board'>('list');
  const [groupBy, setGroupBy] = useState<'type' | 'project'>('type');

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = showUnreadOnly ? notifications.filter(n => !n.read) : notifications;

  // Resolve a project for a notification (via taskId → task → projectIds[0], or direct projectId)
  const getProject = (n: Notification) => {
    if (n.projectId) return projects.find(p => p.id === n.projectId);
    if (n.taskId) {
      const task = tasks.find(t => t.id === n.taskId);
      if (task?.projectIds?.[0]) return projects.find(p => p.id === task.projectIds[0]);
    }
    return undefined;
  };

  const handleCardClick = (n: Notification) => {
    markNotificationRead(n.id);
    if (n.taskId) onOpenTask(n.taskId);
    else if (n.type === 'mention') onNavigate('messages');
  };

  // ── List view ──────────────────────────────────────────────────────────────

  const buildListGroups = () => {
    if (groupBy === 'project') {
      const byProject: Record<string, Notification[]> = {};
      for (const n of filtered) {
        const proj = getProject(n);
        const key = proj?.name ?? 'No Project';
        if (!byProject[key]) byProject[key] = [];
        byProject[key].push(n);
      }
      // Sort group keys: real projects first (by their order), then "No Project"
      const projectNames = projects.map(p => p.name);
      const sorted = Object.keys(byProject).sort((a, b) => {
        const ai = projectNames.indexOf(a);
        const bi = projectNames.indexOf(b);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      return sorted.map(name => ({
        label: name,
        color: projects.find(p => p.name === name)?.color,
        items: byProject[name],
      }));
    }

    // Default: group by type category
    const byType: Record<string, Notification[]> = {};
    for (const n of filtered) {
      const group = TYPE_CONFIG[n.type]?.group ?? 'Other';
      if (!byType[group]) byType[group] = [];
      byType[group].push(n);
    }
    return GROUP_ORDER
      .filter(g => byType[g]?.length > 0)
      .map(name => ({ label: name, color: undefined, items: byType[name] }));
  };

  // ── Board view ─────────────────────────────────────────────────────────────

  const buildBoardColumns = () => {
    const byProject: Record<string, { project: typeof projects[0] | null; items: Notification[] }> = {};
    for (const n of filtered) {
      const proj = getProject(n);
      const key = proj?.id ?? '__none__';
      if (!byProject[key]) byProject[key] = { project: proj ?? null, items: [] };
      byProject[key].items.push(n);
    }
    // Order: projects in their defined order, then "No Project"
    const cols = projects
      .filter(p => byProject[p.id])
      .map(p => ({ ...byProject[p.id], project: p }));
    if (byProject['__none__']?.items.length) {
      cols.push({ project: null, items: byProject['__none__'].items });
    }
    return cols;
  };

  const listGroups = buildListGroups();
  const boardColumns = buildBoardColumns();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className={`mx-auto px-8 py-8 ${viewType === 'board' ? 'max-w-full' : 'max-w-2xl'}`}>

        {/* Header */}
        <div className="mb-6">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle — List / Board */}
            <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
              {([
                { id: 'list',  icon: <List size={13} />,       label: 'List'  },
                { id: 'board', icon: <LayoutGrid size={13} />, label: 'Board' },
              ] as const).map(v => (
                <button
                  key={v.id}
                  onClick={() => setViewType(v.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewType === v.id
                      ? 'bg-white/[0.10] text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {v.icon}
                  {v.label}
                </button>
              ))}
            </div>

            {/* Group by — only in list view */}
            {viewType === 'list' && (
              <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
                {([
                  { id: 'type',    label: 'By type'    },
                  { id: 'project', label: 'By project' },
                ] as const).map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGroupBy(g.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      groupBy === g.id
                        ? 'bg-white/[0.10] text-white'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}

            {/* Unread filter */}
            <button
              onClick={() => setShowUnreadOnly(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showUnreadOnly
                  ? 'border-brand-500/40 bg-brand-600/10 text-brand-400'
                  : 'border-white/[0.08] text-white/40 hover:text-white/70'
              }`}
            >
              {showUnreadOnly ? 'Unread only' : 'All'}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <p className="text-white/20 text-center py-16">
            {showUnreadOnly ? 'No unread notifications' : 'No notifications'}
          </p>

        ) : viewType === 'list' ? (
          /* ── List ── */
          <div className="space-y-6">
            {listGroups.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  {group.color && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />
                  )}
                  <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider">
                    {group.label}
                  </h2>
                  <span className="text-xs text-white/20">{group.items.length}</span>
                </div>
                <div>
                  {group.items.map(n => (
                    <NotifCard
                      key={n.id}
                      n={n}
                      config={TYPE_CONFIG[n.type]}
                      onClick={() => handleCardClick(n)}
                      onMarkRead={(e) => { e.stopPropagation(); markNotificationRead(n.id); }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

        ) : (
          /* ── Board ── */
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {boardColumns.map((col, ci) => (
              <div
                key={col.project?.id ?? '__none__'}
                className="flex-shrink-0 w-72 flex flex-col bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
                  {col.project ? (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.project.color }} />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-white/70 truncate flex-1">
                    {col.project?.name ?? 'No Project'}
                  </span>
                  <span className="text-xs text-white/30 flex-shrink-0">{col.items.length}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-1.5">
                  {col.items.map(n => {
                    const config = TYPE_CONFIG[n.type];
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleCardClick(n)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                          n.read
                            ? 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05]'
                            : 'border-brand-500/20 bg-brand-600/5 hover:bg-brand-600/10'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-1">
                          {!n.read && (
                            <span
                              onClick={(e) => { e.stopPropagation(); markNotificationRead(n.id); }}
                              className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5 cursor-pointer"
                            />
                          )}
                          {config && (
                            <span className={`flex-shrink-0 mt-0.5 ${config.colorClass}`}>{config.icon}</span>
                          )}
                          <p className={`text-xs leading-snug flex-1 min-w-0 ${n.read ? 'text-white/50' : 'text-white/85 font-medium'}`}>
                            {n.title}
                          </p>
                        </div>
                        {n.body && (
                          <p className="text-[11px] text-white/35 truncate ml-6 mb-0.5">{n.body}</p>
                        )}
                        <p className="text-[10px] text-white/20 ml-6">{formatTime(n.createdAt)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
