Pages and Views
===============

This chapter provides a tour of the application screens and the routing
logic that connects them.

Routing and Navigation
----------------------

zmNinjaNG uses **React Router** (``react-router-dom``) for client-side
routing. The router integration is handled in ``src/App.tsx``.

Route Structure
~~~~~~~~~~~~~~~

Routes are defined in the ``AppRoutes`` component. There are two main
types of routes:

1. **Standalone Routes**: Render outside the main layout (e.g., Setup
   Wizard).
2. **Layout Routes**: Render inside ``AppLayout``, which provides the
   sidebar navigation and header.

.. code:: tsx

   // src/App.tsx
   <Routes>
     {/* Standalone Route */}
     <Route path="/profiles/new" element={<ProfileForm />} />

     {/* Layout Routes - wrapped in AppLayout */}
     <Route element={<AppLayout />}>
       <Route path="dashboard" element={<Dashboard />} />
       <Route path="monitors" element={<Monitors />} />
       {/* ... other pages ... */}
     </Route>
   </Routes>

Route Error Boundaries
~~~~~~~~~~~~~~~~~~~~~~

Each route is wrapped in a ``RouteErrorBoundary`` component. This
ensures that if a specific page crashes (e.g., due to a rendering bug),
it doesn’t crash the entire application. The user sees an error message
for that page but can still use the navigation sidebar to go elsewhere.

Programmatic Navigation
~~~~~~~~~~~~~~~~~~~~~~~

To navigate imperatively from code, use the ``useNavigate`` hook:

.. code:: tsx

   import { useNavigate } from 'react-router-dom';

   function MyComponent() {
     const navigate = useNavigate();

     const handleSave = () => {
       // Navigate to monitor details
       navigate(`/monitors/${monitorId}`);
     };
   }

Page Structure
--------------

All pages in zmNinjaNG follow the Ionic page pattern and are located in
``src/pages/``:

::

   src/pages/
   ├── Dashboard.tsx       # Main dashboard with widgets
   ├── Montage.tsx        # Multi-monitor grid view
   ├── Monitors.tsx       # Monitor list/grid view
   ├── MonitorDetail.tsx  # Single monitor view with live stream
   ├── EventDetail.tsx    # Event playback and details
   ├── Events.tsx         # Events list/timeline
   ├── ProfileForm.tsx    # Profile creation/editing
   ├── Profiles.tsx       # Profile selection screen
   └── Settings.tsx       # App settings

Each page uses the ``IonPage`` component and handles its own data
fetching and state management.

Dashboard Page
--------------

**Location**: ``src/pages/Dashboard.tsx``

The dashboard displays customizable widgets using ``react-grid-layout``.
Users can add, remove, reorder, and resize widgets.

Architecture
~~~~~~~~~~~~

.. code:: tsx

   export default function Dashboard() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const widgets = useDashboardStore((state) => state.widgets);
     const layout = useDashboardStore((state) => state.layout);

     if (!currentProfile) {
       return <ProfileRequired />;
     }

     return (
       <IonPage>
         <IonHeader>
           <DashboardHeader />
         </IonHeader>
         <IonContent>
           <DashboardLayout
             widgets={widgets}
             layout={layout}
             onLayoutChange={saveLayout}
           />
         </IonContent>
       </IonPage>
     );
   }

DashboardLayout Component
~~~~~~~~~~~~~~~~~~~~~~~~~

**Location**: ``src/components/dashboard/DashboardLayout.tsx``

This component handles the grid layout and responds to window resize
events.

**Key Implementation Detail - The ResizeObserver Pattern:**

The component needs to: 1. Detect when the container width changes 2.
Calculate how many grid columns fit 3. Save the preference to user
settings

.. code:: tsx

   function DashboardLayout() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const updateSettings = useProfileStore((state) => state.updateSettings);
     const gridCols = useDashboardStore((state) => state.gridCols);

     // Calculate max columns based on container width
     const handleWidthChange = useCallback((width: number) => {
       const maxCols = calculateMaxCols(width);

       if (gridCols > maxCols) {
         setGridCols(maxCols);

         // Save to profile settings
         if (currentProfile) {
           updateSettings(currentProfile.id, { gridCols: maxCols });
         }
       }
     }, [gridCols, currentProfile, updateSettings]);

     // Set up ResizeObserver
     const containerRef = useCallback((node: HTMLDivElement | null) => {
       if (node) {
         const observer = new ResizeObserver(entries => {
           handleWidthChange(entries[0].contentRect.width);
         });
         observer.observe(node);

         return () => observer.disconnect();
       }
     }, [handleWidthChange]);

     return <div ref={containerRef}>...</div>;
   }

**The Problem: Infinite Loop**

The above code has a critical bug. Here’s what happens:

1. Component renders
2. ``currentProfile`` and ``updateSettings`` from Zustand get new object
   references
3. ``handleWidthChange`` recreates (dependencies changed)
4. ``containerRef`` recreates (depends on ``handleWidthChange``)
5. ``containerRef`` callback runs (ref changed)
6. Creates **new** ResizeObserver
7. New observer immediately fires (element has size)
8. Calls ``handleWidthChange`` → updates settings → triggers re-render
9. Back to step 1 → **infinite loop**

Even though ``currentProfile`` and ``updateSettings`` have the same
**values**, Zustand returns new **references** on every render. React
sees them as different and recreates the callback.

**The Solution: Use Refs**

We need to decouple the Zustand values from the callback dependencies:

.. code:: tsx

   function DashboardLayout() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const updateSettings = useProfileStore((state) => state.updateSettings);
     const gridCols = useDashboardStore((state) => state.gridCols);

     // Store Zustand values in refs - doesn't trigger re-renders
     const currentProfileRef = useRef(currentProfile);
     const updateSettingsRef = useRef(updateSettings);

     // Keep refs synchronized with latest values
     useEffect(() => {
       currentProfileRef.current = currentProfile;
       updateSettingsRef.current = updateSettings;
     }, [currentProfile, updateSettings]);

     // Now callback only depends on gridCols (a primitive value, stable)
     const handleWidthChange = useCallback((width: number) => {
       const maxCols = calculateMaxCols(width);

       if (gridCols > maxCols) {
         setGridCols(maxCols);

         // Access via ref - always has current value
         if (currentProfileRef.current) {
           updateSettingsRef.current(currentProfileRef.current.id, {
             gridCols: maxCols
           });
         }
       }
     }, [gridCols]);  // Only gridCols - stable dependency

     const containerRef = useCallback((node: HTMLDivElement | null) => {
       if (node) {
         const observer = new ResizeObserver(entries => {
           handleWidthChange(entries[0].contentRect.width);
         });
         observer.observe(node);

         return () => observer.disconnect();
       }
     }, [handleWidthChange]);

     return <div ref={containerRef}>...</div>;
   }

**Why This Works:**

- Refs don’t trigger re-renders when updated
- ``handleWidthChange`` only recreates when ``gridCols`` changes (actual
  layout change)
- Refs always hold the latest ``currentProfile`` and ``updateSettings``
- ResizeObserver doesn’t get recreated unnecessarily
- No infinite loop

**When to Apply This Pattern:**

Anytime you have: - A callback with Zustand/hook values in dependencies
(``useCallback``, ``useEffect``) - That callback is triggered by
external events (ResizeObserver, timers, listeners) - The callback
updates state or calls actions

Use refs to hold the unstable values instead of putting them in
dependencies.

Montage Page
------------

**Location**: ``src/pages/Montage.tsx``

Displays all monitors in a grid layout for simultaneous viewing.

.. _architecture-1:

Architecture
~~~~~~~~~~~~

.. code:: tsx

   export default function Montage() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const gridCols = useMontageStore((state) => state.gridCols);
     const { data: monitors } = useQuery({
       queryKey: ['monitors', currentProfile?.id],
       queryFn: () => fetchMonitors(currentProfile!.id),
       enabled: !!currentProfile,
     });

     if (!currentProfile) {
       return <ProfileRequired />;
     }

     return (
       <IonPage>
         <IonHeader>
           <MontageHeader />
         </IonHeader>
         <IonContent>
           <MontageGrid
             monitors={monitors}
             gridCols={gridCols}
           />
         </IonContent>
       </IonPage>
     );
   }

The Same Infinite Loop Issue
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Montage also uses ResizeObserver and hit the same bug:

.. code:: tsx

   function Montage() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const updateSettings = useProfileStore((state) => state.updateSettings);
     const { t } = useTranslation();  // Also an unstable reference!

     const handleWidthChange = useCallback((width: number) => {
       const maxCols = getMaxColsForWidth(width, MIN_CARD_WIDTH, GRID_MARGIN);

       if (gridCols > maxCols) {
         setGridCols(maxCols);

         if (currentProfile) {
           updateSettings(currentProfile.id, { montageGridCols: maxCols });
         }

         toast.error(t('montage.screen_too_small'));  // Uses t function
       }
     }, [gridCols, currentProfile, updateSettings, t]);  // All unstable!
   }

**Additional Complexity:**

The ``t`` function from ``useTranslation()`` is also unstable - gets a
new reference on every render.

**The Fix:**

Same pattern - use refs for all unstable dependencies:

.. code:: tsx

   function Montage() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const updateSettings = useProfileStore((state) => state.updateSettings);
     const { t } = useTranslation();

     // Refs for all unstable values
     const currentProfileRef = useRef(currentProfile);
     const updateSettingsRef = useRef(updateSettings);
     const tRef = useRef(t);

     // Keep refs synchronized
     useEffect(() => {
       currentProfileRef.current = currentProfile;
       updateSettingsRef.current = updateSettings;
       tRef.current = t;
     }, [currentProfile, updateSettings, t]);

     // Stable callback - only primitive dependencies
     const handleWidthChange = useCallback((width: number) => {
       const maxCols = getMaxColsForWidth(width, MIN_CARD_WIDTH, GRID_MARGIN);

       if (gridCols > maxCols) {
         setGridCols(maxCols);

         if (currentProfileRef.current) {
           updateSettingsRef.current(currentProfileRef.current.id, {
             montageGridCols: maxCols
           });
         }

         toast.error(tRef.current('montage.screen_too_small'));
       }
     }, [gridCols]);  // Only primitive
   }

**Lesson Learned:**

This bug happened twice in the codebase (DashboardLayout first, then
Montage weeks later) because: - The pattern (ResizeObserver + Zustand)
is common - The bug doesn’t appear immediately - only when resize events
occur - Developers might not realize the same pitfall applies - Without
understanding the root cause, it’s easy to repeat

Now we document it clearly and watch for this pattern in code reviews.

Monitors Page
-------------

**Location**: ``src/pages/Monitors.tsx``

Displays all monitors for the current profile in a list or grid view.

.. _architecture-2:

Architecture
~~~~~~~~~~~~

.. code:: tsx

   export default function Monitors() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const viewMode = useMonitorStore((state) => state.viewMode);  // 'list' | 'grid'

     const { data, isLoading, error } = useQuery({
       queryKey: ['monitors', currentProfile?.id],
       queryFn: () => fetchMonitors(currentProfile!.id),
       enabled: !!currentProfile,
       refetchInterval: 30000,  // Refetch every 30s
     });

     if (!currentProfile) {
       return <ProfileRequired />;
     }

     return (
       <IonPage>
         <IonHeader>
           <IonToolbar>
             <IonTitle>{t('monitors.title')}</IonTitle>
             <IonButtons slot="end">
               <ViewModeToggle mode={viewMode} onChange={setViewMode} />
             </IonButtons>
           </IonToolbar>
         </IonHeader>
         <IonContent>
           {isLoading && <MonitorListSkeleton />}
           {error && <ErrorDisplay error={error} />}
           {data && (
             viewMode === 'grid' ?
               <MonitorGrid monitors={data.monitors} /> :
               <MonitorList monitors={data.monitors} />
           )}
         </IonContent>
       </IonPage>
     );
   }

**Key Points:**

- Uses React Query for data fetching
- Automatic refetch every 30 seconds
- Handles loading/error states
- Switches between list/grid view modes
- All state managed via Zustand stores

MonitorDetail Page
------------------

**Location**: ``src/pages/MonitorDetail.tsx``

Full-screen view of a single monitor with live stream.

.. _architecture-3:

Architecture
~~~~~~~~~~~~

.. code:: tsx

   export default function MonitorDetail() {
     const { id } = useParams<{ id: string }>();
     const currentProfile = useProfileStore((state) => state.currentProfile);

     const { data: monitor } = useQuery({
       queryKey: ['monitor', id],
       queryFn: () => fetchMonitor(id),
       enabled: !!currentProfile,
     });

     const { data: streamUrl } = useQuery({
       queryKey: ['stream', id],
       queryFn: () => generateStreamUrl(currentProfile!.id, id),
       enabled: !!monitor,
     });

     return (
       <IonPage>
         <IonHeader>
           <IonToolbar>
             <IonButtons slot="start">
               <IonBackButton />
             </IonButtons>
             <IonTitle>{monitor?.Monitor.Name}</IonTitle>
           </IonToolbar>
         </IonHeader>
         <IonContent>
           {streamUrl ? (
             <VideoPlayer src={streamUrl} autoPlay />
           ) : (
             <StreamSkeleton />
           )}
           <MonitorControls monitorId={id} />
         </IonContent>
       </IonPage>
     );
   }

**Stream URL Generation:**

The app generates authenticated stream URLs with connection keys:

.. code:: tsx

   async function generateStreamUrl(profileId: string, monitorId: string) {
     const profile = getProfile(profileId);
     const connkey = await generateConnKey(profile);

     return `${profile.portalUrl}/cgi-bin/nph-zms?mode=jpeg&monitor=${monitorId}&connkey=${connkey}`;
   }

Connection keys are cached and regenerated when they expire.

Events Page
-----------

**Location**: ``src/pages/Events.tsx``

Displays a timeline/list of recorded events.

.. _architecture-4:

Architecture
~~~~~~~~~~~~

.. code:: tsx

   export default function Events() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const [filters, setFilters] = useState({ monitorId: null, date: null });

     const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
       queryKey: ['events', currentProfile?.id, filters],
       queryFn: ({ pageParam = 0 }) =>
         fetchEvents(currentProfile!.id, { ...filters, page: pageParam }),
       getNextPageParam: (lastPage) => lastPage.nextPage,
       enabled: !!currentProfile,
     });

     return (
       <IonPage>
         <IonHeader>
           <IonToolbar>
             <IonTitle>{t('events.title')}</IonTitle>
           </IonToolbar>
           <EventFilters filters={filters} onChange={setFilters} />
         </IonHeader>
         <IonContent>
           <EventTimeline
             events={data?.pages.flatMap(p => p.events)}
             onLoadMore={fetchNextPage}
             hasMore={hasNextPage}
           />
         </IonContent>
       </IonPage>
     );
   }

**Infinite Scroll:**

Uses ``useInfiniteQuery`` from React Query to load events incrementally
as the user scrolls.

ProfileForm Page
----------------

**Location**: ``src/pages/ProfileForm.tsx``

Create and edit ZoneMinder server profiles.

.. _architecture-5:

Architecture
~~~~~~~~~~~~

.. code:: tsx

   export default function ProfileForm() {
     const { id } = useParams<{ id?: string }>();  // Optional - create vs edit
     const history = useHistory();
     const addProfile = useProfileStore((state) => state.addProfile);
     const updateProfile = useProfileStore((state) => state.updateProfile);

     const [formData, setFormData] = useState({
       name: '',
       portalUrl: '',
       username: '',
       password: '',
     });

     // Load existing profile if editing
     useEffect(() => {
       if (id) {
         const profile = getProfile(id);
         if (profile) setFormData(profile);
       }
     }, [id]);

     const handleTestConnection = async () => {
       try {
         await testConnection(formData);
         toast.success(t('profile.connection_success'));
       } catch (error) {
         toast.error(t('profile.connection_failed'));
       }
     };

     const handleSave = () => {
       if (id) {
         updateProfile(id, formData);
       } else {
         const newProfile = { ...formData, id: generateId() };
         addProfile(newProfile);
       }

       history.goBack();
     };

     return (
       <IonPage>
         <IonHeader>
           <IonToolbar>
             <IonButtons slot="start">
               <IonBackButton />
             </IonButtons>
             <IonTitle>
               {id ? t('profile.edit') : t('profile.create')}
             </IonTitle>
           </IonToolbar>
         </IonHeader>
         <IonContent>
           <IonList>
             <IonItem>
               <IonLabel position="stacked">{t('profile.name')}</IonLabel>
               <IonInput
                 value={formData.name}
                 onIonChange={e => setFormData({ ...formData, name: e.detail.value! })}
               />
             </IonItem>
             {/* More form fields... */}
           </IonList>

           <IonButton onClick={handleTestConnection}>
             {t('profile.test_connection')}
           </IonButton>
           <IonButton onClick={handleSave}>
             {t('common.save')}
           </IonButton>
         </IonContent>
       </IonPage>
     );
   }

**Connection Testing:**

Before saving, users can test the connection to verify credentials and
server accessibility.

Secondary Views
---------------

Logs Page
~~~~~~~~~

**Location**: ``src/pages/Logs.tsx``

Provides a unified view of both application logs (ephemeral, stored in
memory) and ZoneMinder server logs (fetched via API).

**Key Features**: - Toggle between App (zmNinjaNG) and Server logs - Filter
by log level (DEBUG, INFO, WARN, ERROR) - Filter by component (e.g.,
specific monitor or service) - Export logs to file or share (mobile) -
Live server log fetching

Notification System
~~~~~~~~~~~~~~~~~~~

**Pages**: - **History**: ``src/pages/NotificationHistory.tsx`` - List
of past notifications with read status, event thumbnails, and tap-to-
navigate. - **Settings**: ``src/pages/NotificationSettings.tsx`` -
Notification configuration, including:

- **Connection status badge**: Shows connected/disconnected (ES mode)
  or "Direct mode active" (Direct mode)
- **Mode selector**: Choose between Event Server (ES) and Direct mode.
  Direct mode is auto-detected and greyed out if the ZM server lacks
  the Notifications API.
- **ES mode settings**: WebSocket host, port, SSL toggle, connect/
  disconnect controls, advanced options (toasts, sounds)
- **Direct mode settings**: Polling interval (10s–120s), detected-
  events-only filter
- **Per-monitor filters**: Toggle notifications per camera with
  configurable check intervals
- **Push notification registration**: FCM token registered with either
  ES (via WebSocket) or ZM (via REST API) depending on mode

Server Status
~~~~~~~~~~~~~

**Location**: ``src/pages/Server.tsx``

Dashboard for server health and control.

**Features**: - Version information (API & Core) - System Load and Disk
Usage metrics - Daemon status check - ZoneMinder Run State management
(Start/Stop/Restart)

Timeline View
~~~~~~~~~~~~~

**Location**: ``src/pages/Timeline.tsx``

A visualization of events over time using ``vis-timeline``.

**Implementation details**: - Uses ``vis-timeline/standalone`` for
rendering - Groups events by Monitor - Color-coded by Monitor ID for
visual distinction - Interactive zooming and panning - “Quick Range”
buttons for common timeframes (1h, 8h, 24h)

Common Page Patterns
--------------------

1. Profile Requirement Check
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Most pages require a selected profile:

.. code:: tsx

   const currentProfile = useProfileStore((state) => state.currentProfile);

   if (!currentProfile) {
     return <ProfileRequired />;
   }

2. Data Fetching with React Query
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   const { data, isLoading, error } = useQuery({
     queryKey: ['resource', id],
     queryFn: () => fetchResource(id),
     enabled: !!currentProfile,  // Only fetch if profile exists
   });

3. Loading/Error States
~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   if (isLoading) return <Skeleton />;
   if (error) return <ErrorDisplay error={error} />;
   if (!data) return <EmptyState />;

   return <Content data={data} />;

4. Navigation
~~~~~~~~~~~~~

.. code:: tsx

   const history = useHistory();

   // Push new route (can go back)
   history.push('/monitor/123');

   // Replace route (can't go back)
   history.replace('/dashboard');

   // Go back
   history.goBack();

Key Takeaways
-------------

1. **Infinite loops from ResizeObserver**: Use refs for Zustand values
   in callbacks
2. **React Query for data**: Server state with automatic caching and
   refetching
3. **Profile requirement**: Most pages need a selected profile
4. **Ionic components**: IonPage, IonHeader, IonContent for page
   structure
5. **Error boundaries**: Wrap pages to catch component errors
6. **Loading states**: Always show skeleton/spinner while fetching
7. **Internationalization**: All user-facing text uses :doc:``t()`` function
8. **Navigation**: Use React Router’s ``useHistory`` hook

Next Steps
----------

Continue to `Chapter 5: Component
Architecture <05-component-architecture>` to learn about the
reusable components used across these pages.
