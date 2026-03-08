Shared Services and Reusable Components
=======================================

This chapter documents all shared utilities, services, and reusable
components in zmNinjaNG, including who uses them and how.

Table of Contents
-----------------

- `Shared Services (lib/) <#shared-services-lib>`__
- `Reusable UI Components <#reusable-ui-components>`__
- `Reusable Domain Components <#reusable-domain-components>`__
- `Usage Matrix <#usage-matrix>`__

--------------

Shared Services (lib/)
----------------------

The ``lib/`` directory contains platform-agnostic utilities that could
theoretically be extracted into separate npm packages.

Logger (``lib/logger.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~

Structured logging system with sanitization and component-specific
helpers.

**Features:** - Log levels: DEBUG, INFO, WARN, ERROR, NONE - Automatic
sanitization of passwords, tokens, and sensitive data -
Component-specific logger methods (e.g., ``log.api()``,
``log.profile()``, ``log.download()``) - Centralized log storage for
debug UI (``/logs`` page)

**Implementation:**

.. code:: typescript

   import { log, LogLevel } from '../lib/logger';

   // Basic logging
   log.info('User logged in', { username: 'john' });
   log.error('Failed to fetch', { endpoint: '/api/monitors' }, error);

   // Component-specific (preferred)
   log.api('Fetching monitors', LogLevel.INFO, { endpoint: '/monitors.json' });
   log.download('Download started', LogLevel.INFO, { filename: 'video.mp4' });
   log.profileService('Switching profile', LogLevel.INFO, { from: 'A', to: 'B' });

**Available Component Loggers:** - ``api``, ``app``, ``auth``,
``crypto``, ``dashboard``, ``discovery``, ``download`` -
``errorBoundary``, ``eventCard``, ``eventDetail``, ``eventMontage`` -
``http``, ``imageError``, ``monitor``, ``monitorCard``,
``monitorDetail``, ``montageMonitor`` - ``navigation``,
``notificationHandler``, ``notifications``, ``notificationSettings`` -
``profile``, ``profileForm``, ``profileService``, ``profileSwitcher`` -
``push``, ``queryCache``, ``secureImage``, ``secureStorage``,
``server``, ``time`` - ``videoMarkers``, ``videoPlayer``,
``zmsEventPlayer``

**Used By:** Entire application (all components, stores, API functions)

--------------

HTTP Client (``lib/http.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Platform-agnostic HTTP request abstraction that works on Web, iOS,
Android, and Desktop.

**Features:** - Automatic platform detection (Capacitor, Tauri, or Web)
- CORS handling via proxy in development - Request/response logging via
logger - Token injection for authentication - Support for multiple
response types (json, blob, arraybuffer, text)

**Implementation:**

.. code:: typescript

   import { httpGet, httpPost, httpPut, httpDelete } from '../lib/http';

   // GET request
   const data = await httpGet<MonitorsResponse>('/api/monitors.json');

   // POST with body
   await httpPost('/api/states/change.json', {
     monitorId: '1',
     newState: 'Alert'
   });

   // With auth token
   await httpGet('/api/events.json', {
     token: accessToken,
     params: { limit: 50 }
   });

   // Blob response (for downloads)
   const blob = await httpGet<Blob>('/video.mp4', {
     responseType: 'blob'
   });

**Platform Implementations:** - **Web**: Uses ``fetch()`` with standard
CORS handling - **Mobile (Capacitor)**: Uses ``CapacitorHttp`` for
native networking - **Desktop (Tauri)**: Uses
``@tauri-apps/plugin-http`` for native fetch

**Used By:** API functions (``api/``), download utilities, all network
requests

--------------

Discovery (``lib/discovery.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

ZoneMinder server discovery utility that probes for API endpoints and
derives connection URLs.

**Features:** - Automatic HTTPS/HTTP fallback for scheme-less URLs -
Probes ``/zm/api`` and ``/api`` paths to find API endpoint - Derives
``portalUrl`` and ``cgiUrl`` from confirmed API location - Optional
authentication to fetch accurate ``ZM_PATH_ZMS`` from server config -
Cancellable via AbortSignal - Skips redundant probes on connection
errors (faster failure)

**Implementation:**

.. code:: typescript

   import { discoverZoneminder, DiscoveryError } from '../lib/discovery';

   // Basic discovery (no auth)
   const result = await discoverZoneminder('192.168.1.100');
   // Returns: { portalUrl, apiUrl, cgiUrl }

   // With credentials (fetches accurate ZMS path from server)
   const result = await discoverZoneminder('myserver.com', {
     username: 'admin',
     password: 'secret'
   });

   // With cancellation support
   const abortController = new AbortController();
   try {
     const result = await discoverZoneminder('192.168.1.100', {
       signal: abortController.signal
     });
   } catch (error) {
     if (error instanceof DiscoveryError && error.code === 'CANCELLED') {
       console.log('Discovery was cancelled');
     }
   }

   // Cancel from elsewhere
   abortController.abort();

**Error Codes:** - ``API_NOT_FOUND`` - No ZoneMinder API found at any
probed path - ``PORTAL_UNREACHABLE`` - Server completely unreachable -
``CANCELLED`` - Discovery was cancelled via AbortSignal - ``UNKNOWN`` -
Unexpected error

**Used By:** ``ProfileForm.tsx``, ``Profiles.tsx`` (profile
creation/editing)

--------------

Download Utilities (``lib/download.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Cross-platform file download with progress tracking and cancellation
support.

**Features:** - Platform-specific implementations (Web, Mobile, Desktop)
- Progress callbacks for UI updates - Cancellation via AbortSignal -
Automatic file saving to appropriate locations - Mobile: Saves to
Documents + Photo/Video library - Desktop: User selects save location -
Web: Browser download

**Implementation:**

.. code:: typescript

   import { downloadFile, downloadSnapshot } from '../lib/download';

   // Download a file with progress
   const abortController = new AbortController();

   await downloadFile('https://example.com/video.mp4', 'event-123.mp4', {
     signal: abortController.signal,
     onProgress: (progress) => {
       console.log(`${progress.percentage}% - ${progress.loaded}/${progress.total} bytes`);
     },
   });

   // Cancel download
   abortController.abort();

   // Download monitor snapshot
   await downloadSnapshot(imageUrl, monitorName);

**Platform Implementations:** - **Web**: Blob + anchor download -
**Mobile**: CapacitorHttp → Filesystem → Media library - **Desktop**:
Tauri fetch → User-selected path

**Critical Note:** Mobile implementation uses base64 directly (NOT Blob
conversion) to avoid Out-Of-Memory errors on large video files.

**Used By:** MonitorCard, EventDetail, EventCard, VideoPlayer

--------------

Proxy URL Utilities (``lib/proxy-utils.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Utilities for wrapping URLs with development proxy to handle CORS.

**Features:** - Automatically wraps external URLs with proxy in
development mode - Preserves URLs in production - Platform-aware (only
web development needs proxy)

**Implementation:**

.. code:: typescript

   import { wrapWithImageProxy, wrapWithImageProxyIfNeeded } from '../lib/proxy-utils';

   // Always wrap if proxy is enabled
   const proxiedUrl = wrapWithImageProxy('https://zm.example.com/image.jpg');
   // → 'http://localhost:3001/image-proxy?url=https%3A%2F%2Fzm.example.com%2Fimage.jpg'

   // Conditionally wrap (checks if URL is external)
   const url = wrapWithImageProxyIfNeeded('https://zm.example.com/image.jpg');

**Used By:** API functions (monitors, events), download utilities, HTTP
client

--------------

URL Builder (``lib/url-builder.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Centralized URL construction for ZoneMinder endpoints.

**Features:** - Stream URLs with authentication - Event image/video URLs
- Control URLs for PTZ - Consistent parameter handling - Cache busting
support

**Implementation:**

.. code:: typescript

   import {
     getMonitorStreamUrl,
     getEventImageUrl,
     getEventVideoUrl
   } from '../lib/url-builder';

   // Monitor stream
   const streamUrl = getMonitorStreamUrl(cgiUrl, monitorId, {
     token: accessToken,
     mode: 'jpeg',
     maxfps: 10,
     connkey: 12345,
   });

   // Event thumbnail
   const imageUrl = getEventImageUrl(portalUrl, eventId, frameNumber, {
     token: accessToken,
     width: 320,
     height: 240,
   });

   // Event video download
   const videoUrl = getEventVideoUrl(portalUrl, eventId, {
     token: accessToken,
     format: 'mp4',
   });

**Used By:** API functions, hooks (useMonitorStream, useEventPlayer),
components

--------------

Event Icons (``lib/event-icons.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Maps event causes from ZoneMinder to Lucide icons for visual display.

**Features:** - Exact match for known causes (Motion, Alarm, Signal,
Linked, etc.) - Prefix matching for cause variants (e.g., “Motion:All”,
“Motion:Person” → Motion icon) - Fallback to Circle icon for unknown
causes

**Implementation:**

.. code:: typescript

   import { getEventCauseIcon, hasSpecificCauseIcon } from '../lib/event-icons';

   // Get icon component for a cause
   const Icon = getEventCauseIcon('Motion');  // Returns Move icon
   const Icon2 = getEventCauseIcon('Motion:Person');  // Also returns Move icon (prefix match)
   const Icon3 = getEventCauseIcon('Unknown');  // Returns Circle icon (fallback)

   // Check if cause has a specific (non-fallback) icon
   const hasIcon = hasSpecificCauseIcon('Motion');  // true
   const hasIcon2 = hasSpecificCauseIcon('Custom');  // false

**Mapped Causes:** - ``Motion`` → Move icon - ``Alarm`` → Bell icon -
``Signal`` → Wifi icon - ``Linked`` → Link icon - ``Forced Web`` → Hand
icon - ``Continuous`` → Video icon

**Used By:** EventCard, event list components

--------------

Time Utilities (``lib/time.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Date/time formatting and timezone conversion for ZoneMinder API.

**Features:** - Server-compatible ISO format - Local datetime formatting
for inputs - Timezone conversion - Duration formatting

**Implementation:**

.. code:: typescript

   import { formatForServer, formatLocalDateTime, formatDuration } from '../lib/time';

   // For API requests (server timezone)
   const serverTime = formatForServer(new Date());
   // → '2024-01-10 15:30:45'

   // For datetime-local inputs
   const localTime = formatLocalDateTime(new Date());
   // → '2024-01-10T15:30:45'

   // Duration formatting
   const duration = formatDuration(125); // seconds
   // → '2:05'

**Used By:** API functions, Events page, filters, dashboard widgets

--------------

Crypto Utilities (``lib/crypto.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Encryption/decryption for secure password storage (web platform).

**Features:** - AES-256-GCM encryption - Secure key derivation - Browser
SubtleCrypto API - Base64 encoding for storage

**Implementation:**

.. code:: typescript

   import { encrypt, decrypt } from '../lib/crypto';

   // Encrypt password
   const encrypted = await encrypt('my-password', 'encryption-key');
   // → Base64 string

   // Decrypt password
   const password = await decrypt(encrypted, 'encryption-key');
   // → 'my-password'

**Used By:** ProfileService, secure storage (web fallback)

--------------

Secure Storage (``lib/secureStorage.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Platform-specific secure storage abstraction.

**Features:** - **Mobile**: Native keychain/keystore via
``@aparajita/capacitor-secure-storage`` - **Web**: Encrypted
localStorage via crypto utilities - Consistent API across platforms

**Implementation:**

.. code:: typescript

   import { saveSecure, getSecure, removeSecure } from '../lib/secureStorage';

   // Save password
   await saveSecure('password_profile_123', 'my-secure-password');

   // Retrieve password
   const password = await getSecure('password_profile_123');

   // Delete password
   await removeSecure('password_profile_123');

**Used By:** ProfileService (password management)

--------------

Platform Detection (``lib/platform.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Platform detection utilities.

**Features:** - Detects Tauri (desktop), Capacitor (mobile), or Web -
Proxy mode detection (development) - Consistent platform checks

**Implementation:**

.. code:: typescript

   import { Platform } from '../lib/platform';

   if (Platform.isTauri) {
     // Desktop-specific code
   }

   if (Platform.isNative) {
     // Mobile-specific code
   }

   if (Platform.shouldUseProxy) {
     // Wrap URLs with proxy
   }

**Used By:** HTTP client, download utilities, proxy utilities,
platform-specific features

--------------

API Validator (``lib/api-validator.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Zod-based runtime validation for API responses.

**Features:** - Type-safe runtime validation - Detailed error messages -
Schema coercion (e.g., numbers as strings)

**Implementation:**

.. code:: typescript

   import { validateApiResponse } from '../lib/api-validator';
   import { MonitorsResponseSchema } from '../api/types';

   const response = await fetch('/api/monitors.json');
   const data = await response.json();

   // Validate and coerce types
   const validated = validateApiResponse(MonitorsResponseSchema, data, {
     endpoint: '/api/monitors.json',
     method: 'GET',
   });

**Used By:** All API functions in ``api/`` directory

--------------

Grid Utils (``lib/grid-utils.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Grid layout calculations for montage views.

**Features:** - Responsive grid column calculations - Aspect ratio
handling - Breakpoint support

**Implementation:**

.. code:: typescript

   import { calculateGridCols, calculateItemHeight } from '../lib/grid-utils';

   const cols = calculateGridCols(viewportWidth, minCardWidth);
   const height = calculateItemHeight(cardWidth, aspectRatio);

**Used By:** Montage page, EventMontage page, dashboard grid

--------------

Reusable UI Components
----------------------

Located in ``src/components/ui/``, these are primitive components used
throughout the app.

Button (``ui/button.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~

Styled button component with variants.

**Variants:** default, destructive, outline, secondary, ghost, link

**Sizes:** default, sm, lg, icon

**Usage:**

.. code:: tsx

   <Button variant="destructive" size="sm" onClick={handleDelete}>
     Delete
   </Button>

**Used By:** All pages and components

--------------

Card (``ui/card.tsx``)
~~~~~~~~~~~~~~~~~~~~~~

Container component for content sections.

**Sub-components:** Card, CardHeader, CardTitle, CardContent, CardFooter

**Usage:**

.. code:: tsx

   <Card>
     <CardHeader>
       <CardTitle>Monitor Name</CardTitle>
     </CardHeader>
     <CardContent>
       <img src={streamUrl} />
     </CardContent>
     <CardFooter>
       <Button>View Details</Button>
     </CardFooter>
   </Card>

**Used By:** MonitorCard, EventCard, Dashboard widgets, Settings pages

--------------

Dialog (``ui/dialog.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~

Modal dialog for confirmations and forms.

**Sub-components:** Dialog, DialogTrigger, DialogContent, DialogHeader,
DialogTitle, DialogDescription, DialogFooter

**Usage:**

.. code:: tsx

   <Dialog open={isOpen} onOpenChange={setIsOpen}>
     <DialogContent>
       <DialogHeader>
         <DialogTitle>Confirm Delete</DialogTitle>
         <DialogDescription>
           Are you sure you want to delete this event?
         </DialogDescription>
       </DialogHeader>
       <DialogFooter>
         <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
         <Button variant="destructive" onClick={handleConfirm}>Delete</Button>
       </DialogFooter>
     </DialogContent>
   </Dialog>

**Used By:** Event deletion, profile deletion, widget editing, PTZ
presets

--------------

Popover (``ui/popover.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Floating content container for filters and actions.

**Sub-components:** Popover, PopoverTrigger, PopoverContent

**Usage:**

.. code:: tsx

   <Popover>
     <PopoverTrigger asChild>
       <Button variant="outline">
         <Filter className="h-4 w-4" />
       </Button>
     </PopoverTrigger>
     <PopoverContent>
       {/* Filter controls */}
     </PopoverContent>
   </Popover>

**Used By:** Filters (Events, Monitors, Timeline), date range selectors

--------------

SecureImage (``ui/secure-image.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Image component that handles authenticated requests.

**Features:** - Fetches images with credentials - Converts to blob URL -
Automatic cleanup

**Implementation:**

.. code:: tsx

   <SecureImage
     src="https://zm.example.com/protected-image.jpg"
     alt="Monitor snapshot"
     className="w-full h-auto"
   />

**How it works:** 1. Fetches image with ``credentials: 'include'`` 2.
Converts response to Blob 3. Creates local blob URL 4. Cleans up on
unmount

**Used By:** Components that need authenticated images (rare - most use
stream URLs with tokens)

--------------

VideoPlayer (``ui/video-player.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

HTML5 video wrapper with platform integration.

**Features:** - Autoplay control - Fullscreen support - Error handling -
Play/pause callbacks

**Usage:**

.. code:: tsx

   <VideoPlayer
     src={videoUrl}
     autoplay={true}
     onPlay={() => console.log('Playing')}
     onPause={() => console.log('Paused')}
   />

**Used By:** EventDetail page (MP4 playback), MonitorDetail (live
streams)

--------------

PasswordInput (``ui/password-input.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Password input with show/hide toggle.

**Features:** - Eye icon toggle - Keyboard-accessible - Standard input
props

**Usage:**

.. code:: tsx

   <PasswordInput
     value={password}
     onChange={(e) => setPassword(e.target.value)}
     placeholder="Enter password"
   />

**Used By:** ProfileForm, Login components

--------------

EmptyState (``ui/empty-state.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Placeholder component for empty lists/states.

**Features:** - Icon support - Title and description - Optional action
button

**Usage:**

.. code:: tsx

   <EmptyState
     icon={<Inbox className="h-12 w-12" />}
     title="No events found"
     description="Try adjusting your filters"
     action={
       <Button onClick={clearFilters}>Clear Filters</Button>
     }
   />

**Used By:** Events page, Monitors page, Dashboard (when no widgets)

--------------

PullToRefresh (``ui/pull-to-refresh-indicator.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Visual indicator for pull-to-refresh gesture.

**Features:** - Platform-aware (mobile only) - Animated spinner -
Progress indication

**Usage:**

.. code:: tsx

   const { isRefreshing, onRefresh } = usePullToRefresh(refetch);

   <>
     <PullToRefreshIndicator isActive={isRefreshing} />
     <IonContent onIonRefresh={onRefresh}>
       {/* Content */}
     </IonContent>
   </>

**Used By:** Events page, Monitors page, Montage page

--------------

QuickDateRangeButtons (``ui/quick-date-range-buttons.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Quick date range selector buttons.

**Features:** - Predefined ranges (24h, 48h, 1wk, 2wk, 1mo) -
Abbreviated labels with tooltips - Responsive (hides text on mobile)

**Usage:**

.. code:: tsx

   <QuickDateRangeButtons
     onRangeSelect={({ start, end }) => {
       setStartDate(start);
       setEndDate(end);
     }}
   />

**Used By:** Events filter, Timeline filter, Dashboard widgets

--------------

Select (``ui/select.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~

Dropdown select component.

**Sub-components:** Select, SelectTrigger, SelectValue, SelectContent,
SelectItem

**Usage:**

.. code:: tsx

   <Select value={value} onValueChange={setValue}>
     <SelectTrigger>
       <SelectValue placeholder="Select option" />
     </SelectTrigger>
     <SelectContent>
       <SelectItem value="option1">Option 1</SelectItem>
       <SelectItem value="option2">Option 2</SelectItem>
     </SelectContent>
   </Select>

**Used By:** Settings pages, filters, dashboard widget config

--------------

Switch (``ui/switch.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~

Toggle switch component.

**Usage:**

.. code:: tsx

   <Switch
     checked={enabled}
     onCheckedChange={setEnabled}
   />

**Used By:** Settings pages, filters (favorites toggle)

--------------

Badge (``ui/badge.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~

Small status indicator.

**Variants:** default, secondary, destructive, outline

**Usage:**

.. code:: tsx

   <Badge variant="destructive">Offline</Badge>
   <Badge>5 events</Badge>

**Used By:** MonitorCard (status), EventCard (alarm frames), navigation
(counts)

--------------

Progress (``ui/progress.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Progress bar component.

**Usage:**

.. code:: tsx

   <Progress value={percentage} max={100} />

**Used By:** Background task drawer (download progress)

--------------

Reusable Domain Components
--------------------------

Located in ``src/components/``, organized by domain.

MonitorFilterPopover (``filters/MonitorFilterPopover.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Monitor selection filter with “All Monitors” toggle.

**Features:** - Select individual monitors - “All Monitors” checkbox -
Search/filter monitors - Used in multiple contexts (Events, Timeline,
Dashboard)

**Usage:**

.. code:: tsx

   <MonitorFilterPopoverContent
     monitors={monitors}
     selectedMonitorIds={selectedMonitorIds}
     onSelectionChange={setSelectedMonitorIds}
     idPrefix="events" // for unique checkbox IDs
   />

**Used By:** Events page, Timeline page, Dashboard widget config

--------------

EventsFilterPopover (``events/EventsFilterPopover.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Comprehensive event filtering UI (extracted from Events page).

**Features:** - Monitor selection via MonitorFilterPopover -
Favorites-only toggle - Date range inputs - Quick date range buttons -
Apply/Clear actions

**Usage:**

.. code:: tsx

   <EventsFilterPopover
     monitors={monitors}
     selectedMonitorIds={selectedMonitorIds}
     onMonitorSelectionChange={setSelectedMonitorIds}
     favoritesOnly={favoritesOnly}
     onFavoritesOnlyChange={setFavoritesOnly}
     startDateInput={startDate}
     onStartDateChange={setStartDate}
     endDateInput={endDate}
     onEndDateChange={setEndDate}
     onQuickRangeSelect={({ start, end }) => {
       setStartDate(formatLocalDateTime(start));
       setEndDate(formatLocalDateTime(end));
     }}
     onApplyFilters={applyFilters}
     onClearFilters={clearFilters}
   />

**Used By:** Events page

--------------

BackgroundTaskDrawer (``BackgroundTaskDrawer.tsx``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Drawer UI for background tasks (downloads, uploads, syncs).

**Features:** - Task progress bars - Cancellation support -
Auto-expand/collapse states - Completion badge

**States:** - Hidden: No tasks - Expanded: Shows progress bars -
Collapsed: Thin bar at bottom - Badge: Floating count badge

**Usage:**

.. code:: tsx

   // Automatically rendered in App.tsx layout
   // Controlled by background task store

   // Adding a task
   const taskStore = useBackgroundTasks.getState();
   const taskId = taskStore.addTask({
     type: 'download',
     metadata: { title: 'Video.mp4', description: 'Event 123' },
     cancelFn: () => abortController.abort(),
   });

   // Update progress
   taskStore.updateProgress(taskId, percentage, bytesProcessed);

   // Complete
   taskStore.completeTask(taskId);

**Used By:** Download functions, upload functions (future)

--------------

Usage Matrix
------------

This table shows which components/pages use which shared services:

+---------------------------------------------+------------------------+
| Service/Utility                             | Used By                |
+=============================================+========================+
| **logger**                                  | All components,        |
|                                             | stores, API functions  |
+---------------------------------------------+------------------------+
| **http**                                    | All API functions,     |
|                                             | download utilities     |
+---------------------------------------------+------------------------+
| **download**                                | MonitorCard,           |
|                                             | EventDetail,           |
|                                             | EventCard, VideoPlayer |
+---------------------------------------------+------------------------+
| **proxy-utils**                             | API functions          |
|                                             | (monitors, events),    |
|                                             | download, http         |
+---------------------------------------------+------------------------+
| **url-builder**                             | API functions, hooks   |
|                                             | (useMonitorStream,     |
|                                             | useEventPlayer)        |
+---------------------------------------------+------------------------+
| **time**                                    | API functions, Events  |
|                                             | page, Timeline,        |
|                                             | Dashboard widgets      |
+---------------------------------------------+------------------------+
| **crypto**                                  | ProfileService, secure |
|                                             | storage (web)          |
+---------------------------------------------+------------------------+
| **secureStorage**                           | ProfileService         |
+---------------------------------------------+------------------------+
| **platform**                                | HTTP client, download, |
|                                             | proxy utilities        |
+---------------------------------------------+------------------------+
| **api-validator**                           | All API functions      |
+---------------------------------------------+------------------------+
| **grid-utils**                              | Montage, EventMontage, |
|                                             | Dashboard              |
+---------------------------------------------+------------------------+

--------------

+-----------------------------------------+----------------------------+
| UI Component                            | Used By                    |
+=========================================+============================+
| **Button**                              | All pages and components   |
+-----------------------------------------+----------------------------+
| **Card**                                | MonitorCard, EventCard,    |
|                                         | Dashboard widgets,         |
|                                         | Settings                   |
+-----------------------------------------+----------------------------+
| **Dialog**                              | Event deletion, Profile    |
|                                         | deletion, Widget editing,  |
|                                         | PTZ presets                |
+-----------------------------------------+----------------------------+
| **Popover**                             | Filters (Events, Monitors, |
|                                         | Timeline), date selectors  |
+-----------------------------------------+----------------------------+
| **SecureImage**                         | (Rare - authenticated      |
|                                         | images)                    |
+-----------------------------------------+----------------------------+
| **VideoPlayer**                         | EventDetail, MonitorDetail |
+-----------------------------------------+----------------------------+
| **PasswordInput**                       | ProfileForm                |
+-----------------------------------------+----------------------------+
| **EmptyState**                          | Events, Monitors,          |
|                                         | Dashboard                  |
+-----------------------------------------+----------------------------+
| **PullToRefresh**                       | Events, Monitors, Montage  |
+-----------------------------------------+----------------------------+
| **QuickDateRangeButtons**               | Events filter, Timeline,   |
|                                         | Dashboard widgets          |
+-----------------------------------------+----------------------------+
| **Select**                              | Settings pages, filters,   |
|                                         | widget config              |
+-----------------------------------------+----------------------------+
| **Switch**                              | Settings pages, favorites  |
|                                         | toggle                     |
+-----------------------------------------+----------------------------+
| **Badge**                               | MonitorCard, EventCard,    |
|                                         | navigation                 |
+-----------------------------------------+----------------------------+
| **Progress**                            | BackgroundTaskDrawer       |
+-----------------------------------------+----------------------------+

--------------

+----------------------------------------------+-----------------------+
| Domain Component                             | Used By               |
+==============================================+=======================+
| **MonitorFilterPopover**                     | Events page, Timeline |
|                                              | page, Dashboard       |
|                                              | widget config         |
+----------------------------------------------+-----------------------+
| **EventsFilterPopover**                      | Events page           |
+----------------------------------------------+-----------------------+
| **BackgroundTaskDrawer**                     | App layout            |
|                                              | (auto-rendered)       |
+----------------------------------------------+-----------------------+

--------------

Adding New Shared Services
--------------------------

When creating a new shared utility, follow these guidelines:

1. Choose the Right Location
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- **``lib/``** - Pure utilities (no React, no stores)
- **``hooks/``** - React-specific logic
- **``services/``** - Platform-specific bridges (Capacitor plugins)
- **``components/ui/``** - Primitive UI components
- **``components/domain/``** - Domain-specific reusable components

2. Document Usage
~~~~~~~~~~~~~~~~~

Update this file with: - Description of the utility - Code examples -
Platform considerations - List of consumers

3. Follow Patterns
~~~~~~~~~~~~~~~~~~

Look at existing utilities for patterns: - Consistent error handling -
Logging via component-specific loggers - Platform detection where needed
- TypeScript types exported

4. Test
~~~~~~~

All shared utilities should have unit tests in ``__tests__/``
subdirectory.

--------------

Key Takeaways
-------------

1. **Logger is universal** - Use component-specific helpers (e.g.,
   ``log.api()``, ``log.download()``)
2. **HTTP abstraction is required** - Never use raw ``fetch()``, always
   use ``httpGet/httpPost/etc``
3. **Platform detection matters** - Different implementations for
   Web/Mobile/Desktop
4. **Proxy in development** - Use ``proxy-utils`` for external URLs in
   dev mode
5. **Shared components reduce duplication** - Extract common UI patterns
6. **Document consumers** - When adding shared code, document who uses
   it
7. **DRY principles** - If code appears in 2+ places, extract to shared
   utility
8. **Test shared code** - Shared utilities have higher reuse, deserve
   more testing

--------------

Recent Refactoring (January 2025)
---------------------------------

The following utilities were recently extracted to eliminate
duplication:

1. **``profile-bootstrap.ts``** - Extracted profile initialization logic
   from profile store
2. **``proxy-utils.ts``** - Centralized proxy URL wrapping (previously
   duplicated 4×)
3. **``serializeRequestBody()``** in http.ts - Extracted duplicate body
   serialization
4. **``generateAndSetConnKey()``** in monitors.ts - Extracted duplicate
   key generation
5. **``getDownloadHandler()`` / ``getDataUrlSnapshotHandler()``** in
   download.ts - Platform strategy pattern
6. **``EventsFilterPopover``** - Extracted from Events page (~80 lines
   of inline JSX)

These changes reduced code by ~600+ lines while improving
maintainability.

Notification Services (services/)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The notification system spans three services that handle different delivery
mechanisms:

**``services/notifications.ts``** — WebSocket connection to ZoneMinder Event
Server (ES mode). Handles real-time alarm events via ``zmeventnotification.pl``.

- Singleton via ``getNotificationService()``
- Exponential backoff reconnection with jitter (2s base, 2min cap)
- ``intentionalDisconnect`` flag prevents reconnect after user-initiated
  disconnect; network failures always retry
- ``checkAlive(timeoutMs)`` liveness probe used on app resume and tab
  visibility change
- ``reconnectNow()`` for immediate reconnect on network restore
- 60-second keepalive ping
- ``reconnectAttempts`` resets only after successful authentication

**``services/pushNotifications.ts``** — FCM push notification handling for
iOS and Android.

- Singleton via ``getPushService()``
- Requests permission, obtains FCM token, registers with ZM server
- In ES mode: registers token via WebSocket; in Direct mode: via REST API
- Foreground notifications are processed and added to the notification store
  (but ignored if WebSocket is already connected, to avoid duplicates)
- Handles notification tap to navigate to event detail

**``services/eventPoller.ts``** — Polls ZM events API for new events in
Direct notification mode on desktop/web.

- Singleton via ``getEventPoller()``
- Started by ``NotificationHandler`` when ``notificationMode === 'direct'``
  and ``Platform.isDesktopOrWeb`` (not used on mobile — FCM handles delivery)
- Uses recursive ``setTimeout`` so interval changes take effect on next tick
- Configurable polling interval per-profile (default 30s)
- Optional ``Notes REGEXP:detected:`` filter for object-detection-only events
- Maintains a seen-event set (capped at 500) to avoid duplicate notifications

**``components/NotificationHandler.tsx``** — Headless component that
orchestrates the notification lifecycle:

- Auto-connects WebSocket (ES mode) or starts poller (Direct mode on desktop)
- Listens for ``window.online`` and ``@capacitor/network`` to trigger
  reconnect on network restore
- Desktop: ``visibilitychange`` listener checks WebSocket liveness on tab
  resume
- Mobile: ``appStateChange`` listener checks WebSocket liveness on app resume
- Displays toast notifications for new events
- Clears native badges on app resume (iOS/Android)

--------------

Next Steps
----------

Continue to `Chapter 6: Testing Strategy <06-testing-strategy>`
to learn how to test shared services and components.
