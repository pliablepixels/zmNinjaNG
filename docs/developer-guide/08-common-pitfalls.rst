Common Pitfalls
===============

This chapter catalogs common mistakes and how to avoid them.

React Pitfalls
--------------

1. Using Non-Primitive Dependencies in useCallback
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   const handleClick = useCallback(() => {
     saveData(currentProfile, formData);
   }, [currentProfile, formData]);  // ❌ Objects recreate every render

**Why it’s wrong:**

- ``currentProfile`` and ``formData`` are objects
- Objects get new references on each render (even if values unchanged)
- Dependencies change → callback recreates → triggers re-renders

**Solution:**

.. code:: tsx

   const currentProfileRef = useRef(currentProfile);
   const formDataRef = useRef(formData);

   useEffect(() => {
     currentProfileRef.current = currentProfile;
     formDataRef.current = formData;
   }, [currentProfile, formData]);

   const handleClick = useCallback(() => {
     saveData(currentProfileRef.current, formDataRef.current);
   }, []);  // ✅ Empty deps - never recreates

2. Forgetting to Cleanup useEffect
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   useEffect(() => {
     const timer = setInterval(() => {
       refetchData();
     }, 5000);
     // ❌ No cleanup - timer keeps running after unmount
   }, []);

**Why it’s wrong:**

- Component unmounts but timer keeps running
- Attempts to update state on unmounted component
- Memory leak
- “Can’t perform state update on unmounted component” warning

**Solution:**

.. code:: tsx

   useEffect(() => {
     const timer = setInterval(() => {
       refetchData();
     }, 5000);

     return () => {
       clearInterval(timer);  // ✅ Cleanup on unmount
     };
   }, []);

3. Rendering Streams Before Connection Key is Valid (Zombie Streams)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   const [connKey, setConnKey] = useState(0);

   // Generate connKey in effect
   useEffect(() => {
     const newKey = regenerateConnKey(monitorId);
     setConnKey(newKey);
   }, [monitorId]);

   // Build stream URL immediately (connKey is still 0!)
   const streamUrl = getStreamUrl(cgiUrl, monitorId, {
     connkey: connKey,  // ❌ connKey is 0 on first render
     // ...
   });

   return <img src={streamUrl} />;  // ❌ Starts stream with connKey=0

**Why it’s wrong:**

- Initial state has ``connKey=0`` (invalid)
- Stream URL is built with ``connKey=0``
- Image renders and starts a ZMS stream on the server
- Effect runs and generates valid ``connKey`` (e.g., 12345)
- Stream URL updates, image re-renders with new URL
- Second ZMS stream starts on server with valid ``connKey``
- On unmount, only the stream with valid ``connKey`` gets terminated
- **Result: Zombie stream with ``connKey=0`` left running on server**
- Viewing N monitors creates 2*N streams instead of N

**Solution:**

.. code:: tsx

   const [connKey, setConnKey] = useState(0);

   useEffect(() => {
     const newKey = regenerateConnKey(monitorId);
     setConnKey(newKey);
   }, [monitorId]);

   // Only build URL when we have a valid connKey
   const streamUrl = connKey !== 0  // ✅ Check for valid connKey first
     ? getStreamUrl(cgiUrl, monitorId, {
         connkey: connKey,
         // ...
       })
     : '';  // Return empty string until connKey is valid

   // Cleanup: send CMD_QUIT on unmount
   useEffect(() => {
     return () => {
       if (connKey !== 0 && profile) {
         const controlUrl = getZmsControlUrl(
           profile.portalUrl,
           ZMS_COMMANDS.cmdQuit,
           connKey.toString()
         );
         httpGet(controlUrl).catch(() => {});  // ✅ Terminate stream
       }
     };
   }, []);  // Empty deps - only run on unmount

   return <img src={streamUrl} />;  // ✅ Only renders when connKey is valid

**Key principles for stream lifecycle:** - Never render a stream without
a valid connection key - Always send ``CMD_QUIT`` to terminate streams
on unmount - Use refs to access latest values in cleanup effects - Check
``connKey !== 0`` before building stream URLs

4. Mutating State Directly
~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   const [items, setItems] = useState([1, 2, 3]);

   const addItem = (item) => {
     items.push(item);  // ❌ Mutates state directly
     setItems(items);   // React doesn't detect change (same reference)
   };

**Why it’s wrong:**

- React compares state by reference
- Mutating doesn’t create a new reference
- React doesn’t know state changed
- Component doesn’t re-render

**Solution:**

.. code:: tsx

   const addItem = (item) => {
     setItems([...items, item]);  // ✅ Create new array
   };

   // Or with updater function:
   const addItem = (item) => {
     setItems(prev => [...prev, item]);  // ✅ Uses previous state
   };

5. Missing Keys in Lists
~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   {monitors.map((monitor, index) => (
     <MonitorCard
       key={index}  // ❌ Using index as key
       monitor={monitor}
     />
   ))}

**Why it’s wrong:**

- Index changes when list is reordered/filtered
- React loses track of which component is which
- State (e.g., scroll position) gets mixed up
- Unnecessary re-renders

**Solution:**

.. code:: tsx

   {monitors.map(monitor => (
     <MonitorCard
       key={monitor.Id}  // ✅ Use stable, unique ID
       monitor={monitor}
     />
   ))}

6. Conditional Hooks
~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   function Component({ userId }) {
     if (userId) {
       const user = useQuery(['user', userId], fetchUser);  // ❌ Conditional hook
     }
   }

**Why it’s wrong:**

- Hooks must be called in the same order every render
- Conditional hooks break this rule
- React loses track of hook state
- Causes bugs and errors

**Solution:**

.. code:: tsx

   function Component({ userId }) {
     const user = useQuery({
       queryKey: ['user', userId],
       queryFn: () => fetchUser(userId),
       enabled: !!userId,  // ✅ Disable query instead
     });
   }

Zustand Pitfalls
----------------

7. Using Store Values as Dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   const currentProfile = useProfileStore((state) => state.currentProfile);

   useEffect(() => {
     console.log('Profile changed');
   }, [currentProfile]);  // ❌ Runs every render (new reference)

**Why it’s wrong:**

- Zustand returns new references even if values unchanged
- Effect runs on every render
- Can cause infinite loops if effect updates state

**Solution:**

.. code:: tsx

   const currentProfile = useProfileStore((state) => state.currentProfile);
   const currentProfileRef = useRef(currentProfile);

   useEffect(() => {
     currentProfileRef.current = currentProfile;
   }, [currentProfile]);

   useEffect(() => {
     console.log('Profile changed', currentProfileRef.current);
   }, []);  // ✅ Runs once, ref has latest value

Or use a selector with shallow comparison:

.. code:: tsx

   const profileId = useProfileStore((state) => state.currentProfile?.id);

   useEffect(() => {
     console.log('Profile ID changed', profileId);
   }, [profileId]);  // ✅ ID is a primitive, stable when unchanged

8. Forgetting to Initialize Store State
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   export const useMyStore = create<MyState>((set) => ({
     // ❌ No initial state
     items: undefined,  // Should be [] or null
     count: undefined,  // Should be 0

     addItem: (item) => set((state) => ({
       items: [...state.items, item],  // ❌ Crashes if undefined
     })),
   }));

**Why it’s wrong:**

- Accessing ``undefined.length`` or spreading ``undefined`` crashes
- Components expect defined values

**Solution:**

.. code:: tsx

   export const useMyStore = create<MyState>((set) => ({
     items: [],  // ✅ Initialize as empty array
     count: 0,   // ✅ Initialize as zero

     addItem: (item) => set((state) => ({
       items: [...state.items, item],  // ✅ Safe to spread
     })),
   }));

React Query Pitfalls
--------------------

9. Missing enabled Flag
~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   const { data } = useQuery({
     queryKey: ['user', userId],
     queryFn: () => fetchUser(userId),  // ❌ Runs even if userId is null
   });

**Why it’s wrong:**

- Query runs immediately with ``null`` userId
- API call fails or returns error
- Unnecessary network request

**Solution:**

.. code:: tsx

   const { data } = useQuery({
     queryKey: ['user', userId],
     queryFn: () => fetchUser(userId!),
     enabled: !!userId,  // ✅ Only run if userId exists
   });

10. Not Invalidating Queries After Mutations
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   const mutation = useMutation({
     mutationFn: (data) => createMonitor(data),
     onSuccess: () => {
       toast.success('Monitor created');
       // ❌ Monitors list not refetched, new monitor doesn't appear
     },
   });

**Why it’s wrong:**

- Cached data is stale
- UI doesn’t show updated data
- User has to manually refresh

**Solution:**

.. code:: tsx

   const queryClient = useQueryClient();

   const mutation = useMutation({
     mutationFn: (data) => createMonitor(data),
     onSuccess: () => {
       toast.success('Monitor created');
       queryClient.invalidateQueries({ queryKey: ['monitors'] });  // ✅ Refetch
     },
   });

11. Incorrect Query Keys
~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   // Component A
   const { data } = useQuery({
     queryKey: ['monitors'],  // ❌ Missing profileId
     queryFn: () => fetchMonitors(currentProfile.id),
   });

   // Component B (different profile selected)
   const { data } = useQuery({
     queryKey: ['monitors'],  // ❌ Same key, returns cached data from profile A
     queryFn: () => fetchMonitors(otherProfile.id),
   });

**Why it’s wrong:**

- Query key should uniquely identify the data
- Different profiles have different monitors
- Component B gets cached data from profile A

**Solution:**

.. code:: tsx

   // Component A
   const { data } = useQuery({
     queryKey: ['monitors', profileA.id],  // ✅ Include profile ID
     queryFn: () => fetchMonitors(profileA.id),
   });

   // Component B
   const { data } = useQuery({
     queryKey: ['monitors', profileB.id],  // ✅ Different key
     queryFn: () => fetchMonitors(profileB.id),
   });

Testing Pitfalls
----------------

12. Hardcoded Values in E2E Tests
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: gherkin

   When I select "Front Door" monitor  # ❌ Hardcoded monitor name
   Then I should see 5 events          # ❌ Hardcoded event count

**Why it’s wrong:**

- Test only works with specific server setup
- Fails when server changes
- Not reusable

**Solution:**

.. code:: gherkin

   When I select the first monitor     # ✅ Dynamic
   Then I should see at least 1 event  # ✅ Flexible count

13. Not Mocking Dependencies in Unit Tests
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   // MonitorCard.test.tsx
   it('renders monitor', () => {
     render(<MonitorCard monitor={mockMonitor} />);
     // ❌ MonitorCard uses useMonitorStream which makes real API calls
   });

**Why it’s wrong:**

- Test makes real network requests
- Test is slow
- Test fails if server is down
- Not a unit test (testing integration)

**Solution:**

.. code:: tsx

   import { useMonitorStream } from '../../hooks/useMonitorStream';

   vi.mock('../../hooks/useMonitorStream');

   it('renders monitor', () => {
     useMonitorStream.mockReturnValue({  // ✅ Mock the hook
       streamUrl: 'https://test.com/stream.jpg',
       imgRef: { current: null },
       regenerateConnection: vi.fn(),
     });

     render(<MonitorCard monitor={mockMonitor} />);
     // Now it's a true unit test
   });

14. Forgetting to Add data-testid
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   <Button onClick={handleDelete}>Delete</Button>
   // ❌ No data-testid, hard to select in E2E tests

**Why it’s wrong:**

- E2E tests select by text (“Delete”)
- Text changes when i18n locale changes
- Text might not be unique

**Solution:**

.. code:: tsx

   <Button
     onClick={handleDelete}
     data-testid="delete-monitor-button"  // ✅ Stable selector
   >
     {t('common.delete')}
   </Button>

Performance Pitfalls
--------------------

15. Not Memoizing Expensive Calculations
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   function MonitorList({ monitors }) {
     const sortedMonitors = monitors.sort((a, b) =>
       a.Name.localeCompare(b.Name)
     );  // ❌ Re-sorts on every render

     return (
       <div>
         {sortedMonitors.map(m => <MonitorCard key={m.Id} monitor={m} />)}
       </div>
     );
   }

**Why it’s wrong:**

- Sorting is expensive (O(n log n))
- Runs on every render even if monitors unchanged
- Unnecessary work slows down app

**Solution:**

.. code:: tsx

   function MonitorList({ monitors }) {
     const sortedMonitors = useMemo(
       () => monitors.sort((a, b) => a.Name.localeCompare(b.Name)),
       [monitors]  // ✅ Only re-sort when monitors change
     );

     return (
       <div>
         {sortedMonitors.map(m => <MonitorCard key={m.Id} monitor={m} />)}
       </div>
     );
   }

16. Not Memoizing Components in Lists
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   function MonitorList({ monitors }) {
     return (
       <div>
         {monitors.map(m => (
           <MonitorCard key={m.Id} monitor={m} />
           // ❌ Re-renders all cards when any card changes
         ))}
       </div>
     );
   }

**Why it’s wrong:**

- When one monitor updates, all MonitorCards re-render
- Unnecessary re-renders waste CPU
- List scrolling feels janky

**Solution:**

.. code:: tsx

   // MonitorCard.tsx
   export const MonitorCard = memo(function MonitorCard({ monitor }) {
     // ...
   });  // ✅ Only re-renders if props change

   // Or with custom comparison:
   export const MonitorCard = memo(
     function MonitorCard({ monitor }) {
       // ...
     },
     (prevProps, nextProps) => {
       return prevProps.monitor.Id === nextProps.monitor.Id &&
              prevProps.monitor.Name === nextProps.monitor.Name;
     }
   );

17. Creating New Object References in Component Body
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   function TimelineWidget() {
     const now = new Date();  // ❌ Creates new Date object every render
     
     return (
       <Chart
         tooltip={{
           contentStyle: { backgroundColor: 'black' },  // ❌ New object every render
           labelFormatter: (value) => formatDate(value)  // ❌ New function every render
         }}
         style={{ width: 100 }}  // ❌ New object every render
       />
     );
   }

**Why it’s wrong:**

- ``new Date()`` creates a new reference on every render
- Inline objects ``{{ }}`` create new references on every render
- Inline functions ``() => {}`` create new references on every render
- If these are passed to memoized children or used in dependencies, they
  cause unnecessary re-renders
- Can trigger infinite render loops when used in ``useEffect`` or
  ``useMemo`` dependencies

**Solution:**

.. code:: tsx

   function TimelineWidget() {
     // For values that shouldn't trigger re-renders, use useRef
     const nowRef = useRef(new Date());
     
     // For values derived from props/state, use useMemo
     const tooltipContentStyle = useMemo(() => ({ 
       backgroundColor: 'black' 
     }), []);
     
     // For functions, use useCallback
     const tooltipLabelFormatter = useCallback((value) => {
       return formatDate(value);
     }, []);
     
     // For static styles, define outside component or memoize
     const chartStyle = useMemo(() => ({ width: 100 }), []);
     
     return (
       <Chart
         tooltip={{
           contentStyle: tooltipContentStyle,  // ✅ Stable reference
           labelFormatter: tooltipLabelFormatter  // ✅ Stable reference
         }}
         style={chartStyle}  // ✅ Stable reference
       />
     );
   }

**Real zmNinjaNG example (TimelineWidget):**

.. code:: tsx

   // Before: Caused infinite loops
   export function TimelineWidget() {
     const now = new Date();  // ❌ New reference every render
     
     return (
       <Tooltip
         contentStyle={{ backgroundColor: 'var(--background)' }}  // ❌
         labelFormatter={(value) => format(value, 'PPp')}  // ❌
       />
     );
   }

   // After: Stable references
   export const TimelineWidget = memo(function TimelineWidget() {
     const nowRef = useRef(new Date());  // ✅
     
     const tooltipContentStyle = useMemo(() => ({
       backgroundColor: 'var(--background)',
       border: '1px solid var(--border)',
     }), []);  // ✅
     
     const tooltipLabelFormatter = useCallback((value: number) => {
       return format(new Date(value), 'PPp');
     }, []);  // ✅
     
     return (
       <Tooltip
         contentStyle={tooltipContentStyle}
         labelFormatter={tooltipLabelFormatter}
       />
     );
   });  // ✅ Wrapped in memo

18. Store-to-Component Sync Circular Dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   function DashboardLayout() {
     // Get widgets from store
     const widgets = useDashboardStore(state => state.widgets[profileId]);
     const updateLayouts = useDashboardStore(state => state.updateLayouts);
     
     // Local state for grid layout
     const [layout, setLayout] = useState<Layout[]>([]);
     
     // Sync store → local state
     useEffect(() => {
       setLayout(widgets.map(w => w.layout));  // ❌ Triggers handleLayoutChange
     }, [widgets]);
     
     // Handle layout changes from grid library
     const handleLayoutChange = (nextLayout: Layout[]) => {
       setLayout(nextLayout);
       updateLayouts(profileId, nextLayout);  // ❌ Updates store → triggers useEffect → infinite loop
     };
     
     return <GridLayout layout={layout} onLayoutChange={handleLayoutChange} />;
   }

**Why it’s wrong:**

1. Store changes → ``useEffect`` runs → ``setLayout`` called
2. Grid library detects layout change → calls ``handleLayoutChange``
3. ``handleLayoutChange`` calls ``updateLayouts`` → store changes
4. Go to step 1 → **infinite loop**

This pattern is common when: - Using external libraries
(react-grid-layout, charts, etc.) that emit events on state change -
Syncing between Zustand store and component-local state - Two-way data
binding patterns

**Solution:**

Use a ref to track when you’re syncing from store vs. user interaction:

.. code:: tsx

   function DashboardLayout() {
     const widgets = useDashboardStore(
       useShallow(state => state.widgets[profileId] ?? [])
     );
     const updateLayouts = useDashboardStore(state => state.updateLayouts);
     
     const [layout, setLayout] = useState<Layout[]>([]);
     
     // Track when we're syncing FROM store (not user action)
     const isSyncingFromStoreRef = useRef(false);
     
     // Sync store → local state
     useEffect(() => {
       isSyncingFromStoreRef.current = true;  // ✅ Mark as syncing
       setLayout(widgets.map(w => w.layout));
       
       // Reset flag after React processes the state update
       requestAnimationFrame(() => {
         isSyncingFromStoreRef.current = false;  // ✅ Allow user changes again
       });
     }, [widgets]);
     
     const handleLayoutChange = useCallback((nextLayout: Layout[]) => {
       setLayout(nextLayout);
       
       // Don't update store if we're just syncing FROM store
       if (isSyncingFromStoreRef.current) return;  // ✅ Prevent circular update
       
       updateLayouts(profileId, nextLayout);
     }, [updateLayouts, profileId]);
     
     return <GridLayout layout={layout} onLayoutChange={handleLayoutChange} />;
   }

**Key principles:**

1. **Use a ref** to track sync state (refs don’t cause re-renders)
2. **Set flag before** updating local state from store
3. **Use ``requestAnimationFrame``** to reset flag after React processes
   the update
4. **Check flag** before writing back to store

**Why ``requestAnimationFrame``?**

- ``queueMicrotask`` can fire before React finishes processing
- ``setTimeout(..., 0)`` is unpredictable
- ``requestAnimationFrame`` fires after the current frame’s DOM updates,
  ensuring React has processed the state change

**Real zmNinjaNG example (DashboardLayout.tsx):**

.. code:: tsx

   // Track when we're syncing from store to prevent feedback loop
   const isSyncingFromStoreRef = useRef(false);

   useEffect(() => {
     isSyncingFromStoreRef.current = true;
     setLayout((prev) => (areLayoutsEqual(prev, layouts) ? prev : layouts));
     requestAnimationFrame(() => {
       isSyncingFromStoreRef.current = false;
     });
   }, [layouts, areLayoutsEqual]);

   const handleLayoutChange = useCallback((nextLayout: Layout[]) => {
     setLayout((prev) => (areLayoutsEqual(prev, nextLayout) ? prev : nextLayout));
     
     // Don't update store if we're just syncing from store
     if (!isEditing || isSyncingFromStoreRef.current) return;
     
     updateLayouts(profileIdRef.current, { lg: nextLayout });
   }, [areLayoutsEqual, isEditing, updateLayouts]);

Internationalization Pitfalls
-----------------------------

19. Hardcoded User-Facing Text
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   <Button>Delete Monitor</Button>  // ❌ Hardcoded English
   <Toast message="Monitor deleted successfully" />  // ❌ Hardcoded

**Why it’s wrong:**

- App only works in English
- Can’t localize for other languages
- Violates AGENTS.md guidelines

**Solution:**

.. code:: tsx

   import { useTranslation } from 'react-i18next';

   function Component() {
     const { t } = useTranslation();

     return (
       <>
         <Button>{t('monitors.delete')}</Button>  // ✅ Translatable
         <Toast message={t('monitors.deleted_success')} />  // ✅ Translatable
       </>
     );
   }

And update ALL language files:

.. code:: json

   // en/translation.json
   {
     "monitors": {
       "delete": "Delete Monitor",
       "deleted_success": "Monitor deleted successfully"
     }
   }

   // de/translation.json
   {
     "monitors": {
       "delete": "Monitor löschen",
       "deleted_success": "Monitor erfolgreich gelöscht"
     }
   }

   // ... es, fr, zh

20. Forgetting to Update All Language Files
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: json

   // en/translation.json
   {
     "new_feature": "New Feature"  // ✅ Added
   }

   // de/translation.json
   {
     // ❌ Missing "new_feature"
   }

**Why it’s wrong:**

- German users see missing translation key
- Looks broken in other languages

**Solution:**

Add to **ALL** language files (en, de, es, fr, zh):

.. code:: json

   // de/translation.json
   {
     "new_feature": "Neue Funktion"  // ✅ Added
   }

Cross-Platform Pitfalls
-----------------------

21. Invisible Overlays Blocking Touch Events on iOS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   <div className="relative group">
     <img src={imageUrl} />
     {/* Hover overlay */}
     <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50">
       {/* ❌ Blocks touch events on iOS even though invisible */}
       <Button>Action</Button>
     </div>
   </div>

**Why it’s wrong:**

- Invisible overlays with ``opacity-0`` are still touchable on iOS
- iOS treats them as interactive elements even when not visible
- Users must tap outside the overlay area to interact with elements
  beneath
- Desktop works fine because mouse hover makes overlay visible first
- Mobile users experience confusing touch offset issues

**What happens:** 1. User tries to tap the image or button beneath
overlay 2. Touch event is captured by the invisible overlay 3. Nothing
happens because overlay is invisible 4. User must tap outside the
overlay boundary to succeed

**Solution:**

.. code:: tsx

   <div className="relative group">
     <img src={imageUrl} />
     {/* Hover overlay with pointer-events control */}
     <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50 pointer-events-none group-hover:pointer-events-auto">
       {/* ✅ Not touchable when invisible, touchable when visible */}
       <Button>Action</Button>
     </div>
   </div>

**Key principles:** - Always add :doc:``pointer-events-none`` to invisible
overlay elements - Use ``group-hover:pointer-events-auto`` to restore
interactivity on hover (desktop) - Test touch interactions on actual iOS
devices, not just desktop - Invisible doesn’t mean non-interactive - iOS
can still capture touch events

**When this matters:** - Hover overlays on cards, images, tiles -
Tooltip containers - Hidden menus that appear on hover - Any element
with ``opacity-0`` that overlays interactive content

**Testing:** - Test on actual iOS device (Safari or native app) - Try
tapping all interactive elements in mobile portrait mode - Verify no
“dead zones” where taps are ignored

--------------

Platform-Specific Pitfalls
--------------------------

24. Tauri HTTP Scope Doesn’t Allow Non-Standard Ports
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: json

   // src-tauri/capabilities/default.json
   {
     "identifier": "http:default",
     "allow": [
       { "url": "https://**" }  // ❌ Only allows port 443
     ]
   }

**Why it’s wrong:**

- ``https://**`` only matches the default HTTPS port (443)
- ZoneMinder servers often run on non-standard ports (e.g., 30005,
  30014)
- Requests to ``https://server.com:30005/...`` fail with “url not
  allowed on the configured scope”
- Works in development (web) but fails in Tauri production builds

**Solution:**

.. code:: json

   {
     "identifier": "http:default",
     "allow": [
       { "url": "http://*:*/*" },   // ✅ Any HTTP URL, any port
       { "url": "https://*:*/*" }   // ✅ Any HTTPS URL, any port
     ]
   }

**Key principle:** Always use ``*:*`` in Tauri HTTP scope patterns to
allow any port.

25. ZMS Streaming URLs Hang Forever When Downloading Snapshots
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: typescript

   // Trying to download a snapshot from a ZMS stream URL
   const streamUrl = 'https://server/zm/cgi-bin/zms?monitor=1&mode=jpeg&maxfps=10&connkey=12345';
   await downloadFile(streamUrl, 'snapshot.jpg');  // ❌ Hangs forever

**Why it’s wrong:**

- ZMS with ``mode=jpeg`` and ``maxfps`` returns a continuous MJPEG
  stream
- The stream never ends - it keeps sending frames forever
- HTTP request never completes, download hangs indefinitely
- Also applies to ``/nph-zms`` endpoints

**Solution:**

Normalize ZMS URLs before downloading by setting ``mode=single`` and
removing streaming params:

.. code:: typescript

   export function convertToSnapshotUrl(imageUrl: string): string {
     const parsedUrl = new URL(imageUrl);

     // Handle both /nph-zms and /zms streaming endpoints
     if (!parsedUrl.pathname.includes('nph-zms') && !parsedUrl.pathname.endsWith('/zms')) {
       return imageUrl;  // Not a ZMS URL, return as-is
     }

     const params = parsedUrl.searchParams;
     params.set('mode', 'single');     // ✅ Request single frame, not stream
     params.delete('maxfps');          // Remove streaming params
     params.delete('connkey');
     params.delete('buffer');

     return parsedUrl.toString();
   }

   // Usage
   const snapshotUrl = convertToSnapshotUrl(streamUrl);
   // Result: https://server/zm/cgi-bin/zms?monitor=1&mode=single&scale=100&token=...
   await downloadFile(snapshotUrl, 'snapshot.jpg');  // ✅ Completes quickly

**Key principles:** - Always normalize ZMS/nph-zms URLs before
downloading - Set ``mode=single`` to get a single JPEG frame - Remove
``maxfps``, ``connkey``, and other streaming parameters - Handle both
``/zms`` and ``/nph-zms`` path patterns

Security Pitfalls
-----------------

22. Storing Sensitive Data Unencrypted
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   localStorage.setItem('password', password);  // ❌ Plain text

**Why it’s wrong:**

- Anyone with filesystem access can read it
- Browser extensions can read localStorage
- Security vulnerability

**Solution:**

.. code:: tsx

   import { SecureStorage } from '../lib/secure-storage';

   await SecureStorage.set('password', password);  // ✅ Encrypted

23. Logging Sensitive Data
~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:**

.. code:: tsx

   console.log('User credentials:', username, password);  // ❌ Logs password
   log.debug('Auth response', { accessToken, refreshToken });  // ❌ Logs tokens

**Why it’s wrong:**

- Logs are visible in browser console
- Logs might be sent to error tracking services
- Security leak

**Solution:**

.. code:: tsx

   log.auth('Login successful', LogLevel.INFO, { username });  // ✅ No password
   log.auth('Tokens received', LogLevel.DEBUG);  // ✅ No token values

Checklist: Pre-Code Review
--------------------------

Before submitting a PR, check for these pitfalls:

- ☐ No objects/functions in ``useCallback``/``useEffect`` dependencies
  (use refs)
- ☐ All ``useEffect`` hooks have cleanup if needed
- ☐ No state mutations (use spread operators or updater functions)
- ☐ List items have stable, unique ``key`` props
- ☐ No conditional hooks
- ☐ Zustand values not used as dependencies (use refs or primitives)
- ☐ All stores initialized with default values
- ☐ React Query has ``enabled`` flag when data might be missing
- ☐ Mutations invalidate relevant queries
- ☐ Query keys include all identifying parameters
- ☐ E2E tests use dynamic selectors (``.first()``, “at least N”)
- ☐ Unit tests mock external dependencies
- ☐ All interactive elements have ``data-testid``
- ☐ Expensive calculations wrapped in ``useMemo``
- ☐ List components wrapped in ``memo``
- ☐ No hardcoded user-facing text (use ``t()``)
- ☐ All language files updated (en, de, es, fr, zh)
- ☐ Invisible overlays have ``pointer-events-none`` (iOS touch fix)
- ☐ No sensitive data in logs
- ☐ Sensitive data stored encrypted
- ☐ Tauri HTTP scope uses ``*:*`` pattern for non-standard ports
- ☐ ZMS streaming URLs normalized to ``mode=single`` before download

Next Steps
----------

Continue to `Chapter 9: Contributing <09-contributing>` to learn
how to contribute code to the project.
