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
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { getEventCauseIcon } from '../lib/event-icons';
import { log, LogLevel } from '../lib/logger';
import { navigationService } from '../lib/navigation';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { getPushService } from '../services/pushNotifications';
import { getEventPoller } from '../services/eventPoller';

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
  } = useNotificationStore();

  const lastEventId = useRef<number | null>(null);
  const hasAttemptedAutoConnect = useRef(false);
  const lastProfileId = useRef<string | null>(null);

  // Get settings and events for current profile
  const settings = currentProfile ? getProfileSettings(currentProfile.id) : null;
  const events = currentProfile ? getEvents(currentProfile.id) : [];

  // Reset auto-connect flag when profile changes or disabled
  useEffect(() => {
    if (!settings?.enabled) {
      hasAttemptedAutoConnect.current = false;
    }
  }, [settings?.enabled]);

  // Initialize push notifications on mobile
  // This runs whenever notifications are enabled to ensure we get the FCM token
  useEffect(() => {
    if (Capacitor.isNativePlatform() && settings && settings.enabled) {
      const pushService = getPushService();

      // Initialize push service - this will call register() to get the current FCM token
      pushService.initialize().catch((error) => {
        log.notificationHandler('Failed to initialize push notifications', LogLevel.ERROR, error);
      });
    }
  }, [settings?.enabled]);

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

  // Clear native badge and delivered notifications when app comes to foreground (iOS/Android)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerCleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        const listener = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            await FirebaseMessaging.removeAllDeliveredNotifications();
            log.notificationHandler('Cleared native badge on app resume', LogLevel.DEBUG);
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
      if (!Capacitor.isNativePlatform()) {
        // Non-native (Tauri desktop or web browser): start event poller
        hasAttemptedAutoConnect.current = true;
        log.notifications('Starting event poller for direct mode (desktop)', LogLevel.INFO, {
          profileId: currentProfile.id,
        });
        const poller = getEventPoller();
        poller.start(currentProfile.id);
      }
      // Native (mobile): push notifications handle everything via FCM
      // (initialized separately in the push notifications effect above)
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

    const attemptConnect = async (retries = 3) => {
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
          throw new Error('Failed to get password');
        }
      } catch (error) {
        log.notifications(`Auto-connect failed (retries left: ${retries})`, LogLevel.ERROR, {
          profileId: currentProfile.id,
          error,
        });

        if (retries > 0) {
          setTimeout(() => attemptConnect(retries - 1), 2000);
        }
      }
    };

    // Add a small delay to ensure everything is initialized
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
