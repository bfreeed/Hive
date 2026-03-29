export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'review' | 'done';
export type ViewType = 'list' | 'board' | 'calendar' | 'mindmap';
export type GroupBy = 'project' | 'priority' | 'dueDate' | 'status' | 'label' | 'assignee';

export interface UserFlag {
  id: string;
  name: string;
  color: string;
}

export interface TaskFlag {
  flagId: string;
  appliedBy: string; // userId
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'assistant' | 'collaborator';
  flags: UserFlag[];
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  audioUrl?: string;
  createdAt: string;
  mentions: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projectIds: string[];
  status: TaskStatus;
  priority: Priority;
  assigneeIds: string[];
  dueDate?: string;
  dueTime?: string;
  dueTimeEnd?: string;
  calendarEventId?: string;
  calendarShowAs?: 'free' | 'busy';
  calendarSync?: boolean;
  calendarId?: string; // which Google Calendar to sync to (defaults to 'primary')
  snoozeDate?: string;
  waitDate?: string;
  label?: string;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'custom';
  isPrivate: boolean;
  flags: TaskFlag[];
  linkedContactIds: string[];
  linkedDocIds: string[];
  comments: Comment[];
  audioNotes: AudioNote[];
  attachments: Attachment[];
  reminderAt?: string;    // ISO datetime — when to send the Pushover notification
  reminderSent?: boolean; // true after notification has been fired, prevents double-send
  parentId?: string;      // subtask: ID of parent task
  sectionId?: string;     // which project section this task belongs to
  dependsOn?: string[];   // IDs of tasks that must be done before this one
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AudioNote {
  id: string;
  url: string;
  duration: number;
  transcript?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  source?: 'upload' | 'google_drive';
  driveId?: string;
  createdAt: string;
}

export interface Section {
  id: string;
  name: string;
  projectId: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  status: 'active' | 'on-hold' | 'completed';
  memberIds: string[];
  isPrivate: boolean;
  createdAt: string;
  docs?: Attachment[];
  docContent?: any;
  parentId?: string; // sub-project support: ID of the parent project
  // Google Drive
  googleDriveFolderId?: string;
  googleDriveFolderName?: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  projectIds: string[];
  notes?: string;
  bookingLink?: string;
  meetings: Meeting[];
  linkedTaskIds: string[];
}

export interface ActionItem {
  id: string;
  text: string;
  taskId?: string;      // set once converted to a Task
  accepted: boolean;
  dismissed: boolean;
}

export interface Meeting {
  id: string;
  contactId: string;    // kept for backward-compat with Contact.meetings[]
  title: string;
  date: string;
  notes: string;
  source?: 'granola' | 'manual'; // legacy field — use provider going forward

  // Provider sync fields
  externalId?: string;  // provider's own note ID — dedup key with (provider, externalId)
  provider?: 'granola' | 'fireflies' | 'otter' | 'native' | 'manual';
  transcript?: string;
  summary?: string;
  participantNames?: string[];
  participantEmails?: string[];

  // Linking fields
  linkedContactIds?: string[];
  linkedProjectIds?: string[];
  suggestedProjectIds?: string[];  // AI-suggested, not yet accepted

  // Review workflow
  actionItems?: ActionItem[];
  hasProjectLinks?: boolean;
  reviewed?: boolean;   // false = badge shown; true = user has reviewed

  // Metadata
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomeSection {
  id: 'inbox' | 'unreviewed_meetings' | 'within_72h' | 'overdue' | 'today' | 'high_priority' | 'upcoming' | 'questions' | 'sarahs_updates';
  enabled: boolean;
  label: string;
}

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  { id: 'inbox',              enabled: true,  label: 'Inbox' },
  { id: 'unreviewed_meetings',enabled: true,  label: 'Meetings to Review' },
  { id: 'within_72h',         enabled: true,  label: 'Within 72 Hours' },
  { id: 'overdue',            enabled: true,  label: 'Overdue' },
  { id: 'today',              enabled: true,  label: 'Due Today' },
  { id: 'high_priority',      enabled: true,  label: 'High Priority' },
  { id: 'upcoming',           enabled: true,  label: 'Coming Up' },
  { id: 'questions',          enabled: true,  label: 'Questions for Me' },
  { id: 'sarahs_updates',     enabled: true,  label: "Sarah's Updates" },
];

export interface UserSettings {
  userId: string;
  // Granola
  granolaApiKey?: string;
  granolaLastSyncedAt?: string;
  // Fireflies
  firefliesApiKey?: string;
  firefliesLastSyncedAt?: string;
  // Otter
  otterApiKey?: string;
  otterLastSyncedAt?: string;
  // Google Drive OAuth client ID
  googleClientId?: string;
  // Home layout
  homeSections?: HomeSection[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  taskId?: string;
  projectId?: string;
  read: boolean;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  memberIds: string[];
  description?: string;
  lastReadAt?: string;
  pinnedMessageIds?: string[];
  muted?: boolean;
  readBy?: Record<string, string>; // userId → ISO timestamp of last read
  deletedAt?: string; // soft delete — set when channel is "deleted", cleared on restore
}

export type MessagePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  createdAt: string;
  reactions: Record<string, string[]>;
  attachments?: { name: string; url: string; type: string; duration?: number }[];
  editedAt?: string;
  parentId?: string;
  priority?: MessagePriority;
  receiverPriority?: MessagePriority;
}

// ── Workspace Pages ──────────────────────────────────────────────
export interface HivePage {
  id: string;
  userId: string;
  title: string;
  icon?: string;
  content: any; // TipTap JSON
  parentId?: string;
  projectId?: string;
  templateId?: string;
  isTemplate: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  content: any; // TipTap JSON
}
