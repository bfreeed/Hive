import React, { useState } from 'react';
import { useStore } from '../store';
import {
  MessageSquare, HelpCircle, Bell, UserPlus, ArrowRight,
  Zap, Users, Calendar, Mic, Paperclip, CheckCheck,
} from 'lucide-react';
import type { Notification } from '../types';

interface NotificationsPageProps {
  onNavigate: (page: string) => void;
  onOpenTask: (taskId: string) => void;
}

// Map notification type → { icon, color class, sidebar group }
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

export default function NotificationsPage({ onNavigate, onOpenTask }: NotificationsPageProps) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = showUnreadOnly ? notifications.filter(n => !n.read) : notifications;

  // Group notifications by type category
  const groups: Record<string, Notification[]> = {};
  for (const n of filtered) {
    const group = TYPE_CONFIG[n.type]?.group ?? 'Other';
    if (!groups[group]) groups[group] = [];
    groups[group].push(n);
  }

  const handleCardClick = (n: Notification) => {
    markNotificationRead(n.id);
    if (n.taskId) {
      onOpenTask(n.taskId);
    } else if (n.type === 'mention') {
      onNavigate('messages');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-2xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Notifications</h1>
          <div className="flex items-center gap-3">
            {/* Unread only toggle */}
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
            {/* Mark all as read */}
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
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <p className="text-white/20 text-center py-16">
            {showUnreadOnly ? 'No unread notifications' : 'No notifications'}
          </p>
        ) : (
          <div className="space-y-6">
            {GROUP_ORDER.filter(g => groups[g]?.length > 0).map(groupName => (
              <div key={groupName}>
                <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-1">
                  {groupName}
                </h2>
                <div className="space-y-1">
                  {groups[groupName].map(n => {
                    const config = TYPE_CONFIG[n.type];
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleCardClick(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                          n.read
                            ? 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'
                            : 'border-brand-500/20 bg-brand-600/5 hover:bg-brand-600/10'
                        }`}
                      >
                        {/* Unread dot — click to mark read without navigating */}
                        <span
                          onClick={(e) => { e.stopPropagation(); markNotificationRead(n.id); }}
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 cursor-pointer transition-opacity ${
                            n.read ? 'bg-white/[0.12] opacity-40' : 'bg-brand-400 hover:opacity-80'
                          }`}
                        />
                        {/* Type icon */}
                        {config && (
                          <span className={`mt-0.5 flex-shrink-0 ${config.colorClass}`}>
                            {config.icon}
                          </span>
                        )}
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${n.read ? 'text-white/60' : 'text-white/90 font-medium'}`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-white/40 mt-0.5 truncate">{n.body}</p>
                          )}
                          <p className="text-xs text-white/25 mt-0.5">{formatTime(n.createdAt)}</p>
                        </div>
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
