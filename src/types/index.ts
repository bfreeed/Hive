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
  reminderAt?: string;    // ISO datetime — when to send the SMS reminder
  reminderSent?: boolean; // true after SMS has been fired, prevents double-send
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

export interface Meeting {
  id: string;
  contactId: string;
  title: string;
  date: string;
  notes: string;
  source?: 'granola' | 'manual';
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

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  createdAt: string;
  reactions: Record<string, string[]>;
  attachments?: { name: string; url: string; type: string }[];
  editedAt?: string;
  parentId?: string;
}
