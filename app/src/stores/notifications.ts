import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getNotificationService,
  resetNotificationService,
} from '../services/notifications';
import {
  type ZMEventServerConfig,
  type ZMAlarmEvent,
  type ConnectionState,
  type NotificationMode,
} from '../types/notifications';
import { log, LogLevel } from '../lib/logger';
import { getAppVersion } from '../lib/version';
import { updateNotification } from '../api/notifications';

export interface NotificationSettings {
  enabled: boolean;
  notificationMode: NotificationMode; // 'es' = Event Server websocket, 'direct' = ZM REST API
  notificationId: number | null; // Server-side Notifications.Id (direct mode)
  host: string; // Event server host (e.g., "zm.example.com")
  port: number; // Event server port (default 9000)
  ssl: boolean; // Use wss:// instead of ws://
  allMonitors: boolean; // Receive notifications for all monitors (no filter sent to ES)
  monitorFilters: MonitorNotificationConfig[]; // Per-monitor settings (used when allMonitors is false)
  onlyDetectedEvents: boolean; // Only notify for events with object detection results (direct mode)
  pollingInterval: number; // Seconds between event polls in direct mode (desktop)
  showToasts: boolean; // Show toast notifications for events
  playSound: boolean; // Play sound on notification
  badgeCount: number; // Current unread count
}

export interface MonitorNotificationConfig {
  monitorId: number;
  enabled: boolean;
  checkInterval: number; // Seconds between checks (60, 120, etc.)
}

export type NotificationSource = 'websocket' | 'push' | 'poll';

export interface NotificationEvent extends ZMAlarmEvent {
  receivedAt: number; // Timestamp when received
  read: boolean; // Whether user has seen it
  source: NotificationSource; // How the event was delivered
}

interface NotificationState {
  // Settings per profile ID
  profileSettings: Record<string, NotificationSettings>;

  // Connection state (runtime only, not persisted)
  connectionState: ConnectionState;
  isConnected: boolean;
  currentProfileId: string | null; // Track which profile is connected

  // Events per profile ID
  profileEvents: Record<string, NotificationEvent[]>;

  // Internal runtime state (not persisted)
  _cleanupFunctions: (() => void)[];

  // Actions - Settings
  getProfileSettings: (profileId: string) => NotificationSettings;
  updateProfileSettings: (profileId: string, updates: Partial<NotificationSettings>) => void;
  setMonitorFilter: (profileId: string, monitorId: number, enabled: boolean, checkInterval?: number) => void;
  removeMonitorFilter: (profileId: string, monitorId: number) => void;

  // Actions - Connection
  connect: (profileId: string, username: string, password: string, portalUrl: string) => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;

  // Actions - Events
  addEvent: (profileId: string, event: ZMAlarmEvent, source?: NotificationSource) => void;
  markEventRead: (profileId: string, eventId: number) => void;
  markAllRead: (profileId: string) => void;
  clearEvents: (profileId: string) => void;
  getUnreadCount: (profileId: string) => number;
  getEvents: (profileId: string) => NotificationEvent[];

  // Actions - Push (Mobile)
  registerPushToken: (token: string, platform: 'ios' | 'android') => Promise<void>;
  deregisterPushToken: (token: string, platform: 'ios' | 'android') => Promise<void>;

  // Internal
  _initialize: () => void;
  _cleanup: () => void;
  _syncMonitorFilters: () => Promise<void>;
  _updateBadge: () => Promise<void>;
  _registerPushTokenIfAvailable: () => Promise<void>;
}

const MAX_EVENTS = 100; // Keep last 100 events
const DEFAULT_PORT = 9000;

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  notificationMode: 'es',
  notificationId: null,
  host: '',
  port: DEFAULT_PORT,
  ssl: true,
  allMonitors: true,
  monitorFilters: [],
  onlyDetectedEvents: false,
  pollingInterval: 30,
  showToasts: true,
  playSound: false,
  badgeCount: 0,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      profileSettings: {},
      connectionState: 'disconnected',
      isConnected: false,
      currentProfileId: null,
      profileEvents: {},
      _cleanupFunctions: [],

      // ========== Settings Actions ==========

      getProfileSettings: (profileId) => {
        const settings = get().profileSettings[profileId];
        return { ...DEFAULT_SETTINGS, ...settings };
      },

      updateProfileSettings: (profileId, updates) => {
        log.notifications('Updating notification settings', LogLevel.INFO, { profileId, updates });

        set((state) => ({
          profileSettings: {
            ...state.profileSettings,
            [profileId]: {
              ...(state.profileSettings[profileId] || DEFAULT_SETTINGS),
              ...updates,
            },
          },
        }));

        // If enabled state changed to false, disconnect if this is the current profile
        if ('enabled' in updates && !updates.enabled && get().currentProfileId === profileId) {
          get().disconnect();
        }

        // If monitor filters changed and connected for this profile, update server
        if ('monitorFilters' in updates && get().isConnected && get().currentProfileId === profileId) {
          get()._syncMonitorFilters();
        }
      },

      setMonitorFilter: (profileId, monitorId, enabled, checkInterval = 60) => {
        log.notifications('Setting monitor filter', LogLevel.INFO, { profileId,
          monitorId,
          enabled,
          checkInterval, });

        set((state) => {
          const profileSettings = state.profileSettings[profileId] || DEFAULT_SETTINGS;
          const existing = profileSettings.monitorFilters.find((f) => f.monitorId === monitorId);
          const filters = existing
            ? profileSettings.monitorFilters.map((f) =>
              f.monitorId === monitorId ? { ...f, enabled, checkInterval } : f
            )
            : [
              ...profileSettings.monitorFilters,
              { monitorId, enabled, checkInterval },
            ];

          return {
            profileSettings: {
              ...state.profileSettings,
              [profileId]: {
                ...profileSettings,
                monitorFilters: filters,
              },
            },
          };
        });

        // Update server if connected for this profile
        if (get().isConnected && get().currentProfileId === profileId) {
          get()._syncMonitorFilters();
        }
      },

      removeMonitorFilter: (profileId, monitorId) => {
        log.notifications('Removing monitor filter', LogLevel.INFO, { profileId, monitorId });

        set((state) => {
          const profileSettings = state.profileSettings[profileId] || DEFAULT_SETTINGS;
          return {
            profileSettings: {
              ...state.profileSettings,
              [profileId]: {
                ...profileSettings,
                monitorFilters: profileSettings.monitorFilters.filter(
                  (f) => f.monitorId !== monitorId
                ),
              },
            },
          };
        });

        // Update server if connected for this profile
        if (get().isConnected && get().currentProfileId === profileId) {
          get()._syncMonitorFilters();
        }
      },

      // ========== Connection Actions ==========

      connect: async (profileId: string, username: string, password: string, portalUrl: string) => {
        const settings = get().getProfileSettings(profileId);

        if (!settings.enabled) {
          log.notifications('Notifications not enabled for this profile', LogLevel.WARN, { profileId });
          return;
        }

        if (!settings.host) {
          log.notifications('No notification server host configured', LogLevel.WARN, { profileId });
          return;
        }

        // Disconnect if already connected to a different profile
        if (get().isConnected && get().currentProfileId !== profileId) {
          log.notifications('Disconnecting from previous profile', LogLevel.INFO, { previousProfile: get().currentProfileId,
            newProfile: profileId });
          get().disconnect();
        }

        log.notifications('Connecting to notification server', LogLevel.INFO, { profileId,
          host: settings.host,
          port: settings.port,
          ssl: settings.ssl, });

        const config: ZMEventServerConfig = {
          host: settings.host,
          port: settings.port,
          ssl: settings.ssl,
          username,
          password,
          appVersion: getAppVersion(),
          portalUrl,
        };

        const service = getNotificationService();

        // Setup listeners before connecting
        get()._initialize();

        try {
          await service.connect(config);

          // Mark which profile is connected
          set({ currentProfileId: profileId });

          // Sync monitor filters after connection
          get()._syncMonitorFilters();

          log.notifications('Successfully connected to notification server', LogLevel.INFO, { profileId, });

          // Register push token if on mobile and token is available
          get()._registerPushTokenIfAvailable();
        } catch (error) {
          log.notifications('Failed to connect to notification server', LogLevel.ERROR, { profileId, error });
          throw error;
        }
      },

      disconnect: () => {
        log.notifications('Disconnecting from notification server', LogLevel.INFO, { profileId: get().currentProfileId });

        get()._cleanup();
        resetNotificationService();

        set({
          connectionState: 'disconnected',
          isConnected: false,
          currentProfileId: null,
        });
      },

      reconnect: async () => {
        log.notifications('Triggering reconnect', LogLevel.INFO);
        const service = getNotificationService();
        service.reconnectNow();
      },

      // ========== Event Actions ==========

      getEvents: (profileId) => {
        return get().profileEvents[profileId] || [];
      },

      getUnreadCount: (profileId) => {
        const events = get().profileEvents[profileId] || [];
        return events.filter((e) => !e.read).length;
      },

      /**
       * Add notification event to history
       * Events can come from WebSocket (when connected) or FCM push notifications
       * Duplicate prevention: if an event with the same ID already exists, it will be replaced
       */
      addEvent: (profileId: string, event: ZMAlarmEvent, source: NotificationSource = 'websocket') => {
        log.notifications('Adding notification event', LogLevel.INFO, { profileId,
          monitor: event.MonitorName,
          eventId: event.EventId,
          source, });

        set((state) => {
          const notificationEvent: NotificationEvent = {
            ...event,
            receivedAt: Date.now(),
            read: false,
            source,
          };

          const currentEvents = state.profileEvents[profileId] || [];

          // Remove any existing event with the same ID to avoid duplicates
          // This prevents duplicate entries when receiving the same event from both WebSocket and FCM
          const otherEvents = currentEvents.filter(e => e.EventId !== event.EventId);

          const events = [notificationEvent, ...otherEvents].slice(0, MAX_EVENTS);
          const unreadCount = events.filter((e) => !e.read).length;

          const profileSettings = state.profileSettings[profileId] || DEFAULT_SETTINGS;

          return {
            profileEvents: {
              ...state.profileEvents,
              [profileId]: events,
            },
            profileSettings: {
              ...state.profileSettings,
              [profileId]: {
                ...profileSettings,
                badgeCount: unreadCount,
              },
            },
          };
        });
      },

      markEventRead: (profileId: string, eventId: number) => {
        set((state) => {
          const currentEvents = state.profileEvents[profileId] || [];
          const events = currentEvents.map((e) =>
            e.EventId === eventId ? { ...e, read: true } : e
          );
          const unreadCount = events.filter((e) => !e.read).length;

          const profileSettings = state.profileSettings[profileId] || DEFAULT_SETTINGS;

          return {
            profileEvents: {
              ...state.profileEvents,
              [profileId]: events,
            },
            profileSettings: {
              ...state.profileSettings,
              [profileId]: {
                ...profileSettings,
                badgeCount: unreadCount,
              },
            },
          };
        });

        // Update badge on server if this is the connected profile
        if (get().currentProfileId === profileId) {
          get()._updateBadge();
        }
      },

      markAllRead: (profileId: string) => {
        set((state) => {
          const currentEvents = state.profileEvents[profileId] || [];
          const events = currentEvents.map((e) => ({ ...e, read: true }));
          const profileSettings = state.profileSettings[profileId] || DEFAULT_SETTINGS;

          return {
            profileEvents: {
              ...state.profileEvents,
              [profileId]: events,
            },
            profileSettings: {
              ...state.profileSettings,
              [profileId]: {
                ...profileSettings,
                badgeCount: 0,
              },
            },
          };
        });

        // Clear native badge and delivered notifications on mobile
        import('@capacitor/core').then(({ Capacitor }) => {
          if (Capacitor.isNativePlatform()) {
            import('@capacitor-firebase/messaging').then(({ FirebaseMessaging }) => {
              FirebaseMessaging.removeAllDeliveredNotifications();
            }).catch(() => {});
          }
        }).catch(() => {});

        // Update badge on server if this is the connected profile
        if (get().currentProfileId === profileId) {
          get()._updateBadge();
        }
      },

      clearEvents: (profileId: string) => {
        log.notifications('Clearing all notification events', LogLevel.INFO, { profileId });

        set((state) => {
          const profileSettings = state.profileSettings[profileId] || DEFAULT_SETTINGS;

          return {
            profileEvents: {
              ...state.profileEvents,
              [profileId]: [],
            },
            profileSettings: {
              ...state.profileSettings,
              [profileId]: {
                ...profileSettings,
                badgeCount: 0,
              },
            },
          };
        });

        // Clear native badge and delivered notifications on mobile
        import('@capacitor/core').then(({ Capacitor }) => {
          if (Capacitor.isNativePlatform()) {
            import('@capacitor-firebase/messaging').then(({ FirebaseMessaging }) => {
              FirebaseMessaging.removeAllDeliveredNotifications();
            }).catch(() => {});
          }
        }).catch(() => {});

        // Update badge on server if this is the connected profile
        if (get().currentProfileId === profileId) {
          get()._updateBadge();
        }
      },

      // ========== Push Token Actions ==========

      registerPushToken: async (token: string, platform: 'ios' | 'android') => {
        const { isConnected, currentProfileId } = get();

        if (!isConnected || !currentProfileId) {
          log.notifications('Cannot register push token - not connected', LogLevel.WARN);
          return;
        }

        log.notifications('Registering push token', LogLevel.INFO, { platform, profileId: currentProfileId });

        const service = getNotificationService();
        const settings = get().getProfileSettings(currentProfileId);
        const { monitorFilters } = settings;

        const enabledFilters = monitorFilters.filter((f) => f.enabled);
        const monitorIds = enabledFilters.map((f) => f.monitorId);
        const intervals = enabledFilters.map((f) => f.checkInterval);

        await service.registerPushToken(token, platform, monitorIds, intervals);
      },

      deregisterPushToken: async (token: string, platform: 'ios' | 'android') => {
        const { isConnected, currentProfileId } = get();

        if (!isConnected || !currentProfileId) {
          log.notifications('Cannot deregister push token - not connected', LogLevel.WARN);
          return;
        }

        log.notifications('Deregistering push token', LogLevel.INFO, { platform, profileId: currentProfileId });

        const service = getNotificationService();
        await service.deregisterPushToken(token, platform);
      },

      // ========== Internal Methods ==========

      _initialize: () => {
        const service = getNotificationService();

        // Listen for connection state changes
        const unsubscribeState = service.onStateChange((state) => {
          log.notifications('Connection state changed', LogLevel.INFO, { state });
          set({
            connectionState: state,
            isConnected: state === 'connected',
          });
        });

        // Listen for alarm events
        const unsubscribeEvents = service.onEvent((event) => {
          const { currentProfileId } = get();
          if (currentProfileId) {
            get().addEvent(currentProfileId, event);

            const settings = get().getProfileSettings(currentProfileId);

            // Show toast if enabled
            if (settings.showToasts) {
              // Toast will be shown by the UI component listening to the store
            }

            // Play sound if enabled
            if (settings.playSound) {
              log.notifications('Playing notification sound', LogLevel.INFO);
            }
          }
        });

        // Store cleanup functions in state instead of window object
        set({
          _cleanupFunctions: [unsubscribeState, unsubscribeEvents],
        });
      },

      _cleanup: () => {
        const { _cleanupFunctions } = get();
        if (_cleanupFunctions && _cleanupFunctions.length > 0) {
          _cleanupFunctions.forEach((fn) => fn());
          set({ _cleanupFunctions: [] });
        }
      },

      _syncMonitorFilters: async () => {
        const { currentProfileId } = get();
        if (!currentProfileId) {
          log.notifications('Cannot sync monitor filters - no profile connected', LogLevel.WARN);
          return;
        }

        const settings = get().getProfileSettings(currentProfileId);
        const { monitorFilters } = settings;
        const enabledFilters = monitorFilters.filter((f) => f.enabled);

        if (settings.notificationMode === 'direct') {
          // Direct mode: sync via ZM REST API
          const notifId = settings.notificationId;
          if (!notifId) {
            log.notifications('Cannot sync filters in direct mode - no notification ID', LogLevel.WARN);
            return;
          }

          const monitorList = settings.allMonitors ? '' : enabledFilters.map(f => f.monitorId).join(',');
          const interval = settings.allMonitors ? 0 : Math.max(0, ...enabledFilters.map(f => f.checkInterval));

          log.notifications('Syncing monitor filters via ZM API', LogLevel.INFO, {
            profileId: currentProfileId,
            notificationId: notifId,
            monitorList: monitorList || '(all)',
            interval,
          });

          try {
            await updateNotification(notifId, {
              monitorList: monitorList || undefined,
              interval,
            });
          } catch (error) {
            log.notifications('Failed to sync monitor filters via ZM API', LogLevel.ERROR, { profileId: currentProfileId, error });
          }
        } else {
          // ES mode: sync via websocket
          // When allMonitors is on, don't send a filter — ES treats empty monlist as "all monitors"
          if (settings.allMonitors) {
            log.notifications('All monitors enabled, skipping filter sync', LogLevel.INFO, { profileId: currentProfileId });
            return;
          }

          if (enabledFilters.length === 0) {
            log.notifications('No enabled monitor filters to sync', LogLevel.INFO, { profileId: currentProfileId });
            return;
          }

          const monitorIds = enabledFilters.map((f) => f.monitorId);
          const intervals = enabledFilters.map((f) => f.checkInterval);

          log.notifications('Syncing monitor filters with server', LogLevel.INFO, { profileId: currentProfileId,
            monitors: monitorIds,
            intervals, });

          try {
            const service = getNotificationService();
            await service.setMonitorFilter(monitorIds, intervals);
          } catch (error) {
            log.notifications('Failed to sync monitor filters', LogLevel.ERROR, { profileId: currentProfileId, error });
          }
        }
      },

      _updateBadge: async () => {
        const { currentProfileId } = get();
        if (!currentProfileId) {
          log.notifications('Cannot update badge - no profile connected', LogLevel.WARN);
          return;
        }

        const service = getNotificationService();
        const settings = get().getProfileSettings(currentProfileId);
        const { badgeCount } = settings;

        try {
          await service.updateBadgeCount(badgeCount);
        } catch (error) {
          log.notifications('Failed to update badge count', LogLevel.ERROR, { profileId: currentProfileId, error });
        }
      },

      _registerPushTokenIfAvailable: async () => {
        // Only runs on mobile platforms
        if (typeof window === 'undefined') {
          return;
        }

        try {
          const { Capacitor } = await import('@capacitor/core');
          if (!Capacitor.isNativePlatform()) {
            return;
          }

          const { getPushService } = await import('../services/pushNotifications');
          const pushService = getPushService();

          if (pushService.isReady()) {
            log.notifications('Registering FCM token after connection', LogLevel.INFO);
            await pushService.registerTokenWithServer();
          } else {
            log.notifications('FCM token not yet available - will register when received', LogLevel.INFO);
          }
        } catch (error) {
          log.notifications('Failed to register push token', LogLevel.ERROR, error);
        }
      },
    }),
    {
      name: 'zmng-notifications',
      // Only persist settings and events, not connection state
      partialize: (state) => ({
        profileSettings: state.profileSettings,
        profileEvents: state.profileEvents,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const profileCount = Object.keys(state.profileSettings || {}).length;
          const eventCounts = Object.entries(state.profileEvents || {}).map(
            ([id, events]) => `${id}: ${events.length}`
          );
          log.notifications('Notification store rehydrated', LogLevel.INFO, { profileCount,
            eventCounts, });
        }
      },
    }
  )
);
