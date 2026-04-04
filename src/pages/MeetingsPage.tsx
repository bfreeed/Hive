import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { Calendar, Search, X, Clock, ExternalLink, Sparkles, Send, Loader2, Plus, ChevronRight, Mail } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '../lib/apiFetch';
import type { Meeting, ActionItem } from '../types';

// ---------------------------------------------------------------------------
// Unreviewed badge count (exported so sidebar can show it)
// ---------------------------------------------------------------------------
export function useUnreviewedMeetingCount() {
  const meetings = useStore(s => s.meetings);
  return meetings.filter(m => m.reviewed === false && m.provider && m.provider !== 'manual').length;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function groupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return format(d, 'EEEE');
  return format(d, 'MMMM yyyy');
}

function providerBadge(provider?: string) {
  const map: Record<string, { label: string; color: string }> = {
    granola: { label: 'Granola', color: 'text-emerald-400 bg-emerald-500/10' },
    fireflies: { label: 'Fireflies', color: 'text-orange-400 bg-orange-500/10' },
    otter: { label: 'Otter', color: 'text-blue-400 bg-blue-500/10' },
    native: { label: 'Hive', color: 'text-brand-400 bg-brand-500/10' },
    manual: { label: 'Manual', color: 'text-white/40 bg-white/[0.04]' },
  };
  if (!provider) return null;
  const { label, color } = map[provider] ?? { label: provider, color: 'text-white/40 bg-white/[0.04]' };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${color}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action Item Row
// ---------------------------------------------------------------------------
function ActionItemRow({
  item,
  meetingId,
  showMeetingTitle,
  meetingTitle,
  isMe,
}: {
  item: ActionItem;
  meetingId: string;
  showMeetingTitle?: boolean;
  meetingTitle?: string;
  isMe: boolean;
}) {
  const { updateMeeting, addTask, users, currentUser } = useStore();
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  const handleAccept = () => {
    if (users.length > 1) {
      setShowAssigneePicker(true);
    } else {
      createTask(currentUser?.id ?? '');
    }
  };

  const createTask = (assigneeId: string) => {
    addTask({
      title: item.text,
      projectIds: [],
      status: 'todo',
      priority: 'medium',
      assigneeIds: [assigneeId],
      flags: [],
      isPrivate: false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    const meeting = useStore.getState().meetings.find(m => m.id === meetingId);
    updateMeeting(meetingId, {
      actionItems: (meeting?.actionItems ?? []).map(a =>
        a.id === item.id ? { ...a, accepted: true } : a
      ),
    });
    setShowAssigneePicker(false);
  };

  const handleDismiss = () => {
    const meeting = useStore.getState().meetings.find(m => m.id === meetingId);
    useStore.getState().updateMeeting(meetingId, {
      actionItems: (meeting?.actionItems ?? []).map(a =>
        a.id === item.id ? { ...a, dismissed: true } : a
      ),
    });
  };

  return (
    <div className="group">
      <div className="flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
        <div className="flex-1 min-w-0">
          {showMeetingTitle && meetingTitle && (
            <p className="text-[10px] text-white/30 mb-0.5 truncate">{meetingTitle}</p>
          )}
          <p className="text-sm text-white/80 leading-snug">{item.text}</p>
          {item.assignee && (
            <p className={`text-xs mt-0.5 ${isMe ? 'text-brand-400' : 'text-white/35'}`}>
              {isMe ? 'You' : item.assignee}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
          <button
            onClick={handleAccept}
            className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
            title="Create task"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-white/25 hover:text-white/50 transition-colors"
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Assignee picker */}
      {showAssigneePicker && (
        <div className="mx-3 mb-2 p-3 bg-white/[0.06] rounded-xl border border-white/[0.10] space-y-2">
          <p className="text-xs text-white/40 mb-2">Assign to:</p>
          <div className="flex flex-wrap gap-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => createTask(u.id)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-brand-500/20 border border-white/[0.08] hover:border-brand-500/30 text-sm text-white/70 hover:text-brand-300 transition-colors"
              >
                {u.name}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAssigneePicker(false)} className="text-xs text-white/30 hover:text-white/50 transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Bar (per-meeting or all-meetings)
// ---------------------------------------------------------------------------
function MeetingChat({ meeting }: { meeting?: Meeting }) {
  const { meetings, users } = useStore();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAsk = async (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    setAnswer('');
    setQuery('');

    const meetingList = meeting ? [meeting] : meetings;
    const meetingSummary = meetingList.map(m => ({
      id: m.id,
      title: m.title,
      date: m.date,
      participants: m.participantNames ?? [],
      notes: m.notes,
      summary: m.summary,
      actionItems: (m.actionItems ?? []).map(a => ({
        text: a.text,
        assignee: a.assignee ?? null,
        addedToTasks: a.accepted,
        dismissed: a.dismissed,
      })),
      projects: m.linkedProjectIds ?? [],
    }));

    try {
      const res = await apiFetch('/api/meeting-intelligence', {
        question,
        meetings: meetingSummary,
        users: users.map(u => u.name).join(', '),
      });
      const data = await res.json() as { answer?: string; error?: string };
      setAnswer(data.answer ?? data.error ?? 'No response.');
    } catch {
      setAnswer('Failed to reach the AI. Make sure the dev server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-white/[0.06] p-4 flex-shrink-0">
      {(answer || loading) && (
        <div className="mb-3">
          {loading ? (
            <div className="flex items-center gap-2 text-white/30 text-sm">
              <Loader2 size={13} className="animate-spin" /> Thinking...
            </div>
          ) : (
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-sm text-white/80 leading-relaxed max-h-48 overflow-y-auto scrollbar-hide">
              {answer}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk(query)}
          placeholder={meeting ? 'Ask about this meeting…' : 'Ask your meetings…'}
          className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/40"
        />
        <button
          onClick={() => handleAsk(query)}
          disabled={!query.trim() || loading}
          className="px-3 py-2 rounded-xl bg-brand-500 text-white disabled:opacity-30 hover:bg-brand-600 transition-colors"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email action items to a participant
// ---------------------------------------------------------------------------
function buildMailto(participantName: string, participantEmail: string, meetingTitle: string, items: ActionItem[]): string {
  const subject = encodeURIComponent(`Action items from "${meetingTitle}"`);
  const lines = items.map((item, i) => `${i + 1}. ${item.text}`).join('\n');
  const body = encodeURIComponent(`Hi ${participantName},\n\nHere are your action items from our meeting "${meetingTitle}":\n\n${lines}\n\nLet me know if you have any questions.`);
  return `mailto:${participantEmail}?subject=${subject}&body=${body}`;
}

// ---------------------------------------------------------------------------
// Meeting Detail
// ---------------------------------------------------------------------------
function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const { currentUser } = useStore();
  const myName = currentUser?.name?.toLowerCase() ?? '';

  const pendingItems = (meeting.actionItems ?? []).filter(a => !a.accepted && !a.dismissed);
  const acceptedItems = (meeting.actionItems ?? []).filter(a => a.accepted);

  // Group participants that have action items and have an email
  const participantsWithItems = (meeting.participantNames ?? []).map((name, i) => {
    const email = meeting.participantEmails?.[i];
    const items = pendingItems.filter(a =>
      a.assignee && a.assignee.toLowerCase() === name.toLowerCase()
    );
    return { name, email, items };
  }).filter(p => p.items.length > 0 && p.email && p.name.toLowerCase() !== myName);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white mb-2">{meeting.title}</h1>
            <div className="flex items-center gap-3 text-sm text-white/40 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                {format(new Date(meeting.date), 'EEEE, MMMM d · h:mm a')}
              </span>
              {providerBadge(meeting.provider)}
              {meeting.externalId && meeting.provider === 'granola' && (
                <a
                  href={`https://notes.granola.ai/t/${meeting.externalId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  <ExternalLink size={11} /> Open in Granola
                </a>
              )}
            </div>
            {(meeting.participantNames ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(meeting.participantNames ?? []).map((name, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Items */}
          {pendingItems.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider">Action Items</h3>
                {/* Email buttons for participants with items */}
                {participantsWithItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    {participantsWithItems.map(p => (
                      <a
                        key={p.name}
                        href={buildMailto(p.name, p.email!, meeting.title, p.items)}
                        className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                        title={`Email ${p.name} their ${p.items.length} action item${p.items.length > 1 ? 's' : ''}`}
                      >
                        <Mail size={11} /> {p.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                {pendingItems.map(item => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    meetingId={meeting.id}
                    isMe={!item.assignee || item.assignee.toLowerCase() === myName}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Accepted items */}
          {acceptedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Tasks Created</h3>
              <div className="space-y-1">
                {acceptedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/35">
                    <div className="w-3.5 h-3.5 rounded-full border border-emerald-500/50 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    {item.text}
                    {item.assignee && <span className="text-xs text-white/25 ml-auto">{item.assignee}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary / Notes */}
          {meeting.notes && (
            <div>
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Summary</h3>
              <div className="prose prose-invert prose-sm max-w-none text-white/65 leading-relaxed
                prose-headings:text-white/70 prose-headings:font-semibold prose-headings:text-sm
                prose-p:text-white/65 prose-p:leading-relaxed
                prose-li:text-white/65
                prose-strong:text-white/80 prose-strong:font-semibold
                prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
                <ReactMarkdown>{meeting.notes}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky chat bar */}
      <MeetingChat meeting={meeting} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default view — all pending action items across all meetings
// ---------------------------------------------------------------------------
function AllActionItemsView() {
  const { meetings, currentUser } = useStore();
  const myName = currentUser?.name?.toLowerCase() ?? '';
  const [showAll, setShowAll] = useState(false);

  const allPending = useMemo(() => {
    const items: Array<{ item: ActionItem; meeting: Meeting; isMe: boolean }> = [];
    for (const m of meetings) {
      for (const a of (m.actionItems ?? [])) {
        if (a.accepted || a.dismissed) continue;
        const isMe = !a.assignee || a.assignee.toLowerCase() === myName;
        items.push({ item: a, meeting: m, isMe });
      }
    }
    return items;
  }, [meetings, myName]);

  const filtered = showAll ? allPending : allPending.filter(x => x.isMe);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-hide px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white/80">Action Items</h2>
          <div className="flex items-center gap-1 p-0.5 bg-white/[0.05] rounded-lg">
            <button
              onClick={() => setShowAll(false)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${!showAll ? 'bg-white/[0.08] text-white/80' : 'text-white/35 hover:text-white/60'}`}
            >
              Mine
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${showAll ? 'bg-white/[0.08] text-white/80' : 'text-white/35 hover:text-white/60'}`}
            >
              All
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={28} className="text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">
              {showAll ? 'No pending action items' : 'No action items for you'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map(({ item, meeting, isMe }) => (
              <ActionItemRow
                key={`${meeting.id}-${item.id}`}
                item={item}
                meetingId={meeting.id}
                showMeetingTitle
                meetingTitle={meeting.title}
                isMe={isMe}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chat bar */}
      <MeetingChat />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MeetingsPage() {
  const { meetings } = useStore();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q) ||
        (m.participantNames ?? []).some(n => n.toLowerCase().includes(q))
      );
    }
    return list;
  }, [meetings, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of filtered) {
      const label = groupLabel(m.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const selected = meetings.find(m => m.id === selectedId) ?? null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="px-4 pt-6 pb-3 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white/80 mb-4">Meetings</h2>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search meetings…"
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/70 placeholder-white/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Action items shortcut */}
        <button
          onClick={() => setSelectedId(null)}
          className={`mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedId === null ? 'bg-white/[0.08] text-white/80' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'
          }`}
        >
          <Sparkles size={13} className="text-brand-400" />
          Action Items
        </button>

        {/* Meeting list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
          {groups.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-white/20 text-xs">No meetings yet</p>
            </div>
          )}
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider px-4 py-2">
                {label}
              </p>
              {items.map(m => {
                const pendingCount = (m.actionItems ?? []).filter(a => !a.accepted && !a.dismissed).length;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full flex items-start gap-2 px-4 py-2.5 text-left transition-colors ${
                      selectedId === m.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/70 truncate">{m.title}</p>
                      <p className="text-xs text-white/25 mt-0.5">{format(new Date(m.date), 'h:mm a')}</p>
                    </div>
                    {pendingCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold flex-shrink-0 mt-0.5">
                        {pendingCount}
                      </span>
                    )}
                    {selectedId === m.id && (
                      <ChevronRight size={12} className="text-white/30 flex-shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      {selected ? (
        <MeetingDetail key={selected.id} meeting={selected} />
      ) : (
        <AllActionItemsView />
      )}
    </div>
  );
}
