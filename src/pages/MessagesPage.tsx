import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import { Hash, Plus, Search, Smile, Paperclip, Send, X, Pencil, Trash2, MessageSquare, Link, MoreHorizontal, Pin, Copy, ChevronDown, BellOff, Bell, RotateCcw, Archive, Bookmark, ExternalLink, Globe, UserPlus, Mic, MicOff, Play, Pause, FileText, ImageIcon, Loader2, ChevronLeft, Flag, ArrowRight } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { Message, MessagePriority, User, Channel } from '../types';

const PRIORITY_CONFIG: Record<MessagePriority, { label: string; dot: string; bg: string; text: string; playColor: string }> = {
  low:    { label: 'Low',    dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', playColor: '#10b981' },
  medium: { label: 'Medium', dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', playColor: '#eab308' },
  high:   { label: 'High',   dot: 'bg-orange-400', bg: 'bg-orange-500/10', text: 'text-orange-400', playColor: '#f97316' },
  urgent: { label: 'Urgent', dot: 'bg-red-500',    bg: 'bg-red-500/10',    text: 'text-red-400',    playColor: '#ef4444' },
};
import { uploadToStorage } from '../lib/supabase';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '✅', '🔥'];

const AVATAR_COLORS: Record<string, string> = {
  lev: 'bg-brand-600',
  sarah: 'bg-emerald-600',
};

const AVATAR_INITIALS: Record<string, string> = {
  lev: 'L',
  sarah: 'S',
};

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-400',
  away: 'bg-amber-400',
  busy: 'bg-red-400',
  dnd: 'bg-red-500',
};

function Avatar({ userId, size = 8, status }: { userId: string; size?: number; status?: string }) {
  return (
    <div className="relative flex-shrink-0">
      <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-semibold text-xs ${AVATAR_COLORS[userId] || 'bg-white/20'}`}>
        {AVATAR_INITIALS[userId] || '?'}
      </div>
      {status && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f0f10] ${STATUS_DOT[status] || 'bg-emerald-400'}`} />
      )}
    </div>
  );
}

function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"()[\]{}]+/);
  return m ? m[0] : null;
}

function LinkPreviewCard({ url }: { url: string }) {
  let domain = '';
  try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
  const display = url.replace(/^https?:\/\//, '').slice(0, 70);
  return (
    <a
      href={url} target="_blank" rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition-colors max-w-xs group/link"
      onClick={e => e.stopPropagation()}
    >
      <img
        src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
        alt=""
        className="w-4 h-4 rounded flex-shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/60 truncate">{domain}</p>
        <p className="text-[10px] text-white/30 truncate">{display}</p>
      </div>
      <ExternalLink size={11} className="text-white/20 group-hover/link:text-white/50 flex-shrink-0" />
    </a>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.82);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

function AudioPlayer({ url, duration, title, priority }: { url: string; duration?: number; title?: string; priority?: MessagePriority }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const remaining = duration ? Math.max(0, duration - currentTime) : 0;
  const progress = duration && duration > 0 ? (currentTime / duration) * 100 : 0;
  const playColor = priority ? PRIORITY_CONFIG[priority].playColor : '#3f3f46'; // zinc-700 — neutral when no priority

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 px-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl max-w-[280px]">
      {title && (
        <p className="text-xs font-medium text-white/70 truncate">{title}</p>
      )}
      <div className="flex items-center gap-2.5">
      <button
        onClick={toggle}
        style={{ backgroundColor: playColor }}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
      >
        {playing
          ? <Pause size={13} className="text-white" />
          : <Play size={13} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-1 rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: playColor }}
          />
        </div>
      </div>
      <span className="text-[10px] text-white/40 flex-shrink-0 tabular-nums w-8 text-right">
        {fmtDuration(playing ? remaining : (duration ?? 0))}
      </span>
      </div>
      <audio
        ref={audioRef}
        src={url}
        onCanPlay={() => setLoaded(true)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      />
    </div>
  );
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
  // Split by inline code first to protect its contents from markdown processing
  const codeSegments = body.split(/(`[^`\n]+`)/g);
  return (
    <>
      {codeSegments.map((seg, si) => {
        if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
          return (
            <code key={si} className="bg-white/[0.08] text-amber-300/90 rounded px-1 py-0.5 text-[0.85em] font-mono">
              {seg.slice(1, -1)}
            </code>
          );
        }
        // Process bold, italic, strikethrough, @mentions in plain segments
        const parts = seg.split(/(\*\*[^*\n]+\*\*|_[^_\n]+_|~~[^~\n]+~~|@\w[\w.]*)/g);
        return parts.map((part, pi) => {
          const key = `${si}-${pi}`;
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={key} className="font-semibold text-white/95">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
            return <em key={key} className="italic text-white/80">{part.slice(1, -1)}</em>;
          }
          if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
            return <del key={key} className="opacity-40">{part.slice(2, -2)}</del>;
          }
          if (part.startsWith('@')) {
            const name = part.slice(1).toLowerCase();
            const isMatch = userNames.some(n => n.toLowerCase() === name || n.toLowerCase().startsWith(name));
            if (isMatch) {
              return <span key={key} className="bg-brand-500/20 text-brand-300 rounded px-0.5">{part}</span>;
            }
          }
          return <React.Fragment key={key}>{part}</React.Fragment>;
        });
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
  isPinned?: boolean;
  onReact: (id: string, emoji: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenThread: (id: string) => void;
  onPin: (id: string) => void;
  onCopyLink: (id: string) => void;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  isThread?: boolean;
  isFirstUnread?: boolean;
  isSaved?: boolean;
  onSave?: (id: string) => void;
  userStatuses?: Record<string, string>;
  onSetPriority?: (id: string, p: MessagePriority | null, isReceiver: boolean) => void;
  onMove?: (id: string, targetChannelId: string) => void;
  allChannels?: Channel[];
}

function MessageBubble({ msg, prevMsg, userNames, users, replyCount, isPinned, onReact, onEdit, onDelete, onOpenThread, onPin, onCopyLink, editing, editValue, onEditChange, onEditSave, onEditCancel, isThread, isFirstUnread, isSaved, onSave, userStatuses, onSetPriority, onMove, allChannels }: BubbleProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const author = users.find(u => u.id === msg.authorId);
  const effectivePriority = msg.receiverPriority ?? msg.priority;
  const isContinuation = prevMsg && prevMsg.authorId === msg.authorId
    && isSameDay(prevMsg.createdAt, msg.createdAt)
    && (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60000;

  const totalReactions = Object.entries(msg.reactions).filter(([, us]) => us.length > 0);

  return (
    <>
      {isFirstUnread && (
        <div className="flex items-center gap-3 px-4 py-2 my-1">
          <div className="flex-1 h-px bg-brand-500/40" />
          <span className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider flex-shrink-0">New messages</span>
          <div className="flex-1 h-px bg-brand-500/40" />
        </div>
      )}
    <div
      className={`group relative flex gap-3 px-4 py-0.5 hover:bg-white/[0.02] rounded-lg transition-colors ${
        isPinned ? 'bg-amber-500/[0.03] border-l-2 border-amber-500/30 ml-0 pl-3' : ''
      }`}
      onMouseLeave={() => { setShowEmoji(false); setShowPriorityPicker(false); }}
    >
      {isContinuation ? (
        <div className="w-8 flex-shrink-0 flex items-center justify-center">
          <span className="text-[10px] text-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
            {format(new Date(msg.createdAt), 'h:mm')}
          </span>
        </div>
      ) : (
        <div className="pt-0.5 flex-shrink-0">
          <Avatar userId={msg.authorId} size={8} status={userStatuses?.[msg.authorId]} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {!isContinuation && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white">{author?.name || msg.authorId}</span>
            <span className="text-xs text-white/30">{formatTime(msg.createdAt)}</span>
            {msg.editedAt && <span className="text-[10px] text-white/20">(edited)</span>}
            {effectivePriority && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_CONFIG[effectivePriority].bg} ${PRIORITY_CONFIG[effectivePriority].text}`}>
                {PRIORITY_CONFIG[effectivePriority].label}
              </span>
            )}
            {/* Inline hover action toolbar */}
            {!editing && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0 bg-[#1c1c1f] border border-white/[0.08] rounded-lg px-0.5 py-0 shadow-lg ml-1">
                <div className="relative">
                  <button onClick={() => setShowEmoji(v => !v)} className="p-1 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors"><Smile size={13} /></button>
                  {showEmoji && (
                    <div className="absolute left-0 bottom-full mb-1 flex gap-1 p-1.5 bg-[#1c1c1f] border border-white/[0.08] rounded-xl shadow-xl z-20">
                      {EMOJIS.map(e => (<button key={e} onClick={() => { onReact(msg.id, e); setShowEmoji(false); }} className="text-lg hover:scale-125 transition-transform p-0.5">{e}</button>))}
                    </div>
                  )}
                </div>
                {!isThread && (<button onClick={() => onOpenThread(msg.id)} className="p-1 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors" title="Reply in thread"><MessageSquare size={13} /></button>)}
                <button onClick={() => onEdit(msg.id)} className="p-1 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors" title="Edit"><Pencil size={13} /></button>
                <button onClick={() => onPin(msg.id)} className={`p-1 rounded-md hover:bg-white/[0.08] transition-colors ${isPinned ? 'text-amber-400' : 'text-white/30 hover:text-white/60'}`} title={isPinned ? 'Unpin' : 'Pin'}><Pin size={13} /></button>
                <button onClick={() => onCopyLink(msg.id)} className="p-1 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors" title="Copy link"><Copy size={13} /></button>
                {onSave && (<button onClick={() => onSave(msg.id)} className={`p-1 rounded-md hover:bg-white/[0.08] transition-colors ${isSaved ? 'text-amber-400' : 'text-white/30 hover:text-white/60'}`} title={isSaved ? 'Remove bookmark' : 'Save'}><Bookmark size={13} /></button>)}
                {onSetPriority && (
                  <div className="relative">
                    <button onClick={() => setShowPriorityPicker(v => !v)} className={`p-1 rounded-md hover:bg-white/[0.08] transition-colors ${effectivePriority ? PRIORITY_CONFIG[effectivePriority].text : 'text-white/30 hover:text-white/60'}`} title="Set priority"><Flag size={13} /></button>
                    {showPriorityPicker && (
                      <div className="absolute left-0 bottom-full mb-1 p-1.5 bg-[#1c1c1f] border border-white/[0.08] rounded-xl shadow-xl z-20 flex flex-col gap-0.5 min-w-[110px]">
                        {(Object.entries(PRIORITY_CONFIG) as [MessagePriority, typeof PRIORITY_CONFIG[MessagePriority]][]).map(([p, cfg]) => (
                          <button key={p} onClick={() => { onSetPriority(msg.id, p, true); setShowPriorityPicker(false); }} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.08] ${effectivePriority === p ? cfg.text + ' font-semibold' : 'text-white/60'}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />{cfg.label}
                          </button>
                        ))}
                        {effectivePriority && (
                          <button onClick={() => { onSetPriority(msg.id, null, true); setShowPriorityPicker(false); }} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-colors border-t border-white/[0.06] mt-0.5 pt-2">
                            <X size={10} /> Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {onMove && allChannels && (
                  <div className="relative">
                    <button onClick={() => setShowMovePicker(v => !v)} className="p-1 rounded-md hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors" title="Move to channel"><ArrowRight size={13} /></button>
                    {showMovePicker && (
                      <div className="absolute left-0 bottom-full mb-1 p-1.5 bg-[#1c1c1f] border border-white/[0.08] rounded-xl shadow-xl z-20 flex flex-col gap-0.5 min-w-[170px] max-h-64 overflow-y-auto">
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-2 py-1">Move to...</p>
                        {allChannels.filter(c => c.id !== msg.channelId && !c.deletedAt).map(c => {
                          const isDm = c.type === 'dm';
                          const dmName = isDm ? c.memberIds.filter(id => id !== msg.authorId).map(id => users.find(u => u.id === id)?.name ?? 'Unknown').join(', ') : null;
                          return (
                            <button key={c.id} onClick={() => { onMove(msg.id, c.id); setShowMovePicker(false); }} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-colors">
                              {isDm ? <span className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" /> : <Hash size={11} className="flex-shrink-0 text-white/30" />}
                              <span className="truncate">{isDm ? dmName : c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => onDelete(msg.id)} className="p-1 rounded-md hover:bg-white/[0.08] text-red-400/50 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        )}

        {/* Attachments first — so text caption sits tight below */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mb-1 flex flex-col gap-2">
            {msg.attachments.map((att, i) => {
              if (att.type === 'audio') {
                return <AudioPlayer key={i} url={att.url} duration={att.duration} title={att.name && !att.name.startsWith('Voice note') ? att.name : undefined} priority={effectivePriority} />;
              }
              if (att.type.startsWith('image/') || att.type === 'image') {
                return (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                    <img
                      src={att.url}
                      alt={att.name}
                      className="max-w-[320px] max-h-[240px] rounded-xl object-cover border border-white/[0.08] hover:opacity-90 transition-opacity"
                      loading="lazy"
                    />
                  </a>
                );
              }
              return (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-white/[0.08] transition-colors max-w-xs group/att">
                  {att.type === 'link' ? <Link size={12} className="text-white/40 flex-shrink-0" /> : <FileText size={12} className="text-white/40 flex-shrink-0" />}
                  <span className="text-xs text-white/60 truncate group-hover/att:text-white/80">{att.name || att.url}</span>
                </a>
              );
            })}
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
        ) : msg.body ? (
          <p className="text-sm text-white/80 leading-relaxed break-words">
            {renderBody(msg.body, userNames)}
            {isContinuation && msg.editedAt && <span className="text-[10px] text-white/20 ml-1">(edited)</span>}
          </p>
        ) : null}

        {/* Link preview — first URL in body, if not already in attachments */}
        {(() => {
          const url = extractFirstUrl(msg.body);
          if (!url) return null;
          const alreadyAttached = msg.attachments?.some(a => a.url === url);
          if (alreadyAttached) return null;
          return <LinkPreviewCard url={url} />;
        })()}

        {/* Reactions */}
        {totalReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {totalReactions.map(([emoji, reactors]) => {
              const names = reactors.map(id => users.find(u => u.id === id)?.name?.split(' ')[0] || id).join(', ');
              return (
                <div key={emoji} className="relative group/rxn">
                  <button
                    onClick={() => onReact(msg.id, emoji)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs transition-colors"
                  >
                    <span>{emoji}</span>
                    <span className="text-white/50">{reactors.length}</span>
                  </button>
                  <div className="absolute bottom-full left-0 mb-1.5 px-2 py-1 bg-[#0f0f10] border border-white/[0.1] rounded-lg text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover/rxn:opacity-100 transition-opacity pointer-events-none z-30 shadow-xl">
                    {names}
                  </div>
                </div>
              );
            })}
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

      {/* Toolbar is now inline in the name/date row above */}
    </div>
    </>
  );
}

export default function MessagesPage() {
  const {
    channels, messages, users, currentUser, activeChannelId,
    setActiveChannel, sendMessage, addReaction,
    updateMessage, deleteMessage, replyToMessage, addNotification, deleteChannel, addChannel,
    updateChannel, pinMessage, unpinMessage, restoreChannel, permanentlyDeleteChannel,
    userStatuses, setMessagePriority, moveMessage,
  } = useStore();

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [openThreadId, _setOpenThreadId] = useState<string | null>(() =>
    localStorage.getItem('hive_messages_openThreadId')
  );
  const setOpenThreadId = (id: string | null) => {
    _setOpenThreadId(id);
    if (id) localStorage.setItem('hive_messages_openThreadId', id);
    else localStorage.removeItem('hive_messages_openThreadId');
  };
  const [threadInput, setThreadInput] = useState('');
  const [channelMenuId, setChannelMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingChannelId, setRenamingChannelId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewDm, setShowNewDm] = useState(false);
  const [newDmUserId, setNewDmUserId] = useState('');
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  const [pendingUrlName, setPendingUrlName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<{ name: string; url: string; type: string; duration?: number }[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [copyToast, setCopyToast] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmPermDeleteId, setConfirmPermDeleteId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberStatus, setAddMemberStatus] = useState<'idle' | 'loading' | 'invited' | 'added' | 'notfound'>('idle');
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [showChannelBrowser, setShowChannelBrowser] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('saved_msg_ids') || '[]')); }
    catch { return new Set<string>(); }
  });
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [dmSearchLoading, setDmSearchLoading] = useState(false);
  const dmSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [savedChannelFilter, setSavedChannelFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<MessagePriority | null>(null);
  const [msgPriority, setMsgPriority] = useState<MessagePriority | null>(null);
  const prevChannelIdRef = useRef<string | null>(null);

  // Mobile: 'list' shows the channel sidebar full-screen; 'chat' shows the message area full-screen
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Wrapper so every channel-select also switches to chat view on mobile and clears any overlay panels
  const selectChannel = (id: string) => { setActiveChannel(id); setMobileView('chat'); setPriorityFilter(null); setShowSaved(false); };

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; duration: number } | null>(null);
  const [audioTitle, setAudioTitle] = useState('');
  const audioTitleRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const threadInputRef = useRef<HTMLTextAreaElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);

  const channel = channels.find(c => c.id === activeChannelId);
  const channelMessages = messages.filter(m => m.channelId === activeChannelId);
  const topLevelMessages = channelMessages.filter(m => !m.parentId);
  const threadReplies = openThreadId ? messages.filter(m => m.parentId === openThreadId) : [];
  const threadParentMsg = openThreadId ? messages.find(m => m.id === openThreadId) : null;

  const groupedChannels = channels.filter(c => c.type === 'channel' && !c.deletedAt);
  const dmChannels = channels.filter(c => c.type === 'dm' && !c.deletedAt);
  const deletedChannels = channels.filter(c => c.deletedAt);
  const userNames = users.map(u => u.name);
  const pinnedIds = new Set(channel?.pinnedMessageIds ?? []);
  const pinnedMessages = topLevelMessages.filter(m => pinnedIds.has(m.id));

  // First unread message: from another user, created after lastReadAt
  const firstUnreadId = useMemo(() => {
    const lastRead = channel?.lastReadAt;
    if (!lastRead) return null;
    const msg = topLevelMessages.find(m => m.authorId !== currentUser.id && m.createdAt > lastRead);
    return msg?.id ?? null;
  }, [topLevelMessages, channel?.lastReadAt, currentUser.id]);

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
    setShowPinned(false);
    setEditingDesc(false);
    setShowMembers(false);
    setHasNewMessages(!!firstUnreadId);
  }, [activeChannelId]);

  // Show "new messages" indicator when new messages arrive while channel is open
  useEffect(() => {
    if (firstUnreadId) setHasNewMessages(true);
  }, [firstUnreadId]);

  useEffect(() => {
    if (editingDesc && descInputRef.current) descInputRef.current.focus();
  }, [editingDesc]);

  // Typing indicator: subscribe to broadcast events for current channel
  useEffect(() => {
    if (typingChannelRef.current) {
      supabase.removeChannel(typingChannelRef.current);
    }
    setTypingUsers([]);
    const ch = supabase.channel(`typing-${activeChannelId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const uid = payload?.userId as string;
        if (!uid || uid === currentUser.id) return;
        setTypingUsers(prev => prev.includes(uid) ? prev : [...prev, uid]);
        clearTimeout(typingTimeoutsRef.current[uid]);
        typingTimeoutsRef.current[uid] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(id => id !== uid));
        }, 3000);
      })
      .subscribe();
    typingChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [activeChannelId, currentUser.id]);

  // Draft management: load saved draft when switching channels
  useEffect(() => {
    if (prevChannelIdRef.current !== activeChannelId) {
      const draft = localStorage.getItem(`msg_draft_${activeChannelId}`);
      setInput(draft || '');
      prevChannelIdRef.current = activeChannelId;
    }
  }, [activeChannelId]); // intentionally omits `input` - drafts are saved inline in onChange

  const hasDraft = (id: string) => {
    if (id === activeChannelId) return !!input.trim();
    try { return !!(localStorage.getItem(`msg_draft_${id}`) || '').trim(); } catch { return false; }
  };

  const toggleSave = useCallback((msgId: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) { next.delete(msgId); } else { next.add(msgId); }
      try { localStorage.setItem('saved_msg_ids', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const isUnread = (ch: typeof channels[0]) => {
    const lastRead = ch.lastReadAt;
    if (!lastRead) return messages.some(m => m.channelId === ch.id && m.authorId !== currentUser.id);
    return messages.some(m => m.channelId === ch.id && m.createdAt > lastRead && m.authorId !== currentUser.id);
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

    localStorage.removeItem(`msg_draft_${activeChannelId}`);
    sendMessage(
      activeChannelId,
      body,
      pendingAttachments.length > 0 ? pendingAttachments : undefined,
      msgPriority ?? undefined,
    );
    setInput('');
    setPendingAttachments([]);
    setShowAttachForm(false);
    setMsgPriority(null);
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

  // ── Voice recording ─────────────────────────────────────────────────────────

  // Stop the mic stream immediately — called from stopRecording and on unmount
  const releaseStream = () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
  };

  // Release the mic if the component unmounts while recording is active
  useEffect(() => () => { releaseStream(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream; // store so we can stop it at any time
      // Prefer webm/opus; fall back to whatever the browser supports (Safari uses mp4)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const duration = (Date.now() - recordingStartRef.current) / 1000;
        if (duration < 0.5) return; // too short, discard
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setPendingAudio({ blob, duration });
        setAudioTitle('');
        setTimeout(() => audioTitleRef.current?.focus(), 50);
      };
      mediaRecorderRef.current = mediaRecorder;
      recordingStartRef.current = Date.now();
      mediaRecorder.start(100); // collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access in your browser settings.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    releaseStream(); // stop mic tracks immediately — clears the browser tab indicator
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const uploadAudioBlob = async (blob: Blob, duration: number, title?: string) => {
    setIsUploading(true);
    setPendingAudio(null);
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const path = `audio/${Date.now()}-${currentUser.id}.${ext}`;
      const url = await uploadToStorage('hive-attachments', path, blob);
      setPendingAttachments(prev => [...prev, {
        name: title?.trim() || `Voice note (${fmtDuration(duration)})`,
        url,
        type: 'audio',
        duration,
      }]);
    } catch (err: any) {
      console.error('Audio upload failed:', err);
      alert(`Upload failed: ${err?.message || 'Unknown error'}. Make sure the "hive-attachments" Supabase Storage bucket exists and is set to public.`);
    } finally {
      setIsUploading(false);
    }
  };

  // ── File / photo upload ──────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        let uploadBlob: Blob = file;
        let type = file.type;
        if (file.type.startsWith('image/')) {
          uploadBlob = await compressImage(file);
          type = 'image/jpeg';
        }
        const ext = file.name.split('.').pop() || 'bin';
        const path = `files/${Date.now()}-${currentUser.id}.${ext}`;
        const url = await uploadToStorage('hive-attachments', path, uploadBlob);
        setPendingAttachments(prev => [...prev, { name: file.name, url, type }]);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(`Upload failed: ${err?.message || 'Unknown error'}. Make sure the "hive-attachments" Supabase Storage bucket exists and is set to public.`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const broadcastTyping = useCallback(() => {
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUser.id },
    });
  }, [currentUser.id]);

  const handleCopyLink = useCallback((msgId: string) => {
    const url = `${window.location.origin}?channel=${activeChannelId}&msg=${msgId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    });
  }, [activeChannelId]);

  const handleSaveDesc = () => {
    if (!channel) return;
    updateChannel(channel.id, { description: descValue.trim() || undefined });
    setEditingDesc(false);
  };

  const handleJumpToUnread = () => {
    firstUnreadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHasNewMessages(false);
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim()) return;
    addChannel({ name: newChannelName.trim(), type: 'channel', memberIds: [currentUser.id] });
    setNewChannelName('');
    setShowNewChannel(false);
  };

  const handleDmSearch = (q: string) => {
    setDmSearchQuery(q);
    if (dmSearchTimeout.current) clearTimeout(dmSearchTimeout.current);
    if (!q.trim()) { setDmSearchResults([]); return; }
    setDmSearchLoading(true);
    dmSearchTimeout.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id, name, email')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .neq('id', currentUser.id)
        .limit(8);
      setDmSearchResults(data ?? []);
      setDmSearchLoading(false);
    }, 300);
  };

  const handleStartDm = (userId: string) => {
    const existing = channels.find(c => c.type === 'dm' && c.memberIds.includes(userId) && c.memberIds.includes(currentUser.id));
    if (existing) { selectChannel(existing.id); }
    else { addChannel({ name: '', type: 'dm', memberIds: [currentUser.id, userId] }); }
    setShowNewDm(false);
    setDmSearchQuery('');
    setDmSearchResults([]);
  };

  const handleInviteMember = async () => {
    if (!addMemberEmail.trim() || !channel) return;
    setAddMemberStatus('loading');
    const email = addMemberEmail.trim().toLowerCase();
    // Check if a profile with this email already exists
    const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (data?.id) {
      if (channel.memberIds.includes(data.id)) {
        setAddMemberStatus('added');
        setAddMemberEmail('');
        return;
      }
      // Send invitation instead of directly adding
      const { sendInvitation } = useStore.getState();
      await sendInvitation('channel', channel.id, channel.name || 'channel', data.id);
      setAddMemberStatus('invited');
      setAddMemberEmail('');
    } else {
      setAddMemberStatus('notfound');
    }
  };

  const handleAddDm = () => {
    if (!newDmUserId) return;
    const existing = channels.find(c => c.type === 'dm' && c.memberIds.includes(newDmUserId));
    if (existing) { selectChannel(existing.id); setShowNewDm(false); return; }
    addChannel({ name: '', type: 'dm', memberIds: [currentUser.id, newDmUserId] });
    setNewDmUserId('');
    setShowNewDm(false);
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
      const isFirstUnread = !isThread && msg.id === firstUnreadId;
      if (!isThread && (!prev || !isSameDay(prev.createdAt, msg.createdAt))) {
        items.push(
          <div key={`divider-${msg.id}`} className="flex items-center gap-3 px-4 my-1.5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-white/30 font-medium">{formatDivider(msg.createdAt)}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
        );
      }
      const bubble = (
        <MessageBubble
          key={msg.id}
          msg={msg}
          prevMsg={prev}
          userNames={userNames}
          users={users}
          replyCount={replyCountMap[msg.id] || 0}
          isPinned={pinnedIds.has(msg.id)}
          onReact={(id, emoji) => addReaction(id, emoji)}
          onEdit={handleEditStart}
          onDelete={(id) => {
            deleteMessage(id);
            if (openThreadId === id) setOpenThreadId(null);
          }}
          onOpenThread={setOpenThreadId}
          onPin={(id) => pinnedIds.has(id) ? unpinMessage(id, activeChannelId) : pinMessage(id, activeChannelId)}
          onCopyLink={handleCopyLink}
          editing={editingId === msg.id}
          editValue={editValue}
          onEditChange={setEditValue}
          onEditSave={handleEditSave}
          onEditCancel={() => { setEditingId(null); setEditValue(''); }}
          isThread={isThread}
          isFirstUnread={isFirstUnread}
          isSaved={savedIds.has(msg.id)}
          onSave={toggleSave}
          userStatuses={userStatuses}
          onSetPriority={setMessagePriority}
          onMove={moveMessage}
          allChannels={channels}
        />
      );
      // Wrap first-unread message in a ref div so we can scroll to it
      if (isFirstUnread) {
        items.push(<div key={msg.id} ref={firstUnreadRef}>{bubble}</div>);
      } else {
        items.push(bubble);
      }
    });
    return items;
  };

  return (
    <div className="flex-1 flex overflow-hidden relative">

      {/* Channel sidebar — full-screen on mobile in list view, always visible on desktop */}
      <div className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} w-full md:w-56 flex-shrink-0 flex-col bg-[#111113] border-r border-white/[0.06]`}>
        {/* Search — extra top padding on mobile to clear the Dynamic Island / status bar */}
        <div className="p-3 pt-safe md:pt-3 border-b border-white/[0.06]">
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
          {/* Priority quick nav */}
          {!search.trim() && (() => {
            const prioritized = messages.filter(m => (m.receiverPriority ?? m.priority));
            if (prioritized.length === 0) return null;
            return (
              <div className="px-1 mb-1">
                {(['urgent', 'high', 'medium', 'low'] as MessagePriority[]).map(p => {
                  const count = messages.filter(m => (m.receiverPriority ?? m.priority) === p).length;
                  if (count === 0) return null;
                  const cfg = PRIORITY_CONFIG[p];
                  const isActive = priorityFilter === p;
                  return (
                    <button
                      key={p}
                      onClick={() => { setPriorityFilter(isActive ? null : p); setShowSaved(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="flex-1 text-left">{cfg.label}</span>
                      <span className="text-xs text-white/30">{count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Saved Items quick nav */}
          {!search.trim() && (
            <div className="px-1 mb-1">
              <button
                onClick={() => { setShowSaved(v => !v); setSavedChannelFilter(null); setPriorityFilter(null); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${showSaved ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'}`}
              >
                <Bookmark size={14} className={showSaved ? 'text-amber-400' : 'text-white/30'} />
                <span className="flex-1 text-left">Saved Items</span>
                {savedIds.size > 0 && <span className="text-xs text-white/30">{savedIds.size}</span>}
              </button>
            </div>
          )}

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
                    onClick={() => { selectChannel(ch!.id); setSearch(''); }}
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
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowChannelBrowser(true)} className="text-white/30 hover:text-white/60 transition-colors" title="Browse channels"><Globe size={11} /></button>
                    <button onClick={() => setShowNewChannel(v => !v)} className="text-white/30 hover:text-white/60 transition-colors"><Plus size={12} /></button>
                  </div>
                </div>
                {showNewChannel && (
                  <div className="mx-2 mb-2 flex items-center gap-1">
                    <input
                      autoFocus
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddChannel(); if (e.key === 'Escape') { setShowNewChannel(false); setNewChannelName(''); } }}
                      placeholder="channel-name"
                      className="flex-1 px-2 py-1 bg-white/[0.06] border border-white/[0.1] rounded text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-brand-500/40"
                    />
                    <button onClick={handleAddChannel} className="px-2 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded transition-colors">Add</button>
                    <button onClick={() => { setShowNewChannel(false); setNewChannelName(''); }} className="text-white/30 hover:text-white/60"><X size={12} /></button>
                  </div>
                )}
                {groupedChannels.map(c => {
                  const unread = isUnread(c);
                  const isActive = c.id === activeChannelId;
                  return (
                    <div key={c.id} className="group relative mx-1 flex items-center">
                      <button
                        onClick={() => { selectChannel(c.id); setChannelMenuId(null); setShowSaved(false); }}
                        className={`flex-1 flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                          !showSaved && isActive ? 'bg-white/[0.08] text-white' : unread ? 'text-white font-medium hover:bg-white/[0.04]' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                        }`}
                      >
                        <Hash size={14} className="flex-shrink-0 text-white/30" />
                        <span className="truncate flex-1 text-left">{c.name}</span>
                        {!isActive && hasDraft(c.id) && <span className="text-[9px] text-amber-400/70 font-medium flex-shrink-0">DRAFT</span>}
                        {c.muted && <BellOff size={11} className="text-white/20 flex-shrink-0" />}
                        {unread && !isActive && !c.muted && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
                      </button>
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setChannelMenuId(channelMenuId === c.id ? null : c.id); setConfirmDeleteId(null); }}
                          className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {channelMenuId === c.id && (
                          <div className="absolute right-0 top-full mt-0.5 z-50 bg-[#1c1c1f] border border-white/[0.1] rounded-lg shadow-xl overflow-hidden w-44">
                            {confirmDeleteId === c.id ? (
                              <div className="p-2">
                                <p className="text-xs text-white/60 mb-2">Delete <span className="text-white font-medium">#{c.name}</span> and all its messages?</p>
                                <div className="flex gap-1">
                                  <button onClick={() => { deleteChannel(c.id); setChannelMenuId(null); setConfirmDeleteId(null); }} className="flex-1 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded transition-colors">Delete</button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-white/50 text-xs rounded transition-colors">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setActiveChannel(c.id); setShowMembers(true); setChannelMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors"
                                >
                                  <UserPlus size={12} /> Manage members
                                </button>
                                <button
                                  onClick={() => { updateChannel(c.id, { muted: !c.muted }); setChannelMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors"
                                >
                                  {c.muted ? <Bell size={12} /> : <BellOff size={12} />}
                                  {c.muted ? 'Unmute channel' : 'Mute channel'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(c.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.06] transition-colors"
                                >
                                  <Trash2 size={12} /> Delete channel
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="px-3 mb-1">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Direct Messages</span>
                </div>
                {dmChannels.map(c => {
                  const unread = isUnread(c);
                  const isActive = c.id === activeChannelId;
                  const userId = getDmUserId(c);
                  return (
                    <div key={c.id} className="group relative mx-1 flex items-center">
                      <button
                        onClick={() => { selectChannel(c.id); setChannelMenuId(null); setShowSaved(false); }}
                        className={`flex-1 flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                          !showSaved && isActive ? 'bg-white/[0.08] text-white' : unread ? 'text-white font-medium hover:bg-white/[0.04]' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ${AVATAR_COLORS[userId] || 'bg-white/20'}`}>
                            {getDmName(c)[0]}
                          </div>
                          {userStatuses[userId] && (
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#111113] ${STATUS_DOT[userStatuses[userId]] || 'bg-emerald-400'}`} />
                          )}
                        </div>
                        <span className="truncate flex-1 text-left">{getDmName(c)}</span>
                        {!isActive && hasDraft(c.id) && <span className="text-[9px] text-amber-400/70 font-medium flex-shrink-0">DRAFT</span>}
                        {unread && !isActive
                          ? <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                          : <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        }
                      </button>
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setChannelMenuId(channelMenuId === c.id ? null : c.id); setConfirmDeleteId(null); }}
                          className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {channelMenuId === c.id && (
                          <div className="absolute right-0 top-full mt-0.5 z-50 bg-[#1c1c1f] border border-white/[0.1] rounded-lg shadow-xl overflow-hidden w-48">
                            {confirmDeleteId === c.id ? (
                              <div className="p-2">
                                <p className="text-xs text-white/60 mb-2">Delete conversation with <span className="text-white font-medium">{getDmName(c)}</span>?</p>
                                <div className="flex gap-1">
                                  <button onClick={() => { deleteChannel(c.id); setChannelMenuId(null); setConfirmDeleteId(null); }} className="flex-1 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded transition-colors">Delete</button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-white/50 text-xs rounded transition-colors">Cancel</button>
                                </div>
                              </div>
                            ) : renamingChannelId === c.id ? (
                              <div className="p-2">
                                <p className="text-xs text-white/60 mb-1.5">Rename conversation</p>
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && renameValue.trim()) {
                                      updateChannel(c.id, { name: renameValue.trim() });
                                      setChannelMenuId(null); setRenamingChannelId(null);
                                    } else if (e.key === 'Escape') {
                                      setRenamingChannelId(null);
                                    }
                                  }}
                                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-brand-400 mb-1.5"
                                  placeholder="Conversation name…"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => { if (renameValue.trim()) { updateChannel(c.id, { name: renameValue.trim() }); setChannelMenuId(null); setRenamingChannelId(null); } }}
                                    disabled={!renameValue.trim()}
                                    className="flex-1 py-1 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs rounded transition-colors disabled:opacity-40"
                                  >Save</button>
                                  <button onClick={() => setRenamingChannelId(null)} className="flex-1 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-white/50 text-xs rounded transition-colors">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => { updateChannel(c.id, { muted: !c.muted }); setChannelMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors"
                                >
                                  {c.muted ? <Bell size={12} /> : <BellOff size={12} />}
                                  {c.muted ? 'Unmute' : 'Mute conversation'}
                                </button>
                                <button
                                  onClick={() => { setRenamingChannelId(c.id); setRenameValue(c.name ?? ''); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06] transition-colors"
                                >
                                  <Pencil size={12} /> Rename conversation
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(c.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.06] transition-colors"
                                >
                                  <Trash2 size={12} /> Delete conversation
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Deleted channels archive */}
          {deletedChannels.length > 0 && (
            <div className="mt-2 border-t border-white/[0.04] pt-2">
              <button
                onClick={() => setShowDeleted(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
              >
                <Archive size={12} />
                <span className="flex-1 text-left">Deleted ({deletedChannels.length})</span>
                <ChevronDown size={11} className={`transition-transform ${showDeleted ? '' : '-rotate-90'}`} />
              </button>
              {showDeleted && deletedChannels.map(c => (
                <div key={c.id} className="mx-1 mb-0.5 flex items-center gap-1 px-2 py-1.5 rounded-md bg-white/[0.02] group">
                  <span className="flex-1 text-xs text-white/25 truncate">
                    {c.type === 'channel' ? `#${c.name}` : getDmName(c)}
                  </span>
                  <button
                    onClick={() => restoreChannel(c.id)}
                    title="Restore"
                    className="p-1 rounded text-white/30 hover:text-emerald-400 hover:bg-white/[0.06] transition-colors flex-shrink-0"
                  >
                    <RotateCcw size={11} />
                  </button>
                  {confirmPermDeleteId === c.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { permanentlyDeleteChannel(c.id); setConfirmPermDeleteId(null); }}
                        className="text-[10px] px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmPermDeleteId(null)}
                        className="text-white/30 hover:text-white/60"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmPermDeleteId(c.id)}
                      title="Delete permanently"
                      className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-colors flex-shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Priority filtered panel */}
      {priorityFilter && !showSaved && (() => {
        const cfg = PRIORITY_CONFIG[priorityFilter];
        const filtered = messages.filter(m => (m.receiverPriority ?? m.priority) === priorityFilter);
        const channelsWithMsgs = channels.filter(ch => filtered.some(m => m.channelId === ch.id));
        return (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex items-center gap-3 px-5 min-h-[56px] pt-safe md:pt-0 pb-2 md:pb-0 border-b border-white/[0.06] flex-shrink-0">
              <button onClick={() => setPriorityFilter(null)} className="md:hidden -ml-1 p-3 text-white/60 hover:text-white transition-colors flex-shrink-0">
                <ChevronLeft size={26} />
              </button>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <h2 className="text-sm font-semibold text-white flex-1">{cfg.label} Priority</h2>
              <span className="text-xs text-white/30">{filtered.length}</span>
              <button onClick={() => setPriorityFilter(null)} className="hidden md:flex p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
              {channelsWithMsgs.length === 0 && (
                <p className="text-center text-sm text-white/20 py-12">No {cfg.label.toLowerCase()} priority messages</p>
              )}
              {channelsWithMsgs.map(ch => {
                const chMsgs = filtered.filter(m => m.channelId === ch.id);
                return (
                  <div key={ch.id}>
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Hash size={10} />{ch.type === 'channel' ? ch.name : getDmName(ch)}
                    </p>
                    <div className="space-y-1">
                      {chMsgs.map(m => {
                        const author = users.find(u => u.id === m.authorId);
                        return (
                          <button
                            key={m.id}
                            onClick={() => { setActiveChannel(ch.id); setPriorityFilter(null); setMobileView('chat'); }}
                            className="w-full text-left px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-white/70">{author?.name || m.authorId}</span>
                              <span className="text-[10px] text-white/25">{formatTime(m.createdAt)}</span>
                            </div>
                            <p className="text-sm text-white/60 leading-relaxed line-clamp-2">{m.body || (m.attachments?.[0]?.type === 'audio' ? '🎙 Voice message' : m.attachments?.[0]?.name)}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Saved Items panel */}
      {showSaved && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 min-h-[56px] pt-safe md:pt-0 pb-2 md:pb-0 border-b border-white/[0.06] flex-shrink-0">
            {/* Back button on mobile */}
            <button
              onClick={() => setShowSaved(false)}
              className="md:hidden -ml-1 p-3 text-white/60 hover:text-white transition-colors flex-shrink-0"
            >
              <ChevronLeft size={26} />
            </button>
            <Bookmark size={16} className="text-amber-400 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-white flex-1">
              {savedChannelFilter
                ? (() => { const ch = channels.find(c => c.id === savedChannelFilter); return ch ? (ch.type === 'channel' ? `#${ch.name}` : getDmName(ch)) : 'Saved'; })()
                : 'Saved Items'}
            </h2>
            {savedChannelFilter && (
              <button
                onClick={() => setSavedChannelFilter(null)}
                className="text-[10px] text-white/30 hover:text-white/60 transition-colors px-2 py-0.5 rounded-full border border-white/[0.08] hover:border-white/20"
              >
                Show all
              </button>
            )}
          </div>

          {/* Channel filter pills — only shown when viewing all */}
          {!savedChannelFilter && savedIds.size > 0 && (() => {
            const channelsWithSaves = channels.filter(ch =>
              messages.some(m => m.channelId === ch.id && savedIds.has(m.id))
            );
            if (channelsWithSaves.length < 2) return null;
            return (
              <div className="flex gap-1.5 px-4 py-2 border-b border-white/[0.04] overflow-x-auto scrollbar-hide flex-shrink-0">
                {channelsWithSaves.map(ch => {
                  const count = messages.filter(m => m.channelId === ch.id && savedIds.has(m.id)).length;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setSavedChannelFilter(ch.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      {ch.type === 'channel' ? <Hash size={9} /> : null}
                      {ch.type === 'channel' ? ch.name : getDmName(ch)}
                      <span className="text-white/30 ml-0.5">{count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
            {savedIds.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                  <Bookmark size={24} className="text-white/20" />
                </div>
                <p className="text-white/60 font-medium">No saved items yet</p>
                <p className="text-white/30 text-sm mt-1">Tap a message and click the bookmark icon to save it.</p>
              </div>
            ) : (() => {
              const filtered = messages
                .filter(m => savedIds.has(m.id) && (!savedChannelFilter || m.channelId === savedChannelFilter))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              if (filtered.length === 0) return (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <p className="text-white/40 text-sm">No saved items in this channel yet.</p>
                </div>
              );
              return filtered.map(msg => {
                const ch = channels.find(c => c.id === msg.channelId);
                const author = users.find(u => u.id === msg.authorId);
                return (
                  <div key={msg.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <Avatar userId={msg.authorId} size={8} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-white/80">{author?.name}</span>
                        {ch && !savedChannelFilter && (
                          <button
                            onClick={() => { selectChannel(msg.channelId); setShowSaved(false); }}
                            className="flex items-center gap-0.5 text-[10px] text-brand-400/70 hover:text-brand-400 transition-colors"
                          >
                            {ch.type === 'channel' ? <Hash size={9} /> : null}
                            {ch.type === 'channel' ? ch.name : getDmName(ch)}
                          </button>
                        )}
                        <span className="text-[10px] text-white/25">{formatTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed break-words line-clamp-3">
                        {renderBody(msg.body, userNames)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSave(msg.id)}
                      title="Remove bookmark"
                      className="opacity-0 group-hover:opacity-100 p-1 text-amber-400 hover:text-white/40 transition-all flex-shrink-0 mt-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Main message area — full-screen on mobile in chat view, always visible on desktop */}
      {!showSaved && !priorityFilter && <div className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0`}>
        {/* Header — pt-safe pushes content below Dynamic Island; min-h instead of h so it expands */}
        <div className="flex items-center gap-3 px-3 min-h-[56px] pt-safe md:pt-0 pb-2 md:pb-0 border-b border-white/[0.06] flex-shrink-0">
          {/* Back to channel list — mobile only. Large tap target (44×44 min per Apple HIG) */}
          <button
            onClick={() => setMobileView('list')}
            className="md:hidden -ml-1 p-3 text-white/60 hover:text-white active:text-white transition-colors flex-shrink-0"
          >
            <ChevronLeft size={26} />
          </button>
          {channel?.type === 'channel' ? (
            <Hash size={16} className="text-white/40 flex-shrink-0" />
          ) : (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${AVATAR_COLORS[getDmUserId(channel!)] || 'bg-white/20'}`}>
              {channel ? getDmName(channel)[0] : '?'}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">
              {channel?.type === 'channel' ? `#${channel.name}` : channel ? getDmName(channel) : ''}
            </h2>
            {channel?.type === 'channel' && (
              editingDesc ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    ref={descInputRef}
                    value={descValue}
                    onChange={e => setDescValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveDesc(); if (e.key === 'Escape') setEditingDesc(false); }}
                    onBlur={handleSaveDesc}
                    placeholder="Add a description..."
                    className="text-xs bg-white/[0.06] border border-brand-500/40 rounded px-1.5 py-0.5 text-white/70 placeholder-white/20 focus:outline-none w-48"
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setDescValue(channel?.description || ''); setEditingDesc(true); }}
                  className="flex items-center gap-1 group/desc"
                >
                  <p className="text-xs text-white/30 leading-none group-hover/desc:text-white/50 transition-colors">
                    {channel?.description || 'Add description…'}
                  </p>
                  <Pencil size={9} className="text-white/20 opacity-0 group-hover/desc:opacity-100 transition-opacity" />
                </button>
              )
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 relative">
            {/* Per-channel saved items button */}
            {(() => {
              const channelSavedCount = messages.filter(m => m.channelId === activeChannelId && savedIds.has(m.id)).length;
              return (
                <button
                  onClick={() => { setShowSaved(true); setSavedChannelFilter(activeChannelId); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                    showSaved && savedChannelFilter === activeChannelId
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                  title="Saved in this channel"
                >
                  <Bookmark size={12} />
                  {channelSavedCount > 0 && <span>{channelSavedCount}</span>}
                </button>
              );
            })()}
            {pinnedMessages.length > 0 && (
              <button
                onClick={() => setShowPinned(v => !v)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${showPinned ? 'bg-amber-500/20 text-amber-400' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'}`}
              >
                <Pin size={12} />
                <span>{pinnedMessages.length} pinned</span>
              </button>
            )}

            {/* Member management panel */}
            {showMembers && channel && (
              <div className="absolute right-0 top-full mt-1 z-40 w-64 bg-[#1c1c1f] border border-white/[0.1] rounded-xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold text-white/60">{channel.memberIds.length} member{channel.memberIds.length !== 1 ? 's' : ''}</span>
                  <button onClick={() => { setShowMembers(false); setAddMemberEmail(''); setAddMemberStatus('idle'); }} className="text-white/30 hover:text-white/60 transition-colors"><X size={12} /></button>
                </div>
                <div className="max-h-52 overflow-y-auto scrollbar-hide">
                  {channel.memberIds.map(id => {
                    const u = users.find(u => u.id === id);
                    return (
                      <div key={id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.03] group">
                        <Avatar userId={id} size={6} status={userStatuses[id]} />
                        <div className="flex-1 min-w-0">
                          {id !== currentUser.id ? (
                            <button
                              onClick={() => { handleStartDm(id); setShowMembers(false); }}
                              className="text-sm text-white/70 hover:text-white transition-colors truncate text-left w-full"
                              title="Send direct message"
                            >
                              {u?.name || id}
                            </button>
                          ) : (
                            <p className="text-sm text-white/70 truncate">{u?.name || id} <span className="text-white/25 text-xs">(you)</span></p>
                          )}
                          {userStatuses[id] && <p className="text-[10px] text-white/30 capitalize">{userStatuses[id]}</p>}
                        </div>
                        {id !== currentUser.id && (
                          <button
                            onClick={() => updateChannel(channel.id, { memberIds: channel.memberIds.filter(m => m !== id) })}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-white/30 hover:text-red-400 transition-all"
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-white/[0.06] p-2 space-y-1.5">
                  <div className="flex gap-1">
                    <input
                      type="email"
                      value={addMemberEmail}
                      onChange={e => { setAddMemberEmail(e.target.value); setAddMemberStatus('idle'); }}
                      onKeyDown={e => e.key === 'Enter' && handleInviteMember()}
                      placeholder="Invite by email…"
                      className="flex-1 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/80 placeholder-white/25 focus:outline-none focus:border-brand-500/40"
                    />
                    <button
                      onClick={handleInviteMember}
                      disabled={!addMemberEmail.trim() || addMemberStatus === 'loading'}
                      className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-30 text-white text-xs rounded-lg transition-colors"
                    >
                      <UserPlus size={12} />
                    </button>
                  </div>
                  {addMemberStatus === 'invited' && (
                    <p className="text-[11px] text-emerald-400 px-0.5">Invitation sent — they'll see it in Notifications.</p>
                  )}
                  {addMemberStatus === 'added' && (
                    <p className="text-[11px] text-white/40 px-0.5">Already a member.</p>
                  )}
                  {addMemberStatus === 'notfound' && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/40 px-0.5">No account found. Share this link to invite them:</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(window.location.origin); }}
                        className="w-full text-left px-2 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-lg text-[11px] text-brand-400 truncate transition-colors"
                      >
                        {window.location.origin} — copy link
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pinned messages panel */}
        {showPinned && pinnedMessages.length > 0 && (
          <div className="border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0 max-h-48 overflow-y-auto scrollbar-hide">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04]">
              <Pin size={12} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">{pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? 's' : ''}</span>
            </div>
            {pinnedMessages.map(msg => {
              const author = users.find(u => u.id === msg.authorId);
              return (
                <div key={msg.id} className="flex items-start gap-3 px-4 py-2 hover:bg-white/[0.02] transition-colors group">
                  <Avatar userId={msg.authorId} size={6} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-white/60">{author?.name}</span>
                      <span className="text-[10px] text-white/25">{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-xs text-white/50 truncate">{msg.body}</p>
                  </div>
                  <button
                    onClick={() => unpinMessage(msg.id, activeChannelId)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-white/60 transition-all"
                    title="Unpin"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-4 pb-28 md:pb-4 relative">
          {/* Jump to unread button */}
          {hasNewMessages && firstUnreadId && (
            <button
              onClick={handleJumpToUnread}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-full shadow-lg transition-colors"
            >
              <ChevronDown size={13} />
              Jump to new messages
            </button>
          )}
          {/* Copy toast */}
          {copyToast && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-[#1c1c1f] border border-white/[0.1] rounded-lg text-xs text-white/70 shadow-lg">
              Link copied
            </div>
          )}
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
              {/* Read receipts for DMs */}
              {channel?.type === 'dm' && (() => {
                const otherId = channel.memberIds.find(id => id !== currentUser.id);
                const otherReadAt = channel.readBy?.[otherId ?? ''];
                if (!otherReadAt) return null;
                // Find the last message sent by current user that the other person has read
                const lastReadMsg = [...topLevelMessages].reverse().find(
                  m => m.authorId === currentUser.id && m.createdAt <= otherReadAt
                );
                if (!lastReadMsg) return null;
                const otherUser = users.find(u => u.id === otherId);
                return (
                  <div className="px-4 pb-1 text-right">
                    <span className="text-[10px] text-white/25">
                      Seen by {otherUser?.name?.split(' ')[0] || 'them'} at {format(new Date(otherReadAt), 'h:mm a')}
                    </span>
                  </div>
                );
              })()}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input area — fixed on mobile so it always hugs the bottom nav bar exactly */}
        <div className="fixed bottom-nav-bar left-0 right-0 md:relative md:bottom-auto px-4 pt-3 pb-3 bg-[#0f0f10] md:bg-transparent z-10">
          {/* Pending attachments — audio gets a preview player, others get pills */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingAttachments.map((att, i) => {
                if (att.type === 'audio') {
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <AudioPlayer url={att.url} duration={att.duration} title={att.name && !att.name.startsWith('Voice note') ? att.name : undefined} />
                      <button
                        onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))}
                        className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.06] border border-white/[0.08] rounded-full text-xs text-white/60">
                    {att.type.startsWith('image/')
                      ? <ImageIcon size={10} className="text-emerald-400 flex-shrink-0" />
                      : <Link size={10} className="flex-shrink-0" />}
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <button
                      onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))}
                      className="text-white/30 hover:text-white/60 ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-xs text-red-400">Recording… {fmtDuration(recordingDuration)}</span>
              <span className="text-[10px] text-white/30 ml-auto">Click 🎙 to stop</span>
            </div>
          )}

          {/* Audio title prompt — shown after recording stops */}
          {pendingAudio && (
            <div className="mb-2 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl">
              <p className="text-[10px] text-white/40 mb-1.5">Voice note · {fmtDuration(pendingAudio.duration)} — give it a title?</p>
              <div className="flex items-center gap-2">
                <input
                  ref={audioTitleRef}
                  value={audioTitle}
                  onChange={e => setAudioTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') uploadAudioBlob(pendingAudio.blob, pendingAudio.duration, audioTitle);
                    if (e.key === 'Escape') uploadAudioBlob(pendingAudio.blob, pendingAudio.duration);
                  }}
                  placeholder="e.g. Roof contractor update"
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 focus:outline-none"
                />
                <button
                  onClick={() => uploadAudioBlob(pendingAudio.blob, pendingAudio.duration, audioTitle)}
                  className="text-xs px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors flex-shrink-0"
                >
                  Send
                </button>
                <button
                  onClick={() => uploadAudioBlob(pendingAudio.blob, pendingAudio.duration)}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 focus-within:border-white/20 transition-colors">
            {/* File / photo picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRecording}
              title="Attach photo or file"
              className="flex-shrink-0 mb-0.5 text-white/30 hover:text-white/60 disabled:opacity-30 transition-colors"
            >
              {isUploading
                ? <Loader2 size={16} className="animate-spin text-brand-400" />
                : <Paperclip size={16} />}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                const v = e.target.value;
                setInput(v);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                broadcastTyping();
                if (v.trim()) localStorage.setItem(`msg_draft_${activeChannelId}`, v);
                else localStorage.removeItem(`msg_draft_${activeChannelId}`);
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

            {/* Mic button — tap to start/stop recording */}
            <button
              type="button"
              onClick={() => isRecording ? stopRecording() : startRecording()}
              disabled={isUploading}
              title={isRecording ? 'Click to stop and send voice note' : 'Click to record voice note'}
              className={`flex-shrink-0 mb-0.5 p-1.5 rounded-lg transition-all ${
                isRecording
                  ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30'
                  : 'text-white/30 hover:text-white/60 disabled:opacity-30'
              }`}
            >
              {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
            </button>

            {/* Priority picker */}
            <div className="relative flex-shrink-0 mb-0.5">
              <button
                type="button"
                title="Set message priority"
                onClick={() => setMsgPriority(p => p ? null : 'medium')}
                className={`p-1.5 rounded-lg transition-colors ${msgPriority ? PRIORITY_CONFIG[msgPriority].text : 'text-white/25 hover:text-white/50'}`}
              >
                <Flag size={14} />
              </button>
              {msgPriority !== null && (
                <div className="absolute bottom-full right-0 mb-1 p-1.5 bg-[#1c1c1f] border border-white/[0.08] rounded-xl shadow-xl z-20 flex flex-col gap-0.5 min-w-[110px]">
                  {(Object.entries(PRIORITY_CONFIG) as [MessagePriority, typeof PRIORITY_CONFIG[MessagePriority]][]).map(([p, cfg]) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMsgPriority(p)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.08] ${msgPriority === p ? cfg.text + ' font-semibold' : 'text-white/60'}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      {cfg.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMsgPriority(null)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-colors border-t border-white/[0.06] mt-0.5 pt-2"
                  >
                    <X size={10} /> No priority
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={(!input.trim() && pendingAttachments.length === 0) || isUploading}
              className="flex-shrink-0 mb-0.5 p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} className="text-white" />
            </button>
          </div>
          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 px-1">
              <div className="flex gap-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[10px] text-white/30">
                {typingUsers.map(id => users.find(u => u.id === id)?.name?.split(' ')[0] || id).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
              </span>
            </div>
          )}
          {typingUsers.length === 0 && (
            <p className="text-center text-[10px] text-white/15 mt-1.5">Enter to send · Shift+Enter for new line</p>
          )}
        </div>
      </div>}

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
                isPinned={pinnedIds.has(threadParentMsg.id)}
                onReact={(id, emoji) => addReaction(id, emoji)}
                onEdit={handleEditStart}
                onDelete={(id) => { deleteMessage(id); setOpenThreadId(null); }}
                onOpenThread={() => {}}
                onPin={(id) => pinnedIds.has(id) ? unpinMessage(id, activeChannelId) : pinMessage(id, activeChannelId)}
                onCopyLink={handleCopyLink}
                editing={editingId === threadParentMsg.id}
                editValue={editValue}
                onEditChange={setEditValue}
                onEditSave={handleEditSave}
                onEditCancel={() => { setEditingId(null); setEditValue(''); }}
                isSaved={savedIds.has(threadParentMsg.id)}
                onSave={toggleSave}
                userStatuses={userStatuses}
                onMove={moveMessage}
                allChannels={channels}
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

      {/* Channel Browser modal */}
      {showChannelBrowser && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowChannelBrowser(false)}>
          <div className="bg-[#1c1c1f] border border-white/[0.1] rounded-2xl shadow-2xl w-[500px] max-h-[580px] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-white/40" />
                <h2 className="text-sm font-semibold text-white">All Channels</h2>
                <span className="text-xs text-white/30">{groupedChannels.length}</span>
              </div>
              <button onClick={() => setShowChannelBrowser(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-0.5">
              {groupedChannels.map(c => {
                const isMember = c.memberIds.includes(currentUser.id);
                const msgCount = messages.filter(m => m.channelId === c.id).length;
                return (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors">
                    <Hash size={15} className="text-white/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <button
                          onClick={() => { setActiveChannel(c.id); setShowChannelBrowser(false); setShowSaved(false); }}
                          className="text-sm font-medium text-white/80 hover:text-white transition-colors"
                        >
                          {c.name}
                        </button>
                        <span className="text-[10px] text-white/25">{c.memberIds.length} members · {msgCount} messages</span>
                      </div>
                      {c.description && <p className="text-xs text-white/35 truncate mt-0.5">{c.description}</p>}
                    </div>
                    {isMember ? (
                      <button
                        onClick={() => {
                          if (c.memberIds.length > 1) updateChannel(c.id, { memberIds: c.memberIds.filter(id => id !== currentUser.id) });
                        }}
                        className="flex-shrink-0 px-2.5 py-1 text-xs text-white/40 border border-white/[0.1] rounded-lg hover:border-red-500/40 hover:text-red-400 transition-colors"
                      >
                        Joined
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          updateChannel(c.id, { memberIds: [...c.memberIds, currentUser.id] });
                          selectChannel(c.id);
                          setShowChannelBrowser(false);
                          setShowSaved(false);
                        }}
                        className="flex-shrink-0 px-2.5 py-1 text-xs text-brand-400 border border-brand-500/40 rounded-lg hover:bg-brand-500/10 transition-colors"
                      >
                        Join
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
