import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { Send, Hash, EyeOff, Eye } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

const AVATAR_COLORS = [
  'bg-brand-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
  'bg-indigo-600', 'bg-teal-600', 'bg-fuchsia-600', 'bg-cyan-600',
];

function avatarColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = ((h << 5) - h + userId.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

export default function ProjectChannelView({ projectId }: { projectId: string }) {
  const { channels, messages, users, currentUser, addChannel, updateChannel, sendMessage, projects } = useStore();
  const project = projects.find(p => p.id === projectId);
  const channel = channels.find(c => c.projectId === projectId && !c.deletedAt);
  const channelMessages = useMemo(
    () => messages.filter(m => m.channelId === channel?.id && !m.parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages, channel?.id]
  );

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  const handleSend = () => {
    if (!draft.trim() || !channel) return;
    sendMessage(channel.id, draft.trim());
    setDraft('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCreateChannel = () => {
    if (!project) return;
    addChannel({
      name: project.name,
      type: 'channel',
      memberIds: project.memberIds ?? [currentUser.id],
      projectId,
      hiddenFromSidebar: false,
      pinnedMessageIds: [],
      readBy: {},
    });
  };

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <Hash size={20} className="text-white/20" />
        </div>
        <div className="text-center">
          <p className="text-sm text-white/50 mb-1">No channel for this project yet</p>
          <p className="text-xs text-white/25">Create one to message your team in context</p>
        </div>
        <button
          onClick={handleCreateChannel}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-xl transition-colors"
        >
          Create channel
        </button>
      </div>
    );
  }

  // Group messages by date
  const grouped: Array<{ label: string; messages: typeof channelMessages }> = [];
  for (const msg of channelMessages) {
    const label = dateLabel(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last?.label === label) last.messages.push(msg);
    else grouped.push({ label, messages: [msg] });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Channel header */}
      <div className="flex items-center justify-between px-1 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Hash size={13} className="text-white/30" />
          <span className="text-sm text-white/50">{channel.name}</span>
          <span className="text-xs text-white/20">· {channel.memberIds.length} members</span>
        </div>
        <button
          onClick={() => updateChannel(channel.id, { hiddenFromSidebar: !channel.hiddenFromSidebar })}
          title={channel.hiddenFromSidebar ? 'Show in Messages sidebar' : 'Hide from Messages sidebar'}
          className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
        >
          {channel.hiddenFromSidebar ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-4 space-y-0.5 min-h-0">
        {channelMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
            <Hash size={24} className="text-white/10" />
            <p className="text-sm text-white/25">No messages yet</p>
            <p className="text-xs text-white/15">Start the conversation below</p>
          </div>
        )}
        {grouped.map(({ label, messages: dayMsgs }) => (
          <div key={label}>
            <div className="flex items-center gap-3 px-4 my-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-white/25 font-medium uppercase tracking-wider">{label}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            {dayMsgs.map((msg, i) => {
              const author = users.find(u => u.id === msg.authorId);
              const isMe = msg.authorId === currentUser.id;
              const prevMsg = dayMsgs[i - 1];
              const compact = prevMsg && prevMsg.authorId === msg.authorId &&
                new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000;
              return (
                <div key={msg.id} className={`flex items-start gap-3 px-4 py-0.5 hover:bg-white/[0.02] transition-colors group ${compact ? 'mt-0' : 'mt-2'}`}>
                  {compact ? (
                    <div className="w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 text-right">
                      <span className="text-[10px] text-white/20">{format(new Date(msg.createdAt), 'h:mm')}</span>
                    </div>
                  ) : (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${avatarColor(msg.authorId)}`}>
                      {author?.name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {!compact && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className={`text-sm font-medium ${isMe ? 'text-brand-300' : 'text-white/80'}`}>
                          {isMe ? 'You' : (author?.name ?? 'Unknown')}
                        </span>
                        <span className="text-[10px] text-white/20">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                      </div>
                    )}
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Send bar */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-white/20 transition-colors">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message #${channel.name}…`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 focus:outline-none resize-none min-h-[20px] max-h-32 leading-relaxed"
            style={{ height: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="p-1.5 rounded-lg bg-brand-600 text-white disabled:opacity-25 hover:bg-brand-500 transition-colors flex-shrink-0"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-white/15 mt-1.5 px-0.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
