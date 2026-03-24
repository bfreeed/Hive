/**
 * Centralized localStorage key helpers.
 * Use these instead of hardcoding key strings across the codebase.
 */

export const getPushoverKey = (userId: string) => `pushover_user_key_${userId}`;
export const getReminderLockKey = (taskId: string) => `reminder_lock_${taskId}`;
export const getHealthNotifKey = (userId: string, type: string, taskId: string, date: string) =>
  `health_notif_${userId}_${type}_${taskId}_${date}`;
export const getBriefingKey = (userId: string, date: string) => `briefing_sent_${userId}_${date}`;

export const GOOGLE_CLIENT_ID_KEY = 'google_client_id';
export const GOOGLE_API_KEY_KEY = 'google_api_key';
export const SIDEBAR_NAV_ORDER_KEY = 'sidebar-nav-order';
export const SIDEBAR_PROJECT_ORDER_KEY = 'sidebar-project-order';
