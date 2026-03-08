import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Layouts } from 'react-grid-layout';
import { LogLevel } from '../lib/log-level';
import type { BandwidthMode } from '../lib/zmninja-ng-constants';

export type ViewMode = 'snapshot' | 'streaming';
export type DisplayMode = 'normal' | 'compact';
export type MonitorFeedFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
export type EventsViewMode = 'list' | 'montage';
export type ThemePreference = 'amber' | 'cream' | 'dark' | 'light' | 'slate' | 'system';
export type StreamingMethod = 'auto' | 'mjpeg';
export type WebRTCProtocol = 'webrtc' | 'mse' | 'hls';

export interface ProfileSettings {
  viewMode: ViewMode;
  displayMode: DisplayMode;
  theme: ThemePreference;
  logLevel: LogLevel;
  snapshotRefreshInterval: number; // in seconds
  streamMaxFps: number; // Max FPS for live streams
  streamScale: number; // Scale percentage for live streams (1-100)
  defaultEventLimit: number; // Default number of events to fetch when no filters applied
  dashboardRefreshInterval: number; // in seconds, for dashboard widgets (events/timeline)
  montageLayouts: Layouts; // Store montage layouts per profile
  eventMontageLayouts: Layouts; // Store event montage layouts per profile
  montageGridRows: number; // Grid rows for Montage page
  montageGridCols: number; // Grid columns for Montage page
  eventMontageGridCols: number; // Grid columns for EventMontage page
  montageIsFullscreen: boolean; // Fullscreen state for Montage page
  montageFeedFit: MonitorFeedFit; // Object-fit for montage feeds
  eventsViewMode: EventsViewMode; // List vs montage view for Events page
  monitorsFeedFit: MonitorFeedFit; // Object-fit for monitor grid feeds
  monitorDetailFeedFit: MonitorFeedFit; // Object-fit for monitor detail feed
  eventsThumbnailFit: MonitorFeedFit; // Object-fit for event thumbnails
  monitorDetailCycleSeconds: number; // Auto-cycle interval for single monitor view (0 = off)
  insomnia: boolean; // Global: Keep screen awake across all pages
  monitorDetailInsomnia: boolean; // @deprecated - use global insomnia instead
  montageInsomnia: boolean; // @deprecated - use global insomnia instead
  eventMontageFilters: {
    monitorIds: string[];
    cause: string;
    startDate: string;
    endDate: string;
  };
  eventsPageFilters: {
    monitorIds: string[];
    tagIds: string[];
    startDateTime: string;
    endDateTime: string;
    favoritesOnly: boolean;
  };
  disableLogRedaction: boolean;
  lastRoute: string; // Last visited route for this profile
  // Streaming method: 'auto' tries WebRTC/MSE/HLS for Go2RTC-enabled monitors, 'mjpeg' forces MJPEG for all
  streamingMethod: StreamingMethod;
  // Whether to enable fallback from WebRTC to MSE to HLS when protocols fail
  webrtcFallbackEnabled: boolean;
  // Which protocols to try for WebRTC streaming (video-rtc runs them in parallel)
  webrtcProtocols: WebRTCProtocol[];
  // Bandwidth mode: 'normal' for default intervals, 'low' for reduced bandwidth usage
  bandwidthMode: BandwidthMode;
  // Selected group ID for filtering monitors (null = show all monitors)
  selectedGroupId: string | null;
}

interface SettingsState {
  // Settings per profile ID
  profileSettings: Record<string, ProfileSettings>;

  // Get settings for a specific profile (with defaults)
  getProfileSettings: (profileId: string) => ProfileSettings;

  // Update settings for a specific profile
  updateProfileSettings: (profileId: string, updates: Partial<ProfileSettings>) => void;

  // Save montage layout for current profile
  saveMontageLayout: (profileId: string, layout: Layouts) => void;

  // Save event montage layout for current profile
  saveEventMontageLayout: (profileId: string, layout: Layouts) => void;
}

// Determine default display mode based on device type
const getDefaultDisplayMode = (): DisplayMode => {
  // Check if window is available (client-side)
  if (typeof window !== 'undefined') {
    // Use mobile breakpoint (768px = md breakpoint in Tailwind)
    return window.innerWidth < 768 ? 'compact' : 'normal';
  }
  return 'normal';
};

const getDefaultLogLevel = (): LogLevel => (
  typeof import.meta !== 'undefined' && import.meta.env?.DEV ? LogLevel.DEBUG : LogLevel.INFO
);

export const DEFAULT_SETTINGS: ProfileSettings = {
  viewMode: 'snapshot',
  displayMode: getDefaultDisplayMode(),
  theme: 'light',
  logLevel: getDefaultLogLevel(),
  snapshotRefreshInterval: 3,
  streamMaxFps: 10,
  streamScale: 50,
  defaultEventLimit: 100,
  dashboardRefreshInterval: 30,
  montageLayouts: {},
  eventMontageLayouts: {},
  montageGridRows: 2,
  montageGridCols: 2,
  eventMontageGridCols: 2,
  montageIsFullscreen: false,
  montageFeedFit: 'contain',
  eventsViewMode: 'list',
  monitorsFeedFit: 'cover',
  monitorDetailFeedFit: 'contain',
  eventsThumbnailFit: 'contain',
  monitorDetailCycleSeconds: 0,
  insomnia: false,
  monitorDetailInsomnia: false,
  montageInsomnia: false,
  eventMontageFilters: {
    monitorIds: [],
    cause: 'all',
    startDate: '',
    endDate: '',
  },
  eventsPageFilters: {
    monitorIds: [],
    tagIds: [],
    startDateTime: '',
    endDateTime: '',
    favoritesOnly: false,
  },
  disableLogRedaction: false,
  lastRoute: '/monitors',
  // Auto mode: use WebRTC/MSE/HLS for Go2RTC-enabled monitors, MJPEG for others
  streamingMethod: 'auto',
  // Enable fallback through protocols when one fails
  webrtcFallbackEnabled: true,
  // Default: try all protocols (video-rtc runs them in parallel, first to produce video wins)
  webrtcProtocols: ['webrtc', 'mse', 'hls'],
  // Normal bandwidth mode by default
  bandwidthMode: 'normal',
  // No group filter by default (show all monitors)
  selectedGroupId: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      profileSettings: {},

      getProfileSettings: (profileId) => {
        const settings = get().profileSettings[profileId];
        return { ...DEFAULT_SETTINGS, ...settings };
      },

      updateProfileSettings: (profileId, updates) => {
        set((state) => ({
          profileSettings: {
            ...state.profileSettings,
            [profileId]: {
              ...(state.profileSettings[profileId] || DEFAULT_SETTINGS),
              ...updates,
            },
          },
        }));
      },

      saveMontageLayout: (profileId, layout) => {
        get().updateProfileSettings(profileId, { montageLayouts: layout });
      },

      saveEventMontageLayout: (profileId, layout) => {
        get().updateProfileSettings(profileId, { eventMontageLayouts: layout });
      },
    }),
    {
      name: 'zmng-settings',
    }
  )
);
