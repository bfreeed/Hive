import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { Hash, Plus, Search, Smile, Paperclip, Send, X, Pencil, Trash2, MessageSquare, Link } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { Message, User } from '../types';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '✅', '🔥'];

const AVATAR_COLORS: Record<string, string> = {
  lev: 'bg-brand-600',
  sarah: 'bg-emerald-600',
};

const AVATAR_INITIALS: Record<string, string> = {
  lev: 'L',
  sarah: 'S',
};

function Avatar({ userId, size = 8 }: { userId: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs ${AVATAR_COLORS[userId] || 'bg-white/20'}`}>
      {AVATAR_INITIALS[userId] || '?'}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

function formatDivider(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function renderBody(body: string, userNames: string[]): React.ReactNode {
  const parts = body.split(/(@\w[\w.]*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const name = part.slice(1).toLowerCase();
          const isMatch = userNames.some(n => n.toLowerCase() === name || n.toLowerCase().startsWith(name));
          if (isMatch) {
            return <span key={i} className="bg-brand-500/20 text-brand-300 rounded px-0.5">{part}</span>;
          }
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

interface BubbleProps {
  msg: Message;
  prevMsg?: Message;
  userNames: string[];
  users: User[];
  replyCount: number;
  onReact: (id: string, emoji: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenThread: (id: string) => void;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  isThread?: boolean;
}

function MessageBubble({ msg, prevMsg, userNames, users, replyCount, onReact, onEdit, onDelete, onOpenThread, editing, editValue, onEditChange, onEditSave, onEditCancel, isThread }: BubbleProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const author = users.find(u => u.id === msg.authorId);
  const isContinuation = prevMsg && prevMsg.authorId === msg.authorId
    && isSameDay(prevMsg.createdAt, msg.createdAt)
    && (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60000;

  const totalReactions = Object.entries(msg.reactions).filter(([, us]) => us.length > 0);

  return (
    <div
      className="group relative flex gap-3 px-4 py-0.5 hover:bg-white/[0.02] rounded-lg transition-colors"
      onMouseLeave={() => setShowEmoji(false)}
    >
      {isContinuation ? (
        <div className="w-8 flex-shrink-0 flex items-center justify-center">
          <span className="text-[10px] text-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
            {format(new Date(msg.createdAt), 'h:mm')}
          </span>
        </div>
      ) : (
        <div className="pt-0.5 flex-shrink-0">
          <Avatar userId={msg.authorId} size={8} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {!isContinuation && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white">{author?.name || msg.authorId}</span>
            <span className="text-xs text-white/30">{formatTime(msg.createdAt)}</span>
            {msg.editedAt && <span className="text-[10px] text-white/20">(edited)</span>}
          </div>
        )}

        {editing ? (
          <textarea
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditSave(); }
              if (e.key === 'Escape') onEditCancel();
            }}
            autoFocus
            className="w-full bg-white/[0.06] border border-brand-500/40 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none resize-none"
            rows={2}
          />
        ) : (
          <p className="text-sm text-white/80 leading-relaxed break-words">
            {renderBody(msg.body, userNames)}
            {isContinuation && msg.editedAt && <span className="text-[10px] text-white/20 ml-1">(edited)</span>}
          </p>
        )}

        {/* Attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {msg.attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-white/[0.08] transition-colors max-w-xs group/att">
                <Link size={12} className="text-white/40 flex-shrink-0" />
                <span className="text-xs text-white/60 truncate group-hover/att:text-white/80">{att.name || att.url}</span>
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {totalReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {totalReactions.map(([emoji, reactors]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs transition-colors"
              >
                <span>{emoji}</span>
                <span className="text-white/50">{reactors.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread reply preview */}
        {!isThread && replyCount > 0 && (
          <button
            onClick={() => onOpenThread(msg.id)}
            className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <MessageSquare size={12} />
            <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Hover action toolbar */}
      {!editing && (
        <div className="absolute right-3 top-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#1c1c1f] border border-white/[0.08] rounded-lg px-1 py-0.5 shadow-lg z-10">
          <div className="relative">
            <button
              onClick={() => setShowEmoji(v => !v)}
              className="p-1.5 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"
            >
              <Smile size={14} />
            </button>
            {showEmoji && (
              <div className="absolute right-0 bottom-full mb-1 flex gap-1 p-1.5 bg-[#1c1c1f] border border-white/[0.08] rounded-xl shadow-xl z-20">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => { onReact(msg.id, e); setShowEmoji(false); }}
                    className="text-lg hover:scale-125 transition-transform p-0.5"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!isThread && (
            <button
              onClick={() => onOpenThread(msg.id)}
              className="p-1.5 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"
              title="Reply in thread"
            >
              <MessageSquare size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(msg.id)}
            className="p-1.5 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(msg.id)}
            className="p-1.5 rounded-md hover:bg-white/[0.08] text-red-400/50 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const {
    channels, messages, users, currentUser, activeChannelId,
    setActiveChannel, sendMessage, addReaction,
    updateMessage, deleteMessage, replyToMessage, addNotification, deleteChannel,
  } = useStore();

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadInput, setThreadInput] = useState('');
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  const [pendingUrlName, setPendingUrlName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<{ name: string; url: string; type: string }[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const threadInputRef = useRef<HTMLTextAreaElement>(null);

  const channel = channels.find(c => c.id === activeChannelId);
  const channelMessages = messages.filter(m => m.channelId === activeChannelId);
  const topLevelMessages = channelMessages.filter(m => !m.parentId);
  const threadReplies = openThreadId ? messages.filter(m => m.parentId === openThreadId) : [];
  const threadParentMsg = openThreadId ? messages.find(m => m.id === openThreadId) : null;

  const groupedChannels = channels.filter(c => c.type === 'channel');
  const dmChannels = channels.filter(c => c.type === 'dm');
  const userNames = users.map(u => u.name);

  // Reply count per message
  const replyCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    messages.filter(m => m.parentId).forEach(m => {
      map[m.parentId!] = (map[m.parentId!] || 0) + 1;
    });
    return map;
  }, [messages]);

  // Full-text search across message bodies
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return messages
      .filter(m => m.body.toLowerCase().includes(q))
      .slice(0, 20)
      .map(m => ({ msg: m, ch: channels.find(c => c.id === m.channelId) }))
      .filter(r => r.ch);
  }, [search, messages, channels]);

  // Scroll to bottom when channel switches or new top-level messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChannelId, topLevelMessages.length]);

  // Scroll thread to bottom when replies arrive
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadReplies.length]);

  // Close thread panel when switching channels
  useEffect(() => {
    setOpenThreadId(null);
  }, [activeChannelId]);

  const isUnread = (ch: typeof channels[0]) => {
    const lastRead = ch.lastReadAt;
    if (!lastRead) return messages.some(m => m.channelId === ch.id);
    return messages.some(m => m.channelId === ch.id && m.createdAt > lastRead);
  };

  const handleSend = () => {
    const body = input.trim();
    if (!body && pendingAttachments.length === 0) return;

    // Parse @mentions and fire notifications
    const mentionRegex = /@(\w[\w.]*)/g;
    let match;
    while ((match = mentionRegex.exec(body)) !== null) {
      const mentionName = match[1].toLowerCase();
      const mentionedUser = users.find(u =>
        u.name.toLowerCase() === mentionName || u.id === mentionName
      );
      if (mentionedUser && mentionedUser.id !== currentUser.id) {
        addNotification({
          type: 'mention',
          title: `@mention in #${channel?.name || activeChannelId}`,
          body: `${currentUser.name} mentioned you: "${body.slice(0, 60)}${body.length > 60 ? '…' : ''}"`,
        });
      }
    }

    sendMessage(
      activeChannelId,
      body,
      pendingAttachments.length > 0 ? pendingAttachments : undefined
    );
    setInput('');
    setPendingAttachments([]);
    setShowAttachForm(false);
    inputRef.current?.focus();
  };

  const handleReply = () => {
    const body = threadInput.trim();
    if (!body || !openThreadId) return;
    replyToMessage(openThreadId, activeChannelId, body);
    setThreadInput('');
    threadInputRef.current?.focus();
  };

  const handleEditStart = (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    setEditingId(id);
    setEditValue(msg.body);
  };

  const handleEditSave = () => {
    if (!editingId || !editValue.trim()) return;
    updateMessage(editingId, editValue.trim());
    setEditingId(null);
    setEditValue('');
  };

  const handleAddAttachment = () => {
    if (!pendingUrl.trim()) return;
    setPendingAttachments(prev => [...prev, {
      name: pendingUrlName.trim() || pendingUrl.trim(),
      url: pendingUrl.trim(),
      type: 'link',
    }]);
    setPendingUrl('');
    setPendingUrlName('');
    setShowAttachForm(false);
  };

  const getDmName = (ch: typeof channels[0]) => {
    const otherId = ch.memberIds.find(id => id !== currentUser.id);
    return users.find(u => u.id === otherId)?.name || ch.name;
  };

  const getDmUserId = (ch: typeof channels[0]) =>
    ch.memberIds.find(id => id !== currentUser.id) || '';

  const renderMessageList = (msgs: Message[], isThread = false) => {
    const items: React.ReactNode[] = [];
    msgs.forEach((msg, i) => {
      const prev = msgs[i - 1];
      if (!isThread && (!prev || !isSameDay(prev.createdAt, msg.createdAt))) {
        items.push(
          <div key={`divider-${msg.id}`} className="flex items-center gap-3 px-4 my-4">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-white/30 font-medium">{formatDivider(msg.createdAt)}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
        );
      }
      items.push(
        <MessageBubble
          key={msg.id}
          msg={msg}
          prevMsg={prev}
          userNames={userNames}
          users={users}
          replyCount={replyCountMap[msg.id] || 0}
          onReact={(id, emoji) => addReaction(id, emoji)}
          onEdit={handleEditStart}
          onDelete={(id) => {
            deleteMessage(id);
            if (openThreadId === id) setOpenThreadId(null);
          }}
          onOpenThread={setOpenThreadId}
          editing={editingId === msg.id}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditSave={handleEditSave}
          onEditCancel={() => { setEditingId(null); setEditValue(''); }}
          isThread={isThread}
        />
      );
    });
    return items;
  };

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* Channel sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col bg-[#111113] border-r border-white/[0.06]">
        {/* Search */}
        <div className="p-3 border-b border-white/[0.06]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-7 pr-6 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/40"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
          {search.trim() ? (
            /* Search results mode */
            <div>
              <p className="px-3 mb-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.length === 0 ? (
                <p className="px-3 text-xs text-white/20">No messages found</p>
              ) : (
                searchResults.map(({ msg, ch }) => (
                  <button
                    key={msg.id}
                    onClick={() => { setActiveChannel(ch!.id); setSearch(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {ch!.type === 'channel' ? (
                        <Hash size={10} className="text-white/30 flex-shrink-0" />
                      ) : (
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${AVATAR_COLORS[getDmUserId(ch!)] || 'bg-white/20'}`} />
                      )}
                      <span className="text-[10px] text-white/30 truncate flex-1">
                        {ch!.type === 'channel' ? ch!.name : getDmName(ch!)}
                      </span>
                      <span className="text-[10px] text-white/20 flex-shrink-0">
                        {format(new Date(msg.createdAt), 'MMM d')}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 truncate">{msg.body}</p>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Normal channel list */
            <>
              <div className="mb-3">
                <div className="flex items-center justify-between px-3 mb-1">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Channels</span>
                  <button className="text-white/30 hover:text-white/60 transition-colors"><Plus size={12} /></button>
                </div>
                {groupedChannels.map(c => {
                  const unread = isUnread(c);
                  const isActive = c.id === activeChannelId;
                  return (
                    <div key={c.id} className="group/ch relative mx-1">
                      <button
                        onClick={() => setActiveChannel(c.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                          isActive
                            ? 'bg-white/[0.08] text-white'
                            : unread
                              ? 'text-white font-medium hover:bg-white/[0.04]'
                              : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                        }`}
                      >
                        <Hash size={14} className="flex-shrink-0 text-white/30" />
                        <span className="truncate flex-1 text-left">{c.name}</span>
                        {unread && !isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteChannel(c.id); }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/ch:opacity-100 p-1 rounded text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all"
                        title="Delete channel"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between px-3 mb-1">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Direct Messages</span>
                  <button className="text-white/30 hover:text-white/60 transition-colors"><Plus size={12} /></button>
                </div>
                {dmChannels.map(c => {
                  const unread = isUnread(c);
                  const isActive = c.id === activeChannelId;
                  const userId = getDmUserId(c);
                  return (
                    <div key={c.id} className="group/dm relative mx-1">
                      <button
                        onClick={() => setActiveChannel(c.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                          isActive
                            ? 'bg-white/[0.08] text-white'
                            : unread
                              ? 'text-white font-medium hover:bg-white/[0.04]'
                              : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-white ${AVATAR_COLORS[userId] || 'bg-white/20'}`}>
                          {getDmName(c)[0]}
                        </div>
                        <span className="truncate flex-1 text-left">{getDmName(c)}</span>
                        {unread && !isActive
                          ? <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                          : <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        }
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteChannel(c.id); }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/dm:opacity-100 p-1 rounded text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all"
                        title="Delete conversation"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main message area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.06] flex-shrink-0">
          {channel?.type === 'channel' ? (
            <Hash size={16} className="text-white/40 flex-shrink-0" />
          ) : (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${AVATAR_COLORS[getDmUserId(channel!)] || 'bg-white/20'}`}>
              {channel ? getDmName(channel)[0] : '?'}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-white">
              {channel?.type === 'channel' ? `#${channel.name}` : channel ? getDmName(channel) : ''}
            </h2>
            {channel?.description && (
              <p className="text-xs text-white/30 leading-none">{channel.description}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {channel?.memberIds.map(id => (
              <div key={id} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-[#0f0f10] -ml-1 first:ml-0 ${AVATAR_COLORS[id] || 'bg-white/20'}`}>
                {AVATAR_INITIALS[id] || '?'}
              </div>
            ))}
            <span className="text-xs text-white/30 ml-1">{channel?.memberIds.length}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
          {topLevelMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                {channel?.type === 'channel'
                  ? <Hash size={24} className="text-white/20" />
                  : <span className="text-2xl">{channel ? getDmName(channel)[0] : ''}</span>
                }
              </div>
              <p className="text-white/60 font-medium">
                {channel?.type === 'channel'
                  ? `Welcome to #${channel?.name}`
                  : `Your DM with ${channel ? getDmName(channel) : ''}`}
              </p>
              <p className="text-white/30 text-sm mt-1">
                {channel?.type === 'channel'
                  ? channel?.description
                  : 'Send a message to start the conversation.'}
              </p>
            </div>
          ) : (
            <>
              {renderMessageList(topLevelMessages)}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 pb-4">
          {/* Pending attachment pills */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.06] border border-white/[0.08] rounded-full text-xs text-white/60">
                  <Link size={10} className="flex-shrink-0" />
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <button
                    onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="text-white/30 hover:text-white/60 ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attach URL form */}
          {showAttachForm && (
            <div className="mb-2 p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl flex items-center gap-2">
              <input
                value={pendingUrl}
                onChange={e => setPendingUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddAttachment();
                  if (e.key === 'Escape') setShowAttachForm(false);
                }}
                placeholder="Paste URL"
                autoFocus
                className="flex-1 bg-transparent text-xs text-white/80 placeholder-white/25 focus:outline-none"
              />
              <input
                value={pendingUrlName}
                onChange={e => setPendingUrlName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddAttachment(); }}
                placeholder="Label (optional)"
                className="w-32 bg-transparent text-xs text-white/50 placeholder-white/20 focus:outline-none"
              />
              <button
                onClick={handleAddAttachment}
                disabled={!pendingUrl.trim()}
                className="px-2.5 py-1 text-xs bg-brand-600 hover:bg-brand-500 disabled:opacity-30 text-white rounded-lg transition-colors"
              >
                Add
              </button>
              <button onClick={() => setShowAttachForm(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 focus-within:border-white/20 transition-colors">
            <button
              onClick={() => setShowAttachForm(v => !v)}
              className={`flex-shrink-0 mb-0.5 transition-colors ${showAttachForm ? 'text-brand-400' : 'text-white/30 hover:text-white/60'}`}
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder={channel?.type === 'channel'
                ? `Message #${channel?.name}`
                : `Message ${channel ? getDmName(channel) : ''}`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 focus:outline-none resize-none leading-relaxed"
              style={{ minHeight: '22px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() && pendingAttachments.length === 0}
              className="flex-shrink-0 mb-0.5 p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} className="text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-white/15 mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* Thread panel */}
      {openThreadId && threadParentMsg && (
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-white/[0.06] bg-[#111113]">
          {/* Thread header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-white/40" />
              <span className="text-sm font-semibold text-white">Thread</span>
            </div>
            <button
              onClick={() => setOpenThreadId(null)}
              className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Thread messages */}
          <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
            {/* Parent message */}
            <div className="border-b border-white/[0.06] pb-4 mb-4">
              <MessageBubble
                msg={threadParentMsg}
                userNames={userNames}
                users={users}
                replyCount={0}
                onReact={(id, emoji) => addReaction(id, emoji)}
                onEdit={handleEditStart}
                onDelete={(id) => { deleteMessage(id); setOpenThreadId(null); }}
                onOpenThread={() => {}}
                editing={editingId === threadParentMsg.id}
                editValue={editValue}
                onEditChange={setEditValue}
                onEditSave={handleEditSave}
                onEditCancel={() => { setEditingId(null); setEditValue(''); }}
                isThread
              />
            </div>

            {/* Replies */}
            {threadReplies.length > 0 && (
              <div>
                <p className="px-4 mb-2 text-xs text-white/30 font-medium">
                  {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
                </p>
                {renderMessageList(threadReplies, true)}
              </div>
            )}
            <div ref={threadBottomRef} />
          </div>

          {/* Thread reply input */}
          <div className="flex-shrink-0 px-3 pb-3">
            <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-white/20 transition-colors">
              <textarea
                ref={threadInputRef}
                value={threadInput}
                onChange={e => {
                  setThreadInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
                  if (e.key === 'Escape') setOpenThreadId(null);
                }}
                placeholder="Reply in thread..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: '20px', maxHeight: '80px' }}
              />
              <button
                onClick={handleReply}
                disabled={!threadInput.trim()}
                className="flex-shrink-0 p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={12} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
