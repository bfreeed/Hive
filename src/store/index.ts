import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, Project, Contact, User, Notification, Channel, Message } from '../types';

const LEV: User = { id: 'lev', name: 'Lev Freedman', email: 'lev@example.com', role: 'owner' };
const SARAH: User = { id: 'sarah', name: 'Sarah', email: 'sarah@example.com', role: 'assistant' };

const now = new Date().toISOString();
const in2d = new Date(Date.now() + 2*864e5).toISOString();
const in7d = new Date(Date.now() + 7*864e5).toISOString();
const yest = new Date(Date.now() - 864e5).toISOString();

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

const PROJECTS: Project[] = [
  { id: 'personal', name: 'Personal Life', description: 'Personal tasks and life admin', color: '#6366f1', status: 'active', memberIds: ['lev','sarah'], isPrivate: false, createdAt: now },
  { id: 'rff', name: 'Resilient Future Foundation', description: 'RFF nonprofit work', color: '#10b981', status: 'active', memberIds: ['lev'], isPrivate: false, createdAt: now },
  { id: 'jedi', name: 'Jedi Village', description: 'Property in Sebastopol', color: '#f59e0b', status: 'active', memberIds: ['lev'], isPrivate: false, createdAt: now },
];

const TASKS: Task[] = [
  { id: 't1', title: 'Fix roof leak', projectIds: ['jedi'], status: 'todo', priority: 'urgent', assigneeIds: ['lev', 'sarah'], within72Hours: true, questionsForLev: false, updateAtCheckin: false, isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now, dueDate: in2d },
  { id: 't2', title: 'Name change with Travis County', projectIds: ['jedi'], status: 'waiting', priority: 'high', assigneeIds: ['lev'], within72Hours: false, questionsForLev: false, updateAtCheckin: false, isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now },
  { id: 't3', title: 'Schedule dentist appointment', projectIds: ['personal'], status: 'todo', priority: 'medium', assigneeIds: ['sarah'], within72Hours: false, questionsForLev: false, updateAtCheckin: true, isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now, dueDate: in7d },
  { id: 't4', title: 'Review RFF grant proposal', projectIds: ['rff'], status: 'review', priority: 'high', assigneeIds: ['lev'], within72Hours: false, questionsForLev: true, updateAtCheckin: false, isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now },
  { id: 't5', title: 'Contact storage facility', projectIds: ['jedi'], status: 'todo', priority: 'medium', assigneeIds: ['sarah'], within72Hours: false, questionsForLev: false, updateAtCheckin: false, isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now },
  { id: 't6', title: 'Annual physical checkup', projectIds: ['personal'], status: 'todo', priority: 'medium', assigneeIds: ['lev'], within72Hours: false, questionsForLev: false, updateAtCheckin: false, isPrivate: true, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now, dueDate: yest },
];

const CONTACTS: Contact[] = [
  { id: 'c1', name: 'Sarah', email: 'sarah@example.com', projectIds: ['personal','rff','jedi'], notes: 'Personal assistant', meetings: [], linkedTaskIds: ['t3','t5'] },
  { id: 'c2', name: 'Freddie Kimmel', projectIds: ['personal'], notes: '', meetings: [], linkedTaskIds: [] },
  { id: 'c3', name: 'Daniel Kaminski', projectIds: ['personal'], notes: '', meetings: [], linkedTaskIds: [] },
];

const CHANNELS: Channel[] = [
  { id: 'general', name: 'general', type: 'channel', memberIds: ['lev', 'sarah'], description: 'General updates and announcements' },
  { id: 'jedi-village', name: 'jedi-village', type: 'channel', memberIds: ['lev', 'sarah'], description: 'Jedi Village property updates' },
  { id: 'rff', name: 'rff-foundation', type: 'channel', memberIds: ['lev', 'sarah'], description: 'Resilient Future Foundation work' },
  { id: 'dm-sarah', name: 'Sarah', type: 'dm', memberIds: ['lev', 'sarah'] },
];

const MESSAGES: Message[] = [
  // #general
  { id: 'm1', channelId: 'general', authorId: 'sarah', body: 'Good morning! I have the weekly task summary ready whenever you want to review it.', createdAt: hoursAgo(2), reactions: {} },
  { id: 'm2', channelId: 'general', authorId: 'lev', body: 'Great, send it over. Also can you check on the dentist appointment status?', createdAt: hoursAgo(1.8), reactions: { '👍': ['sarah'] } },
  { id: 'm3', channelId: 'general', authorId: 'sarah', body: 'On it. I called and they have availability next Tuesday or Thursday morning.', createdAt: hoursAgo(1.5), reactions: {} },
  { id: 'm4', channelId: 'general', authorId: 'lev', body: 'Thursday works. Book it.', createdAt: hoursAgo(1.2), reactions: { '✅': ['sarah'] } },
  { id: 'm5', channelId: 'general', authorId: 'sarah', body: 'Done! Added to your calendar for Thursday 9am. Confirmation sent to your email.', createdAt: hoursAgo(1), reactions: {} },

  // #jedi-village
  { id: 'm6', channelId: 'jedi-village', authorId: 'sarah', body: 'Heard back from the roofing contractor. They can come out Wednesday between 10am–2pm.', createdAt: daysAgo(1), reactions: {} },
  { id: 'm7', channelId: 'jedi-village', authorId: 'lev', body: 'Perfect. Make sure someone is there to let them in.', createdAt: daysAgo(1), reactions: {} },
  { id: 'm8', channelId: 'jedi-village', authorId: 'sarah', body: 'I can be there. Should I get a quote before approving any work?', createdAt: daysAgo(1), reactions: {} },
  { id: 'm9', channelId: 'jedi-village', authorId: 'lev', body: 'Yes — get the quote first, anything under $2k just approve. Over that, send it to me.', createdAt: daysAgo(1), reactions: { '👍': ['sarah'] } },
  { id: 'm10', channelId: 'jedi-village', authorId: 'sarah', body: 'Also the Travis County name change paperwork came back. Looks like we need a notarized signature. Want me to find a mobile notary?', createdAt: hoursAgo(4), reactions: {} },
  { id: 'm11', channelId: 'jedi-village', authorId: 'lev', body: 'Yes please. Try to find one that can come to me.', createdAt: hoursAgo(3), reactions: {} },

  // #rff-foundation
  { id: 'm12', channelId: 'rff', authorId: 'sarah', body: 'The grant proposal draft is in your review queue. It is due Friday so wanted to flag it early.', createdAt: daysAgo(2), reactions: {} },
  { id: 'm13', channelId: 'rff', authorId: 'lev', body: 'I saw it. Will review tonight. Any notes from the board?', createdAt: daysAgo(2), reactions: {} },
  { id: 'm14', channelId: 'rff', authorId: 'sarah', body: 'Nothing formal yet. Marcus mentioned they want a stronger impact statement in section 3.', createdAt: daysAgo(2), reactions: {} },
  { id: 'm15', channelId: 'rff', authorId: 'lev', body: 'Good to know. I will tighten that section.', createdAt: daysAgo(1), reactions: {} },

  // DM - sarah
  { id: 'm16', channelId: 'dm-sarah', authorId: 'sarah', body: 'Hey, quick heads up — the storage facility said they need 30 days notice to cancel. Did you want to keep the unit through April?', createdAt: daysAgo(1), reactions: {} },
  { id: 'm17', channelId: 'dm-sarah', authorId: 'lev', body: 'No let\'s cancel it. Start the 30 day notice now.', createdAt: daysAgo(1), reactions: {} },
  { id: 'm18', channelId: 'dm-sarah', authorId: 'sarah', body: 'Done. They confirmed cancellation effective April 20th. I will add a task to arrange pickup of anything still there.', createdAt: daysAgo(1), reactions: { '❤️': ['lev'] } },
  { id: 'm19', channelId: 'dm-sarah', authorId: 'sarah', body: 'Also — are we still doing the weekly check-in call on Friday?', createdAt: minsAgo(30), reactions: {} },
  { id: 'm20', channelId: 'dm-sarah', authorId: 'lev', body: 'Yes, same time. 10am.', createdAt: minsAgo(15), reactions: {} },
];

const uid = () => Math.random().toString(36).slice(2,9);

interface AppStore {
  currentUser: User; users: User[];
  projects: Project[]; tasks: Task[]; contacts: Contact[]; notifications: Notification[];
  channels: Channel[]; messages: Message[];
  activeChannelId: string;
  activeProjectId: string | null; sidebarOpen: boolean; darkMode: boolean; voiceOpen: boolean;
  setActiveProject: (id: string | null) => void;
  setActiveChannel: (id: string) => void;
  toggleSidebar: () => void; toggleDarkMode: () => void; toggleVoice: () => void;
  addTask: (t: Omit<Task,'id'|'createdAt'|'updatedAt'|'comments'|'audioNotes'|'attachments'>) => void;
  addComment: (taskId: string, body: string) => void;
  updateTask: (id: string, u: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addProject: (p: Omit<Project,'id'|'createdAt'>) => void;
  updateProject: (id: string, u: Partial<Project>) => void;
  addUser: (email: string, name?: string) => User;
  addContact: (c: Omit<Contact,'id'|'meetings'|'linkedTaskIds'>) => void;
  updateContact: (id: string, u: Partial<Contact>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<Notification,'id'|'createdAt'|'read'>) => void;
  updateChannel: (id: string, u: Partial<Channel>) => void;
  sendMessage: (channelId: string, body: string, attachments?: { name: string; url: string; type: string }[]) => void;
  updateMessage: (id: string, body: string) => void;
  deleteMessage: (id: string) => void;
  replyToMessage: (parentId: string, channelId: string, body: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
}

export const useStore = create<AppStore>()(persist((set) => ({
  currentUser: LEV, users: [LEV, SARAH],
  projects: PROJECTS, tasks: TASKS, contacts: CONTACTS, notifications: [],
  channels: CHANNELS, messages: MESSAGES,
  activeChannelId: 'general',
  activeProjectId: null, sidebarOpen: true, darkMode: true, voiceOpen: false,
  setActiveProject: (id) => set({ activeProjectId: id }),
  setActiveChannel: (id) => set((s) => ({
    activeChannelId: id,
    channels: s.channels.map(c => c.id === id ? { ...c, lastReadAt: new Date().toISOString() } : c),
  })),
  updateChannel: (id, u) => set((s) => ({ channels: s.channels.map(c => c.id === id ? { ...c, ...u } : c) })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  toggleVoice: () => set((s) => ({ voiceOpen: !s.voiceOpen })),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, { ...task, id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), comments: [], audioNotes: [], attachments: [], calendarSync: true }] })),
  addComment: (taskId, body) => set((s) => {
    const task = s.tasks.find(t => t.id === taskId);
    const comment = { id: uid(), taskId, authorId: s.currentUser.id, body, createdAt: new Date().toISOString(), mentions: [] };
    const tasks = s.tasks.map((t) => t.id === taskId ? { ...t, comments: [...t.comments, comment], updatedAt: new Date().toISOString() } : t);
    const notif = (task && task.assigneeIds.length > 1)
      ? [{ id: uid(), type: 'comment', title: 'New comment on task', body: body.slice(0, 80) + (body.length > 80 ? '\u2026' : ''), taskId, read: false, createdAt: new Date().toISOString() }]
      : [];
    return { tasks, notifications: [...notif, ...s.notifications] };
  }),
  updateTask: (id, u) => set((s) => {
    const prev = s.tasks.find(t => t.id === id);
    const tasks = s.tasks.map((t) => t.id === id ? { ...t, ...u, updatedAt: new Date().toISOString() } : t);
    if (!prev) return { tasks };
    const ts = new Date().toISOString();
    const mkn = (type, title, body) => ({ id: uid(), type, title, body, taskId: id, read: false, createdAt: ts });
    const nn = [];
    if (u.questionsForLev === true && !prev.questionsForLev) nn.push(mkn('questions', 'Questions for Lev', prev.title));
    if (u.updateAtCheckin === true && !prev.updateAtCheckin) nn.push(mkn('checkin', 'Update at Check-in', prev.title));
    const isShared = prev.assigneeIds.length > 1;
    if (isShared) {
      if (u.status && u.status !== prev.status) nn.push(mkn('status_change', 'Task updated', prev.title + ' \u2192 ' + u.status));
      if (u.priority && u.priority !== prev.priority) nn.push(mkn('priority_change', 'Task updated', prev.title + ' priority \u2192 ' + u.priority));
      if (u.assigneeIds && JSON.stringify([...u.assigneeIds].sort()) !== JSON.stringify([...prev.assigneeIds].sort())) nn.push(mkn('assignee_change', 'Task updated', prev.title + ' \u2192 assignees changed'));
      if (u.dueDate !== undefined && u.dueDate !== prev.dueDate) nn.push(mkn('date_change', 'Task updated', prev.title + ' \u2192 ' + (u.dueDate ? u.dueDate.slice(0, 10) : 'no date')));
    }
    // Recurring: when marked done, auto-create next instance
    let newRecurring: Task[] = [];
    if (u.status === 'done' && prev.status !== 'done' && prev.recurring && prev.recurring !== 'custom') {
      let nextDue: string | undefined;
      if (prev.dueDate) {
        const d = new Date(prev.dueDate + 'T12:00:00');
        if (prev.recurring === 'daily') d.setDate(d.getDate() + 1);
        else if (prev.recurring === 'weekly') d.setDate(d.getDate() + 7);
        else if (prev.recurring === 'monthly') {
          const targetMonth = d.getMonth() + 1;
          d.setMonth(targetMonth);
          if (d.getMonth() !== targetMonth % 12) d.setDate(0); // clamp month overflow
        }
        nextDue = d.toISOString().slice(0, 10);
      }
      const { id: _id, createdAt: _c, updatedAt: _u, completedAt: _x, reminderSent: _rs, ...rest } = prev;
      newRecurring = [{ ...rest, id: uid(), status: 'todo', dueDate: nextDue, reminderSent: false, createdAt: ts, updatedAt: ts }];
    }
    return { tasks: [...tasks, ...newRecurring], notifications: [...nn, ...s.notifications] };
  }),
  deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  addProject: (p) => set((s) => ({ projects: [...s.projects, { ...p, id: uid(), createdAt: new Date().toISOString() }] })),
  updateProject: (id, u) => set((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, ...u } : p) })),
  addUser: (email, name) => {
    // Check if user already exists
    let existing: User | undefined;
    let newUser: User | undefined;
    set((s) => {
      existing = s.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) return s;
      const derivedName = name?.trim() || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      newUser = { id: uid(), name: derivedName, email: email.toLowerCase(), role: 'collaborator' };
      return { users: [...s.users, newUser] };
    });
    return (existing || newUser)!;
  },
  addContact: (c) => set((s) => ({ contacts: [...s.contacts, { ...c, id: uid(), meetings: [], linkedTaskIds: [] }] })),
  updateContact: (id, u) => set((s) => ({ contacts: s.contacts.map((c) => c.id === id ? { ...c, ...u } : c) })),
  markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) })),
  markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  addNotification: (n) => set((s) => ({ notifications: [{ ...n, id: uid(), createdAt: new Date().toISOString(), read: false }, ...s.notifications] })),
  sendMessage: (channelId, body, attachments) => set((s) => ({
    messages: [...s.messages, {
      id: uid(), channelId, authorId: s.currentUser.id, body,
      createdAt: new Date().toISOString(), reactions: {},
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }],
  })),
  updateMessage: (id, body) => set((s) => ({
    messages: s.messages.map(m => m.id === id ? { ...m, body, editedAt: new Date().toISOString() } : m),
  })),
  deleteMessage: (id) => set((s) => ({
    messages: s.messages.filter(m => m.id !== id && m.parentId !== id),
  })),
  replyToMessage: (parentId, channelId, body) => set((s) => ({
    messages: [...s.messages, {
      id: uid(), channelId, authorId: s.currentUser.id, body,
      parentId, createdAt: new Date().toISOString(), reactions: {},
    }],
  })),
  addReaction: (messageId, emoji) => set((s) => ({
    messages: s.messages.map((m) => {
      if (m.id !== messageId) return m;
      const users = m.reactions[emoji] || [];
      const userId = s.currentUser.id;
      const already = users.includes(userId);
      return {
        ...m,
        reactions: {
          ...m.reactions,
          [emoji]: already ? users.filter(u => u !== userId) : [...users, userId],
        },
      };
    }),
  })),
}), {
  name: 'hive-store',
  partialize: (state) => ({
    tasks: state.tasks,
    projects: state.projects,
    contacts: state.contacts,
    channels: state.channels,
    messages: state.messages,
    notifications: state.notifications,
    darkMode: state.darkMode,
    activeChannelId: state.activeChannelId,
  }),
}));
