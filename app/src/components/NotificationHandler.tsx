/**
 * Notification Handler Component
 *
 * A headless component that manages the notification system.
 * It listens to the notification store and displays toast notifications
 * for new events. It also handles auto-connecting to the notification
 * server when a profile is loaded.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../stores/notifications';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useProfileStore } from '../stores/profile';
import { useAuthStore } from '../stores/auth';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { getEventCauseIcon } from '../lib/event-icons';
import { log, LogLevel } from '../lib/logger';
import { navigationService } from '../lib/navigation';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Platform } from '../lib/platform';
import { getPushService } from '../services/pushNotifications';
import { getEventPoller } from '../services/eventPoller';
import { getNotificationService } from '../services/notifications';

/**
 * NotificationHandler component.
 * This component does not render any visible UI itself but manages
 * side effects related to notifications (toasts, sounds, connection).
 */
export function NotificationHandler() {
  const navigate = useNavigate();
  const { currentProfile } = useCurrentProfile();
  const getDecryptedPassword = useProfileStore((state) => state.getDecryptedPassword);
  const { t } = useTranslation();

  const {
    getProfileSettings,
    getEvents,
    isConnected,
    connectionState,
    currentProfileId,
    connect,
    disconnect,
    reconnect,
  } = useNotificationStore();

  const lastEventId = useRef<number | null>(null);
  const hasAttemptedAutoConnect = useRef(false);
  const lastProfileId = useRef<string | null>(null);

  // Get settings and events for current profile
  const settings = currentProfile ? getProfileSettings(currentProfile.id) : null;
  const events = currentProfile ? getEvents(currentProfile.id) : [];

  // Reset auto-connect flag when profile changes, disabled, or mode changes
  useEffect(() => {
    if (!settings?.enabled) {
      hasAttemptedAutoConnect.current = false;
    }
  }, [settings?.enabled]);

  useEffect(() => {
    hasAttemptedAutoConnect.current = false;
  }, [settings?.notificationMode]);

  // Initialize push notifications on mobile
  // Runs when notifications are enabled or mode changes to ensure FCM token
  // is registered with the correct backend (ES websocket vs ZM REST API)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !settings?.enabled || !currentProfile) return;

    const mode = settings.notificationMode || 'es';

    // In direct mode, set currentProfileId so the push service knows which
    // profile to register against (there's no WebSocket connect to set it)
    if (mode === 'direct') {
      useNotificationStore.setState({ currentProfileId: currentProfile.id });
      // Sync badge count with server after setting profile
      useNotificationStore.getState()._updateBadge();
    }

    const pushService = getPushService();

    if (pushService.isReady()) {
      // Token already obtained — re-register with server for current mode
      log.notificationHandler('Re-registering FCM token for mode change', LogLevel.INFO, { mode });
      pushService.registerTokenWithServer().catch((error) => {
        log.notificationHandler('Failed to re-register FCM token', LogLevel.ERROR, error);
      });
    } else {
      // First time — initialize to get FCM token and register
      pushService.initialize().catch((error) => {
        log.notificationHandler('Failed to initialize push notifications', LogLevel.ERROR, error);
      });
    }
  }, [settings?.enabled, settings?.notificationMode, currentProfile]);

  // Handle profile switching
  useEffect(() => {
    if (currentProfile?.id !== lastProfileId.current) {
      lastProfileId.current = currentProfile?.id || null;
      hasAttemptedAutoConnect.current = false;

      // Disconnect from previous profile if connected to a different one
      if (isConnected && currentProfileId !== currentProfile?.id) {
        log.notifications('Profile changed - disconnecting from previous profile', LogLevel.INFO, { previousProfile: currentProfileId,
          newProfile: currentProfile?.id, });
        disconnect();
      }
    }
  }, [currentProfile?.id, isConnected, currentProfileId, disconnect]);

  // Process delivered notifications and sync badge when profile connects (handles cold start + warm resume)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !currentProfileId) return;

    const processDelivered = async () => {
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        const { notifications } = await FirebaseMessaging.getDeliveredNotifications();

        if (notifications.length > 0) {
          const store = useNotificationStore.getState();
          const { profiles } = useProfileStore.getState();
          const profile = profiles.find(p => p.id === currentProfileId);
          const authStore = useAuthStore.getState();

          for (const notif of notifications) {
            const data = notif.data as Record<string, string> | undefined;
            const mid = data?.mid || data?.MonitorId;
            const eid = data?.eid || data?.EventId;

            let imageUrl: string | undefined;
            if (eid && profile && authStore.accessToken) {
              imageUrl = `${profile.portalUrl}/index.php?view=image&eid=${eid}&fid=snapshot&width=600&token=${authStore.accessToken}`;
            }

            const monitorName = data?.monitorName || data?.MonitorName || notif.title?.replace(/\s*Alarm.*$/, '') || 'Unknown';
            const cause = data?.cause || data?.Cause || notif.body || 'Motion detected';

            store.addEvent(currentProfileId, {
              MonitorId: mid ? parseInt(String(mid), 10) : 0,
              MonitorName: monitorName,
              EventId: eid ? parseInt(String(eid), 10) : Date.now(),
              Cause: cause,
              Name: monitorName,
              ImageUrl: imageUrl,
            }, 'push');
          }
          log.notificationHandler('Added delivered notifications to history', LogLevel.INFO, { count: notifications.length });
        }

        await FirebaseMessaging.removeAllDeliveredNotifications();
      } catch (err) {
        log.notificationHandler('Failed to process delivered notifications', LogLevel.ERROR, err);
      }
    };

    processDelivered();
  }, [currentProfileId]);

  // Clear native badge and sync badge count when app comes to foreground (iOS/Android)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerCleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        const listener = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            // Read delivered notifications that arrived while backgrounded
            try {
              const store = useNotificationStore.getState();
              const profileId = store.currentProfileId;
              if (profileId) {
                const { notifications } = await FirebaseMessaging.getDeliveredNotifications();
                if (notifications.length > 0) {
                  const { profiles } = useProfileStore.getState();
                  const profile = profiles.find(p => p.id === profileId);
                  const authStore = useAuthStore.getState();

                  for (const notif of notifications) {
                    const data = notif.data as Record<string, string> | undefined;
                    const mid = data?.mid || data?.MonitorId;
                    const eid = data?.eid || data?.EventId;

                    let imageUrl: string | undefined;
                    if (eid && profile && authStore.accessToken) {
                      imageUrl = `${profile.portalUrl}/index.php?view=image&eid=${eid}&fid=snapshot&width=600&token=${authStore.accessToken}`;
                    }

                    const monitorName = data?.monitorName || data?.MonitorName || notif.title?.replace(/\s*Alarm.*$/, '') || 'Unknown';
                    const cause = data?.cause || data?.Cause || notif.body || 'Motion detected';

                    store.addEvent(profileId, {
                      MonitorId: mid ? parseInt(String(mid), 10) : 0,
                      MonitorName: monitorName,
                      EventId: eid ? parseInt(String(eid), 10) : Date.now(),
                      Cause: cause,
                      Name: monitorName,
                      ImageUrl: imageUrl,
                    }, 'push');
                  }
                  log.notificationHandler('Added delivered notifications to history on resume', LogLevel.INFO, { count: notifications.length });
                }
              }
            } catch (err) {
              log.notificationHandler('Failed to read delivered notifications on resume', LogLevel.ERROR, err);
            }

            await FirebaseMessaging.removeAllDeliveredNotifications();
            log.notificationHandler('Cleared native badge on app resume', LogLevel.DEBUG);

            // Sync badge count with server
            const store = useNotificationStore.getState();
            store._updateBadge();
          }
        });

        listenerCleanup = () => { listener.remove(); };
      } catch (e) {
        log.notificationHandler('Failed to setup badge clearing on resume', LogLevel.ERROR, e);
      }
    };

    setup();
    return () => { listenerCleanup?.(); };
  }, []);

  // Network change listener: reconnect when connectivity is restored
  useEffect(() => {
    const mode = settings?.notificationMode || 'es';
    if (!settings?.enabled || mode !== 'es') return;

    const handleOnline = () => {
      log.notificationHandler('Network restored, triggering reconnect', LogLevel.INFO);
      reconnect();
    };

    window.addEventListener('online', handleOnline);

    // On native platforms, also use Capacitor's Network plugin for faster detection
    let networkCleanup: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      import('@capacitor/network').then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => {
          if (status.connected) {
            log.notificationHandler('Native network restored, triggering reconnect', LogLevel.INFO);
            reconnect();
          }
        }).then((handle) => {
          networkCleanup = () => handle.remove();
        });
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      networkCleanup?.();
    };
  }, [settings?.enabled, settings?.notificationMode, reconnect]);

  // Visibility change listener (desktop/web): check liveness when tab becomes visible
  useEffect(() => {
    const mode = settings?.notificationMode || 'es';
    if (!settings?.enabled || mode !== 'es' || Capacitor.isNativePlatform()) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!isConnected) return;

      log.notificationHandler('Tab visible, checking WebSocket liveness', LogLevel.DEBUG);
      const service = getNotificationService();
      const alive = await service.checkAlive(5000);

      if (!alive) {
        log.notificationHandler('WebSocket not responding after tab resume, reconnecting', LogLevel.WARN);
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings?.enabled, settings?.notificationMode, isConnected, reconnect]);

  // App resume liveness check (mobile): verify WebSocket is alive when app returns to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const mode = settings?.notificationMode || 'es';
    if (!settings?.enabled || mode !== 'es') return;

    let listenerCleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');

        const listener = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive || !isConnected) return;

          log.notificationHandler('App resumed, checking WebSocket liveness', LogLevel.DEBUG);
          const service = getNotificationService();
          const alive = await service.checkAlive(5000);

          if (!alive) {
            log.notificationHandler('WebSocket not responding after app resume, reconnecting', LogLevel.WARN);
            reconnect();
          }
        });

        listenerCleanup = () => { listener.remove(); };
      } catch (e) {
        log.notificationHandler('Failed to setup app resume liveness check', LogLevel.ERROR, e);
      }
    };

    setup();
    return () => { listenerCleanup?.(); };
  }, [settings?.enabled, settings?.notificationMode, isConnected, reconnect]);

  // Listen to navigation events from services (e.g., push notifications)
  useEffect(() => {
    const unsubscribe = navigationService.addListener((event) => {
      log.notificationHandler('Navigating from service event', LogLevel.INFO, { path: event.path,
        replace: event.replace, });

      if (event.replace) {
        navigate(event.path, { replace: true });
      } else {
        navigate(event.path);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  // Auto-connect when profile loads (if enabled)
  // In ES mode: connects websocket. In Direct mode on desktop: starts event poller.
  useEffect(() => {
    if (
      !settings?.enabled ||
      !currentProfile ||
      !currentProfile.username ||
      !currentProfile.password ||
      hasAttemptedAutoConnect.current
    ) {
      return;
    }

    const mode = settings.notificationMode || 'es';

    if (mode === 'direct') {
      if (Platform.isDesktopOrWeb) {
        // Desktop (Tauri) or web browser: start event poller
        hasAttemptedAutoConnect.current = true;
        log.notifications('Starting event poller for direct mode', LogLevel.INFO, {
          profileId: currentProfile.id,
        });
        const poller = getEventPoller();
        poller.start(currentProfile.id);
      }
      // Native mobile (iOS/Android): push notifications handle everything via FCM
      return;
    }

    // ES mode: auto-connect websocket (existing behavior)
    if (
      !settings.host ||
      isConnected ||
      connectionState !== 'disconnected'
    ) {
      return;
    }

    hasAttemptedAutoConnect.current = true;

    log.notifications('Auto-connecting to notification server', LogLevel.INFO, { profileId: currentProfile.id, });

    const attemptConnect = async () => {
      try {
        const password = await getDecryptedPassword(currentProfile.id);

        // Check state again right before connecting to avoid race conditions
        // This is crucial because getDecryptedPassword is async and state might have changed
        const currentState = useNotificationStore.getState().connectionState;
        if (currentState !== 'disconnected') {
           log.notifications('Skipping auto-connect - already connected or connecting', LogLevel.INFO, { state: currentState,
             profileId: currentProfile.id, });
           return;
        }

        if (password) {
          await connect(currentProfile.id, currentProfile.username!, password, currentProfile.portalUrl);
          log.notifications('Auto-connected to notification server', LogLevel.INFO, { profileId: currentProfile.id, });
        } else {
          log.notifications('Auto-connect failed - could not decrypt password', LogLevel.ERROR, {
            profileId: currentProfile.id,
          });
        }
      } catch (error) {
        // The service handles reconnection internally via exponential backoff
        log.notifications('Auto-connect failed, service will retry automatically', LogLevel.ERROR, {
          profileId: currentProfile.id,
          error,
        });
      }
    };

    // Small delay to ensure store initialization is complete
    setTimeout(() => attemptConnect(), 500);
  }, [settings?.enabled, settings?.notificationMode, settings?.host, isConnected, connectionState, currentProfile, connect, getDecryptedPassword]);

  // Stop event poller on cleanup or when mode/profile changes
  useEffect(() => {
    return () => {
      const poller = getEventPoller();
      if (poller.isRunning()) {
        poller.stop();
      }
    };
  }, [currentProfile?.id, settings?.notificationMode, settings?.enabled]);

  // Listen for new events and show toasts
  useEffect(() => {
    if (!settings?.showToasts || events.length === 0) {
      return;
    }

    const latestEvent = events[0];

    // Only show toast if this is a new event we haven't seen
    if (latestEvent.EventId !== lastEventId.current) {
      lastEventId.current = latestEvent.EventId;

      // Show toast notification
      toast(
        <div className="flex items-start gap-3">
          {latestEvent.ImageUrl ? (
            <div className="flex-shrink-0">
              <img
                src={latestEvent.ImageUrl}
                alt={latestEvent.MonitorName}
                className="h-16 w-16 rounded object-cover border"
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  e.currentTarget.style.display = 'none';
                  const icon = e.currentTarget.nextElementSibling as HTMLElement;
                  if (icon) icon.style.display = 'block';
                }}
              />
              <div style={{ display: 'none' }} className="mt-0.5">
                <Bell className="h-5 w-5 text-primary" />
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 mt-0.5">
              <Bell className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{latestEvent.MonitorName}</div>
            {currentProfile && (
              <div className="text-xs text-muted-foreground/70">{currentProfile.name}</div>
            )}
            {(() => {
              const CauseIcon = getEventCauseIcon(latestEvent.Cause);
              return (
                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                  <CauseIcon className="h-3 w-3" />
                  {latestEvent.Cause}
                </div>
              );
            })()}
            <div className="text-xs text-muted-foreground mt-1">
              {t('events.event_id')}: {latestEvent.EventId}
            </div>
          </div>
        </div>,
        {
          duration: 5000,
          action: latestEvent.EventId
            ? {
                label: t('common.view'),
                onClick: () => {
                  // Navigate to event detail
                  navigate(`/events/${latestEvent.EventId}`);
                },
              }
            : undefined,
        }
      );

      // Play sound if enabled
      if (settings?.playSound) {
        playNotificationSound();
      }

      log.notifications('Showed notification toast', LogLevel.INFO, { profileId: currentProfile?.id,
        monitor: latestEvent.MonitorName,
        eventId: latestEvent.EventId, });
    }
  }, [events, settings?.showToasts, settings?.playSound, currentProfile?.id, t, navigate]);

  // This component doesn't render anything
  return null;
}

/**
 * Plays a notification sound using the Web Audio API.
 * Generates a simple beep tone.
 */
function playNotificationSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // 800 Hz tone
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    log.notifications('Failed to play notification sound', LogLevel.ERROR, error);
  }
}
