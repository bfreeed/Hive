import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Calendar, Search, X, Clock, ExternalLink, Sparkles, Send, Loader2, Plus, ChevronRight, Mail, FolderOpen, Check, Pencil, UserPlus, Trash2, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import NewContactModal from '../components/NewContactModal';
import { apiFetch } from '../lib/apiFetch';
import type { Meeting, ActionItem } from '../types';
import InlineCapture from '../components/InlineCapture';

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
  return format(new Date(dateStr), 'MMMM yyyy');
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
  onOpenTask,
}: {
  item: ActionItem;
  meetingId: string;
  showMeetingTitle?: boolean;
  meetingTitle?: string;
  isMe: boolean;
  onOpenTask?: (id: string) => void;
}) {
  const { updateMeeting } = useStore();
  const [showCapture, setShowCapture] = useState(false);

  const handleDismiss = () => {
    const meeting = useStore.getState().meetings.find(m => m.id === meetingId);
    useStore.getState().updateMeeting(meetingId, {
      actionItems: (meeting?.actionItems ?? []).map(a =>
        a.id === item.id ? { ...a, dismissed: true } : a
      ),
    });
  };

  const handleCreated = () => {
    const meeting = useStore.getState().meetings.find(m => m.id === meetingId);
    updateMeeting(meetingId, {
      actionItems: (meeting?.actionItems ?? []).map(a =>
        a.id === item.id ? { ...a, accepted: true } : a
      ),
    });
    setShowCapture(false);
  };

  return (
    <div className="group">
      <div className="py-2.5 px-4 rounded-lg hover:bg-white/[0.03] transition-colors">
        {showMeetingTitle && meetingTitle && (
          <p className="text-[10px] text-white/30 mb-0.5 truncate">{meetingTitle}</p>
        )}
        <span className="text-sm text-white/80 leading-snug">{item.text}</span>
        <span className="inline-flex items-center gap-1 ml-2 opacity-30 group-hover:opacity-100 transition-opacity align-middle">
          <button
            onClick={() => setShowCapture(true)}
            className="p-0.5 text-emerald-400 hover:text-emerald-300 transition-colors"
            title="Create task"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={handleDismiss}
            className="p-0.5 text-white/25 hover:text-white/50 transition-colors"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </span>
        {item.assignee && (
          <p className={`text-xs mt-0.5 ${isMe ? 'text-brand-400' : 'text-white/35'}`}>
            {isMe ? 'You' : item.assignee}
          </p>
        )}
      </div>

      {showCapture && (
        <div className="mx-3 mb-2 max-w-3xl">
          <InlineCapture
            initialTitle={item.text}
            showCollapsedButton={false}
            onCreated={handleCreated}
            onCancel={() => setShowCapture(false)}
            onOpenDetail={onOpenTask ? id => { handleCreated(); onOpenTask(id); } : undefined}
          />
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
    <div className="border-t border-white/[0.06] p-5 flex-shrink-0 bg-white/[0.01]">
      {(answer || loading) && (
        <div className="mb-3">
          {loading ? (
            <div className="flex items-center gap-2 text-white/30 text-sm">
              <Loader2 size={13} className="animate-spin" /> Thinking...
            </div>
          ) : (
            <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl text-sm text-white/80 leading-relaxed max-h-48 overflow-y-auto scrollbar-hide">
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
          className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/40"
        />
        <button
          onClick={() => handleAsk(query)}
          disabled={!query.trim() || loading}
          className="px-3 py-2.5 rounded-2xl bg-brand-500 text-white disabled:opacity-30 hover:bg-brand-600 transition-colors"
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
function MeetingDetail({ meeting, onOpenTask }: { meeting: Meeting; onOpenTask?: (id: string) => void }) {
  const { currentUser, projects, contacts, updateMeeting, addContact } = useStore();
  const myName = currentUser?.name?.toLowerCase() ?? '';
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [participantMenu, setParticipantMenu] = useState<number | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<{ index: number; value: string } | null>(null);

  // Close all dropdowns on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (participantMenu !== null) setParticipantMenu(null);
      if (showProjectDropdown) { setShowProjectDropdown(false); setProjectSearch(''); }
      if (showContactDropdown) { setShowContactDropdown(false); setContactSearch(''); }
      if (editingParticipant) setEditingParticipant(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [participantMenu, showProjectDropdown, showContactDropdown, editingParticipant]);

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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-fade-in">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-10 py-10 max-w-3xl">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-white leading-tight mb-4">{meeting.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] text-sm text-white/50">
                <Clock size={12} />
                {format(new Date(meeting.date), 'EEEE, MMMM d · h:mm a')}
              </span>
              {providerBadge(meeting.provider)}
              {meeting.externalId && meeting.provider === 'granola' && (
                <a
                  href={`https://notes.granola.ai/t/${meeting.externalId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  <ExternalLink size={11} /> Open in Granola
                </a>
              )}
              {(meeting.participantNames ?? []).map((name, i) => {
                if (name.toLowerCase() === myName) return null;
                const isEditing = editingParticipant?.index === i;
                const isMenuOpen = participantMenu === i;
                const alreadyContact = contacts.some(c =>
                  `${c.firstName} ${c.lastName}`.trim().toLowerCase() === name.toLowerCase() ||
                  (meeting.participantEmails?.[i] && c.email && c.email.toLowerCase() === meeting.participantEmails[i].toLowerCase())
                );
                return (
                  <div key={i} className="relative">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingParticipant.value}
                        onChange={e => setEditingParticipant({ index: i, value: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editingParticipant.value.trim()) {
                            const names = [...(meeting.participantNames ?? [])];
                            names[i] = editingParticipant.value.trim();
                            updateMeeting(meeting.id, { participantNames: names });
                            setEditingParticipant(null);
                          }
                          if (e.key === 'Escape') setEditingParticipant(null);
                        }}
                        onBlur={() => {
                          if (editingParticipant.value.trim()) {
                            const names = [...(meeting.participantNames ?? [])];
                            names[i] = editingParticipant.value.trim();
                            updateMeeting(meeting.id, { participantNames: names });
                          }
                          setEditingParticipant(null);
                        }}
                        className="px-3 py-1 rounded-full bg-white/[0.08] border border-brand-500/40 text-sm text-white/70 focus:outline-none w-40"
                      />
                    ) : (
                      <button
                        onClick={() => setParticipantMenu(isMenuOpen ? null : i)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] text-sm text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
                      >
                        {name}
                        <MoreHorizontal size={11} className="text-white/25" />
                      </button>
                    )}
                    {isMenuOpen && !isEditing && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setParticipantMenu(null)} />
                        <div className="absolute left-0 top-full mt-1 bg-[#1a1a1f] border border-white/[0.08] rounded-xl shadow-xl p-1 min-w-[160px] z-50">
                          <button
                            onClick={() => {
                              setEditingParticipant({ index: i, value: name });
                              setParticipantMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
                          >
                            <Pencil size={12} /> Edit name
                          </button>
                          {!alreadyContact && (
                            <button
                              onClick={() => {
                                const parts = name.split(' ');
                                addContact({
                                  firstName: parts[0] || '',
                                  lastName: parts.slice(1).join(' '),
                                  email: meeting.participantEmails?.[i] ?? undefined,
                                  projectIds: [],
                                });
                                setParticipantMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
                            >
                              <UserPlus size={12} /> Add as contact
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const names = [...(meeting.participantNames ?? [])];
                              const emails = [...(meeting.participantEmails ?? [])];
                              names.splice(i, 1);
                              emails.splice(i, 1);
                              updateMeeting(meeting.id, { participantNames: names, participantEmails: emails });
                              setParticipantMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Project pills */}
              {(meeting.linkedProjectIds ?? []).map(pid => {
                const proj = projects.find(p => p.id === pid);
                if (!proj) return null;
                return (
                  <span
                    key={pid}
                    className="group/pill flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: (proj.color ?? '#6366f1') + '15', color: proj.color ?? '#6366f1' }}
                  >
                    <FolderOpen size={11} />
                    {proj.name}
                    <button
                      onClick={() => updateMeeting(meeting.id, {
                        linkedProjectIds: (meeting.linkedProjectIds ?? []).filter(id => id !== pid),
                      })}
                      className="opacity-0 group-hover/pill:opacity-100 transition-opacity ml-0.5 hover:text-white"
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}

              {/* Add project button */}
              <div className="relative">
                <button
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  <Plus size={11} /> Add to project
                </button>
                {showProjectDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setShowProjectDropdown(false); setProjectSearch(''); }} />
                    <div className="absolute left-0 top-full mt-1 bg-[#1a1a1f] border border-white/[0.08] rounded-xl shadow-xl min-w-[220px] z-50">
                      <div className="p-1.5">
                        <input
                          autoFocus
                          value={projectSearch}
                          onChange={e => setProjectSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') { setShowProjectDropdown(false); setProjectSearch(''); } }}
                          placeholder="Search projects..."
                          className="w-full px-2.5 py-1.5 bg-white/[0.06] border border-white/[0.08] rounded-lg text-xs text-white/70 placeholder-white/25 focus:outline-none focus:border-brand-500/40"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1">
                        {projects
                          .filter(p => !(meeting.linkedProjectIds ?? []).includes(p.id))
                          .filter(p => !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                          .map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                updateMeeting(meeting.id, {
                                  linkedProjectIds: [...(meeting.linkedProjectIds ?? []), p.id],
                                });
                                setShowProjectDropdown(false);
                                setProjectSearch('');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color ?? '#6366f1' }} />
                              {p.name}
                            </button>
                          ))}
                        {projects.filter(p => !(meeting.linkedProjectIds ?? []).includes(p.id)).filter(p => !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-xs text-white/30">{projectSearch.trim() ? 'No matches' : 'All projects linked'}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Add contact button */}
              <div className="relative">
                <button
                  onClick={() => setShowContactDropdown(!showContactDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  <UserPlus size={11} /> Add to contact
                </button>
                {showContactDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setShowContactDropdown(false); setContactSearch(''); }} />
                    <div className="absolute left-0 top-full mt-1 bg-[#1a1a1f] border border-white/[0.08] rounded-xl shadow-xl min-w-[220px] z-50">
                      <div className="p-1.5">
                        <input
                          autoFocus
                          value={contactSearch}
                          onChange={e => setContactSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') { setShowContactDropdown(false); setContactSearch(''); } }}
                          placeholder="Search contacts..."
                          className="w-full px-2.5 py-1.5 bg-white/[0.06] border border-white/[0.08] rounded-lg text-xs text-white/70 placeholder-white/25 focus:outline-none focus:border-brand-500/40"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1">
                        {contacts
                          .filter(c => !(meeting.linkedContactIds ?? []).includes(c.id))
                          .filter(c => !contactSearch.trim() || `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactSearch.toLowerCase()))
                          .map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                updateMeeting(meeting.id, {
                                  linkedContactIds: [...(meeting.linkedContactIds ?? []), c.id],
                                });
                                setShowContactDropdown(false);
                                setContactSearch('');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
                            >
                              <span className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] text-white/40 flex-shrink-0">
                                {c.firstName.charAt(0).toUpperCase()}
                              </span>
                              {`${c.firstName} ${c.lastName}`.trim()}
                            </button>
                          ))}
                        {contacts.filter(c => !(meeting.linkedContactIds ?? []).includes(c.id)).filter(c => !contactSearch.trim() || `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-xs text-white/30">{contactSearch.trim() ? 'No matches' : 'All contacts linked'}</p>
                        )}
                      </div>
                      <div className="border-t border-white/[0.06] p-1">
                        <button
                          onClick={() => { setShowContactDropdown(false); setContactSearch(''); setShowNewContactModal(true); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                        >
                          <Plus size={11} /> New contact
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Suggested Projects */}
          {(meeting.suggestedProjectIds ?? []).filter(id => projects.some(p => p.id === id)).length > 0 && (
            <div className="mb-8 bg-brand-500/[0.03] rounded-2xl border border-brand-500/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-brand-400" />
                <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Suggested Projects</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(meeting.suggestedProjectIds ?? []).map(pid => {
                  const proj = projects.find(p => p.id === pid);
                  if (!proj) return null;
                  return (
                    <span
                      key={pid}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                      style={{ backgroundColor: (proj.color ?? '#6366f1') + '10', color: proj.color ?? '#6366f1' }}
                    >
                      <FolderOpen size={11} />
                      {proj.name}
                      <button
                        onClick={() => updateMeeting(meeting.id, {
                          linkedProjectIds: [...(meeting.linkedProjectIds ?? []), pid],
                          suggestedProjectIds: (meeting.suggestedProjectIds ?? []).filter(id => id !== pid),
                        })}
                        className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        title="Accept"
                      >
                        <Check size={10} />
                      </button>
                      <button
                        onClick={() => updateMeeting(meeting.id, {
                          suggestedProjectIds: (meeting.suggestedProjectIds ?? []).filter(id => id !== pid),
                        })}
                        className="p-0.5 rounded-full bg-white/[0.06] text-white/30 hover:text-white/50 transition-colors"
                        title="Dismiss"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Items */}
          {pendingItems.length > 0 && (
            <div className="mb-10 bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider border-l-2 border-brand-500/40 pl-3">Action Items</h3>
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
              <div className="space-y-1">
                {pendingItems.map(item => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    meetingId={meeting.id}
                    isMe={!item.assignee || item.assignee.toLowerCase() === myName}
                    onOpenTask={onOpenTask}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Accepted items */}
          {acceptedItems.length > 0 && (
            <div className="mb-10 bg-white/[0.02] rounded-2xl border border-white/[0.06] p-6">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider border-l-2 border-emerald-500/40 pl-3 mb-4">Tasks Created</h3>
              <div className="space-y-1.5">
                {acceptedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-emerald-500/[0.03] text-sm text-white/45">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1">{item.text}</span>
                    {item.assignee && <span className="text-xs text-white/25">{item.assignee}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary / Notes */}
          {meeting.notes && (
            <div className="mb-10">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider border-l-2 border-brand-500/40 pl-3 mb-6">Summary</h3>
              <div className="prose prose-invert max-w-none text-white/65
                prose-headings:text-white/80 prose-headings:font-semibold
                prose-h2:text-base prose-h2:border-l-2 prose-h2:border-brand-500/50 prose-h2:pl-3 prose-h2:mt-8 prose-h2:mb-3
                prose-h3:text-sm prose-h3:border-l-2 prose-h3:border-white/10 prose-h3:pl-3 prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-white/65 prose-p:leading-[1.8] prose-p:mb-4
                prose-li:text-white/65 prose-li:leading-[1.8]
                prose-strong:text-white/80 prose-strong:font-semibold
                prose-ul:my-3 prose-ol:my-3 prose-li:my-1
                [&_ul]:list-disc [&_ul]:marker:text-brand-400/70
                [&_ul_ul]:list-[circle] [&_ul_ul]:marker:text-white/30
                [&_ul]:pl-5 [&_ol]:pl-5">
                <ReactMarkdown>{meeting.notes}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky chat bar */}
      <MeetingChat meeting={meeting} />

      {showNewContactModal && (
        <NewContactModal
          onClose={() => setShowNewContactModal(false)}
          onCreated={id => {
            updateMeeting(meeting.id, { linkedContactIds: [...(meeting.linkedContactIds ?? []), id] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default view — all pending action items across all meetings
// ---------------------------------------------------------------------------
function AllActionItemsView({ onOpenTask }: { onOpenTask?: (id: string) => void }) {
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
        <div className="max-w-2xl">
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
                  onOpenTask={onOpenTask}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat bar */}
      <MeetingChat />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function MeetingsPage({ onOpenTask }: { onOpenTask?: (id: string) => void } = {}) {
  const { meetings, projects, contacts } = useStore();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem('hive_meetings_selectedId')
  );

  const selectMeeting = (id: string | null) => {
    setSelectedId(id);
    if (id) localStorage.setItem('hive_meetings_selectedId', id);
    else localStorage.removeItem('hive_meetings_selectedId');
  };
  const [sidebarTab, setSidebarTab] = useState<'byDate' | 'byProject'>(() =>
    (localStorage.getItem('hive_meetings_tab') as 'byDate' | 'byProject') || 'byDate'
  );
  const [tabOrder, setTabOrder] = useState<['byDate' | 'byProject', 'byDate' | 'byProject']>(() => {
    const saved = localStorage.getItem('hive_meetings_tabOrder');
    if (saved) try { return JSON.parse(saved); } catch {}
    return ['byDate', 'byProject'];
  });
  const [draggingTab, setDraggingTab] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (label: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const handleTabChange = (tab: 'byDate' | 'byProject') => {
    setSidebarTab(tab);
    localStorage.setItem('hive_meetings_tab', tab);
  };

  const handleTabDragStart = (tab: string) => setDraggingTab(tab);
  const handleTabDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleTabDrop = (targetTab: string) => {
    if (draggingTab && draggingTab !== targetTab) {
      const newOrder: ['byDate' | 'byProject', 'byDate' | 'byProject'] =
        draggingTab === 'byDate' ? ['byDate', 'byProject'] : ['byProject', 'byDate'];
      setTabOrder(newOrder);
      localStorage.setItem('hive_meetings_tabOrder', JSON.stringify(newOrder));
    }
    setDraggingTab(null);
  };

  const tabLabels: Record<string, string> = { byDate: 'By Date', byProject: 'By Project' };

  const toggleExpanded = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

  const projectGroups = useMemo(() => {
    const buckets = new Map<string, Meeting[]>();
    const noProject: Meeting[] = [];
    for (const m of filtered) {
      const pids = (m.linkedProjectIds ?? []).filter(id => projects.some(p => p.id === id));
      if (pids.length === 0) {
        noProject.push(m);
      } else {
        for (const pid of pids) {
          if (!buckets.has(pid)) buckets.set(pid, []);
          buckets.get(pid)!.push(m);
        }
      }
    }
    const result: Array<{ projectId: string | null; projectName: string; projectColor?: string; meetings: Meeting[] }> = [];
    for (const p of projects) {
      const ms = buckets.get(p.id);
      if (ms && ms.length > 0) {
        result.push({ projectId: p.id, projectName: p.name, projectColor: p.color, meetings: ms });
      }
    }
    result.sort((a, b) => a.projectName.localeCompare(b.projectName));
    if (noProject.length > 0) {
      result.push({ projectId: null, projectName: 'No Project', meetings: noProject });
    }
    return result;
  }, [filtered, projects]);

  const selected = meetings.find(m => m.id === selectedId) ?? null;

  // Helper to render a meeting row in the sidebar
  const renderMeetingRow = (m: Meeting, indent = false, idx = 0) => {
    const pendingCount = (m.actionItems ?? []).filter(a => !a.accepted && !a.dismissed).length;
    const isSelected = selectedId === m.id;
    const isOdd = idx % 2 === 1;
    return (
      <button
        key={m.id}
        onClick={() => selectMeeting(m.id)}
        className={`w-full flex items-start gap-2 ${indent ? 'pl-9 pr-4' : 'px-4'} py-1.5 text-left transition-colors border-l-2 ${
          isSelected
            ? 'bg-white/[0.08] border-brand-500'
            : `${isOdd ? 'bg-white/[0.02]' : ''} border-transparent hover:border-brand-500/40`
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white/70 truncate leading-snug">{m.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] text-white/25">{format(new Date(m.date), 'MMM d')}</span>
            {(() => {
              const linkedContacts = (m.linkedContactIds ?? []).map(id => { const c = contacts.find(c => c.id === id); return c ? `${c.firstName} ${c.lastName}`.trim() : undefined; }).filter(Boolean);
              if (linkedContacts.length === 0) return null;
              return <span className="text-[10px] text-white/35 truncate">{linkedContacts.join(', ')}</span>;
            })()}
            {(() => {
              const linkedProjects = (m.linkedProjectIds ?? []).map(id => projects.find(p => p.id === id)?.name).filter(Boolean);
              if (linkedProjects.length === 0) return null;
              const label = linkedProjects.length === 1 ? linkedProjects[0] : `${linkedProjects[0]} +${linkedProjects.length - 1}`;
              return <span className="text-[10px] text-brand-400/60 truncate">{label}</span>;
            })()}
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold flex-shrink-0 mt-0.5">
            {pendingCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="px-4 pt-6 pb-3 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white/80 mb-3">Meetings</h2>

          {/* Sidebar tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-white/[0.05] rounded-lg mb-3">
            {tabOrder.map(tab => (
              <button
                key={tab}
                draggable
                onDragStart={() => handleTabDragStart(tab)}
                onDragOver={handleTabDragOver}
                onDrop={() => handleTabDrop(tab)}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-grab active:cursor-grabbing ${
                  sidebarTab === tab ? 'bg-white/[0.08] text-white/80' : 'text-white/35 hover:text-white/60'
                } ${draggingTab === tab ? 'opacity-50' : ''}`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

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
          onClick={() => selectMeeting(null)}
          className={`mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedId === null ? 'bg-white/[0.08] text-white/80' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'
          }`}
        >
          <Sparkles size={13} className="text-brand-400" />
          Action Items
        </button>

        {/* Meeting list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
          {sidebarTab === 'byDate' ? (
            <>
              {groups.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-white/20 text-xs">No meetings yet</p>
                </div>
              )}
              {groups.map(([label, items]) => {
                const isExpanded = !collapsedMonths.has(label);
                return (
                  <div key={label}>
                    <button
                      onClick={() => toggleMonth(label)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/[0.04] transition-colors"
                    >
                      <ChevronRight
                        size={12}
                        className={`text-white/25 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                      <Calendar size={14} className="text-white/25 flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider flex-1 text-left">{label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/30 flex-shrink-0">
                        {items.length}
                      </span>
                    </button>
                    {isExpanded && items.map((m, i) => renderMeetingRow(m, true, i))}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {projectGroups.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-white/20 text-xs">No meetings yet</p>
                </div>
              )}
              {projectGroups.map(({ projectId, projectName, projectColor, meetings: pMeetings }) => {
                const key = projectId ?? '__none';
                const isExpanded = expandedProjects.has(key);
                return (
                  <div key={key}>
                    <button
                      onClick={() => toggleExpanded(key)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/[0.04] transition-colors"
                    >
                      <ChevronRight
                        size={12}
                        className={`text-white/25 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                      <FolderOpen
                        size={14}
                        className="flex-shrink-0"
                        style={{ color: projectColor ?? 'rgba(255,255,255,0.2)' }}
                      />
                      <span className="text-sm text-white/70 truncate flex-1 text-left">{projectName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/30 flex-shrink-0">
                        {pMeetings.length}
                      </span>
                    </button>
                    {isExpanded && pMeetings.map((m, i) => renderMeetingRow(m, true, i))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Main panel */}
      {selected ? (
        <MeetingDetail key={selected.id} meeting={selected} onOpenTask={onOpenTask} />
      ) : (
        <AllActionItemsView onOpenTask={onOpenTask} />
      )}
    </div>
  );
}
