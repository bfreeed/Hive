import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { Calendar, Search, Check, X, Clock, Link2, AlertCircle, Plus, ChevronRight, ExternalLink, Sparkles, Send, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
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
    manual: { label: 'Manual', color: 'text-white/90 bg-white/[0.04]' },
  };
  if (!provider) return null;
  const { label, color } = map[provider] ?? { label: provider, color: 'text-white/90 bg-white/[0.04]' };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${color}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Review Panel — shown in meeting detail when reviewed === false
// ---------------------------------------------------------------------------
function ReviewPanel({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { projects, contacts, tasks, addTask, updateMeeting, users } = useStore();
  const [acceptedItems, setAcceptedItems] = useState<Set<string>>(new Set());
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());
  const [acceptedSuggested, setAcceptedSuggested] = useState<Set<string>>(new Set());
  // assignee picker: maps action item id → pending state
  const [pendingAssignee, setPendingAssignee] = useState<{ item: ActionItem } | null>(null);

  const handleAcceptProject = (pid: string) => {
    setAcceptedSuggested(prev => new Set([...prev, pid]));
    updateMeeting(meeting.id, {
      linkedProjectIds: [...(meeting.linkedProjectIds ?? []), pid],
      suggestedProjectIds: (meeting.suggestedProjectIds ?? []).filter(id => id !== pid),
    });
  };

  const handleDismissProject = (pid: string) => {
    updateMeeting(meeting.id, {
      suggestedProjectIds: (meeting.suggestedProjectIds ?? []).filter(id => id !== pid),
    });
  };

  // Step 1: show assignee picker
  const handleAcceptAction = (item: ActionItem) => {
    setPendingAssignee({ item });
  };

  // Step 2: create task with chosen assignee
  const handleConfirmAssignee = (assigneeId: string) => {
    if (!pendingAssignee) return;
    const { item } = pendingAssignee;
    setAcceptedItems(prev => new Set([...prev, item.id]));
    addTask({
      title: item.text,
      projectIds: meeting.linkedProjectIds ?? [],
      status: 'todo',
      priority: 'medium',
      assigneeIds: [assigneeId],
      flags: [],
      isPrivate: false,
      linkedContactIds: meeting.linkedContactIds ?? [],
      linkedDocIds: [],
    });
    updateMeeting(meeting.id, {
      actionItems: (meeting.actionItems ?? []).map(a =>
        a.id === item.id ? { ...a, accepted: true, taskId: 'pending' } : a
      ),
    });
    setPendingAssignee(null);
  };

  const handleDismissAction = (item: ActionItem) => {
    setDismissedItems(prev => new Set([...prev, item.id]));
    updateMeeting(meeting.id, {
      actionItems: (meeting.actionItems ?? []).map(a =>
        a.id === item.id ? { ...a, dismissed: true } : a
      ),
    });
  };

  const handleMarkReviewed = () => {
    updateMeeting(meeting.id, { reviewed: true });
    onClose();
  };

  const pendingSuggested = (meeting.suggestedProjectIds ?? []).filter(
    id => !acceptedSuggested.has(id)
  );
  const pendingActions = (meeting.actionItems ?? []).filter(
    a => !a.accepted && !a.dismissed && !acceptedItems.has(a.id) && !dismissedItems.has(a.id)
  );

  if (pendingSuggested.length === 0 && pendingActions.length === 0) {
    return (
      <div className="mt-4 p-4 bg-emerald-500/8 rounded-xl border border-emerald-500/20">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
          <Check size={14} /> All items reviewed
        </div>
        <button
          onClick={handleMarkReviewed}
          className="mt-3 w-full py-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-sm rounded-lg transition-colors"
        >
          Mark as reviewed
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-amber-500/8 rounded-xl border border-amber-500/20 space-y-4">
      <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
        <AlertCircle size={14} /> Needs your review
      </div>

      {/* Suggested projects */}
      {pendingSuggested.length > 0 && (
        <div>
          <p className="text-xs text-white/90 uppercase tracking-wider mb-2">Suggested projects</p>
          <div className="space-y-1.5">
            {pendingSuggested.map(pid => {
              const project = projects.find(p => p.id === pid);
              if (!project) return null;
              return (
                <div key={pid} className="flex items-center gap-2">
                  <span
                    className="flex-1 text-sm px-2 py-1 rounded-lg border"
                    style={{ borderColor: project.color + '40', color: project.color + 'cc', background: project.color + '10' }}
                  >
                    {project.name}
                  </span>
                  <button
                    onClick={() => handleAcceptProject(pid)}
                    className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                    title="Link to this meeting"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleDismissProject(pid)}
                    className="p-1 text-white/90 hover:text-white/90 transition-colors"
                    title="Dismiss suggestion"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignee picker */}
      {pendingAssignee && (
        <div className="p-3 bg-white/[0.06] rounded-xl border border-white/[0.10] space-y-2">
          <p className="text-xs text-white/60 mb-1">Assign to:</p>
          <p className="text-sm text-white/90 mb-2">{pendingAssignee.item.text}</p>
          <div className="flex flex-wrap gap-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => handleConfirmAssignee(u.id)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-brand-500/20 border border-white/[0.08] hover:border-brand-500/30 text-sm text-white/80 hover:text-brand-300 transition-colors"
              >
                {u.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPendingAssignee(null)}
            className="text-xs text-white/40 hover:text-white/60 transition-colors mt-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Action items */}
      {pendingActions.length > 0 && (
        <div>
          <p className="text-xs text-white/90 uppercase tracking-wider mb-2">Action items</p>
          <div className="space-y-1.5">
            {pendingActions.map(item => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="flex-1 text-sm text-white/90 py-1">{item.text}</span>
                <button
                  onClick={() => handleAcceptAction(item)}
                  className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors flex-shrink-0"
                  title="Create task"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => handleDismissAction(item)}
                  className="p-1 text-white/90 hover:text-white/90 transition-colors flex-shrink-0"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleMarkReviewed}
        className="w-full py-2 bg-white/[0.06] hover:bg-white/[0.10] text-white/90 hover:text-white/80 text-sm rounded-lg transition-colors"
      >
        Skip review — mark as reviewed
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting Detail
// ---------------------------------------------------------------------------
function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const { projects, contacts } = useStore();
  const [showReview, setShowReview] = useState(!meeting.reviewed);

  const linkedProjects = (meeting.linkedProjectIds ?? [])
    .map(id => projects.find(p => p.id === id))
    .filter(Boolean) as typeof projects;

  const linkedContacts = (meeting.linkedContactIds ?? [])
    .map(id => contacts.find(c => c.id === id))
    .filter(Boolean) as typeof contacts;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        {!meeting.reviewed && (
          <div className="flex items-center gap-2 mb-3 text-amber-400 text-xs font-semibold">
            <AlertCircle size={12} /> Needs review
          </div>
        )}
        <h1 className="text-xl font-semibold text-white mb-2">{meeting.title}</h1>
        <div className="flex items-center gap-3 text-sm text-white/80">
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {format(new Date(meeting.date), 'EEEE, MMMM d · h:mm a')}
          </span>
          {providerBadge(meeting.provider)}
        </div>
      </div>

      {/* Open in Granola */}
      {meeting.externalId && meeting.provider === 'granola' && (
        <a
          href={`https://notes.granola.ai/t/${meeting.externalId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
        >
          <ExternalLink size={13} /> Open in Granola
        </a>
      )}

      {/* Review Panel */}
      {showReview && !meeting.reviewed && (
        <ReviewPanel meeting={meeting} onClose={() => setShowReview(false)} />
      )}

      {/* Participants */}
      {(meeting.participantNames ?? []).length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider mb-2">Participants</h3>
          <div className="flex flex-wrap gap-2">
            {(meeting.participantNames ?? []).map((name, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/[0.06] text-white/90">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Linked projects */}
      {linkedProjects.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Link2 size={11} /> Projects
          </h3>
          <div className="flex flex-wrap gap-2">
            {linkedProjects.map(p => (
              <span
                key={p.id}
                className="text-xs px-2 py-1 rounded-full border"
                style={{ borderColor: p.color + '40', color: p.color + 'cc' }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Accepted action items */}
      {(meeting.actionItems ?? []).filter(a => a.accepted).length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider mb-2">Tasks created</h3>
          <div className="space-y-1">
            {(meeting.actionItems ?? []).filter(a => a.accepted).map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm text-white/90">
                <Check size={12} className="text-emerald-400 flex-shrink-0" />
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Intelligence Panel
// ---------------------------------------------------------------------------
function IntelligencePanel({ onClose }: { onClose: () => void }) {
  const { meetings, users } = useStore();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = [
    'Show all action items from this week by meeting',
    'Which action items haven\'t been added to tasks yet?',
    'What did we discuss about financials?',
    'What is Sarah responsible for from recent meetings?',
  ];

  const handleAsk = async (q: string) => {
    const question = q || query.trim();
    if (!question || loading) return;
    setLoading(true);
    setAnswer('');

    // Build a structured summary of all meetings for Claude
    const meetingSummary = meetings.map(m => ({
      id: m.id,
      title: m.title,
      date: m.date,
      participants: m.participantNames ?? [],
      actionItems: (m.actionItems ?? []).map(a => ({
        text: a.text,
        addedToTasks: a.accepted,
        dismissed: a.dismissed,
        assignee: null,
      })),
      projects: m.linkedProjectIds ?? [],
    }));

    const userList = users.map(u => u.name).join(', ');

    try {
      const res = await fetch('/api/meeting-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, meetings: meetingSummary, users: userList }),
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
    <div className="flex-1 flex flex-col overflow-hidden px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-white/90">Ask your meetings</h2>
        </div>
        <button onClick={onClose} className="text-xs text-white/40 hover:text-white/60 transition-colors">
          Back to meetings
        </button>
      </div>

      {/* Suggestions */}
      {!answer && !loading && (
        <div className="mb-6 space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Try asking</p>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setQuery(s); handleAsk(s); }}
              className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Answer */}
      {(answer || loading) && (
        <div className="flex-1 overflow-y-auto scrollbar-hide mb-6">
          {loading ? (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-white/80 font-sans leading-relaxed">{answer}</pre>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 mt-auto">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk(query)}
          placeholder="Ask anything about your meetings..."
          className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-brand-500/40"
        />
        <button
          onClick={() => handleAsk(query)}
          disabled={!query.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium disabled:opacity-30 hover:bg-brand-600 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
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
  const [filterUnreviewed, setFilterUnreviewed] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);

  const unreviewedCount = meetings.filter(m => m.reviewed === false && m.provider && m.provider !== 'manual').length;

  const filtered = useMemo(() => {
    let list = [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (filterUnreviewed) list = list.filter(m => !m.reviewed);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q) ||
        (m.participantNames ?? []).some(n => n.toLowerCase().includes(q))
      );
    }
    return list;
  }, [meetings, search, filterUnreviewed]);

  // Group by date label
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
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="px-4 pt-6 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/90">Meetings</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowIntelligence(true); setSelectedId(null); }}
                className="flex items-center gap-1 text-xs text-brand-400 bg-brand-500/10 px-2 py-1 rounded-full hover:bg-brand-500/20 transition-colors"
              >
                <Sparkles size={10} /> Ask
              </button>
            {unreviewedCount > 0 && !filterUnreviewed && (
              <button
                onClick={() => setFilterUnreviewed(true)}
                className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/12 px-2 py-1 rounded-full hover:bg-amber-500/20 transition-colors"
              >
                <AlertCircle size={10} /> {unreviewedCount} to review
              </button>
            )}
            {filterUnreviewed && (
              <button
                onClick={() => setFilterUnreviewed(false)}
                className="text-xs text-white/90 hover:text-white/80 transition-colors"
              >
                Show all
              </button>
            )}
            </div>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/90" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search meetings..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder-white/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Meeting list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
          {groups.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Calendar size={24} className="text-white/10 mx-auto mb-2" />
              <p className="text-white/90 text-sm">No meetings yet</p>
              <p className="text-white/10 text-xs mt-1">
                Connect Granola in Settings to sync
              </p>
            </div>
          )}
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-white/90 uppercase tracking-wider px-4 py-2">
                {label}
              </p>
              {items.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors relative ${
                    selectedId === m.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Unreviewed dot */}
                  {!m.reviewed && m.provider && m.provider !== 'manual' && (
                    <span className="absolute left-2 top-4 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate font-medium">{m.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/90">
                        {format(new Date(m.date), 'h:mm a')}
                      </span>
                      {(m.participantNames ?? []).length > 0 && (
                        <span className="text-xs text-white/90 truncate">
                          {(m.participantNames ?? []).slice(0, 2).join(', ')}
                          {(m.participantNames ?? []).length > 2 && ` +${(m.participantNames ?? []).length - 2}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedId === m.id && (
                    <ChevronRight size={13} className="text-white/90 flex-shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      {showIntelligence ? (
        <IntelligencePanel onClose={() => setShowIntelligence(false)} />
      ) : selected ? (
        <MeetingDetail key={selected.id} meeting={selected} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Calendar size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/90 text-sm">Select a meeting</p>
            <button
              onClick={() => setShowIntelligence(true)}
              className="mt-4 flex items-center gap-1.5 mx-auto text-xs text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded-full hover:bg-brand-500/20 transition-colors"
            >
              <Sparkles size={11} /> Ask your meetings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
