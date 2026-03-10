/**
 * ZM Notifications API
 *
 * Manages FCM push token registration via ZoneMinder's Notifications REST API.
 * Used in Direct ZM notification mode (no Event Server websocket needed).
 * See ZoneMinder PR #4685 for server-side implementation.
 */

import { getApiClient } from './client';
import { log, LogLevel } from '../lib/logger';

export interface ZMNotification {
  Id: number;
  UserId: number | null;
  Token: string;
  Platform: 'android' | 'ios' | 'web';
  MonitorList: string | null;
  Interval: number;
  PushState: 'enabled' | 'disabled';
  AppVersion: string | null;
  BadgeCount: number;
  LastNotifiedAt: string | null;
  CreatedOn: string;
  UpdatedOn: string;
}

interface NotificationResponse {
  notification: { Notification: ZMNotification };
}

interface NotificationsListResponse {
  notifications: { Notification: ZMNotification }[];
}

/**
 * Register or upsert an FCM token with the ZM server.
 * If the token already exists, updates the existing row.
 */
export async function registerToken(params: {
  token: string;
  platform: 'android' | 'ios' | 'web';
  monitorList?: string;
  interval?: number;
  pushState?: 'enabled' | 'disabled';
  appVersion?: string;
  profile?: string;
}): Promise<ZMNotification> {
  log.api('Registering notification token via ZM API', LogLevel.INFO, {
    platform: params.platform,
    profile: params.profile,
  });

  const client = getApiClient();
  const formData = new URLSearchParams();
  formData.append('Notification[Token]', params.token);
  formData.append('Notification[Platform]', params.platform);
  if (params.monitorList !== undefined) formData.append('Notification[MonitorList]', params.monitorList);
  if (params.interval !== undefined) formData.append('Notification[Interval]', String(params.interval));
  if (params.pushState) formData.append('Notification[PushState]', params.pushState);
  if (params.appVersion) formData.append('Notification[AppVersion]', params.appVersion);
  if (params.profile) formData.append('Notification[Profile]', params.profile.slice(0, 128));

  const resp = await client.post<NotificationResponse>('/notifications.json', formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return resp.data.notification.Notification;
}

/**
 * Update an existing notification registration (monitor list, interval, push state).
 * Only send fields you want to change.
 */
export async function updateNotification(
  id: number,
  params: Partial<{
    monitorList: string;
    interval: number;
    pushState: 'enabled' | 'disabled';
    badgeCount: number;
  }>
): Promise<ZMNotification> {
  log.api('Updating notification via ZM API', LogLevel.INFO, { id });

  const client = getApiClient();
  const formData = new URLSearchParams();
  if (params.monitorList !== undefined) formData.append('Notification[MonitorList]', params.monitorList);
  if (params.interval !== undefined) formData.append('Notification[Interval]', String(params.interval));
  if (params.pushState !== undefined) formData.append('Notification[PushState]', params.pushState);
  if (params.badgeCount !== undefined) formData.append('Notification[BadgeCount]', String(params.badgeCount));

  const resp = await client.put<NotificationResponse>(`/notifications/${id}.json`, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return resp.data.notification.Notification;
}

/**
 * Delete a notification registration.
 */
export async function deleteNotification(id: number): Promise<void> {
  log.api('Deleting notification via ZM API', LogLevel.INFO, { id });

  const client = getApiClient();
  await client.delete(`/notifications/${id}.json`);
}

/**
 * List all notification registrations for the current user.
 */
export async function listNotifications(): Promise<ZMNotification[]> {
  const client = getApiClient();
  const resp = await client.get<NotificationsListResponse>('/notifications.json');
  return resp.data.notifications.map(n => n.Notification);
}

/**
 * Check if the ZM server supports the Notifications API.
 * Returns true on 200 (even if empty list), false on 404.
 */
export async function checkNotificationsApiSupport(): Promise<boolean> {
  try {
    const client = getApiClient();
    await client.get('/notifications.json');
    return true;
  } catch (e: unknown) {
    const error = e as { status?: number; response?: { status?: number } };
    if (error?.status === 404 || error?.response?.status === 404) return false;
    throw e;
  }
}
