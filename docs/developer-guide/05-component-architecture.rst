Project Architecture
====================

This chapter describes the overall structure of the zmNinjaNG project,
including non-component logic and the component hierarchy.

Directory Structure
-------------------

The ``src/`` directory is organized by responsibility:

::

   src/
   ├── api/             # API client functions (Zustand independence)
   ├── components/      # React components (Visuals)
   ├── hooks/           # Custom React hooks (Component logic)
   ├── lib/             # Pure utility functions and system wrappers
   ├── pages/           # Route-level views
   ├── services/        # Platform-specific services (Capacitor, etc.)
   ├── stores/          # Global state (Zustand)
   └── types/           # Shared TypeScript definitions

Key Directories Explained
~~~~~~~~~~~~~~~~~~~~~~~~~

- **``api/``**: Contains raw fetch functions for ZoneMinder endpoints.
  These functions are stateless and should not depend on React or stores
  directly if possible (though some might need auth tokens).
- **``hooks/``**: Reusable React logic.

  - ``useMonitorStream``: Manages video stream URLs and auth.
  - ``useEventPlayer``: Manages JPEGs streaming for recorded events.
  - ``useTokenRefresh``: Handles background token renewal.

- **``lib/``**: “Library” code - helpers that could theoretically be in
  a separate npm package.

  - ``logger.ts``: Structured logging system.
  - ``utils.ts``: String formatting, date helpers.
  - ``http.ts``: Fetch wrapper with error handling.

- **``services/``**: Bridges between the web app and native platform
  features.

  - ``notifications.ts``: Push notification handling.
  - ``storage.ts``: Wrapper around Capacitor preferences/secure storage.

- **``stores/``**: Global state management (see Chapter 3).

Component Structure
-------------------

Components are organized by domain in ``src/components/``:

::

   src/components/
   ├── dashboard/          # Dashboard-specific components
   │   ├── DashboardWidget.tsx
   │   ├── DashboardLayout.tsx
   │   ├── DashboardConfig.tsx
   │   ├── WidgetEditDialog.tsx
   │   └── widgets/
   │       ├── MonitorWidget.tsx
   │       ├── EventsWidget.tsx
   │       ├── HeatmapWidget.tsx
   │       └── TimelineWidget.tsx
   ├── monitors/          # Monitor-related components
   │   ├── MonitorCard.tsx
   │   ├── MontageMonitor.tsx
   │   └── PTZControls.tsx
   ├── events/           # Event-related components
   │   ├── EventCard.tsx
   │   ├── EventListView.tsx
   │   ├── EventMontageView.tsx
   │   ├── ZmsEventPlayer.tsx
   │   ├── EventHeatmap.tsx
   │   └── TagChip.tsx         # Event tag display
   ├── filters/          # Filter components
   │   ├── MonitorFilterPopover.tsx
   │   └── GroupFilterSelect.tsx  # Monitor group filtering
   ├── QRScanner.tsx     # QR code scanning for profile import
   └── ui/              # Reusable UI primitives
       ├── button.tsx
       ├── card.tsx
       ├── dialog.tsx
       ├── badge.tsx
       ├── video-player.tsx
       └── ...

Monitor Components
------------------

MonitorCard
~~~~~~~~~~~

**Location**: ``src/components/monitors/MonitorCard.tsx``

The primary component for displaying a single monitor with live stream
preview, status, and actions.

**Key Features:** - Live stream thumbnail (JPEG stream from ZoneMinder)
- Auto-regenerates connection keys on stream failure - Download snapshot
functionality - Status badge (Live/Offline) with FPS - Quick navigation
to monitor detail and events - Settings button for monitor configuration

**Implementation Details:**

.. code:: tsx

   export const MonitorCard = memo(function MonitorCardComponent({
     monitor,
     status,
     eventCount,
     onShowSettings,
     objectFit,
   }: MonitorCardComponentProps) {
     const navigate = useNavigate();
     const { t } = useTranslation();

     // Custom hook manages stream URL and connection state
     const {
       streamUrl,
       displayedImageUrl,
       imgRef,
       regenerateConnection,
     } = useMonitorStream({ monitorId: monitor.Id });

     // Handles stream errors - regenerates connkey once, then shows placeholder
     const handleImageError = () => {
       const img = imgRef.current;
       if (!img) return;

       if (!img.dataset.retrying) {
         img.dataset.retrying = 'true';
         regenerateConnection();
         toast.error(t('monitors.stream_connection_lost', { name: monitor.Name }));

         setTimeout(() => {
           if (img) delete img.dataset.retrying;
         }, 5000);
       } else {
         // Show "No Signal" placeholder
         img.src = `data:image/svg+xml,...`;
       }
     };

     // Downloads current frame as snapshot
     const handleDownloadSnapshot = async (e: React.MouseEvent) => {
       e.stopPropagation();
       if (imgRef.current) {
         await downloadSnapshotFromElement(imgRef.current, monitor.Name);
         toast.success(t('monitors.snapshot_downloaded'));
       }
     };

     return (
       <Card data-testid="monitor-card">
         {/* Stream preview */}
         <div onClick={() => navigate(`/monitors/${monitor.Id}`)}>
           <img
             ref={imgRef}
             src={displayedImageUrl || streamUrl}
             onError={handleImageError}
             style={{ objectFit: resolvedFit }}
           />
           <Badge variant={isRunning ? 'default' : 'destructive'}>
             {isRunning ? t('monitors.live') : t('monitors.offline')}
           </Badge>
         </div>

         {/* Info and actions */}
         <div>
           <div>{monitor.Name}</div>
           <div>{status?.CaptureFPS || '0'} FPS</div>
           <Button onClick={() => navigate(`/events?monitorId=${monitor.Id}`)}>
             Events {eventCount > 0 && <Badge>{eventCount}</Badge>}
           </Button>
           <Button onClick={handleShowSettings}>Settings</Button>
           <Button onClick={handleDownloadSnapshot}>Download</Button>
         </div>
       </Card>
     );
   });

**Why it’s memoized:**

The component is wrapped in ``React.memo()`` to prevent unnecessary
re-renders when the monitor list updates but this specific monitor’s
data hasn’t changed.

**The useMonitorStream Hook:**

Encapsulates stream URL generation and connection key management: -
Generates authenticated stream URL with connection key - Watches for
failures and regenerates keys - Returns ref for the ``<img>:doc:`` element
for snapshot downloads - **See** `Chapter 7: Streaming
Mechanics <07-api-and-data-fetching>` for
details on cache busting (``_t``), multi-port streaming, and snapshot
preloading. - Uses ``src/lib/url-builder.ts`` for centralized URL
construction.

MontageMonitor
~~~~~~~~~~~~~~

**Location**: ``src/components/monitors/MontageMonitor.tsx``

A simplified version of MonitorCard optimized for the montage view with
many monitors.

**Differences from MonitorCard:** - Minimal UI (no buttons, just stream
and status) - Smaller footprint for grid display - Click to view
full-screen - Uses same ``useMonitorStream`` hook

**Usage:**

.. code:: tsx

   <MontageGrid>
     {monitors.map(monitor => (
       <MontageMonitor
         key={monitor.Id}
         monitor={monitor}
         onPress={() => navigate(`/monitors/${monitor.Id}`)}
       />
     ))}
   </MontageGrid>

PTZControls
~~~~~~~~~~~

**Location**: ``src/components/monitors/PTZControls.tsx``

Pan-Tilt-Zoom control interface for controllable cameras.

**Features:** - Directional pad for pan/tilt - Zoom in/out controls -
Preset position buttons - Auto-pause mode (move while pressed)

**API Integration:**

.. code:: tsx

   const handleMove = async (direction: PTZDirection) => {
     await api.ptzControl(monitor.Id, {
       command: direction,
       speed: zoomSpeed,
     });
   };

Dashboard Components
--------------------

DashboardWidget
~~~~~~~~~~~~~~~

**Location**: ``src/components/dashboard/DashboardWidget.tsx``

Wrapper component that provides edit, delete, and drag functionality for
dashboard widgets.

**Implementation:**

.. code:: tsx

   export function DashboardWidget({
     id,
     title,
     children,
     profileId,
     'data-grid': dataGrid,  // From react-grid-layout
   }: DashboardWidgetProps) {
     const isEditing = useDashboardStore((state) => state.isEditing);
     const removeWidget = useDashboardStore((state) => state.removeWidget);
     const widgetRef = useRef<HTMLDivElement>(null);
     const [editDialogOpen, setEditDialogOpen] = useState(false);

     return (
       <Card ref={widgetRef} data-grid={dataGrid}>
         {/* Edit mode controls */}
         {isEditing && (
           <div className="absolute top-2 right-2 z-50 flex gap-2">
             <Button
               onClick={(e) => {
                 e.stopPropagation();  // Prevent drag
                 setEditDialogOpen(true);
               }}
               onMouseDown={(e) => e.stopPropagation()}  // Prevent drag
             >
               <Pencil />
             </Button>
             <Button
               onClick={(e) => {
                 e.stopPropagation();
                 removeWidget(profileId, id);
               }}
               onMouseDown={(e) => e.stopPropagation()}
             >
               <X />
             </Button>
           </div>
         )}

         {/* Drag handle */}
         {title && (
           <CardHeader className="drag-handle cursor-move">
             {isEditing && <GripVertical />}
             {title}
           </CardHeader>
         )}

         {/* Widget content */}
         <CardContent>{children}</CardContent>
       </Card>
     );
   }

**Key Point: Preventing Drag on Buttons**

Notice the ``e.stopPropagation()`` and
``onMouseDown={(e) => e.stopPropagation()}`` on the buttons. This
prevents ``react-grid-layout`` from initiating a drag when you click the
buttons.

Without this, clicking “Delete” would start dragging the widget instead
of deleting it.

Widget Types
~~~~~~~~~~~~

All widgets follow the same pattern: they’re wrapped in
``DashboardWidget`` and receive configuration:

**MonitorWidget**
(``src/components/dashboard/widgets/MonitorWidget.tsx``): - Displays a
single monitor stream - Configuration: monitor ID, object-fit mode

**EventsWidget**
(``src/components/dashboard/widgets/EventsWidget.tsx``): - Shows recent
events list - Configuration: monitor filter, date range

**HeatmapWidget**
(``src/components/dashboard/widgets/HeatmapWidget.tsx``): - Event
frequency heatmap by day/hour - Configuration: date range, monitors

**TimelineWidget**
(``src/components/dashboard/widgets/TimelineWidget.tsx``): - Event
timeline visualization - Configuration: date range

**Usage:**

.. code:: tsx

   <DashboardWidget id="widget-1" title="Front Door" profileId={profileId}>
     <MonitorWidget monitorId="1" />
   </DashboardWidget>

Event Components
----------------

EventCard
~~~~~~~~~

**Location**: ``src/components/events/EventCard.tsx``

Displays a single event with thumbnail, details, and actions.

**Features:** - Event thumbnail - Cause/notes display - Duration and
timestamp - Quick play button - Delete/download actions

ZmsEventPlayer
~~~~~~~~~~~~~~

**Location**: ``src/components/events/ZmsEventPlayer.tsx``

Video player for event playback using ZoneMinder’s zms streaming.

**Features:** - Play/pause controls - Frame-by-frame navigation - Speed
control (0.25x - 2x) - Progress bar with scrubbing - Fullscreen support

**Implementation Detail:**

The player generates a progressive stream URL:

.. code:: tsx

   const streamUrl = `${profile.portalUrl}/cgi-bin/nph-zms?mode=jpeg&event=${eventId}&frame=1&scale=100&rate=100&maxfps=30&connkey=${connkey}`;

Parameters: - ``mode=jpeg``: JPEG stream (vs MPEG) - ``event``: Event ID
- ``frame``: Starting frame - ``rate``: Playback speed (100 = 1x, 200 =
2x, 50 = 0.5x) - ``maxfps``: Frame rate cap - ``connkey``:
Authentication token

EventHeatmap
~~~~~~~~~~~~

**Location**: ``src/components/events/EventHeatmap.tsx``

Calendar heatmap showing event frequency by day and hour.

**Uses:** - ``react-calendar-heatmap`` for visualization - Queries event
counts aggregated by time - Color intensity based on event frequency

TagChip
~~~~~~~

**Location**: ``src/components/events/TagChip.tsx``

Displays event tags as small badge/chip elements.

**Features:** - Compact visual representation of tags - Used in
EventCard to show assigned tags - Styled to match the app’s design
system

**Usage:**

.. code:: tsx

   <div className="flex gap-1">
     {tags.map(tag => (
       <TagChip key={tag.Id} tag={tag} />
     ))}
   </div>

Filter Components
-----------------

GroupFilterSelect
~~~~~~~~~~~~~~~~~

**Location**: ``src/components/filters/GroupFilterSelect.tsx``

Dropdown component for filtering monitors by group.

**Features:** - Fetches groups from the groups API - Supports “All
Groups” option - Updates filter state when selection changes

**Usage:**

.. code:: tsx

   <GroupFilterSelect
     value={selectedGroupId}
     onChange={(groupId) => setSelectedGroupId(groupId)}
   />

QR Scanner
----------

QRScanner
~~~~~~~~~

**Location**: ``src/components/QRScanner.tsx``

A dialog-based QR code scanner for importing server profiles.

**Platform Implementations:** - **Native (iOS/Android)**: Uses
``capacitor-barcode-scanner`` for native camera access - **Web
(Desktop)**: Uses ``html5-qrcode`` library with browser camera API

**Features:** - Scan QR codes with device camera - Load QR codes from
photo files (“Load from Photo” option) - Graceful error handling for
permission denied, camera not found - Auto-cleanup of scanner resources
on unmount

**Usage:**

.. code:: tsx

   <QRScanner
     open={scannerOpen}
     onOpenChange={setScannerOpen}
     onScan={(data) => {
       // data contains the decoded QR code content
       // Parse as JSON for profile data
       const profile = JSON.parse(data);
       importProfile(profile);
     }}
   />

**Implementation Notes:** - The ``html5-qrcode`` library manipulates DOM
directly, so the scanner container is created outside React’s virtual
DOM to avoid reconciliation conflicts - Native scanner launches a
full-screen camera view; the dialog is hidden while scanning - File
scanning creates a temporary DOM element, scans the image, then cleans
up

UI Components
-------------

Located in ``src/components/ui/``, these are reusable primitives:

SecureImage
~~~~~~~~~~~

**Location**: ``src/components/ui/secure-image.tsx``

An image component that handles authenticated requests (for servers
requiring auth).

**Implementation:**

.. code:: tsx

   export function SecureImage({ src, alt, ...props }: SecureImageProps) {
     const [blobUrl, setBlobUrl] = useState<string | null>(null);

     useEffect(() => {
       if (!src) return;

       // Fetch with credentials
       fetch(src, { credentials: 'include' })
         .then(res => res.blob())
         .then(blob => {
           const url = URL.createObjectURL(blob);
           setBlobUrl(url);
         });

       return () => {
         if (blobUrl) URL.revokeObjectURL(blobUrl);
       };
     }, [src]);

     return <img src={blobUrl || ''} alt={alt} {...props} />;
   }

This fetches the image with credentials, converts to a blob, and creates
a local URL. Necessary for servers that require authentication on all
requests.

VideoPlayer
~~~~~~~~~~~

**Location**: ``src/components/ui/video-player.tsx``

Wrapper around HTML5 video with Ionic integration.

**Features:** - Autoplay control - Play/pause callbacks - Error handling
- Fullscreen support

PasswordInput
~~~~~~~~~~~~~

**Location**: ``src/components/ui/password-input.tsx``

Text input with show/hide password toggle.

**Implementation:**

.. code:: tsx

   export function PasswordInput({ ...props }: PasswordInputProps) {
     const [showPassword, setShowPassword] = useState(false);

     return (
       <div className="relative">
         <input
           type={showPassword ? 'text' : 'password'}
           {...props}
         />
         <button
           onClick={() => setShowPassword(!showPassword)}
           className="absolute right-2 top-2"
         >
           {showPassword ? <EyeOff /> : <Eye />}
         </button>
       </div>
     );
   }

Component Composition
---------------------

Components are designed to be composable. Example: building a monitor
view:

.. code:: tsx

   function MonitorDetailPage() {
     const { id } = useParams();

     return (
       <IonPage>
         <IonHeader>
           <Toolbar />
         </IonHeader>
         <IonContent>
           <VideoPlayer src={streamUrl} />  {/* UI component */}
           <MonitorInfo monitor={monitor} />  {/* Monitor component */}
           {monitor.Controllable === '1' && (
             <PTZControls monitor={monitor} />  {/* Monitor component */}
           )}
           <EventTimeline monitorId={id} />  {/* Event component */}
         </IonContent>
       </IonPage>
     );
   }

Testing Data Attributes
-----------------------

All interactive components have ``data-testid`` attributes for E2E
tests:

.. code:: tsx

   <Card data-testid="monitor-card">
     <img data-testid="monitor-player" />
     <Badge data-testid="monitor-status" />
     <div data-testid="monitor-name">{monitor.Name}</div>
     <Button data-testid="monitor-events-button">Events</Button>
     <Button data-testid="monitor-settings-button">Settings</Button>
     <Button data-testid="monitor-download-button">Download</Button>
   </Card>

These are used in E2E tests:

.. code:: gherkin

   When I click on the first monitor card
   Then I should see the monitor player
   And the monitor status should be "Live"

Implementation in ``tests/steps.ts``:

.. code:: tsx

   When('I click on the first monitor card', async ({ page }) => {
     await page.locator('[data-testid="monitor-card"]').first().click();
   });

   Then('the monitor status should be {string}', async ({ page }, status) => {
     await expect(page.locator('[data-testid="monitor-status"]')).toHaveText(status);
   });

Key Patterns
------------

1. Memo for List Items
~~~~~~~~~~~~~~~~~~~~~~

Components rendered in lists are memoized to prevent unnecessary
re-renders:

.. code:: tsx

   export const MonitorCard = memo(MonitorCardComponent);
   export const EventCard = memo(EventCardComponent);

2. Custom Hooks for Complex Logic
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Complex logic is extracted into hooks:

- ``useCurrentProfile()`` - Current profile and settings (stable
  references, prevents re-render loops)
- ``useMonitorStream()`` - Stream URL and connection management
- ``useEventPlayer()`` - Event playback state
- ``usePTZControl()`` - PTZ command handling

3. Refs for DOM Access
~~~~~~~~~~~~~~~~~~~~~~

Components that need DOM access (screenshots, video, etc.) use refs:

.. code:: tsx

   const imgRef = useRef<HTMLImageElement>(null);

   const downloadSnapshot = () => {
     if (imgRef.current) {
       downloadSnapshotFromElement(imgRef.current, monitor.Name);
     }
   };

4. Stop Propagation for Nested Interactions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When components have nested clickable areas:

.. code:: tsx

   <Card onClick={openDetails}>
     <Button onClick={(e) => {
       e.stopPropagation();  // Don't trigger card click
       handleDelete();
     }}>Delete</Button>
   </Card>

Component Communication
-----------------------

Props Down
~~~~~~~~~~

Parent components pass data and callbacks to children:

.. code:: tsx

   <MonitorCard
     monitor={monitor}
     status={status}
     eventCount={eventCount}
     onShowSettings={(m) => setSelectedMonitor(m)}
   />

Events Up
~~~~~~~~~

Children notify parents via callbacks:

.. code:: tsx

   function MonitorCard({ onShowSettings }) {
     return (
       <Button onClick={() => onShowSettings(monitor)}>
         Settings
       </Button>
     );
   }

Global State via Zustand
~~~~~~~~~~~~~~~~~~~~~~~~

Components access global state directly:

.. code:: tsx

   const isEditing = useDashboardStore((state) => state.isEditing);
   const removeWidget = useDashboardStore((state) => state.removeWidget);

Key Takeaways
-------------

1. **Components organized by domain**: dashboard/, monitors/, events/,
   ui/
2. **Memoize list items**: Prevent unnecessary re-renders
3. **Data attributes for testing**: All interactive elements have
   :doc:``data-testid``
4. **Custom hooks extract logic**: ``useMonitorStream``,
   ``useEventPlayer``, etc.
5. **Refs for DOM access**: Screenshots, video playback, scroll position
6. **Stop propagation**: Nested clickable areas need
   ``e.stopPropagation()``
7. **Composition over inheritance**: Build complex UIs from simple
   components
8. **Stream URL management**: useMonitorStream hook handles
   authentication and regeneration

Platform Integrations (``src/services/``)
-----------------------------------------

The ``src/services/`` directory allows the React application to interact
with native device features provided by Capacitor. This layer acts as a
bridge, ensuring the UI code remains platform-agnostic.

Storage Service (``services/storage.ts``)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

We use a hybrid storage approach: - **Web**: Standard ``localStorage``.
- **Native (iOS/Android)**: Encrypted ``SecureStorage`` (via
``@aparajita/capacitor-secure-storage``).

**Why?** Storing authentication tokens in plaintext ``localStorage`` on
a shared device (or even a phone) is a security risk. SecureStorage uses
the device’s hardware-backed keystore (Keychain on iOS, Keystore on
Android).

Feature Deep Dive: Notifications
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The notification system supports two modes and involves native plugins,
REST API calls, WebSocket connections, and local state management.

**1. Notification Modes**

- **ES (Event Server)**: WebSocket connection to zmeventnotification
  server for real-time events. FCM push on iOS/Android. Default mode.
- **Direct**: Uses ZoneMinder's Notifications REST API. FCM push on
  iOS/Android (server sends directly). Event polling on desktop/web.
  No Event Server required.

**2. The Stack**

- **Native Layer**: Firebase Cloud Messaging (FCM) via
  ``@capacitor-firebase/messaging``
- **WebSocket Service**: ``src/services/notifications.ts`` (ES mode)
- **Push Service**: ``src/services/pushNotifications.ts`` (FCM on
  iOS/Android)
- **Event Poller**: ``src/services/eventPoller.ts`` (Direct mode on
  desktop/web)
- **Notifications API**: ``src/api/notifications.ts`` (Direct mode
  token registration)
- **Store**: ``src/stores/notifications.ts``
- **Orchestrator**: ``src/components/NotificationHandler.tsx``
- **UI**: ``src/pages/NotificationSettings.tsx``

**3. The Registration Flow**

ES mode:

1. User enables notifications and selects Event Server mode.
2. App connects to ES via WebSocket and authenticates.
3. On mobile, ``MobilePushService`` requests FCM permission and obtains
   a token.
4. Token is sent to ES via the WebSocket ``push`` command.

Direct mode:

1. User enables notifications and selects Direct mode.
2. On mobile, ``MobilePushService`` requests FCM permission and obtains
   a token.
3. Token is registered with ZoneMinder via
   ``POST /api/notifications.json`` (includes platform, monitor list,
   and push state).
4. On desktop/web, the event poller starts polling
   ``/api/events.json`` at the configured interval.

**4. Handling Incoming Notifications**

- **Foreground (WebSocket/ES mode)**: Events arrive via WebSocket.
  ``NotificationHandler`` watches the store and shows toast
  notifications. FCM duplicates are suppressed (guard checks
  ``isConnected``).
- **Foreground (Push/Direct mode)**: FCM ``notificationReceived``
  fires. ``MobilePushService`` parses the payload (supports both ES
  and ZM field formats) and calls ``addEvent``. The store update
  triggers a toast via ``NotificationHandler``.
- **Foreground (Poller/Direct desktop)**: The event poller adds new
  events to the store. Toasts are shown by ``NotificationHandler``.
- **Background/Closed**: Tapping a system notification triggers
  ``notificationActionPerformed``. The app launches and navigates to
  the event detail page.

**5. Deduplication**

``addEvent`` in the store replaces any existing event with the same
``EventId``, preventing duplicate entries when the same event arrives
from multiple sources (e.g., WebSocket and FCM).

Next Steps
----------

Continue to `Chapter 6: Testing Strategy <06-testing-strategy>`
to learn how to test these components.
