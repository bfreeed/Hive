import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Task, Project, Contact, User, UserFlag, Notification, Channel, Message } from '../types';

// ---------------------------------------------------------------------------
// Fallback seed data (shown while Supabase loads or if it fails)
// ---------------------------------------------------------------------------

const DEFAULT_FLAGS: UserFlag[] = [
  { id: 'flag-72h', name: '72h Priority', color: '#ef4444' },
  { id: 'flag-questions', name: 'Questions for Me', color: '#a855f7' },
  { id: 'flag-checkin', name: 'Update at Checkin', color: '#10b981' },
];

const LEV: User = { id: 'lev', name: 'Lev Freedman', email: 'lev@example.com', role: 'owner', flags: DEFAULT_FLAGS };
const SARAH: User = { id: 'sarah', name: 'Sarah', email: 'sarah@example.com', role: 'assistant', flags: DEFAULT_FLAGS };

const now = new Date().toISOString();
const in2d = new Date(Date.now() + 2 * 864e5).toISOString();
const in7d = new Date(Date.now() + 7 * 864e5).toISOString();
const yest = new Date(Date.now() - 864e5).toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

const PROJECTS: Project[] = [
  { id: 'personal', name: 'Personal Life', description: 'Personal tasks and life admin', color: '#6366f1', status: 'active', memberIds: ['lev', 'sarah'], isPrivate: false, createdAt: now },
  { id: 'rff', name: 'Resilient Future Foundation', description: 'RFF nonprofit work', color: '#10b981', status: 'active', memberIds: ['lev'], isPrivate: false, createdAt: now },
  { id: 'jedi', name: 'Jedi Village', description: 'Property in Sebastopol', color: '#f59e0b', status: 'active', memberIds: ['lev'], isPrivate: false, createdAt: now },
];

const TASKS: Task[] = [
  { id: 't1', title: 'Fix roof leak', projectIds: ['jedi'], status: 'todo', priority: 'urgent', assigneeIds: ['lev', 'sarah'], flags: [{ flagId: 'flag-72h', appliedBy: 'lev' }], isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now, dueDate: in2d },
  { id: 't2', title: 'Name change with Travis County', projectIds: ['jedi'], status: 'waiting', priority: 'high', assigneeIds: ['lev'], flags: [], isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now },
  { id: 't3', title: 'Schedule dentist appointment', projectIds: ['personal'], status: 'todo', priority: 'medium', assigneeIds: ['sarah'], flags: [{ flagId: 'flag-checkin', appliedBy: 'lev' }], isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now, dueDate: in7d },
  { id: 't4', title: 'Review RFF grant proposal', projectIds: ['rff'], status: 'review', priority: 'high', assigneeIds: ['lev'], flags: [{ flagId: 'flag-questions', appliedBy: 'lev' }], isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now },
  { id: 't5', title: 'Contact storage facility', projectIds: ['jedi'], status: 'todo', priority: 'medium', assigneeIds: ['sarah'], flags: [], isPrivate: false, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now },
  { id: 't6', title: 'Annual physical checkup', projectIds: ['personal'], status: 'todo', priority: 'medium', assigneeIds: ['lev'], flags: [], isPrivate: true, linkedContactIds: [], linkedDocIds: [], comments: [], audioNotes: [], attachments: [], calendarSync: true, createdAt: now, updatedAt: now, dueDate: yest },
];

const CONTACTS: Contact[] = [
  { id: 'c1', name: 'Sarah', email: 'sarah@example.com', projectIds: ['personal', 'rff', 'jedi'], notes: 'Personal assistant', meetings: [], linkedTaskIds: ['t3', 't5'] },
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
  { id: 'm1', channelId: 'general', authorId: 'sarah', body: 'Good morning! I have the weekly task summary ready whenever you want to review it.', createdAt: hoursAgo(2), reactions: {} },
  { id: 'm2', channelId: 'general', authorId: 'lev', body: 'Great, send it over. Also can you check on the dentist appointment status?', createdAt: hoursAgo(1.8), reactions: { '👍': ['sarah'] } },
  { id: 'm3', channelId: 'general', authorId: 'sarah', body: 'On it. I called and they have availability next Tuesday or Thursday morning.', createdAt: hoursAgo(1.5), reactions: {} },
  { id: 'm4', channelId: 'general', authorId: 'lev', body: 'Thursday works. Book it.', createdAt: hoursAgo(1.2), reactions: { '✅': ['sarah'] } },
  { id: 'm5', channelId: 'general', authorId: 'sarah', body: 'Done! Added to your calendar for Thursday 9am. Confirmation sent to your email.', createdAt: hoursAgo(1), reactions: {} },
  { id: 'm6', channelId: 'jedi-village', authorId: 'sarah', body: 'Heard back from the roofing contractor. They can come out Wednesday between 10am–2pm.', createdAt: daysAgo(1), reactions: {} },
  { id: 'm7', channelId: 'jedi-village', authorId: 'lev', body: 'Perfect. Make sure someone is there to let them in.', createdAt: daysAgo(1), reactions: {} },
  { id: 'm8', channelId: 'jedi-village', authorId: 'sarah', body: 'I can be there. Should I get a quote before approving any work?', createdAt: daysAgo(1), reactions: {} },
  { id: 'm9', channelId: 'jedi-village', authorId: 'lev', body: 'Yes — get the quote first, anything under $2k just approve. Over that, send it to me.', createdAt: daysAgo(1), reactions: { '👍': ['sarah'] } },
  { id: 'm10', channelId: 'jedi-village', authorId: 'sarah', body: 'Also the Travis County name change paperwork came back. Looks like we need a notarized signature. Want me to find a mobile notary?', createdAt: hoursAgo(4), reactions: {} },
  { id: 'm11', channelId: 'jedi-village', authorId: 'lev', body: 'Yes please. Try to find one that can come to me.', createdAt: hoursAgo(3), reactions: {} },
  { id: 'm12', channelId: 'rff', authorId: 'sarah', body: 'The grant proposal draft is in your review queue. It is due Friday so wanted to flag it early.', createdAt: daysAgo(2), reactions: {} },
  { id: 'm13', channelId: 'rff', authorId: 'lev', body: 'I saw it. Will review tonight. Any notes from the board?', createdAt: daysAgo(2), reactions: {} },
  { id: 'm14', channelId: 'rff', authorId: 'sarah', body: 'Nothing formal yet. Marcus mentioned they want a stronger impact statement in section 3.', createdAt: daysAgo(2), reactions: {} },
  { id: 'm15', channelId: 'rff', authorId: 'lev', body: 'Good to know. I will tighten that section.', createdAt: daysAgo(1), reactions: {} },
  { id: 'm16', channelId: 'dm-sarah', authorId: 'sarah', body: 'Hey, quick heads up — the storage facility said they need 30 days notice to cancel. Did you want to keep the unit through April?', createdAt: daysAgo(1), reactions: {} },
  { id: 'm17', channelId: 'dm-sarah', authorId: 'lev', body: "No let's cancel it. Start the 30 day notice now.", createdAt: daysAgo(1), reactions: {} },
  { id: 'm18', channelId: 'dm-sarah', authorId: 'sarah', body: 'Done. They confirmed cancellation effective April 20th. I will add a task to arrange pickup of anything still there.', createdAt: daysAgo(1), reactions: { '❤️': ['lev'] } },
  { id: 'm19', channelId: 'dm-sarah', authorId: 'sarah', body: 'Also — are we still doing the weekly check-in call on Friday?', createdAt: minsAgo(30), reactions: {} },
  { id: 'm20', channelId: 'dm-sarah', authorId: 'lev', body: 'Yes, same time. 10am.', createdAt: minsAgo(15), reactions: {} },
];

// ---------------------------------------------------------------------------
// Mappers: DB row (snake_case) → TypeScript type (camelCase)
// ---------------------------------------------------------------------------

function dbToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    projectIds: row.project_ids ?? [],
    status: row.status,
    priority: row.priority,
    assigneeIds: row.assignee_ids ?? [],
    dueDate: row.due_date ?? undefined,
    dueTime: row.due_time ?? undefined,
    dueTimeEnd: row.due_time_end ?? undefined,
    calendarEventId: row.calendar_event_id ?? undefined,
    calendarShowAs: row.calendar_show_as ?? undefined,
    calendarSync: row.calendar_sync ?? true,
    snoozeDate: row.snooze_date ?? undefined,
    waitDate: row.wait_date ?? undefined,
    label: row.label ?? undefined,
    recurring: row.recurring ?? undefined,
    isPrivate: row.is_private ?? false,
    flags: row.flags ?? [],
    linkedContactIds: row.linked_contact_ids ?? [],
    linkedDocIds: row.linked_doc_ids ?? [],
    comments: row.comments ?? [],
    audioNotes: row.audio_notes ?? [],
    attachments: row.attachments ?? [],
    reminderAt: row.reminder_at ?? undefined,
    reminderSent: row.reminder_sent ?? false,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskToDb(t: Task) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    project_ids: t.projectIds,
    status: t.status,
    priority: t.priority,
    assignee_ids: t.assigneeIds,
    due_date: t.dueDate ?? null,
    due_time: t.dueTime ?? null,
    due_time_end: t.dueTimeEnd ?? null,
    calendar_event_id: t.calendarEventId ?? null,
    calendar_show_as: t.calendarShowAs ?? null,
    calendar_sync: t.calendarSync,
    snooze_date: t.snoozeDate ?? null,
    wait_date: t.waitDate ?? null,
    label: t.label ?? null,
    recurring: t.recurring ?? null,
    is_private: t.isPrivate,
    flags: t.flags ?? [],
    linked_contact_ids: t.linkedContactIds,
    linked_doc_ids: t.linkedDocIds,
    comments: t.comments,
    audio_notes: t.audioNotes,
    attachments: t.attachments,
    reminder_at: t.reminderAt ?? null,
    reminder_sent: t.reminderSent ?? false,
    completed_at: t.completedAt ?? null,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function dbToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    icon: row.icon ?? undefined,
    status: row.status,
    memberIds: row.member_ids ?? [],
    isPrivate: row.is_private ?? false,
    createdAt: row.created_at,
  };
}

function projectToDb(p: Project) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    color: p.color,
    icon: p.icon ?? null,
    status: p.status,
    member_ids: p.memberIds,
    is_private: p.isPrivate,
    created_at: p.createdAt,
  };
}

function dbToContact(row: any): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    avatar: row.avatar ?? undefined,
    projectIds: row.project_ids ?? [],
    notes: row.notes ?? undefined,
    bookingLink: row.booking_link ?? undefined,
    meetings: row.meetings ?? [],
    linkedTaskIds: row.linked_task_ids ?? [],
  };
}

function contactToDb(c: Contact) {
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    avatar: c.avatar ?? null,
    project_ids: c.projectIds,
    notes: c.notes ?? null,
    booking_link: c.bookingLink ?? null,
    meetings: c.meetings,
    linked_task_ids: c.linkedTaskIds,
  };
}

function dbToChannel(row: any): Channel {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    memberIds: row.member_ids ?? [],
    description: row.description ?? undefined,
    lastReadAt: row.last_read_at ?? undefined,
    pinnedMessageIds: row.pinned_message_ids ?? [],
    muted: row.muted ?? false,
    readBy: row.read_by ?? {},
  };
}

function dbToMessage(row: any): Message {
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    reactions: row.reactions ?? {},
    attachments: row.attachments ?? undefined,
    editedAt: row.edited_at ?? undefined,
    parentId: row.parent_id ?? undefined,
  };
}

function dbToNotification(row: any): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    taskId: row.task_id ?? undefined,
    projectId: row.project_id ?? undefined,
    read: row.read ?? false,
    createdAt: row.created_at,
  };
}

function dbToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar ?? undefined,
    role: row.role ?? 'collaborator',
    flags: row.flags ?? DEFAULT_FLAGS,
  };
}

// ---------------------------------------------------------------------------
// uid helper
// ---------------------------------------------------------------------------
const uid = () => Math.random().toString(36).slice(2, 9);

// ---------------------------------------------------------------------------
// Store interface (unchanged from original)
// ---------------------------------------------------------------------------

interface AppStore {
  currentUser: User;
  users: User[];
  projects: Project[];
  tasks: Task[];
  contacts: Contact[];
  notifications: Notification[];
  channels: Channel[];
  messages: Message[];
  activeChannelId: string;
  activeProjectId: string | null;
  sidebarOpen: boolean;
  darkMode: boolean;
  voiceOpen: boolean;
  manualOrder: string[];
  isLoading: boolean;

  loadData: () => Promise<void>;

  setManualOrder: (order: string[]) => void;
  setActiveProject: (id: string | null) => void;
  setActiveChannel: (id: string) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  toggleVoice: () => void;
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'audioNotes' | 'attachments'>) => void;
  addComment: (taskId: string, body: string) => void;
  updateTask: (id: string, u: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (id: string, u: Partial<Project>) => void;
  addUser: (email: string, name?: string) => User;
  addContact: (c: Omit<Contact, 'id' | 'meetings' | 'linkedTaskIds'>) => void;
  updateContact: (id: string, u: Partial<Contact>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  addChannel: (channel: Omit<Channel, 'id'>) => void;
  updateChannel: (id: string, u: Partial<Channel>) => void;
  deleteChannel: (id: string) => void;
  sendMessage: (channelId: string, body: string, attachments?: { name: string; url: string; type: string }[]) => void;
  updateMessage: (id: string, body: string) => void;
  deleteMessage: (id: string) => void;
  replyToMessage: (parentId: string, channelId: string, body: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  pinMessage: (messageId: string, channelId: string) => void;
  unpinMessage: (messageId: string, channelId: string) => void;
  addUserFlag: (flag: Omit<UserFlag, 'id'>) => void;
  updateUserFlag: (flagId: string, changes: Partial<Omit<UserFlag, 'id'>>) => void;
  removeUserFlag: (flagId: string) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStore = create<AppStore>()((set, get) => ({
  currentUser: LEV,
  users: [LEV, SARAH],
  projects: PROJECTS,
  tasks: TASKS,
  contacts: CONTACTS,
  notifications: [],
  channels: CHANNELS,
  messages: MESSAGES,
  activeChannelId: 'general',
  activeProjectId: null,
  sidebarOpen: true,
  darkMode: true,
  voiceOpen: false,
  manualOrder: [],
  isLoading: false,

  // -------------------------------------------------------------------------
  // loadData — fetch everything from Supabase and replace local state
  // -------------------------------------------------------------------------
  loadData: async () => {
    set({ isLoading: true });
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // Load all tables in parallel
      const [
        tasksRes,
        projectsRes,
        contactsRes,
        channelsRes,
        messagesRes,
        notificationsRes,
        profilesRes,
        prefsRes,
      ] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: true }),
        supabase.from('projects').select('*').order('created_at', { ascending: true }),
        supabase.from('contacts').select('*'),
        supabase.from('channels').select('*'),
        supabase.from('messages').select('*').order('created_at', { ascending: true }),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        authUser ? supabase.from('user_preferences').select('*').eq('user_id', authUser.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);

      const updates: Partial<AppStore> = { isLoading: false };

      if (tasksRes.data && tasksRes.data.length > 0) {
        updates.tasks = tasksRes.data.map(dbToTask);
      }
      if (projectsRes.data && projectsRes.data.length > 0) {
        updates.projects = projectsRes.data.map(dbToProject);
      }
      if (contactsRes.data && contactsRes.data.length > 0) {
        updates.contacts = contactsRes.data.map(dbToContact);
      }
      if (channelsRes.data && channelsRes.data.length > 0) {
        updates.channels = channelsRes.data.map(dbToChannel);
      }
      if (messagesRes.data && messagesRes.data.length > 0) {
        updates.messages = messagesRes.data.map(dbToMessage);
      }
      if (notificationsRes.data) {
        updates.notifications = notificationsRes.data.map(dbToNotification);
      }

      // Build users list from profiles
      if (profilesRes.data && profilesRes.data.length > 0) {
        const dbUsers = profilesRes.data.map(dbToUser);
        // Keep seed users with string IDs (lev/sarah) because DB tasks still reference
        // those seed IDs in assigneeIds. Filter out seeds whose ID already exists in DB.
        const ids = new Set(dbUsers.map(u => u.id));
        const extras = [LEV, SARAH].filter(u => !ids.has(u.id));
        updates.users = [...dbUsers, ...extras];

        // Set currentUser from authenticated profile
        if (authUser) {
          const myProfile = profilesRes.data.find(p => p.id === authUser.id);
          if (myProfile) {
            updates.currentUser = dbToUser(myProfile);
          }
        }
      }

      // Load manual order from user_preferences
      if (prefsRes.data?.manual_order) {
        updates.manualOrder = prefsRes.data.manual_order;
      }

      set(updates);
    } catch (err) {
      console.error('Supabase loadData error:', err);
      set({ isLoading: false });
    }
  },

  // -------------------------------------------------------------------------
  // UI actions
  // -------------------------------------------------------------------------
  setManualOrder: async (order) => {
    set({ manualOrder: order });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('user_preferences').upsert({ user_id: user.id, manual_order: order });
    } catch (err) {
      console.error('setManualOrder sync error:', err);
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  setActiveChannel: (id) => {
    const now = new Date().toISOString();
    const { currentUser } = useStore.getState();
    set((s) => ({
      activeChannelId: id,
      channels: s.channels.map(c => c.id === id
        ? { ...c, lastReadAt: now, readBy: { ...(c.readBy ?? {}), [currentUser.id]: now } }
        : c
      ),
    }));
    // Persist readBy to Supabase (best-effort, column may not exist yet)
    supabase.from('channels').update({ read_by: { [currentUser.id]: now } }).eq('id', id)
      .then(() => {});
  },

  addChannel: (channel) => {
    const newChannel: Channel = { ...channel, id: uid() };
    set((s) => ({ channels: [...s.channels, newChannel] }));
    supabase.from('channels').insert({
      id: newChannel.id,
      name: newChannel.name,
      type: newChannel.type,
      member_ids: newChannel.memberIds,
      description: newChannel.description ?? null,
    }).then(({ error }) => { if (error) console.error('addChannel error:', error); });
  },

  updateChannel: (id, u) => {
    set((s) => ({ channels: s.channels.map(c => c.id === id ? { ...c, ...u } : c) }));
    const dbFields: Record<string, any> = {};
    if ('description' in u) dbFields.description = u.description ?? null;
    if ('pinnedMessageIds' in u) dbFields.pinned_message_ids = u.pinnedMessageIds ?? [];
    if ('muted' in u) dbFields.muted = u.muted ?? false;
    if ('readBy' in u) dbFields.read_by = u.readBy ?? {};
    if (Object.keys(dbFields).length > 0) {
      supabase.from('channels').update(dbFields).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateChannel error:', error); });
    }
  },

  deleteChannel: (id) => {
    set((s) => ({
      channels: s.channels.filter(c => c.id !== id),
      messages: s.messages.filter(m => m.channelId !== id),
      activeChannelId: s.activeChannelId === id
        ? (s.channels.find(c => c.id !== id)?.id ?? s.activeChannelId)
        : s.activeChannelId,
    }));
    supabase.from('messages').delete().eq('channel_id', id)
      .then(() => supabase.from('channels').delete().eq('id', id))
      .then(({ error }) => { if (error) console.error('deleteChannel error:', error); });
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  toggleVoice: () => set((s) => ({ voiceOpen: !s.voiceOpen })),

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  addTask: (task) => {
    const newTask: Task = {
      ...task,
      id: uid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
      audioNotes: [],
      attachments: [],
      calendarSync: true,
    };
    // Optimistic update
    set((s) => ({ tasks: [...s.tasks, newTask] }));
    // Persist
    supabase.from('tasks').insert(taskToDb(newTask))
      .then(({ error }) => { if (error) console.error('addTask error:', error); });
  },

  addComment: (taskId, body) => set((s) => {
    const task = s.tasks.find(t => t.id === taskId);
    const comment = {
      id: uid(),
      taskId,
      authorId: s.currentUser.id,
      body,
      createdAt: new Date().toISOString(),
      mentions: [],
    };
    const tasks = s.tasks.map((t) =>
      t.id === taskId
        ? { ...t, comments: [...t.comments, comment], updatedAt: new Date().toISOString() }
        : t
    );
    const notif = (task && task.assigneeIds.length > 1)
      ? [{ id: uid(), type: 'comment', title: 'New comment on task', body: body.slice(0, 80) + (body.length > 80 ? '\u2026' : ''), taskId, read: false, createdAt: new Date().toISOString() }]
      : [];

    // Persist updated task
    const updated = tasks.find(t => t.id === taskId);
    if (updated) {
      supabase.from('tasks').update({ comments: updated.comments, updated_at: updated.updatedAt }).eq('id', taskId)
        .then(({ error }) => { if (error) console.error('addComment error:', error); });
    }

    return { tasks, notifications: [...notif, ...s.notifications] };
  }),

  updateTask: (id, u) => set((s) => {
    const prev = s.tasks.find(t => t.id === id);
    const ts = new Date().toISOString();
    const tasks = s.tasks.map((t) => t.id === id ? { ...t, ...u, updatedAt: ts } : t);
    if (!prev) return { tasks };

    const mkn = (type: string, title: string, body: string) => ({
      id: uid(), type, title, body, taskId: id, read: false, createdAt: ts,
    });
    const nn: Notification[] = [];
    // Notify when a flag is newly added
    if (u.flags && prev.flags) {
      const prevFlagIds = new Set(prev.flags.map(f => f.flagId));
      const allUsers = s.users;
      u.flags.filter(f => !prevFlagIds.has(f.flagId)).forEach(f => {
        const applier = allUsers.find(u2 => u2.id === f.appliedBy);
        const flagDef = applier?.flags?.find(fd => fd.id === f.flagId);
        if (flagDef) nn.push(mkn('flag', `Flagged: ${flagDef.name}`, prev.title));
      });
    }
    const isShared = prev.assigneeIds.length > 1;
    if (isShared) {
      if (u.status && u.status !== prev.status) nn.push(mkn('status_change', 'Task updated', prev.title + ' \u2192 ' + u.status));
      if (u.priority && u.priority !== prev.priority) nn.push(mkn('priority_change', 'Task updated', prev.title + ' priority \u2192 ' + u.priority));
      if (u.assigneeIds && JSON.stringify([...u.assigneeIds].sort()) !== JSON.stringify([...prev.assigneeIds].sort()))
        nn.push(mkn('assignee_change', 'Task updated', prev.title + ' \u2192 assignees changed'));
      if (u.dueDate !== undefined && u.dueDate !== prev.dueDate)
        nn.push(mkn('date_change', 'Task updated', prev.title + ' \u2192 ' + (u.dueDate ? u.dueDate.slice(0, 10) : 'no date')));
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
          if (d.getMonth() !== targetMonth % 12) d.setDate(0);
        }
        nextDue = d.toISOString().slice(0, 10);
      }
      const { id: _id, createdAt: _c, updatedAt: _u, completedAt: _x, reminderSent: _rs, ...rest } = prev;
      newRecurring = [{ ...rest, id: uid(), status: 'todo', dueDate: nextDue, reminderSent: false, createdAt: ts, updatedAt: ts }];
    }

    // Persist
    const updatedTask = tasks.find(t => t.id === id);
    if (updatedTask) {
      supabase.from('tasks').update(taskToDb(updatedTask)).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateTask error:', error); });
    }
    if (newRecurring.length > 0) {
      supabase.from('tasks').insert(newRecurring.map(taskToDb))
        .then(({ error }) => { if (error) console.error('addRecurring error:', error); });
    }
    if (nn.length > 0) {
      supabase.from('notifications').insert(nn.map(n => ({
        id: n.id, type: n.type, title: n.title, body: n.body,
        task_id: n.taskId ?? null, project_id: n.projectId ?? null,
        read: n.read, created_at: n.createdAt,
      }))).then(({ error }) => { if (error) console.error('notification insert error:', error); });
    }

    return { tasks: [...tasks, ...newRecurring], notifications: [...nn, ...s.notifications] };
  }),

  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    supabase.from('tasks').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteTask error:', error); });
  },

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------
  addProject: (p) => {
    const newProject: Project = { ...p, id: uid(), createdAt: new Date().toISOString() };
    set((s) => ({ projects: [...s.projects, newProject] }));
    supabase.from('projects').insert(projectToDb(newProject))
      .then(({ error }) => { if (error) console.error('addProject error:', error); });
  },

  updateProject: (id, u) => {
    set((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, ...u } : p) }));
    const updated = get().projects.find(p => p.id === id);
    if (updated) {
      supabase.from('projects').update(projectToDb(updated)).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateProject error:', error); });
    }
  },

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  addUser: (email, name) => {
    let existing: User | undefined;
    let newUser: User | undefined;
    set((s) => {
      existing = s.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) return s;
      const derivedName = name?.trim() || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      newUser = { id: uid(), name: derivedName, email: email.toLowerCase(), role: 'collaborator', flags: DEFAULT_FLAGS };
      return { users: [...s.users, newUser] };
    });
    return (existing || newUser)!;
  },

  // -------------------------------------------------------------------------
  // Contacts
  // -------------------------------------------------------------------------
  addContact: (c) => {
    const newContact: Contact = { ...c, id: uid(), meetings: [], linkedTaskIds: [] };
    set((s) => ({ contacts: [...s.contacts, newContact] }));
    supabase.from('contacts').insert(contactToDb(newContact))
      .then(({ error }) => { if (error) console.error('addContact error:', error); });
  },

  updateContact: (id, u) => {
    set((s) => ({ contacts: s.contacts.map((c) => c.id === id ? { ...c, ...u } : c) }));
    const updated = get().contacts.find(c => c.id === id);
    if (updated) {
      supabase.from('contacts').update(contactToDb(updated)).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateContact error:', error); });
    }
  },

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  markNotificationRead: (id) => {
    set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) }));
    supabase.from('notifications').update({ read: true }).eq('id', id)
      .then(({ error }) => { if (error) console.error('markNotificationRead error:', error); });
  },

  markAllNotificationsRead: () => {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    supabase.from('notifications').update({ read: true }).eq('read', false)
      .then(({ error }) => { if (error) console.error('markAllNotificationsRead error:', error); });
  },

  addNotification: (n) => {
    const newN: Notification = { ...n, id: uid(), createdAt: new Date().toISOString(), read: false };
    set((s) => ({ notifications: [newN, ...s.notifications] }));
    supabase.from('notifications').insert({
      id: newN.id, type: newN.type, title: newN.title, body: newN.body,
      task_id: newN.taskId ?? null, project_id: newN.projectId ?? null,
      read: false, created_at: newN.createdAt,
    }).then(({ error }) => { if (error) console.error('addNotification error:', error); });
  },

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------
  sendMessage: (channelId, body, attachments) => {
    const s = get();
    const newMsg: Message = {
      id: uid(),
      channelId,
      authorId: s.currentUser.id,
      body,
      createdAt: new Date().toISOString(),
      reactions: {},
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };
    set((st) => ({ messages: [...st.messages, newMsg] }));
    supabase.from('messages').insert({
      id: newMsg.id,
      channel_id: newMsg.channelId,
      author_id: newMsg.authorId,
      body: newMsg.body,
      reactions: newMsg.reactions,
      attachments: newMsg.attachments ?? null,
      parent_id: newMsg.parentId ?? null,
      created_at: newMsg.createdAt,
    }).then(({ error }) => { if (error) console.error('sendMessage error:', error); });
  },

  updateMessage: (id, body) => {
    const editedAt = new Date().toISOString();
    set((s) => ({
      messages: s.messages.map(m => m.id === id ? { ...m, body, editedAt } : m),
    }));
    supabase.from('messages').update({ body, edited_at: editedAt }).eq('id', id)
      .then(({ error }) => { if (error) console.error('updateMessage error:', error); });
  },

  deleteMessage: (id) => {
    set((s) => ({
      messages: s.messages.filter(m => m.id !== id && m.parentId !== id),
    }));
    supabase.from('messages').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteMessage error:', error); });
  },

  replyToMessage: (parentId, channelId, body) => {
    const s = get();
    const newMsg: Message = {
      id: uid(),
      channelId,
      authorId: s.currentUser.id,
      body,
      parentId,
      createdAt: new Date().toISOString(),
      reactions: {},
    };
    set((st) => ({ messages: [...st.messages, newMsg] }));
    supabase.from('messages').insert({
      id: newMsg.id,
      channel_id: newMsg.channelId,
      author_id: newMsg.authorId,
      body: newMsg.body,
      reactions: newMsg.reactions,
      parent_id: newMsg.parentId,
      created_at: newMsg.createdAt,
    }).then(({ error }) => { if (error) console.error('replyToMessage error:', error); });
  },

  pinMessage: (messageId, channelId) => {
    const s = useStore.getState();
    const ch = s.channels.find(c => c.id === channelId);
    if (!ch) return;
    const pins = [...(ch.pinnedMessageIds ?? [])];
    if (!pins.includes(messageId)) pins.push(messageId);
    useStore.getState().updateChannel(channelId, { pinnedMessageIds: pins });
  },

  unpinMessage: (messageId, channelId) => {
    const s = useStore.getState();
    const ch = s.channels.find(c => c.id === channelId);
    if (!ch) return;
    const pins = (ch.pinnedMessageIds ?? []).filter(id => id !== messageId);
    useStore.getState().updateChannel(channelId, { pinnedMessageIds: pins });
  },

  // -------------------------------------------------------------------------
  // User Flags
  // -------------------------------------------------------------------------
  addUserFlag: (flag) => {
    const newFlag: UserFlag = { ...flag, id: uid() };
    set((s) => {
      const updated = { ...s.currentUser, flags: [...(s.currentUser.flags || []), newFlag] };
      return {
        currentUser: updated,
        users: s.users.map(u => u.id === s.currentUser.id ? updated : u),
      };
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const flags = get().currentUser.flags;
      supabase.from('profiles').update({ flags }).eq('id', user.id)
        .then(({ error }) => { if (error) console.error('addUserFlag error:', error); });
    });
  },

  updateUserFlag: (flagId, changes) => {
    set((s) => {
      const updated = {
        ...s.currentUser,
        flags: (s.currentUser.flags || []).map(f => f.id === flagId ? { ...f, ...changes } : f),
      };
      return {
        currentUser: updated,
        users: s.users.map(u => u.id === s.currentUser.id ? updated : u),
      };
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const flags = get().currentUser.flags;
      supabase.from('profiles').update({ flags }).eq('id', user.id)
        .then(({ error }) => { if (error) console.error('updateUserFlag error:', error); });
    });
  },

  removeUserFlag: (flagId) => {
    set((s) => {
      const updated = {
        ...s.currentUser,
        flags: (s.currentUser.flags || []).filter(f => f.id !== flagId),
      };
      // Remove this flag from all tasks (only entries applied by this user)
      const tasks = s.tasks.map(t => ({
        ...t,
        flags: t.flags.filter(tf => !(tf.flagId === flagId && tf.appliedBy === s.currentUser.id)),
      }));
      return {
        currentUser: updated,
        users: s.users.map(u => u.id === s.currentUser.id ? updated : u),
        tasks,
      };
    });
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const flags = get().currentUser.flags;
      await supabase.from('profiles').update({ flags }).eq('id', user.id);
      // Update all tasks that had this flag
      const affectedTasks = get().tasks;
      await Promise.all(
        affectedTasks.map(t =>
          supabase.from('tasks').update({ flags: t.flags }).eq('id', t.id)
        )
      );
    });
  },

  addReaction: (messageId, emoji) => {
    set((s) => ({
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
    }));
    // Persist updated reactions
    const updated = get().messages.find(m => m.id === messageId);
    if (updated) {
      supabase.from('messages').update({ reactions: updated.reactions }).eq('id', messageId)
        .then(({ error }) => { if (error) console.error('addReaction error:', error); });
    }
  },
}));

// ---------------------------------------------------------------------------
// Auto-load on module init (after auth is established)
// We call loadData when the store is first imported if a session exists.
// App.tsx also calls it after login to refresh.
// ---------------------------------------------------------------------------
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    useStore.getState().loadData();
  }
});

// Re-load when auth state changes (login/logout)
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') {
    useStore.getState().loadData();
  }
  if (event === 'SIGNED_OUT') {
    useStore.setState({
      tasks: TASKS,
      projects: PROJECTS,
      contacts: CONTACTS,
      channels: CHANNELS,
      messages: MESSAGES,
      notifications: [],
      users: [LEV, SARAH],
      currentUser: LEV,
      manualOrder: [],
    });
  }
});

// ---------------------------------------------------------------------------
// Real-time subscriptions — messages appear instantly for all users
// ---------------------------------------------------------------------------
supabase
  .channel('messages-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
    const newMsg = dbToMessage(payload.new);
    const state = useStore.getState();
    // Skip if we already have this message (sent by current user, already in state)
    if (state.messages.some(m => m.id === newMsg.id)) return;
    useStore.setState((s) => ({ messages: [...s.messages, newMsg] }));
  })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
    const updated = dbToMessage(payload.new);
    useStore.setState((s) => ({
      messages: s.messages.map(m => m.id === updated.id ? updated : m),
    }));
  })
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
    const id = payload.old?.id;
    if (id) {
      useStore.setState((s) => ({ messages: s.messages.filter(m => m.id !== id) }));
    }
  })
  .subscribe();
