import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Task, Project, Contact, User, UserFlag, Notification, Channel, Message, Section, Meeting, UserSettings, HivePage, Invitation } from '../types';
import { apiFetch } from '../lib/apiFetch';

// ---------------------------------------------------------------------------
// Fallback seed data (shown while Supabase loads or if it fails)
// ---------------------------------------------------------------------------

const DEFAULT_FLAGS: UserFlag[] = [
  { id: 'flag-72h', name: '72h Priority', color: '#ef4444' },
  { id: 'flag-questions', name: 'Questions for Me', color: '#a855f7' },
  { id: 'flag-checkin', name: 'Update at Checkin', color: '#10b981' },
];

/** Placeholder user shown while auth is loading — replaced by real profile from Supabase */
const PLACEHOLDER_USER: User = { id: '__loading__', name: '', email: '', role: 'owner', flags: DEFAULT_FLAGS };

const CHANNELS: Channel[] = [];

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
    calendarSync: row.calendar_sync ?? false,
    calendarId: row.calendar_id ?? undefined,
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
    deletedAt: row.deleted_at ?? undefined,
    parentId: row.parent_id ?? undefined,
    sectionId: row.section_id ?? undefined,
    dependsOn: row.depends_on ?? [],
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
    calendar_id: t.calendarId ?? null,
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
    parent_id: t.parentId ?? null,
    section_id: t.sectionId ?? null,
    depends_on: t.dependsOn ?? [],
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
    parentId: row.parent_id ?? undefined,
    folderId: row.folder_id ?? undefined,
    isFolder: row.is_folder ?? false,
    googleDriveFolderId: row.google_drive_folder_id ?? undefined,
    googleDriveFolderName: row.google_drive_folder_name ?? undefined,
    hideFromSidebar: row.hide_from_sidebar ?? false,
    deletedAt: row.deleted_at ?? undefined,
    docContent: row.doc_content ?? undefined,
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
    parent_id: p.parentId ?? null,
    folder_id: p.folderId ?? null,
    is_folder: p.isFolder ?? false,
    google_drive_folder_id: p.googleDriveFolderId ?? null,
    google_drive_folder_name: p.googleDriveFolderName ?? null,
    hide_from_sidebar: p.hideFromSidebar ?? false,
    doc_content: p.docContent ?? null,
  };
}

function dbToContact(row: any): Contact {
  return {
    id: row.id,
    firstName: row.first_name ?? (row.name ? row.name.split(' ')[0] : ''),
    lastName: row.last_name ?? (row.name ? row.name.split(' ').slice(1).join(' ') : ''),
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    avatar: row.avatar ?? undefined,
    business: row.business ?? undefined,
    birthday: row.birthday ?? undefined,
    address: row.address ?? undefined,
    relationshipTagIds: row.relationship_tag_ids ?? [],
    projectIds: row.project_ids ?? [],
    notes: row.notes ?? undefined,
    bookingLink: row.booking_link ?? undefined,
    meetings: row.meetings ?? [],
    linkedTaskIds: row.linked_task_ids ?? [],
  };
}

function contactToDb(c: Contact, userId?: string) {
  return {
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email ?? null,
    phone: c.phone ?? null,
    avatar: c.avatar ?? null,
    business: c.business ?? null,
    birthday: c.birthday ?? null,
    address: c.address ?? null,
    relationship_tag_ids: c.relationshipTagIds,
    project_ids: c.projectIds,
    notes: c.notes ?? null,
    booking_link: c.bookingLink ?? null,
    meetings: c.meetings,
    linked_task_ids: c.linkedTaskIds,
    ...(userId ? { user_id: userId } : {}),
  };
}

function messageToDb(m: Message) {
  return {
    id: m.id,
    channel_id: m.channelId,
    author_id: m.authorId,
    body: m.body,
    created_at: m.createdAt,
    reactions: m.reactions ?? {},
    attachments: m.attachments ?? null,
    edited_at: m.editedAt ?? null,
    parent_id: m.parentId ?? null,
    priority: m.priority ?? null,
    receiver_priority: m.receiverPriority ?? null,
  };
}

function channelToDb(c: Channel) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    member_ids: c.memberIds,
    description: c.description ?? null,
    last_read_at: c.lastReadAt ?? null,
    pinned_message_ids: c.pinnedMessageIds ?? [],
    muted: c.muted ?? false,
    read_by: c.readBy ?? {},
    deleted_at: c.deletedAt ?? null,
    project_id: c.projectId ?? null,
    hidden_from_sidebar: c.hiddenFromSidebar ?? false,
  };
}

function notificationToDb(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    task_id: n.taskId ?? null,
    project_id: n.projectId ?? null,
    user_id: n.userId ?? null,
    invitation_id: n.invitationId ?? null,
    read: n.read ?? false,
    created_at: n.createdAt,
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
    deletedAt: row.deleted_at ?? undefined,
    projectId: row.project_id ?? undefined,
    hiddenFromSidebar: row.hidden_from_sidebar ?? false,
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
    priority: row.priority ?? undefined,
    receiverPriority: row.receiver_priority ?? undefined,
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
    userId: row.user_id ?? undefined,
    invitationId: row.invitation_id ?? undefined,
    read: row.read ?? false,
    createdAt: row.created_at,
  };
}

function dbToInvitation(row: any): Invitation {
  return {
    id: row.id,
    type: row.type,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    invitedByUserId: row.invited_by_user_id,
    invitedByName: row.invited_by_name ?? '',
    invitedUserId: row.invited_user_id,
    status: row.status,
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

function dbToMeeting(row: any): Meeting {
  return {
    id: row.id,
    contactId: row.contact_id ?? '',
    title: row.title,
    date: row.date ?? row.created_at,
    notes: row.notes ?? '',
    source: row.source ?? undefined,
    externalId: row.external_id ?? undefined,
    provider: row.provider ?? undefined,
    transcript: row.transcript ?? undefined,
    summary: row.summary ?? undefined,
    participantNames: row.participant_names ?? [],
    participantEmails: row.participant_emails ?? [],
    linkedContactIds: row.linked_contact_ids ?? [],
    linkedProjectIds: row.linked_project_ids ?? [],
    suggestedProjectIds: row.suggested_project_ids ?? [],
    actionItems: row.action_items ?? [],
    hasProjectLinks: row.has_project_links ?? false,
    reviewed: row.reviewed ?? false,
    userId: row.user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function meetingToDb(m: Meeting) {
  return {
    id: m.id,
    contact_id: m.contactId || null,
    title: m.title,
    date: m.date,
    notes: m.notes,
    source: m.source ?? null,
    external_id: m.externalId ?? null,
    provider: m.provider ?? null,
    transcript: m.transcript ?? null,
    summary: m.summary ?? null,
    participant_names: m.participantNames ?? [],
    participant_emails: m.participantEmails ?? [],
    linked_contact_ids: m.linkedContactIds ?? [],
    linked_project_ids: m.linkedProjectIds ?? [],
    suggested_project_ids: m.suggestedProjectIds ?? [],
    action_items: m.actionItems ?? [],
    has_project_links: m.hasProjectLinks ?? false,
    reviewed: m.reviewed ?? false,
    user_id: m.userId ?? null,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

function dbToUserSettings(row: any): UserSettings {
  return {
    userId: row.user_id,
    granolaApiKey: row.granola_api_key ?? undefined,
    granolaLastSyncedAt: row.granola_last_synced_at ?? undefined,
    firefliesApiKey: row.fireflies_api_key ?? undefined,
    firefliesLastSyncedAt: row.fireflies_last_synced_at ?? undefined,
    otterApiKey: row.otter_api_key ?? undefined,
    otterLastSyncedAt: row.otter_last_synced_at ?? undefined,
    googleClientId: row.google_client_id ?? undefined,
    anthropicApiKey: row.anthropic_api_key ?? undefined,
    homeSections: row.home_sections ?? undefined,
    relationshipTags: row.relationship_tags ?? undefined,
    calendarDefaultSync: row.calendar_default_sync ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// uid helper
// ---------------------------------------------------------------------------
const uid = () => crypto.randomUUID();

function dbToPage(row: any): HivePage {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title ?? 'Untitled',
    icon: row.icon ?? undefined,
    content: row.content ?? {},
    parentId: row.parent_id ?? undefined,
    projectId: row.project_id ?? undefined,
    templateId: row.template_id ?? undefined,
    isTemplate: row.is_template ?? false,
    type: row.type ?? 'space',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Store interface (unchanged from original)
// ---------------------------------------------------------------------------

export interface Toast {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

interface AppStore {
  currentUser: User;
  users: User[];
  projects: Project[];
  trashedProjects: Project[];
  tasks: Task[];
  trashedTasks: Task[];
  contacts: Contact[];
  notifications: Notification[];
  channels: Channel[];
  messages: Message[];
  activeChannelId: string | null;
  activeProjectId: string | null;
  sidebarOpen: boolean;
  darkMode: boolean;
  voiceOpen: boolean;
  manualOrder: string[];
  isLoading: boolean;
  granolaManualSyncTrigger: number;
  triggerGranolaSync: () => void;
  firefliesManualSyncTrigger: number;
  triggerFirefliesSync: () => void;
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;

  loadData: () => Promise<void>;

  setManualOrder: (order: string[]) => void;
  setActiveProject: (id: string | null) => void;
  setActiveChannel: (id: string) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  toggleVoice: () => void;
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'audioNotes' | 'attachments'>) => Promise<void>;
  addComment: (taskId: string, body: string) => void;
  updateTask: (id: string, u: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (id: string, u: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  restoreProject: (id: string) => void;
  permanentDeleteProject: (id: string) => void;
  emptyTrash: () => void;
  addUser: (email: string, name?: string) => User;
  addContact: (c: Omit<Contact, 'id' | 'meetings' | 'linkedTaskIds' | 'relationshipTagIds'>) => void;
  updateContact: (id: string, u: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  addChannel: (channel: Omit<Channel, 'id'>) => void;
  updateChannel: (id: string, u: Partial<Channel>) => void;
  deleteChannel: (id: string) => void;
  restoreChannel: (id: string) => void;
  permanentlyDeleteChannel: (id: string) => void;
  sendMessage: (channelId: string, body: string, attachments?: { name: string; url: string; type: string }[], priority?: import('../types').MessagePriority) => void;
  updateMessage: (id: string, body: string) => void;
  setMessagePriority: (id: string, priority: import('../types').MessagePriority | null, isReceiver?: boolean) => void;
  moveMessage: (id: string, targetChannelId: string) => void;
  deleteMessage: (id: string) => void;
  replyToMessage: (parentId: string, channelId: string, body: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  pinMessage: (messageId: string, channelId: string) => void;
  unpinMessage: (messageId: string, channelId: string) => void;
  addUserFlag: (flag: Omit<UserFlag, 'id'>) => void;
  updateUserFlag: (flagId: string, changes: Partial<Omit<UserFlag, 'id'>>) => void;
  removeUserFlag: (flagId: string) => void;
  userStatuses: Record<string, string>;
  setUserStatus: (userId: string, status: string) => void;
  sections: Section[];
  addSection: (s: Omit<Section, 'id'>) => void;
  updateSection: (id: string, u: Partial<Section>) => void;
  deleteSection: (id: string) => void;

  // Meeting notes
  meetings: Meeting[];
  addMeeting: (m: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Meeting>;
  updateMeeting: (id: string, u: Partial<Meeting>) => Promise<void>;
  upsertMeeting: (m: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'> & { externalId: string; provider: string }) => Promise<Meeting>;

  // User settings (API keys, sync timestamps)
  userSettings: UserSettings | null;
  loadUserSettings: () => Promise<void>;
  saveUserSettings: (s: Partial<UserSettings>) => Promise<void>;

  // Workspace pages
  pages: HivePage[];
  addPage: (p: Partial<HivePage>) => Promise<HivePage>;
  updatePage: (id: string, u: Partial<HivePage>) => Promise<void>;
  deletePage: (id: string) => Promise<void>;

  // Invitations
  invitations: Invitation[];
  sendInvitation: (type: 'project' | 'channel', resourceId: string, resourceName: string, invitedUserId: string) => Promise<void>;
  respondToInvitation: (invitationId: string, accept: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStore = create<AppStore>()((set, get) => ({
  currentUser: PLACEHOLDER_USER,
  users: [PLACEHOLDER_USER],
  projects: [],
  trashedProjects: [],
  tasks: [],
  trashedTasks: [],
  contacts: [],
  notifications: [],
  invitations: [],
  channels: CHANNELS,
  messages: [],
  sections: [],
  meetings: [],
  pages: [],
  userSettings: null,
  activeChannelId: null,
  activeProjectId: null,
  sidebarOpen: true,
  darkMode: true,
  voiceOpen: false,
  manualOrder: [],
  isLoading: false,
  granolaManualSyncTrigger: 0,
  triggerGranolaSync: () => set(s => ({ granolaManualSyncTrigger: s.granolaManualSyncTrigger + 1 })),
  firefliesManualSyncTrigger: 0,
  triggerFirefliesSync: () => set(s => ({ firefliesManualSyncTrigger: s.firefliesManualSyncTrigger + 1 })),
  userStatuses: {},
  toasts: [],
  addToast: (type, message) => {
    const id = Math.random().toString(36).slice(2);
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // -------------------------------------------------------------------------
  // loadData — fetch everything from Supabase and replace local state
  // -------------------------------------------------------------------------
  loadData: async () => {
    // Prevent concurrent loadData calls (e.g. SIGNED_IN + INITIAL_SESSION firing together)
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      // Use getSession (reads from localStorage, no network call) to reliably get the current user
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user ?? null;

      // If no auth user, clear everything and bail out early
      if (!authUser) {
        set({ isLoading: false, projects: [], trashedProjects: [], tasks: [], trashedTasks: [], channels: CHANNELS, messages: [], meetings: [], pages: [] });
        return;
      }

      const uid = authUser.id;

      // Optimistically set currentUser from auth metadata immediately.
      // This unblocks the UI so it can render before Supabase queries complete.
      // The profile will be refined with DB data once Phase 1 finishes.
      const derivedNameEarly = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
      if (get().currentUser.id === '__loading__') {
        set({ currentUser: { id: uid, name: derivedNameEarly, email: authUser.email ?? '', role: 'owner', flags: DEFAULT_FLAGS } });
      }

      // Phase 1 — user-scoped queries with no cross-table dependencies
      const [
        tasksRes,
        trashedTasksRes,
        projectsRes,
        trashedProjectsRes,
        contactsRes,
        channelsRes,
        notificationsRes,
        prefsRes,
        meetingsRes,
        settingsRes,
        pagesRes,
        invitationsRes,
      ] = await Promise.allSettled([
        supabase.from('tasks').select('*').contains('assignee_ids', [uid]).is('deleted_at', null).order('created_at', { ascending: true }),
        supabase.from('tasks').select('*').contains('assignee_ids', [uid]).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('projects').select('*').contains('member_ids', [uid]).is('deleted_at', null).order('created_at', { ascending: true }),
        supabase.from('projects').select('*').contains('member_ids', [uid]).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('contacts').select('*').eq('user_id', uid),
        supabase.from('channels').select('*').contains('member_ids', [uid]),
        supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('user_preferences').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('meetings').select('*').eq('user_id', uid).order('date', { ascending: false }),
        supabase.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('pages').select('*').eq('user_id', uid).order('updated_at', { ascending: false }),
        supabase.from('invitations').select('*').eq('invited_user_id', uid).eq('status', 'pending'),
      ]).then(results => results.map((r, i) => {
        if (r.status === 'rejected') { console.error(`loadData phase1 query ${i} failed:`, r.reason); return { data: null, error: r.reason }; }
        return r.value;
      }));

      // Phase 2 — queries that depend on channel/project membership (must run after phase 1)
      // Messages filtered to only the user's channels; profiles loaded for all collaborators.
      const phase1Channels = channelsRes.data ?? [];
      const phase1ChannelIds = phase1Channels.map((c: any) => c.id as string);
      const phase1Projects = projectsRes.data ?? [];
      const allCollaboratorIds = new Set<string>([
        ...phase1Channels.flatMap((c: any) => c.member_ids ?? []),
        ...phase1Projects.flatMap((p: any) => p.member_ids ?? []),
        uid,
      ]);

      const [messagesRes, profilesRes] = await Promise.allSettled([
        phase1ChannelIds.length > 0
          ? supabase.from('messages').select('*').in('channel_id', phase1ChannelIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase.from('profiles').select('*').in('id', Array.from(allCollaboratorIds)),
      ]).then(results => results.map((r, i) => {
        if (r.status === 'rejected') { console.error(`loadData phase2 query ${i} failed:`, r.reason); return { data: null, error: r.reason }; }
        return r.value;
      }));

      const updates: Partial<AppStore> = { isLoading: false };

      // Build users list + set currentUser from profiles
      // Always ensure currentUser.id matches the real auth UUID so new data is saved with the right owner
      const myProfile = (profilesRes.data ?? []).find((p: any) => p.id === uid);
      if (myProfile) {
        updates.currentUser = dbToUser(myProfile);
      } else {
        // Profile missing — upsert it so it exists for next time, and use auth identity now
        const derivedName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
        supabase.from('profiles').upsert({
          id: uid,
          name: derivedName,
          email: authUser.email ?? '',
          role: 'owner',
        }).then(({ error }) => { if (error) console.error('profile upsert error:', error); });
        updates.currentUser = { id: uid, name: derivedName, email: authUser.email ?? '', role: 'owner', flags: DEFAULT_FLAGS };
      }
      // Only expose profiles for users who share a channel — already filtered at DB level above
      if (profilesRes.data && profilesRes.data.length > 0) {
        updates.users = profilesRes.data.map(dbToUser);
      }

      // Map projects — if deleted_at column doesn't exist yet, fall back to all projects
      if (projectsRes.data) {
        updates.projects = projectsRes.data.map(dbToProject);
        updates.trashedProjects = (trashedProjectsRes.data ?? []).map(dbToProject);
      } else {
        // Migration not yet run — fetch all projects without deleted_at filter
        const { data: allProjects } = await supabase.from('projects').select('*').contains('member_ids', [uid]).order('created_at', { ascending: true });
        updates.projects = (allProjects ?? []).map(dbToProject);
        updates.trashedProjects = [];
      }

      // Map tasks — same fallback pattern
      if (tasksRes.data) {
        updates.tasks = tasksRes.data.map(dbToTask);
        updates.trashedTasks = (trashedTasksRes.data ?? []).map(dbToTask);
      } else {
        const { data: allTasks } = await supabase.from('tasks').select('*').contains('assignee_ids', [uid]).order('created_at', { ascending: true });
        updates.tasks = (allTasks ?? []).map(dbToTask);
        updates.trashedTasks = [];
      }
      let userChannels = channelsRes.data ?? [];

      // If no channels returned, ensure a default general channel exists for this user.
      // Use ignoreDuplicates: true so we never overwrite member_ids on an existing general channel.
      if (userChannels.length === 0) {
        const { data: existingGeneral } = await supabase.from('channels').select('id, member_ids').eq('id', 'general').maybeSingle();
        if (!existingGeneral) {
          // Channel doesn't exist yet — create it
          await supabase.from('channels').insert({
            id: 'general',
            name: 'general',
            type: 'channel',
            member_ids: [uid],
            description: 'General updates and announcements',
            pinned_message_ids: [],
            muted: false,
            read_by: {},
          });
          userChannels = [{ id: 'general', name: 'general', type: 'channel', member_ids: [uid], description: 'General updates and announcements', pinned_message_ids: [], muted: false, read_by: {} }];
        } else if (!existingGeneral.member_ids.includes(uid)) {
          // Channel exists but user is not a member — add them
          const updated = [...existingGeneral.member_ids, uid];
          await supabase.from('channels').update({ member_ids: updated }).eq('id', 'general');
          userChannels = [{ ...existingGeneral, member_ids: updated }];
        } else {
          // Already a member — just use the existing channel
          userChannels = [existingGeneral];
        }
      }
      updates.channels = userChannels.map(dbToChannel);

      // Reset activeChannelId if it points to a channel not in the list
      const channelIds = new Set(userChannels.map((c: any) => c.id));
      if (!channelIds.has(get().activeChannelId)) {
        updates.activeChannelId = userChannels[0]?.id ?? null;
      }

      // Messages already filtered to this user's channels at DB level (phase 2 query)
      updates.messages = (messagesRes.data ?? []).map(dbToMessage);

      if (contactsRes.data && contactsRes.data.length > 0) {
        updates.contacts = contactsRes.data.map(dbToContact);
      }
      if (notificationsRes.data) {
        updates.notifications = notificationsRes.data.map(dbToNotification);
      }

      if (prefsRes.data?.manual_order) {
        updates.manualOrder = prefsRes.data.manual_order;
      }

      updates.meetings = (meetingsRes.data ?? []).map(dbToMeeting);

      if (settingsRes.data) {
        updates.userSettings = dbToUserSettings(settingsRes.data);
      }

      updates.pages = (pagesRes.data ?? []).map(dbToPage);
      updates.invitations = (invitationsRes.data ?? []).map(dbToInvitation);

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
    supabase.from('channels').insert(channelToDb(newChannel))
      .then(({ error }) => { if (error) console.error('addChannel error:', error); });
  },

  updateChannel: (id, u) => {
    const prev = get().channels.find(c => c.id === id);
    set((s) => ({ channels: s.channels.map(c => c.id === id ? { ...c, ...u } : c) }));
    const updated = get().channels.find(c => c.id === id);
    const dbFields: Record<string, any> = {};
    if ('description' in u) dbFields.description = u.description ?? null;
    if ('pinnedMessageIds' in u) dbFields.pinned_message_ids = u.pinnedMessageIds ?? [];
    if ('muted' in u) dbFields.muted = u.muted ?? false;
    if ('readBy' in u) dbFields.read_by = u.readBy ?? {};
    if ('deletedAt' in u) dbFields.deleted_at = u.deletedAt ?? null;
    if ('memberIds' in u) dbFields.member_ids = u.memberIds ?? [];
    if (Object.keys(dbFields).length > 0) {
      supabase.from('channels').update(dbFields).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateChannel error:', error); });
    }
    // Fire notifications for newly added members
    if (u.memberIds && prev) {
      const newMemberIds = u.memberIds.filter(mid => !prev.memberIds.includes(mid));
      const { addNotification } = get();
      newMemberIds.forEach(mid => {
        addNotification({
          type: 'mention',
          title: `You were added to #${updated?.name ?? 'a channel'}`,
          body: 'You can now see messages in this channel.',
          userId: mid,
        });
      });
    }
  },

  deleteChannel: (id) => {
    const now = new Date().toISOString();
    set((s) => ({
      channels: s.channels.map(c => c.id === id ? { ...c, deletedAt: now } : c),
      activeChannelId: s.activeChannelId === id
        ? (s.channels.find(c => c.id !== id && !c.deletedAt)?.id ?? s.activeChannelId)
        : s.activeChannelId,
    }));
    supabase.from('channels').update({ deleted_at: now }).eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteChannel error:', error); });
  },

  restoreChannel: (id) => {
    set((s) => ({
      channels: s.channels.map(c => c.id === id ? { ...c, deletedAt: undefined } : c),
    }));
    supabase.from('channels').update({ deleted_at: null }).eq('id', id)
      .then(({ error }) => { if (error) console.error('restoreChannel error:', error); });
  },

  permanentlyDeleteChannel: (id) => {
    set((s) => ({
      channels: s.channels.filter(c => c.id !== id),
      messages: s.messages.filter(m => m.channelId !== id),
    }));
    supabase.from('messages').delete().eq('channel_id', id)
      .then(() => supabase.from('channels').delete().eq('id', id))
      .then(({ error }) => { if (error) console.error('permanentlyDeleteChannel error:', error); });
  },

  setUserStatus: (userId, status) => set((s) => ({ userStatuses: { ...s.userStatuses, [userId]: status } })),

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------
  addSection: (s) => {
    const newSection: Section = { ...s, id: uid() };
    set((state) => ({ sections: [...state.sections, newSection] }));
  },
  updateSection: (id, u) => set((s) => ({
    sections: s.sections.map(sec => sec.id === id ? { ...sec, ...u } : sec),
  })),
  deleteSection: (id) => set((s) => ({
    sections: s.sections.filter(sec => sec.id !== id),
    // Remove sectionId from tasks that belonged to this section
    tasks: s.tasks.map(t => t.sectionId === id ? { ...t, sectionId: undefined } : t),
  })),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  toggleVoice: () => set((s) => ({ voiceOpen: !s.voiceOpen })),

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  addTask: async (task) => {
    // Get the real auth UUID — don't trust currentUser.id if it's still the placeholder
    let realUid = get().currentUser?.id;
    if (!realUid || realUid === '__loading__') {
      const { data: { session } } = await supabase.auth.getSession();
      realUid = session?.user?.id ?? realUid;
    }
    let assigneeIds = task.assigneeIds.map(id =>
      (id === '__loading__' && realUid && realUid !== '__loading__') ? realUid : id
    );
    // Always ensure at least the current user is assigned so loadData can find the task
    if (assigneeIds.length === 0 && realUid) assigneeIds = [realUid];
    const calDefault = get().userSettings?.calendarDefaultSync ?? false;
    const newTask: Task = {
      ...task,
      assigneeIds,
      id: uid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
      audioNotes: [],
      attachments: [],
      calendarSync: task.calendarSync ?? calDefault,
    };
    // Optimistic update
    set((s) => ({ tasks: [...s.tasks, newTask] }));
    // Persist
    supabase.from('tasks').insert(taskToDb(newTask))
      .then(({ error }) => {
        if (error) {
          console.error('addTask error:', error);
          get().addToast('error', 'Failed to save task. Check your connection and try again.');
        }
      });
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
    // Auto-clear reminder when task is marked done (prevents ghost notifications)
    const finalUpdate = (u.status === 'done' && prev?.status !== 'done' && prev?.reminderAt)
      ? { ...u, reminderAt: undefined, reminderSent: undefined }
      : u;
    const tasks = s.tasks.map((t) => t.id === id ? { ...t, ...finalUpdate, updatedAt: ts } : t);
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
        .then(({ error }) => { if (error) { console.error('updateTask error:', error); get().addToast('error', 'Failed to save task changes.'); } });
    }
    if (newRecurring.length > 0) {
      supabase.from('tasks').insert(newRecurring.map(taskToDb))
        .then(({ error }) => { if (error) console.error('addRecurring error:', error); });
    }
    if (nn.length > 0) {
      supabase.from('notifications').insert(nn.map(notificationToDb))
        .then(({ error }) => { if (error) console.error('notification insert error:', error); });
    }

    return { tasks: [...tasks, ...newRecurring], notifications: [...nn, ...s.notifications] };
  }),

  deleteTask: (id) => {
    const now = new Date().toISOString();
    const task = get().tasks.find(t => t.id === id);
    if (!task) return;
    const trashed: Task = { ...task, deletedAt: now };
    set((s) => ({
      tasks: s.tasks.filter(t => t.id !== id),
      trashedTasks: [trashed, ...s.trashedTasks],
    }));
    supabase.from('tasks').update({ deleted_at: now }).eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteTask error:', error); });
  },

  restoreTask: (id) => {
    const task = get().trashedTasks.find(t => t.id === id);
    if (!task) return;
    const restored: Task = { ...task, deletedAt: undefined };
    set((s) => ({
      trashedTasks: s.trashedTasks.filter(t => t.id !== id),
      tasks: [...s.tasks, restored],
    }));
    supabase.from('tasks').update({ deleted_at: null }).eq('id', id)
      .then(({ error }) => { if (error) console.error('restoreTask error:', error); });
  },

  permanentDeleteTask: (id) => {
    set((s) => ({ trashedTasks: s.trashedTasks.filter(t => t.id !== id) }));
    supabase.from('tasks').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('permanentDeleteTask error:', error); });
  },

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------
  addProject: (p) => {
    const newProject: Project = { ...p, id: uid(), createdAt: new Date().toISOString() };
    set((s) => ({ projects: [...s.projects, newProject] }));
    supabase.from('projects').insert(projectToDb(newProject))
      .then(({ error }) => { if (error) { console.error('addProject error:', error); get().addToast('error', 'Failed to save project. Check your connection.'); } });
    // Auto-create a linked channel (skipped for folders and sub-projects).
    // Only add the creator — collaborators are added when they accept their project invitation.
    if (!p.isFolder) {
      const creatorId = get().currentUser.id;
      const newChannel = {
        id: uid(),
        name: p.name,
        type: 'channel' as const,
        memberIds: creatorId && creatorId !== '__loading__' ? [creatorId] : (p.memberIds ?? []),
        projectId: newProject.id,
        hiddenFromSidebar: false,
        pinnedMessageIds: [],
        readBy: {},
      };
      set((s) => ({ channels: [...s.channels, newChannel] }));
      supabase.from('channels').insert(channelToDb(newChannel))
        .then(({ error }) => { if (error) console.error('addChannel (auto) error:', error); });
    }
  },

  updateProject: (id, u) => {
    const prev = get().projects.find(p => p.id === id);
    set((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, ...u } : p) }));
    const updated = get().projects.find(p => p.id === id);
    if (updated) {
      supabase.from('projects').update(projectToDb(updated)).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateProject error:', error); });
    }
    // Fire notifications for newly added members
    if (u.memberIds && prev) {
      const newMemberIds = u.memberIds.filter(mid => !prev.memberIds.includes(mid));
      const { addNotification } = get();
      newMemberIds.forEach(mid => {
        addNotification({
          type: 'assignment',
          title: `You were added to ${updated?.name ?? 'a project'}`,
          body: 'You now have access to this project and its tasks.',
          userId: mid,
          projectId: id,
        });
      });
    }
  },

  deleteProject: (id) => {
    const now = new Date().toISOString();
    const project = get().projects.find(p => p.id === id);
    if (!project) return;

    if (project.isFolder) {
      // Folders: just move child projects out (no trash for folders themselves)
      set(s => ({
        projects: s.projects
          .filter(p => p.id !== id)
          .map(p => p.folderId === id ? { ...p, folderId: undefined } : p),
      }));
      supabase.from('projects').update({ folder_id: null }).eq('folder_id', id);
      supabase.from('projects').delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('deleteProject (folder) error:', error); });
      return;
    }

    // Soft-delete the project
    const trashed: Project = { ...project, deletedAt: now };

    // Also soft-delete all tasks belonging to this project
    const affectedTasks = get().tasks.filter(t => t.projectIds.includes(id));
    const trashedTasks: Task[] = affectedTasks.map(t => ({ ...t, deletedAt: now }));

    set(s => ({
      projects: s.projects.filter(p => p.id !== id),
      trashedProjects: [trashed, ...s.trashedProjects],
      tasks: s.tasks.filter(t => !t.projectIds.includes(id)),
      trashedTasks: [...trashedTasks, ...s.trashedTasks],
    }));

    supabase.from('projects').update({ deleted_at: now }).eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteProject error:', error); });
    if (affectedTasks.length > 0) {
      supabase.from('tasks').update({ deleted_at: now }).in('id', affectedTasks.map(t => t.id))
        .then(({ error }) => { if (error) console.error('deleteProject tasks error:', error); });
    }
  },

  restoreProject: (id) => {
    const project = get().trashedProjects.find(p => p.id === id);
    if (!project) return;
    const restored: Project = { ...project, deletedAt: undefined };
    // Also restore tasks that were soft-deleted when the project was deleted
    const restoredTasks = get().trashedTasks
      .filter(t => t.projectIds.includes(id))
      .map(t => ({ ...t, deletedAt: undefined }));
    const restoredTaskIds = restoredTasks.map(t => t.id);
    set((s) => ({
      trashedProjects: s.trashedProjects.filter(p => p.id !== id),
      projects: [...s.projects, restored],
      trashedTasks: s.trashedTasks.filter(t => !restoredTaskIds.includes(t.id)),
      tasks: [...s.tasks, ...restoredTasks],
    }));
    supabase.from('projects').update({ deleted_at: null }).eq('id', id)
      .then(({ error }) => { if (error) console.error('restoreProject error:', error); });
    if (restoredTaskIds.length > 0) {
      supabase.from('tasks').update({ deleted_at: null }).in('id', restoredTaskIds)
        .then(({ error }) => { if (error) console.error('restoreProject tasks error:', error); });
    }
  },

  permanentDeleteProject: (id) => {
    set((s) => ({ trashedProjects: s.trashedProjects.filter(p => p.id !== id) }));
    supabase.from('projects').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('permanentDeleteProject error:', error); });
  },

  emptyTrash: () => {
    const { trashedProjects, trashedTasks } = get();
    const projectIds = trashedProjects.map(p => p.id);
    const taskIds = trashedTasks.map(t => t.id);
    set({ trashedProjects: [], trashedTasks: [] });
    if (projectIds.length > 0) {
      supabase.from('projects').delete().in('id', projectIds)
        .then(({ error }) => { if (error) console.error('emptyTrash projects error:', error); });
    }
    if (taskIds.length > 0) {
      supabase.from('tasks').delete().in('id', taskIds)
        .then(({ error }) => { if (error) console.error('emptyTrash tasks error:', error); });
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
    // Persist to profiles so the UUID survives a page reload
    if (newUser) {
      supabase.from('profiles').upsert({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.error('addUser profile upsert error:', error); });
    }
    return (existing || newUser)!;
  },

  // -------------------------------------------------------------------------
  // Contacts
  // -------------------------------------------------------------------------
  addContact: (c) => {
    const currentUserId = get().currentUser.id;
    const newContact: Contact = { relationshipTagIds: [], ...c, id: uid(), meetings: [], linkedTaskIds: [] };
    set((s) => ({ contacts: [...s.contacts, newContact] }));
    supabase.from('contacts').insert(contactToDb(newContact, currentUserId))
      .then(({ error }) => { if (error) { console.error('addContact error:', error); get().addToast('error', 'Failed to save contact.'); } });
  },

  updateContact: (id, u) => {
    set((s) => ({ contacts: s.contacts.map((c) => c.id === id ? { ...c, ...u } : c) }));
    const updated = get().contacts.find(c => c.id === id);
    if (updated) {
      supabase.from('contacts').update(contactToDb(updated)).eq('id', id)
        .then(({ error }) => { if (error) { console.error('updateContact error:', error); get().addToast('error', 'Failed to save contact changes.'); } });
    }
  },

  deleteContact: (id) => {
    set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }));
    supabase.from('contacts').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteContact error:', error); });
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
    const { currentUser } = get();
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    supabase.from('notifications').update({ read: true }).eq('read', false).eq('user_id', currentUser.id)
      .then(({ error }) => { if (error) console.error('markAllNotificationsRead error:', error); });
  },

  deleteNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    supabase.from('notifications').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteNotification error:', error); });
  },

  addNotification: (n) => {
    const newN: Notification = { ...n, id: uid(), createdAt: new Date().toISOString(), read: false };
    set((s) => ({ notifications: [newN, ...s.notifications] }));
    supabase.from('notifications').insert(notificationToDb(newN))
      .then(({ error }) => { if (error) console.error('addNotification error:', error); });
  },

  // -------------------------------------------------------------------------
  // Invitations
  // -------------------------------------------------------------------------
  sendInvitation: async (type, resourceId, resourceName, invitedUserId) => {
    const res = await apiFetch('/api/invitations', { action: 'send', type, resourceId, resourceName, invitedUserId });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('sendInvitation error:', err);
    }
  },

  respondToInvitation: async (invitationId, accept) => {
    const invitation = get().invitations.find(i => i.id === invitationId);
    if (!invitation) return;

    // Optimistically remove from local state so the notification disappears immediately
    set(s => ({ invitations: s.invitations.filter(i => i.id !== invitationId) }));
    set(s => ({
      notifications: s.notifications.map(n =>
        n.invitationId === invitationId ? { ...n, read: true } : n
      ),
    }));

    // Delegate to server endpoint which uses service-role key to bypass RLS.
    // This is necessary because the user is not yet a project/channel member
    // when they accept, so client-side updates would fail the members-only RLS policy.
    try {
      const res = await apiFetch('/api/invitations', { action: 'respond', invitationId, accept });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('respondToInvitation error:', err);
      }
    } catch (e) {
      console.error('respondToInvitation fetch error:', e);
    }

    if (accept) {
      // Reload so the newly joined project/channel appears in sidebar
      get().loadData();
    }
  },

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------
  sendMessage: (channelId, body, attachments, priority) => {
    if (body.length > 10000) { console.warn('sendMessage: body too long, truncating'); body = body.slice(0, 10000); }
    const s = get();
    const newMsg: Message = {
      id: uid(),
      channelId,
      authorId: s.currentUser.id,
      body,
      createdAt: new Date().toISOString(),
      reactions: {},
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      ...(priority ? { priority } : {}),
    };
    set((st) => ({ messages: [...st.messages, newMsg] }));
    supabase.from('messages').insert(messageToDb(newMsg))
      .then(({ error }) => { if (error) { console.error('sendMessage error:', error); get().addToast('error', 'Message failed to send. Check your connection.'); } });
  },

  updateMessage: (id, body) => {
    const { currentUser, messages } = get();
    const msg = messages.find(m => m.id === id);
    if (!msg || msg.authorId !== currentUser.id) return; // can only edit own messages
    if (body.length > 10000) body = body.slice(0, 10000);
    const editedAt = new Date().toISOString();
    set((s) => ({
      messages: s.messages.map(m => m.id === id ? { ...m, body, editedAt } : m),
    }));
    supabase.from('messages').update({ body, edited_at: editedAt }).eq('id', id)
      .then(({ error }) => { if (error) console.error('updateMessage error:', error); });
  },

  setMessagePriority: (id, priority, isReceiver = false) => {
    const field = isReceiver ? 'receiverPriority' : 'priority';
    const dbField = isReceiver ? 'receiver_priority' : 'priority';
    set((s) => ({
      messages: s.messages.map(m => m.id === id ? { ...m, [field]: priority ?? undefined } : m),
    }));
    supabase.from('messages').update({ [dbField]: priority ?? null }).eq('id', id)
      .then(({ error }) => { if (error) console.error('setMessagePriority error:', error); });
  },

  moveMessage: (id, targetChannelId) => {
    set((s) => ({
      messages: s.messages.map(m => m.id === id ? { ...m, channelId: targetChannelId } : m),
    }));
    supabase.from('messages').update({ channel_id: targetChannelId }).eq('id', id)
      .then(({ error }) => { if (error) console.error('moveMessage error:', error); });
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
    supabase.from('messages').insert(messageToDb(newMsg))
      .then(({ error }) => { if (error) { console.error('replyToMessage error:', error); get().addToast('error', 'Reply failed to send.'); } });
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

  // -------------------------------------------------------------------------
  // Meetings
  // -------------------------------------------------------------------------
  addMeeting: async (m) => {
    const currentUserId = get().currentUser?.id;
    const newMeeting: Meeting = {
      ...m,
      id: uid(),
      userId: m.userId ?? currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ meetings: [newMeeting, ...s.meetings] }));
    const { error } = await supabase.from('meetings').insert(meetingToDb(newMeeting));
    if (error) console.error('addMeeting error:', error);
    return newMeeting;
  },

  updateMeeting: async (id, u) => {
    const updatedAt = new Date().toISOString();
    set((s) => ({
      meetings: s.meetings.map(m => m.id === id ? { ...m, ...u, updatedAt } : m),
    }));
    const dbFields: Record<string, any> = { updated_at: updatedAt };
    if ('notes' in u) dbFields.notes = u.notes ?? null;
    if ('linkedContactIds' in u) dbFields.linked_contact_ids = u.linkedContactIds ?? [];
    if ('linkedProjectIds' in u) dbFields.linked_project_ids = u.linkedProjectIds ?? [];
    if ('suggestedProjectIds' in u) dbFields.suggested_project_ids = u.suggestedProjectIds ?? [];
    if ('actionItems' in u) dbFields.action_items = u.actionItems ?? [];
    if ('reviewed' in u) dbFields.reviewed = u.reviewed ?? false;
    if ('hasProjectLinks' in u) dbFields.has_project_links = u.hasProjectLinks ?? false;
    if ('transcript' in u) dbFields.transcript = u.transcript ?? null;
    if ('summary' in u) dbFields.summary = u.summary ?? null;
    if ('participantNames' in u) dbFields.participant_names = u.participantNames ?? [];
    if ('participantEmails' in u) dbFields.participant_emails = u.participantEmails ?? [];
    const { error } = await supabase.from('meetings').update(dbFields).eq('id', id);
    if (error) console.error('updateMeeting error:', error);
  },

  upsertMeeting: async (m) => {
    const existing = get().meetings.find(
      x => x.provider === m.provider && x.externalId === m.externalId
    );
    // If exists, update notes/summary/participants in case they changed since last sync
    if (existing) {
      const updates: Partial<Meeting> = {};
      if (m.notes && m.notes !== existing.notes) updates.notes = m.notes;
      if (m.summary && m.summary !== existing.summary) updates.summary = m.summary;
      if (m.participantNames?.length && JSON.stringify(m.participantNames) !== JSON.stringify(existing.participantNames)) updates.participantNames = m.participantNames;
      if (m.participantEmails?.length && JSON.stringify(m.participantEmails) !== JSON.stringify(existing.participantEmails)) updates.participantEmails = m.participantEmails;
      if (Object.keys(updates).length > 0) await get().updateMeeting(existing.id, updates);
      return { ...existing, ...updates };
    }
    return get().addMeeting(m);
  },

  // -------------------------------------------------------------------------
  // User Settings
  // -------------------------------------------------------------------------
  loadUserSettings: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) { console.error('loadUserSettings error:', error); return; }
    if (data) set({ userSettings: dbToUserSettings(data) });
  },

  saveUserSettings: async (s) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date().toISOString();
    const row: Record<string, any> = { user_id: user.id, updated_at: now };
    if ('granolaApiKey' in s) row.granola_api_key = s.granolaApiKey ?? null;
    if ('granolaLastSyncedAt' in s) row.granola_last_synced_at = s.granolaLastSyncedAt ?? null;
    if ('firefliesApiKey' in s) row.fireflies_api_key = s.firefliesApiKey ?? null;
    if ('firefliesLastSyncedAt' in s) row.fireflies_last_synced_at = s.firefliesLastSyncedAt ?? null;
    if ('otterApiKey' in s) row.otter_api_key = s.otterApiKey ?? null;
    if ('otterLastSyncedAt' in s) row.otter_last_synced_at = s.otterLastSyncedAt ?? null;
    if ('googleClientId' in s) row.google_client_id = s.googleClientId ?? null;
    if ('anthropicApiKey' in s) row.anthropic_api_key = s.anthropicApiKey ?? null;
    if ('homeSections' in s) row.home_sections = s.homeSections ?? null;
    if ('relationshipTags' in s) row.relationship_tags = s.relationshipTags ?? null;
    if ('calendarDefaultSync' in s) row.calendar_default_sync = s.calendarDefaultSync ?? false;
    const { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' });
    if (error) { console.error('saveUserSettings error:', error); return; }
    set((st) => ({ userSettings: { ...(st.userSettings ?? { userId: user.id }), ...s } }));
  },

  // ── Workspace pages ──────────────────────────────────────────────────────
  addPage: async (p) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const now = new Date().toISOString();
    const row = {
      user_id: user.id,
      title: p.title ?? 'Untitled',
      icon: p.icon ?? null,
      content: p.content ?? {},
      parent_id: p.parentId ?? null,
      project_id: p.projectId ?? null,
      template_id: p.templateId ?? null,
      is_template: p.isTemplate ?? false,
      type: p.type ?? 'space',
      sort_order: p.sortOrder ?? 0,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await supabase.from('pages').insert(row).select().single();
    if (error) throw error;
    const newPage = dbToPage(data);
    set((s) => ({ pages: [newPage, ...s.pages] }));
    return newPage;
  },

  updatePage: async (id, u) => {
    const now = new Date().toISOString();
    const row: Record<string, any> = { updated_at: now };
    if ('title' in u) row.title = u.title;
    if ('icon' in u) row.icon = u.icon ?? null;
    if ('content' in u) row.content = u.content;
    if ('parentId' in u) row.parent_id = u.parentId ?? null;
    if ('projectId' in u) row.project_id = u.projectId ?? null;
    if ('sortOrder' in u) row.sort_order = u.sortOrder;
    if ('type' in u) row.type = u.type;
    set((s) => ({
      pages: s.pages.map((pg) => pg.id === id ? { ...pg, ...u, updatedAt: now } : pg),
    }));
    const { error } = await supabase.from('pages').update(row).eq('id', id);
    if (error) console.error('updatePage error:', error);
  },

  deletePage: async (id) => {
    set((s) => ({ pages: s.pages.filter((pg) => pg.id !== id) }));
    const { error } = await supabase.from('pages').delete().eq('id', id);
    if (error) console.error('deletePage error:', error);
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

// Re-load when auth state changes (login/logout/session restore).
// INITIAL_SESSION fires on hard refresh when the session is restored from localStorage.
// isLoading guard in loadData prevents concurrent calls if both the module-level getSession()
// and this handler fire at the same time.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    useStore.getState().loadData();
  }
  if (event === 'SIGNED_OUT') {
    useStore.setState({
      tasks: [],
      projects: [],
      contacts: [],
      channels: CHANNELS,
      messages: [],
      notifications: [],
      users: [PLACEHOLDER_USER],
      currentUser: PLACEHOLDER_USER,
      manualOrder: [],
      meetings: [],
      userSettings: null,
    });
  }
});

// ---------------------------------------------------------------------------
// Real-time subscriptions — messages appear instantly for all users
// Guard: only accept events for channels the current user is a member of.
// RLS enforces this at the DB level too; this is defense-in-depth.
// ---------------------------------------------------------------------------
supabase
  .channel('messages-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
    const newMsg = dbToMessage(payload.new);
    const state = useStore.getState();
    // Only accept messages from channels this user belongs to
    const userChannelIds = new Set(state.channels.map(c => c.id));
    if (!userChannelIds.has(newMsg.channelId)) return;
    // Skip if we already have this message (sent by current user, already in state)
    if (state.messages.some(m => m.id === newMsg.id)) return;
    useStore.setState((s) => ({ messages: [...s.messages, newMsg] }));
  })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
    const updated = dbToMessage(payload.new);
    const state = useStore.getState();
    const userChannelIds = new Set(state.channels.map(c => c.id));
    if (!userChannelIds.has(updated.channelId)) return;
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
