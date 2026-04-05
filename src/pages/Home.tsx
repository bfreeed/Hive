import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { AlertTriangle, Clock, MessageSquare, CheckCircle, ArrowRight, Plus, X, Sun, Calendar, Sparkles, ChevronRight, ChevronDown, Send, Loader2, UserPlus, Check, FolderOpen, Hash } from 'lucide-react';
import { isPast, addDays, isWithinInterval, startOfDay } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import TaskRow from '../components/TaskRow';
import InlineCapture, { type InlineCaptureHandle } from '../components/InlineCapture';
import { DEFAULT_HOME_SECTIONS, type HomeSection } from '../types';
import { ANTHROPIC_API_KEY_KEY } from '../lib/storageKeys';

const CARD_STYLES: Record<string, { border: string; label: string; dot: string }> = {
  overdue:        { border: 'border-red-500/30',    label: 'text-red-400',     dot: 'bg-red-500' },
  urgent:         { border: 'border-red-500/30',    label: 'text-red-400',     dot: 'bg-red-500' },
  'due today':    { border: 'border-orange-500/30', label: 'text-orange-400',  dot: 'bg-orange-400' },
  today:          { border: 'border-orange-500/30', label: 'text-orange-400',  dot: 'bg-orange-400' },
  'high priority':{ border: 'border-orange-400/25', label: 'text-orange-300',  dot: 'bg-orange-400' },
  high:           { border: 'border-orange-400/25', label: 'text-orange-300',  dot: 'bg-orange-400' },
  'medium priority':{ border: 'border-yellow-500/25', label: 'text-yellow-400', dot: 'bg-yellow-400' },
  upcoming:       { border: 'border-brand-500/25',  label: 'text-brand-400',   dot: 'bg-brand-400' },
  'coming up':    { border: 'border-brand-500/25',  label: 'text-brand-400',   dot: 'bg-brand-400' },
  messages:       { border: 'border-purple-500/25', label: 'text-purple-400',  dot: 'bg-purple-400' },
  'low priority': { border: 'border-emerald-500/25',label: 'text-emerald-400', dot: 'bg-emerald-400' },
};

function getCardStyle(title: string) {
  const key = title.toLowerCase().trim();
  return CARD_STYLES[key] ?? { border: 'border-white/[0.08]', label: 'text-white/60', dot: 'bg-white/30' };
}

function ClaudeCardResponse({ text }: { text: string }) {
  // Split into intro + sections
  const parts = text.split(/\n(?=## )/);
  const intro = parts[0].startsWith('## ') ? null : parts[0].trim();
  const sectionParts = parts[0].startsWith('## ') ? parts : parts.slice(1);

  const sections = sectionParts.map(block => {
    const lines = block.split('\n');
    const title = lines[0].replace(/^##\s*/, '').trim();
    const items = lines.slice(1)
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(l => l.length > 0);
    return { title, items };
  }).filter(s => s.items.length > 0 || s.title);

  // If no sections found, fall back to plain markdown
  if (sections.length === 0) {
    return (
      <div className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03]">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="text-sm text-white/75 leading-relaxed mb-2 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="text-white/90 font-semibold">{children}</strong>,
            ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
            li: ({ children }) => <li className="text-sm text-white/70 flex gap-2"><span className="text-brand-400 flex-shrink-0">•</span><span>{children}</span></li>,
          }}
        >{text}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {intro && (
        <p className="text-sm text-white/50 px-1 pb-1">{intro}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sections.map((section, i) => {
          const style = getCardStyle(section.title);
          return (
            <div key={i} className={`rounded-xl border ${style.border} bg-white/[0.02] px-4 py-3`}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${style.label}`}>{section.title}</span>
                <span className="text-[10px] text-white/20 ml-auto">{section.items.length}</span>
              </div>
              <ul className="space-y-1.5">
                {section.items.map((item, j) => (
                  <li key={j} className="text-sm text-white/65 leading-snug pl-1">{item}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, icon, count, color = 'text-white/50', children }: {
  title: string; icon: React.ReactNode; count: number;
  color?: string; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        <span className="text-xs opacity-50 ml-1">{count}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function Home({ onNavigate, onOpenTask }: { onNavigate: (page: string, id?: string) => void; onOpenTask: (id: string) => void }) {
  const { tasks, projects, meetings, messages, channels, userSettings, saveUserSettings, currentUser, invitations, respondToInvitation } = useStore();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const captureRef = useRef<InlineCaptureHandle>(null);

  // Claude bar
  const [claudeInput, setClaudeInput] = useState('');
  const [claudeAnswer, setClaudeAnswer] = useState('');
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState('');
  const claudeInputRef = useRef<HTMLInputElement>(null);

  // Cancel speech if user navigates away
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  // Get active sections (user prefs or defaults)
  const sections: HomeSection[] = userSettings?.homeSections ?? DEFAULT_HOME_SECTIONS;

  const triggerBriefing = useCallback(async () => {
    const now2 = new Date();
    const h = now2.getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const todayStr = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}-${String(now2.getDate()).padStart(2, '0')}`;
    const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    const dueTodayCount = tasks.filter(t => t.status !== 'done' && t.dueDate === todayStr).length;
    const urgentTasks = tasks.filter(t =>
      t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high') &&
      !(t.dueDate && t.dueDate < todayStr)
    );
    const sentences: string[] = [];
    if (overdueTasks.length > 0) sentences.push(`You have ${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}: ${overdueTasks.map(t => t.title).join(', ')}.`);
    if (dueTodayCount > 0) sentences.push(`${dueTodayCount} task${dueTodayCount !== 1 ? 's are' : ' is'} due today.`);
    if (urgentTasks.length > 0) sentences.push(`Urgent items: ${urgentTasks.map(t => t.title).join(', ')}.`);
    if (overdueTasks.length === 0 && dueTodayCount === 0 && urgentTasks.length === 0) sentences.push('All clear — nothing urgent today.');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sentences.join(' '));
      utterance.rate = 0.92;
      utterance.pitch = 1;
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }, [tasks]);

  const askClaude = useCallback(async () => {
    const question = claudeInput.trim();
    if (!question) return;
    const apiKey = userSettings?.anthropicApiKey || localStorage.getItem(ANTHROPIC_API_KEY_KEY);
    if (!apiKey) {
      setClaudeError('Add your Anthropic API key in Settings → Claude AI to use this.');
      return;
    }
    setClaudeLoading(true);
    setClaudeAnswer('');
    setClaudeError('');

    // Build context from the user's data
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeTasks = tasks.filter(t => t.status !== 'done');
    const taskSummary = activeTasks.map(t =>
      `- ${t.title} [${t.priority ?? 'no priority'}, ${t.status}${t.dueDate ? `, due ${t.dueDate}` : ''}${t.projectIds?.length ? `, project: ${projects.find(p => p.id === t.projectIds[0])?.name ?? t.projectIds[0]}` : ''}]`
    ).join('\n');
    const recentMessages = messages
      .slice(-30)
      .map(m => {
        const ch = channels.find(c => c.id === m.channelId);
        return `[${ch?.name ?? 'DM'}] ${m.body || '(audio/attachment)'}`;
      }).join('\n');

    const systemPrompt = `You are a smart assistant embedded in Hive, a personal productivity app. Today is ${todayStr}.
Answer questions about the user's tasks, projects, and messages concisely. Be direct and specific.
Never make up tasks or information that isn't in the data.

FORMATTING RULES:
- When answering questions about priorities, focus areas, or what to do today, ALWAYS organize your response into ## sections.
- Use these section titles when relevant: ## Overdue, ## Due Today, ## High Priority, ## Upcoming, ## Messages, ## Low Priority
- Under each section, list items as bullet points (- item)
- Keep each item to one line — just the task title and any critical detail
- Add a brief 1-sentence intro before the sections if helpful, but keep it short
- For open-ended questions not about priorities, you may respond in plain prose

ACTIVE TASKS (${activeTasks.length}):
${taskSummary || 'None'}

RECENT MESSAGES (last 30):
${recentMessages || 'None'}

PROJECTS: ${projects.map(p => p.name).join(', ') || 'None'}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: question }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? `API error ${res.status}`);
      }

      // Stream the response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              answer += parsed.delta.text;
              setClaudeAnswer(answer);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (e: any) {
      setClaudeError(e.message ?? 'Something went wrong.');
    } finally {
      setClaudeLoading(false);
    }
  }, [claudeInput, userSettings, tasks, projects, messages, channels]);

  const now = new Date();
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const activeTasks = tasks.filter(t => {
    if (t.status === 'done') return false;
    if (t.snoozeDate && new Date(t.snoozeDate) > now) return false;
    return true;
  });

  // Section data
  const within72 = activeTasks.filter(t => t.flags?.some(f => f.flagId === 'flag-72h'));
  const overdue = activeTasks.filter(t => t.dueDate && t.dueDate < todayStr && !within72.includes(t));
  const todayTasks = activeTasks.filter(t => t.dueDate === todayStr && !within72.includes(t) && !overdue.includes(t));
  const highPriority = activeTasks.filter(t =>
    (t.priority === 'urgent' || t.priority === 'high') &&
    !within72.includes(t) && !overdue.includes(t) && !todayTasks.includes(t)
  );
  const upcoming = activeTasks.filter(t => {
    if (!t.dueDate) return false;
    if (within72.includes(t) || overdue.includes(t) || todayTasks.includes(t)) return false;
    const d = new Date(t.dueDate);
    return isWithinInterval(d, { start: addDays(startOfDay(now), 1), end: addDays(startOfDay(now), 7) });
  });
  const questions = activeTasks.filter(t => t.flags?.some(f => f.flagId === 'flag-questions'));
  const checkInUpdates = activeTasks.filter(t => t.flags?.some(f => f.flagId === 'flag-checkin'));
  const unreviewedMeetings = meetings.filter(m => m.reviewed === false && m.provider && m.provider !== 'manual');

  const sectionData: Record<string, { tasks?: typeof activeTasks; count: number; render: () => React.ReactNode }> = {
    unreviewed_meetings: {
      count: unreviewedMeetings.length,
      render: () => unreviewedMeetings.length === 0 ? null : (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Sparkles size={13} />
            <span className="text-xs font-semibold uppercase tracking-wider">Meetings to Review</span>
            <span className="text-xs opacity-50 ml-1">{unreviewedMeetings.length}</span>
          </div>
          <div className="space-y-0.5">
            {unreviewedMeetings.slice(0, 5).map(m => (
              <button
                key={m.id}
                onClick={() => onNavigate('meetings')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-white/70 truncate">{m.title}</span>
                <ChevronRight size={12} className="text-white/20 group-hover:text-white/40 flex-shrink-0" />
              </button>
            ))}
            {unreviewedMeetings.length > 5 && (
              <button onClick={() => onNavigate('meetings')} className="text-xs text-white/30 hover:text-white/50 px-3 py-1 transition-colors">
                +{unreviewedMeetings.length - 5} more
              </button>
            )}
          </div>
        </div>
      ),
    },
    within_72h: {
      count: within72.length,
      render: () => (
        <Section title="Within 72 Hours" icon={<AlertTriangle size={13} />} count={within72.length} color="text-red-400">
          {within72.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
        </Section>
      ),
    },
    overdue: {
      count: overdue.length,
      render: () => (
        <Section title="Overdue" icon={<AlertTriangle size={13} />} count={overdue.length} color="text-red-500">
          {overdue.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
        </Section>
      ),
    },
    today: {
      count: todayTasks.length,
      render: () => (
        <Section title="Due Today" icon={<Clock size={13} />} count={todayTasks.length} color="text-orange-400">
          {todayTasks.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
        </Section>
      ),
    },
    high_priority: {
      count: highPriority.length,
      render: () => (
        <Section title="High Priority" icon={<ArrowRight size={13} />} count={highPriority.length} color="text-white/40">
          {highPriority.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
        </Section>
      ),
    },
    upcoming: {
      count: upcoming.length,
      render: () => (
        <Section title="Coming Up" icon={<Calendar size={13} />} count={upcoming.length} color="text-white/30">
          {upcoming.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
        </Section>
      ),
    },
    questions: {
      count: questions.length,
      render: () => (
        <Section title="Questions for Me" icon={<MessageSquare size={13} />} count={questions.length} color="text-purple-400">
          {questions.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
        </Section>
      ),
    },
    sarahs_updates: {
      count: checkInUpdates.length,
      render: () => (
        <Section title="Check-in Updates" icon={<CheckCircle size={13} />} count={checkInUpdates.length} color="text-emerald-400">
          {checkInUpdates.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
        </Section>
      ),
    },
  };

  const totalSignal = sections
    .filter(s => s.enabled)
    .reduce((sum, s) => sum + (sectionData[s.id]?.count ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-3xl mx-auto px-5 py-6">
        {/* Header */}
        <div className="mb-6">
          <p className="text-white/30 text-xs font-medium tracking-wide uppercase mb-3">{today}</p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-white/50 text-sm">
              {activeTasks.length} active tasks · {new Set(activeTasks.flatMap(t => t.projectIds ?? [])).size} projects
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => captureRef.current?.open()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 active:scale-95 transition-all shadow-lg shadow-brand-500/25"
              >
                <Plus size={15} /> New Task
              </button>
              <button
                onClick={triggerBriefing}
                disabled={isSpeaking}
                title="Read morning briefing aloud"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${isSpeaking ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-400/40 animate-pulse' : 'bg-amber-500/12 text-amber-400 hover:bg-amber-500/22 hover:text-amber-300'}`}
              >
                <Sun size={15} />
                {isSpeaking ? 'Speaking…' : 'Briefing'}
              </button>
            </div>
          </div>
        </div>

        {/* Claude bar */}
        <div className="mb-5">
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${claudeLoading ? 'border-brand-500/40 bg-brand-500/[0.04]' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14]'}`}>
            <Sparkles size={14} className={`flex-shrink-0 ${claudeLoading ? 'text-brand-400 animate-pulse' : 'text-white/25'}`} />
            <input
              ref={claudeInputRef}
              value={claudeInput}
              onChange={e => { setClaudeInput(e.target.value); setClaudeAnswer(''); setClaudeError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askClaude(); } }}
              placeholder="Ask Claude anything about your tasks, projects, or messages…"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
            />
            {claudeInput && !claudeLoading && (
              <button
                onClick={askClaude}
                className="p-1 rounded-lg text-brand-400 hover:text-brand-300 transition-colors flex-shrink-0"
              >
                <Send size={13} />
              </button>
            )}
            {claudeLoading && <Loader2 size={13} className="text-brand-400 animate-spin flex-shrink-0" />}
            {(claudeAnswer || claudeError) && !claudeLoading && (
              <button onClick={() => { setClaudeAnswer(''); setClaudeError(''); setClaudeInput(''); }} className="p-1 text-white/20 hover:text-white/50 flex-shrink-0">
                <X size={13} />
              </button>
            )}
          </div>
          {(claudeAnswer || claudeError) && (
            <div className="mt-2">
              {claudeError ? (
                <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] text-red-400 text-sm">{claudeError}</div>
              ) : (
                <ClaudeCardResponse text={claudeAnswer} />
              )}
            </div>
          )}
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div className="mb-6 space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.05]">
                <span className="flex-shrink-0 text-brand-400">
                  {inv.type === 'channel' ? <Hash size={14} /> : <FolderOpen size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium truncate">{inv.resourceName}</p>
                  <p className="text-xs text-white/35">{inv.invitedByName} invited you to join this {inv.type}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => respondToInvitation(inv.id, true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
                  >
                    <Check size={11} /> Accept
                  </button>
                  <button
                    onClick={() => respondToInvitation(inv.id, false)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white/80 text-xs font-medium transition-colors"
                  >
                    <X size={11} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <InlineCapture ref={captureRef} />

        {/* Sections — rendered in user-defined order */}
        {sections.filter(s => s.enabled).map(s => (
          <React.Fragment key={s.id}>
            {sectionData[s.id]?.render()}
          </React.Fragment>
        ))}

        {/* All clear */}
        {totalSignal === 0 && (
          <div className="text-center py-16">
            <p className="text-white/20 text-lg">All clear.</p>
            <p className="text-white/10 text-sm mt-1">Nothing urgent today.</p>
          </div>
        )}
      </div>
    </div>
  );
}
