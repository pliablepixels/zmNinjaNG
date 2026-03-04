/**
 * Mobile Push Notifications Service
 *
 * Handles FCM push notifications for mobile platforms (iOS/Android)
 * Uses @capacitor-firebase/messaging to get FCM tokens on both platforms.
 * Integrates with ZoneMinder event notification server.
 */

import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import type { Notification } from '@capacitor-firebase/messaging';
import { log, LogLevel } from '../lib/logger';
import { navigationService } from '../lib/navigation';
import { useNotificationStore } from '../stores/notifications';
import { useProfileStore } from '../stores/profile';
import { useAuthStore } from '../stores/auth';

/**
 * Data payload sent by zmeventnotification server via FCM.
 * ES sends mid (monitor ID), eid (event ID), and since ES 7.x+
 * also monitorName and cause as structured fields.
 */
export interface PushNotificationData {
  mid?: string;
  eid?: string;
  monitorName?: string;
  cause?: string;
  notification_foreground?: string;
}

export class MobilePushService {
  private isInitialized = false;
  private currentToken: string | null = null;

  /**
   * Initialize push notifications (mobile only)
   */
  public async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      log.push('Push notifications not available on web platform', LogLevel.INFO);
      return;
    }

    log.push('Initializing push notifications', LogLevel.INFO);

    try {
      // Request permission
      const permissionResult = await FirebaseMessaging.requestPermissions();

      if (permissionResult.receive === 'granted') {
        log.push('Push notification permission granted', LogLevel.INFO);

        // Setup listeners BEFORE requesting token to ensure we catch token refreshes
        if (!this.isInitialized) {
          this._setupListeners();
          this.isInitialized = true;
        }

        // Get current FCM token
        log.push('Requesting FCM token via getToken()', LogLevel.INFO);
        try {
          const result = await FirebaseMessaging.getToken();
          this.currentToken = result.token;
          this.hasRetried = false;

          log.push('FCM token received', LogLevel.INFO, {
            token: result.token.substring(0, 20) + '...',
          });

          // Register token with ZM notification server
          this._registerWithServer(result.token);
        } catch (tokenError) {
          log.push('FCM token request failed', LogLevel.ERROR, tokenError);

          if (!this.hasRetried) {
            this.hasRetried = true;
            log.push('Retrying FCM token request once after 5s...', LogLevel.INFO);

            setTimeout(async () => {
              try {
                const retryResult = await FirebaseMessaging.getToken();
                this.currentToken = retryResult.token;

                log.push('FCM token received on retry', LogLevel.INFO, {
                  token: retryResult.token.substring(0, 20) + '...',
                });

                this._registerWithServer(retryResult.token);
              } catch (e) {
                log.push('FCM token retry failed', LogLevel.ERROR, e);
              }
            }, 5000);
          }
        }

        log.push('Push notifications initialized successfully', LogLevel.INFO);
      } else {
        log.push('Push notification permission denied', LogLevel.WARN, {
          receive: permissionResult.receive,
        });
      }
    } catch (error) {
      log.push('Failed to initialize push notifications', LogLevel.ERROR, error);
      throw error;
    }
  }

  /**
   * Get current FCM token
   */
  public getToken(): string | null {
    return this.currentToken;
  }

  /**
   * Check if push notifications are initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.currentToken !== null;
  }

  /**
   * Register token with notification server if connected
   * Can be called after connection is established
   */
  public async registerTokenWithServer(): Promise<void> {
    if (!this.currentToken) {
      log.push('No FCM token available to register', LogLevel.WARN);
      return;
    }

    await this._registerWithServer(this.currentToken);
  }

  /**
   * Deregister from push notifications and notify server
   */
  public async deregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (!this.currentToken) {
      log.push('No FCM token to deregister', LogLevel.INFO);
      return;
    }

    log.push('Deregistering from push notifications', LogLevel.INFO);

    try {
      // Send disabled state to server if connected
      const notificationStore = useNotificationStore.getState();
      if (notificationStore.isConnected) {
        const platform = Capacitor.getPlatform() as 'ios' | 'android';
        log.push('Sending disabled state to notification server', LogLevel.INFO, { platform });
        await notificationStore.deregisterPushToken(this.currentToken, platform);
      }

      // Unregister locally
      await this._unregister();
    } catch (error) {
      log.push('Failed to deregister from push notifications', LogLevel.ERROR, error);
      throw error;
    }
  }

  /**
   * Unregister from push notifications (local only)
   */
  private async _unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    log.push('Unregistering from push notifications locally', LogLevel.INFO);

    try {
      // Remove all listeners
      await FirebaseMessaging.removeAllListeners();

      // Delete FCM token
      await FirebaseMessaging.deleteToken();

      // Clear token
      this.currentToken = null;
      this.isInitialized = false;

      log.push('Unregistered from push notifications', LogLevel.INFO);
    } catch (error) {
      log.push('Failed to unregister from push notifications', LogLevel.ERROR, error);
    }
  }

  // Single retry flag to prevent infinite retry loops
  private hasRetried = false;

  // ========== PRIVATE METHODS ==========

  private _setupListeners(): void {
    // Called when FCM token is refreshed
    FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
      log.push('FCM token refreshed', LogLevel.INFO, {
        token: token.substring(0, 20) + '...',
      });

      this.currentToken = token;
      this.hasRetried = false;

      // Register refreshed token with ZM notification server
      this._registerWithServer(token);
    });

    // Called when notification is received while app is in foreground
    FirebaseMessaging.addListener(
      'notificationReceived',
      ({ notification }) => {
        log.push('Push notification received (foreground)', LogLevel.INFO, {
          title: notification.title,
          body: notification.body,
          data: notification.data,
        });

        // Handle the notification data
        this._handleNotification(notification);
      }
    );

    // Called when user taps on notification
    FirebaseMessaging.addListener(
      'notificationActionPerformed',
      ({ notification }) => {
        log.push('Push notification action performed', LogLevel.INFO, {
          notification,
        });

        // Handle the tap action
        this._handleNotificationAction(notification);
      }
    );
  }

  private async _registerWithServer(token: string): Promise<void> {
    const notificationStore = useNotificationStore.getState();

    if (!notificationStore.isConnected) {
      log.push('Storing FCM token - will register when connected to notification server', LogLevel.INFO);
      return;
    }

    try {
      const platform = Capacitor.getPlatform() as 'ios' | 'android';

      log.push('Registering FCM token with notification server', LogLevel.INFO, {
        platform,
      });

      await notificationStore.registerPushToken(token, platform);

      log.push('Successfully registered FCM token with server', LogLevel.INFO);
    } catch (error) {
      log.push('Failed to register FCM token with server', LogLevel.ERROR, error);
    }
  }

  /**
   * Handle incoming push notification when app is in foreground
   */
  private _handleNotification(notification: Notification): void {
    const data = notification.data as PushNotificationData | undefined;

    log.push('Processing FCM notification (foreground)', LogLevel.INFO, {
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });

    // Extract event data and add to notification store
    // ES sends mid (monitor ID) and eid (event ID) in the data payload
    if (data?.mid && data?.eid) {
      const notificationStore = useNotificationStore.getState();

      // If we are connected to the event server, we will receive this event via WebSocket.
      // Ignore the push notification to avoid duplicate processing/toasts.
      if (notificationStore.isConnected) {
        log.push('Ignoring foreground push notification - already connected to event server', LogLevel.INFO, {
          eventId: data.eid,
        });
        return;
      }

      const profileId = notificationStore.currentProfileId;

      if (profileId) {
        let imageUrl: string | undefined;

        const { profiles, currentProfileId } = useProfileStore.getState();
        const currentProfile = profiles.find(p => p.id === currentProfileId);
        const authStore = useAuthStore.getState();

        if (currentProfile && authStore.accessToken) {
          imageUrl = `${currentProfile.portalUrl}/index.php?view=image&eid=${data.eid}&fid=snapshot&width=600&token=${authStore.accessToken}`;
        }

        // Prefer structured data fields from ES, fall back to parsing notification title/body
        const monitorName = data.monitorName || notification.title?.replace(/\s*Alarm.*$/, '') || 'Unknown';
        const cause = data.cause || notification.body || 'Motion detected';

        notificationStore.addEvent(profileId, {
          MonitorId: parseInt(data.mid, 10),
          MonitorName: monitorName,
          EventId: parseInt(data.eid, 10),
          Cause: cause,
          Name: monitorName,
          ImageUrl: imageUrl,
        });
      }
    }
  }

  /**
   * Handle notification tap action
   */
  private _handleNotificationAction(notification: Notification): void {
    const data = notification.data as PushNotificationData | undefined;

    log.push('Processing notification tap', LogLevel.INFO, {
      mid: data?.mid,
      eid: data?.eid,
    });

    if (data?.eid && data?.mid) {
      const notificationStore = useNotificationStore.getState();
      const profileId = notificationStore.currentProfileId;

      if (profileId) {
        let imageUrl: string | undefined;

        const { profiles, currentProfileId } = useProfileStore.getState();
        const currentProfile = profiles.find(p => p.id === currentProfileId);
        const authStore = useAuthStore.getState();

        if (currentProfile && authStore.accessToken) {
          imageUrl = `${currentProfile.portalUrl}/index.php?view=image&eid=${data.eid}&fid=snapshot&width=600&token=${authStore.accessToken}`;
        }

        const monitorName = data.monitorName || notification.title?.replace(/\s*Alarm.*$/, '') || 'Unknown';
        const cause = data.cause || notification.body || 'Motion detected';

        notificationStore.addEvent(profileId, {
          MonitorId: parseInt(data.mid, 10),
          MonitorName: monitorName,
          EventId: parseInt(data.eid, 10),
          Cause: cause,
          Name: monitorName,
          ImageUrl: imageUrl,
        });

        notificationStore.markEventRead(profileId, parseInt(data.eid, 10));

        log.push('Added notification to history from tap action and marked as read', LogLevel.INFO, {
          eventId: data.eid,
          profileId,
        });
      }

      navigationService.navigateToEvent(data.eid);

      log.push('Navigating to event detail', LogLevel.INFO, { eventId: data.eid });
    }
  }
}

// Singleton instance
let pushService: MobilePushService | null = null;

export function getPushService(): MobilePushService {
  if (!pushService) {
    pushService = new MobilePushService();
  }
  return pushService;
}

export function resetPushService(): void {
  if (pushService) {
    pushService['_unregister']().catch((error) => {
      log.push('Failed to unregister push service', LogLevel.ERROR, error);
    });
    pushService = null;
  }
}
