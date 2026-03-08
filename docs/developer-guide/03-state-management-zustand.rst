State Management with Zustand
=============================

This chapter explains how zmNinjaNG manages global application state using
Zustand.

Why Do We Need Global State Management?
---------------------------------------

React’s ``useState`` works great for component-local state, but
applications need to share state across many components:

::

   ProfileSettings (needs: currentProfile)
      ├── MonitorList (needs: currentProfile)
      │      └── MonitorCard (needs: currentProfile)
      └── DashboardConfig (needs: currentProfile)

Without global state, you’d have to: 1. Store state in a common parent
component 2. Pass it down through every intermediate component (“prop
drilling”) 3. Pass callback functions back up to update it

This becomes unmaintainable quickly.

What is Zustand?
----------------

Zustand is a lightweight state management library. Think of it as a
global ``useState`` that any component can access.

**Key features**: - Simple API (less boilerplate than Redux) - No
Context Provider needed - TypeScript-friendly - Works outside React
components - Automatic persistence to storage

Creating a Store
----------------

A store is created using the ``create`` function:

.. code:: tsx

   // src/stores/useProfileStore.ts
   import { create } from 'zustand';

   interface ProfileState {
     // State
     currentProfile: Profile | null;
     profiles: Profile[];

     // Actions (functions that modify state)
     setCurrentProfile: (profile: Profile | null) => void;
     addProfile: (profile: Profile) => void;
   }

   export const useProfileStore = create<ProfileState>((set) => ({
     // Initial state
     currentProfile: null,
     profiles: [],

     // Actions
     setCurrentProfile: (profile) =>
       set({ currentProfile: profile }),

     addProfile: (profile) =>
       set((state) => ({
         profiles: [...state.profiles, profile]
       })),
   }));

The ``set`` Function
~~~~~~~~~~~~~~~~~~~~

``set`` is how you update the store. It has two forms:

**Object form** (merge state):

.. code:: tsx

   set({ currentProfile: profile })  // Merges { currentProfile: profile } into state

**Function form** (access current state):

.. code:: tsx

   set((state) => ({
     profiles: [...state.profiles, newProfile]
   }))

**Important**: Like React state, you must return a **new object/array**,
not mutate:

.. code:: tsx

   // ❌ Wrong - mutates state
   set((state) => {
     state.profiles.push(newProfile);
     return state;
   })

   // ✅ Correct - creates new array
   set((state) => ({
     profiles: [...state.profiles, newProfile]
   }))

Using a Store in Components
---------------------------

Import the hook and call it to get state and actions:

.. code:: tsx

   import { useProfileStore } from '../stores/useProfileStore';

   function ProfileSelector() {
     // Get everything
     const { currentProfile, profiles, setCurrentProfile } = useProfileStore();

     return (
       <View>
         {profiles.map(profile => (
           <Pressable
             key={profile.id}
             onPress={() => setCurrentProfile(profile)}
           >
             <Text>{profile.name}</Text>
           </Pressable>
         ))}
       </View>
     );
   }

Selectors: Optimizing Re-renders
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Important**: When you call ``useProfileStore()`` without arguments,
the component re-renders whenever **any** state in the store changes,
even if you don’t use it.

.. code:: tsx

   function UserName() {
     const { currentProfile } = useProfileStore();
     // ⚠️ This re-renders when profiles array changes, even though we don't use it!

     return <Text>{currentProfile?.name}</Text>;
   }

**Selectors** let you subscribe to specific parts of state:

.. code:: tsx

   function UserName() {
     // Only re-renders when currentProfile changes
     const currentProfile = useProfileStore((state) => state.currentProfile);

     return <Text>{currentProfile?.name}</Text>;
   }

**When to use selectors**: - When you only need a small part of the
store - In frequently-rendered components - To prevent unnecessary
re-renders

**When NOT to use selectors**: - When you need multiple pieces of state
(use destructuring instead) - In components that rarely render

Multiple Selectors
~~~~~~~~~~~~~~~~~~

.. code:: tsx

   function ProfileView() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const setCurrentProfile = useProfileStore((state) => state.setCurrentProfile);
     // Each selector is independent - component re-renders only when these specific values change
   }

Computed Values in Selectors
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Selectors can derive data:

.. code:: tsx

   function ActiveMonitorsCount() {
     const activeCount = useMonitorStore((state) =>
       state.monitors.filter(m => !m.deleted).length
     );

     return <Text>Active: {activeCount}</Text>;
   }

**Performance caveat**: This creates a new number on every store update.
For complex derivations, use ``useMemo``:

.. code:: tsx

   function MonitorList() {
     const monitors = useMonitorStore((state) => state.monitors);

     const activeMonitors = useMemo(
       () => monitors.filter(m => !m.deleted),
       [monitors]
     );

     // ...
   }

useShallow: Preventing Infinite Loops with Arrays and Objects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When selecting arrays or objects from Zustand, you can encounter
infinite re-render loops because JavaScript compares objects by
**reference**, not by **value**.

The Problem
^^^^^^^^^^^

.. code:: tsx

   function EventList() {
     // ❌ Creates new array reference every time selector runs!
     const favoriteIds = useEventFavoritesStore((state) =>
       state.profileFavorites[profileId] || []
     );

     useEffect(() => {
       console.log('Favorites changed');
     }, [favoriteIds]);  // Runs on EVERY render!
   }

**Why this happens:**

1. Selector runs: ``state.profileFavorites[profileId] || []``
2. Returns ``[1, 2, 3]`` (new array reference)
3. Component re-renders
4. Selector runs again: returns ``[1, 2, 3]`` (different reference!)
5. React sees new reference → triggers effect
6. → Infinite loop

Even though the array *values* are identical ``[1, 2, 3]``, they’re
different *objects*:

.. code:: tsx

   [1, 2, 3] !== [1, 2, 3]  // true - different references!

The Solution: useShallow
^^^^^^^^^^^^^^^^^^^^^^^^

``useShallow`` does **shallow comparison** - it compares array/object
contents, not references:

.. code:: tsx

   import { useShallow } from 'zustand/react/shallow';

   function EventList() {
     // ✅ Returns same reference if array contents haven't changed
     const favoriteIds = useEventFavoritesStore(
       useShallow((state) => state.getFavorites(profileId))
     );

     useEffect(() => {
       console.log('Favorites actually changed');
     }, [favoriteIds]);  // Only runs when array contents change
   }

**How it works:**

.. code:: tsx

   // Without useShallow:
   [1, 2, 3] !== [1, 2, 3]  // true (different references)

   // With useShallow:
   shallowEquals([1, 2, 3], [1, 2, 3])  // true (same contents)

It compares each element:
``arr1[0] === arr2[0] && arr1[1] === arr2[1] && ...``

When to Use useShallow
^^^^^^^^^^^^^^^^^^^^^^

**Use for:** - Selecting arrays: ``(state) => state.items`` - Selecting
objects: ``(state) => state.config`` - Selecting multiple values:
``(state) => ({ a: state.a, b: state.b })``

**Don’t use for:** - Primitives: ``(state) => state.count``
(numbers/strings/booleans are fine) - Single object properties:
``(state) => state.currentProfile`` (already stable if unchanged) -
Actions/functions: ``(state) => state.addItem`` (functions don’t need
shallow comparison)

Examples
^^^^^^^^

.. code:: tsx

   // ✅ Array - use useShallow
   const monitors = useMonitorStore(
     useShallow((state) => state.monitors)
   );

   // ✅ Object - use useShallow
   const settings = useSettingsStore(
     useShallow((state) => state.getProfileSettings(profileId))
   );

   // ✅ Multiple values - use useShallow
   const { name, email } = useUserStore(
     useShallow((state) => ({
       name: state.currentUser?.name,
       email: state.currentUser?.email,
     }))
   );

   // ✅ Primitive - no useShallow needed
   const count = useCountStore((state) => state.count);

   // ✅ Function - no useShallow needed
   const increment = useCountStore((state) => state.increment);

Debugging Infinite Loops
^^^^^^^^^^^^^^^^^^^^^^^^

If you suspect an infinite loop from Zustand:

1. Add console.log to see how often selector runs:

   .. code:: tsx

      const data = useStore((state) => {
        console.log('Selector running');
        return state.data;
      });

2. Check if you’re selecting an array/object without useShallow

3. Wrap with useShallow and test

useShallow vs useMemo
^^^^^^^^^^^^^^^^^^^^^

Both prevent unnecessary re-renders, but for different reasons:

- **useShallow**: Compares array/object contents to return stable
  reference
- **useMemo**: Caches expensive calculation results

.. code:: tsx

   // useShallow - for Zustand arrays/objects
   const favorites = useEventStore(
     useShallow((state) => state.getFavorites(profileId))
   );

   // useMemo - for expensive derivations
   const sortedMonitors = useMemo(
     () => monitors.sort((a, b) => a.name.localeCompare(b.name)),
     [monitors]
   );

Store Actions: Best Practices
-----------------------------

Actions should encapsulate business logic:

.. code:: tsx

   export const useProfileStore = create<ProfileState>((set, get) => ({
     currentProfile: null,
     profiles: [],

     // Simple action
     setCurrentProfile: (profile) =>
       set({ currentProfile: profile }),

     // Complex action with logic
     deleteProfile: (profileId) => {
       const { profiles, currentProfile, setCurrentProfile } = get();

       // Remove profile
       const newProfiles = profiles.filter(p => p.id !== profileId);

       // If we deleted the current profile, select another
       if (currentProfile?.id === profileId) {
         setCurrentProfile(newProfiles[0] || null);
       }

       set({ profiles: newProfiles });
     },
   }));

**The ``get`` function**: Second parameter to ``create``, returns
current state:

.. code:: tsx

   create<State>((set, get) => ({
     count: 0,
     increment: () => {
       const current = get().count;  // Access current state
       set({ count: current + 1 });
     }
   }))

Persistence
-----------

Zustand can persist state to storage automatically:

.. code:: tsx

   import { create } from 'zustand';
   import { persist, createJSONStorage } from 'zustand/middleware';
   import AsyncStorage from '@react-native-async-storage/async-storage';

   export const useProfileStore = create<ProfileState>()(
     persist(
       (set, get) => ({
         // State and actions here
       }),
       {
         name: 'profile-storage',  // Storage key
         storage: createJSONStorage(() => AsyncStorage),
       }
     )
   );

**How it works**: 1. When state changes, Zustand saves it to
AsyncStorage 2. On app launch, Zustand loads state from AsyncStorage 3.
Everything is automatic

**Caveats**: - Can slow down updates if state is large - Versioning is
manual (detect and handle format changes yourself)

Advanced Persistence: Hydration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Persistence is **asynchronous** (especially with ``AsyncStorage`` on
mobile). When the app launches, the store starts with its initial state
(empty) and then “hydrates” with data from storage a few milliseconds
later.

This can cause UI flashes or errors if the app tries to use state before
it’s loaded. To handle this, we use the ``onRehydrateStorage`` callback.

**Implementation Pattern (``src/stores/profile.ts``)**:

.. code:: tsx

   export const useProfileStore = create<ProfileState>()(
     persist(
       (set, get) => ({
         // ... state and actions
         isInitialized: false,
       }),
       {
         name: 'profile-storage',
         storage: createJSONStorage(() => AsyncStorage),
         
         // Callback when hydration starts
         onRehydrateStorage: () => {
           console.log('Hydration starting...');
           
           // Returns a function that runs when hydration finishes
           return (state, error) => {
             if (error) {
               console.error('Hydration failed', error);
             } else {
               console.log('Hydration finished');
               // Flag that we are ready to render
               state?.setInitialized(true);
             }
           };
         },
       }
     )
   );

**Usage in App Logic**:

In the main ``App.tsx``, we wait for ``isInitialized`` before rendering
routes:

.. code:: tsx

   function AppRoutes() {
     const isInitialized = useProfileStore((state) => state.isInitialized);

     if (!isInitialized) {
       return <LoadingScreen />;
     }

     return <Routes>...</Routes>;
   }

Calling Stores Outside React
----------------------------

Unlike React state, Zustand works outside components:

.. code:: tsx

   import { useProfileStore } from '../stores/profile';

   // In a regular function (not a component)
   // Access primitives directly - do NOT use currentProfile() getter
   export function getCurrentProfile(): Profile | null {
     const { profiles, currentProfileId } = useProfileStore.getState();
     return profiles.find(p => p.id === currentProfileId) ?? null;
   }

   // Update from outside React
   export function resetProfile(): void {
     useProfileStore.getState().setCurrentProfileId(null);
   }

This is useful for: - Utility functions - API clients - Event handlers
outside React

The Critical Issue: Object References
-------------------------------------

**This is the source of our infinite loop bugs (detailed in Chapter
4).**

Zustand stores return **new object references** on every access, even if
the values haven’t changed:

.. code:: tsx

   function MyComponent() {
     const settings = useProfileStore((state) => state.settings);

     useEffect(() => {
       console.log('Settings changed!');
     }, [settings]);  // ⚠️ Runs on EVERY render!
   }

**Why?** Even though ``settings`` value might be identical, Zustand
can’t guarantee it’s the same reference.

**This causes infinite loops when**: 1. You use a Zustand value as a
dependency in ``useCallback`` or ``useEffect`` 2. That callback/effect
updates state 3. State update triggers re-render 4. Re-render creates
new Zustand reference 5. New reference triggers callback/effect again 6.
→ Infinite loop

Example: The Infinite Loop
~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   function DashboardLayout() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const updateSettings = useProfileStore((state) => state.updateSettings);

     // ⚠️ INFINITE LOOP!
     const handleResize = useCallback((width: number) => {
       if (currentProfile) {
         updateSettings(currentProfile.id, { layoutWidth: width });
       }
     }, [currentProfile, updateSettings]);  // These change on every render!

     // handleResize changes → triggers ResizeObserver → updates settings
     // → triggers re-render → currentProfile/updateSettings get new references
     // → handleResize changes again → infinite loop
   }

The Solution: Refs (Preview)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

We solve this using ``useRef`` to hold Zustand values without making
them dependencies:

.. code:: tsx

   function DashboardLayout() {
     const currentProfile = useProfileStore((state) => state.currentProfile);
     const updateSettings = useProfileStore((state) => state.updateSettings);

     // Store in refs
     const currentProfileRef = useRef(currentProfile);
     const updateSettingsRef = useRef(updateSettings);

     // Keep refs updated
     useEffect(() => {
       currentProfileRef.current = currentProfile;
       updateSettingsRef.current = updateSettings;
     }, [currentProfile, updateSettings]);

     // ✅ Now stable - no Zustand values as dependencies
     const handleResize = useCallback((width: number) => {
       if (currentProfileRef.current) {
         updateSettingsRef.current(currentProfileRef.current.id, { layoutWidth: width });
       }
     }, []);  // Empty dependencies - never recreates

     // handleResize is stable → no infinite loop
   }

See Chapter 4 for detailed analysis of this pattern.

Zustand Store Structure in zmNinjaNG
-------------------------------

We use multiple stores for different domains:

::

   src/stores/
   ├── useProfileStore.ts       # User profiles management
   ├── useAuthStore.ts          # Authentication tokens and state
   ├── useSettingsStore.ts      # Application and profile settings
   ├── useDashboardStore.ts     # Dashboard configuration
   ├── useMonitorStore.ts       # Monitor data cache
   ├── useNotificationStore.ts  # Push notifications
   ├── useLogStore.ts           # Application logs (ephemeral)
   └── useQueryCacheStore.ts    # API response cache

**Why multiple stores?** - Separation of concerns - Better performance
(components subscribe to relevant store only) - Easier to test and
reason about

Store Organization Pattern
--------------------------

Each store follows this pattern:

.. code:: tsx

   // 1. Define state interface
   interface MyState {
     // Data
     items: Item[];
     selectedId: string | null;

     // Actions
     addItem: (item: Item) => void;
     selectItem: (id: string) => void;
     clearSelection: () => void;
   }

   // 2. Create store with persistence
   export const useMyStore = create<MyState>()(
     persist(
       (set, get) => ({
         // 3. Initial state
         items: [],
         selectedId: null,

         // 4. Actions
         addItem: (item) =>
           set((state) => ({ items: [...state.items, item] })),

         selectItem: (id) =>
           set({ selectedId: id }),

         clearSelection: () =>
           set({ selectedId: null }),
       }),
       {
         name: 'my-storage',
         storage: createJSONStorage(() => AsyncStorage),
       }
     )
   );

Testing Zustand Stores
----------------------

Stores can be tested independently:

.. code:: tsx

   import { useProfileStore } from '../useProfileStore';

   describe('ProfileStore', () => {
     beforeEach(() => {
       // Reset store before each test
       useProfileStore.setState({
         currentProfile: null,
         profiles: [],
       });
     });

     it('sets current profile', () => {
       const profile = { id: '1', name: 'Test' };

       useProfileStore.getState().setCurrentProfile(profile);

       expect(useProfileStore.getState().currentProfile).toBe(profile);
     });

     it('adds profile to list', () => {
       const profile = { id: '1', name: 'Test' };

       useProfileStore.getState().addProfile(profile);

       expect(useProfileStore.getState().profiles).toContain(profile);
     });
   });

Key Takeaways
-------------

1. **Zustand is global state**: Any component can access it
2. **Use selectors**: Subscribe to specific parts of state to optimize
   re-renders
3. **Actions encapsulate logic**: Don’t manipulate state directly from
   components
4. **Object references change**: Zustand values get new references even
   if unchanged
5. **Refs prevent loops**: Don’t use Zustand values as
   :doc:``useCallback``/``useEffect`` dependencies directly
6. **Multiple stores**: Separate concerns for better organization
7. **Persistence is automatic**: With the persist middleware
8. **Works outside React**: Can call ``getState()`` from anywhere

Common Patterns
---------------

Pattern 1: Derived State with Selectors
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   const hasActiveMonitors = useMonitorStore((state) =>
     state.monitors.some(m => !m.deleted)
   );

Pattern 2: Multiple Actions in Sequence
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   const resetApp = () => {
     useProfileStore.getState().clearProfiles();
     useDashboardStore.getState().resetDashboard();
     useMonitorStore.getState().clearCache();
   };

Pattern 3: Conditional Updates
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   addMonitor: (monitor) =>
     set((state) => {
       // Don't add duplicates
       if (state.monitors.some(m => m.id === monitor.id)) {
         return state;  // Return current state unchanged
       }
       return { monitors: [...state.monitors, monitor] };
     }),

Next Steps
----------

Continue to `Chapter 4: Pages and Views <04-pages-and-views>` to
see real examples of how Zustand object references caused infinite loops
in our codebase and how we fixed them.
