React Fundamentals
==================

This chapter explains React from first principles for programmers
unfamiliar with React’s mental model. We’ll use real examples from the
zmNinjaNG codebase.

Table of Contents
-----------------

- `What is React? <#what-is-react>`__
- `Components: The Building Blocks <#components-the-building-blocks>`__
- `Props: Passing Data <#props-passing-data>`__
- `State: Component Memory <#state-component-memory>`__
- `Rendering and Re-rendering <#rendering-and-re-rendering>`__
- `Hooks: React’s Power Tools <#hooks-reacts-power-tools>`__
- `Object Identity and References <#object-identity-and-references>`__
- `React.memo: Preventing
  Re-renders <#reactmemo-preventing-re-renders>`__
- `Key Takeaways <#key-takeaways>`__

What is React?
--------------

React is a library for building user interfaces. The key mental shift
from traditional programming is moving from **imperative** (telling the
computer HOW to update) to **declarative** (describing WHAT the UI
should look like).

Traditional Approach (Imperative)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: javascript

   // You manually manipulate the DOM, step by step
   const button = document.getElementById('myButton');
   button.textContent = 'Clicked ' + count + ' times';
   button.style.color = count > 5 ? 'red' : 'black';

   // When count changes, you write more code to update the DOM again
   count++;
   button.textContent = 'Clicked ' + count + ' times';
   button.style.color = count > 5 ? 'red' : 'black';

Problem: You have to remember to update every affected element, which
gets complex quickly.

React Approach (Declarative)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: jsx

   // You describe what the UI should look like for any value of count
   function MyButton({ count }) {
     return (
       <button style={{ color: count > 5 ? 'red' : 'black' }}>
         Clicked {count} times
       </button>
     );
   }

   // When count changes, React automatically updates the button
   // You don't write update code - just re-describe the UI

**Key principle**: You describe the UI as a function of your data. When
data changes, React efficiently updates the DOM to match your
description.

Components: The Building Blocks
-------------------------------

A component is a JavaScript function that returns UI. Think of it like a
reusable template or a custom HTML tag.

Simple Example
~~~~~~~~~~~~~~

.. code:: tsx

   // A simple welcome component
   function Welcome({ name }: { name: string }) {
     return <Text>Hello, {name}!</Text>;
   }

   // Use it like an HTML tag
   <Welcome name="Alice" />  // Renders: "Hello, Alice!"
   <Welcome name="Bob" />    // Renders: "Hello, Bob!"

Real zmNinjaNG Example: MonitorCard
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Let’s look at a real component from zmNinjaNG (simplified):

.. code:: tsx

   // app/src/components/monitors/MonitorCard.tsx
   function MonitorCard({ monitor, status, eventCount, onShowSettings }) {
     const navigate = useNavigate();
     const { t } = useTranslation();

     return (
       <Card>
         <div className="flex flex-col sm:flex-row gap-4 p-4">
           {/* Thumbnail */}
           <div onClick={() => navigate(`/monitors/${monitor.Id}`)}>
             <img src={streamUrl} alt={monitor.Name} />
             <Badge variant={isRunning ? 'default' : 'destructive'}>
               {isRunning ? t('monitors.live') : t('monitors.offline')}
             </Badge>
           </div>

           {/* Monitor Info */}
           <div>
             <div>{monitor.Name}</div>
             <Button onClick={() => navigate(`/events?monitorId=${monitor.Id}`)}>
               {t('sidebar.events')}
             </Button>
           </div>
         </div>
       </Card>
     );
   }

This component: - Takes data as input (``monitor``, ``status``, etc.) -
Returns UI that displays that data - Can be reused for every monitor in
the system

JSX: JavaScript + XML
~~~~~~~~~~~~~~~~~~~~~

The ``<Card>`` and ``<Button>`` syntax is called JSX. It looks like HTML
but is actually JavaScript.

.. code:: tsx

   // This JSX:
   const element = <Text>Hello</Text>;

   // Gets compiled to this JavaScript:
   const element = React.createElement(Text, null, 'Hello');

**JSX Rules:** 1. You can embed JavaScript expressions inside ``{}`` 2.
Components must return a single root element 3. Use ``className``
instead of ``class``, ``onClick`` instead of ``onclick``

.. code:: tsx

   function UserCard({ user }) {
     // ❌ Wrong - Multiple root elements
     return (
       <Text>{user.name}</Text>
       <Text>{user.email}</Text>
     );

     // ✅ Correct - Single root element
     return (
       <View>
         <Text>{user.name}</Text>
         <Text>{user.email}</Text>
       </View>
     );
   }

Props: Passing Data
-------------------

Props (properties) are how you pass data into components. Think of them
like function parameters.

Key Characteristics of Props
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. **Immutable** - A component cannot change its own props
2. **One-way flow** - Data flows from parent to child
3. **Typed** - In TypeScript, you define the shape of props

Example from MonitorCard
~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   // Define the shape of props with TypeScript
   interface MonitorCardProps {
     monitor: Monitor;           // The monitor object
     status: MonitorStatus;      // Current status
     eventCount: number;         // Number of events
     onShowSettings: (monitor: Monitor) => void;  // Callback function
   }

   function MonitorCard({ monitor, status, eventCount, onShowSettings }: MonitorCardProps) {
     // Props are READ-ONLY
     // monitor = someOtherMonitor;  // ❌ Don't do this!

     return (
       <Card>
         <Text>{monitor.Name}</Text>
         <Button onClick={() => onShowSettings(monitor)}>
           Settings
         </Button>
       </Card>
     );
   }

How Parent Passes Props
~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   function MonitorList() {
     const monitors = [
       { Id: '1', Name: 'Front Door', ... },
       { Id: '2', Name: 'Backyard', ... }
     ];

     return (
       <View>
         {monitors.map(monitor => (
           <MonitorCard
             key={monitor.Id}
             monitor={monitor}
             status={getStatus(monitor.Id)}
             eventCount={10}
             onShowSettings={handleShowSettings}
           />
         ))}
       </View>
     );
   }

**Flow**: ``MonitorList`` (parent) → passes props → ``MonitorCard``
(child)

The child can’t change the props, but it can call callback functions
(like ``onShowSettings``) to notify the parent.

State: Component Memory
-----------------------

While props are data passed from outside, **state** is data that a
component owns and can change. When state changes, React re-renders the
component.

useState Hook
~~~~~~~~~~~~~

.. code:: tsx

   import { useState } from 'react';

   function Counter() {
     // Declare state: [currentValue, functionToUpdateIt] = useState(initialValue)
     const [count, setCount] = useState(0);

     const increment = () => {
       setCount(count + 1);  // Update state
     };

     return (
       <View>
         <Text>Count: {count}</Text>
         <Pressable onPress={increment}>
           <Text>Increment</Text>
         </Pressable>
       </View>
     );
   }

What Happens When You Click?
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. User clicks the button
2. ``increment`` function is called
3. ``setCount(count + 1)`` is called
4. React schedules a re-render
5. Component function runs again with new ``count`` value
6. UI updates to show new count

Real Example: useMonitorStream Hook
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Let’s look at how zmNinjaNG uses state in the ``useMonitorStream`` hook:

.. code:: tsx

   // app/src/hooks/useMonitorStream.ts
   export function useMonitorStream({ monitorId }) {
     // State for connection key - changes when we regenerate connection
     const [connKey, setConnKey] = useState(0);

     // State for cache busting - changes periodically to refresh snapshots
     const [cacheBuster, setCacheBuster] = useState(Date.now());

     // State for the displayed image URL - updates when new image loads
     const [displayedImageUrl, setDisplayedImageUrl] = useState('');

     const regenerateConnection = () => {
       const newKey = generateKey();
       setConnKey(newKey);              // Update connKey state
       setCacheBuster(Date.now());      // Update cacheBuster state
       // React will re-render any component using this hook
     };

     // ... rest of hook
   }

Each piece of state serves a purpose: - ``connKey`` - tracks the current
connection, changes when we reconnect - ``cacheBuster`` - forces image
refresh by changing the URL - ``displayedImageUrl`` - the currently
displayed image

State is Asynchronous
~~~~~~~~~~~~~~~~~~~~~

This is a critical concept that trips up many developers:

.. code:: tsx

   function Counter() {
     const [count, setCount] = useState(0);

     const incrementTwice = () => {
       setCount(count + 1);  // count is 0, so this queues update to 1
       setCount(count + 1);  // count is STILL 0, so this also queues update to 1
       console.log(count);   // Still logs 0!
       // Result: count becomes 1, not 2!
     };
   }

**Why?** State updates are batched and asynchronous. The ``count``
variable doesn’t change immediately.

**Solution**: Use the updater function form:

.. code:: tsx

   const incrementTwiceCorrect = () => {
     setCount(prev => prev + 1);  // prev is 0, returns 1
     setCount(prev => prev + 1);  // prev is 1, returns 2
     // Result: count becomes 2 ✅
   };

The updater function receives the actual latest value, not the stale
``count`` from when the function was created.

Rendering and Re-rendering
--------------------------

Understanding when and why components re-render is crucial for avoiding
bugs and performance issues.

When Does a Component Re-render?
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

A component re-renders when:

1. **Its state changes** (via a ``setState`` call)
2. **Its props change** (parent passes new values)
3. **Its parent re-renders** (even if this component’s props didn’t
   change)

.. code:: tsx

   function Parent() {
     const [count, setCount] = useState(0);

     return (
       <View>
         {/* Child re-renders every time Parent re-renders */}
         <Child name="Alice" />

         <Pressable onPress={() => setCount(count + 1)}>
           <Text>Increment: {count}</Text>
         </Pressable>
       </View>
     );
   }

   function Child({ name }) {
     console.log('Child rendered');  // Logs every time Parent re-renders
     return <Text>Hello, {name}</Text>;
   }

Each Render is a Snapshot
~~~~~~~~~~~~~~~~~~~~~~~~~

This is one of React’s most important concepts: **each render is a
snapshot in time**.

.. code:: tsx

   function Message() {
     const [text, setText] = useState('Hello');

     const handleClick = () => {
       setText('Goodbye');
       alert(text);  // Shows 'Hello', not 'Goodbye'! Why?
     };

     return <Button onClick={handleClick}>{text}</Button>;
   }

**Why does ``alert`` show ‘Hello’?**

1. When the component first renders, ``text`` is ``'Hello'``
2. The ``handleClick`` function is created with ``text`` captured as
   ``'Hello'``
3. When you click, ``handleClick`` runs with the old ``text`` value
4. ``setText`` schedules a re-render, but doesn’t change ``text``
   immediately
5. A new render will create a new ``handleClick`` with the new ``text``

This is called “closure over props/state” - each render has its own
values.

Example from zmNinjaNG: useMonitorStream Cleanup
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   // app/src/hooks/useMonitorStream.ts
   export function useMonitorStream({ monitorId }) {
     const [connKey, setConnKey] = useState(0);
     // Use the useCurrentProfile() hook for stable references
     const { currentProfile } = useCurrentProfile();

     // Store cleanup parameters in ref (we'll learn about refs soon)
     const cleanupParamsRef = useRef({ monitorId, connKey, profile: currentProfile });

     // Update ref whenever values change
     useEffect(() => {
       cleanupParamsRef.current = { monitorId, connKey, profile: currentProfile };
     }, [monitorId, connKey, currentProfile]);

     // Cleanup on unmount
     useEffect(() => {
       return () => {
         // Access the LATEST values via ref, not the stale closure values
         const params = cleanupParamsRef.current;

         // If we used monitorId/connKey directly, we'd get stale values!
         sendQuitCommand(params.connKey);  // Uses latest connKey ✅
       };
     }, []); // Empty deps - only run on unmount

     // ...
   }

**Why use a ref?** The cleanup function is created once (empty deps
``[]``), so it would capture the initial values of ``monitorId`` and
``connKey``. By using a ref, we can access the latest values when
cleanup runs.

Hooks: React’s Power Tools
--------------------------

Hooks are special functions that let you “hook into” React features like
state, effects, and context.

Hook Rules (CRITICAL)
~~~~~~~~~~~~~~~~~~~~~

1. **Only call at the top level** - Not inside loops, conditions, or
   nested functions
2. **Only call from React functions** - Components or custom hooks

.. code:: tsx

   // ❌ WRONG
   function Component({ showCounter }) {
     if (showCounter) {
       const [count, setCount] = useState(0);  // Conditional hook!
     }
     // ...
   }

   // ✅ CORRECT
   function Component({ showCounter }) {
     const [count, setCount] = useState(0);  // Always called

     if (!showCounter) {
       return null;  // Conditionally render instead
     }
     // ...
   }

**Why?** React relies on the order hooks are called to track their
state. Conditional hooks break this order.

useEffect: Side Effects
~~~~~~~~~~~~~~~~~~~~~~~

``useEffect`` runs code **after** the component renders. Use it for: -
Fetching data - Subscriptions - Setting up timers - Manually changing
the DOM - Cleanup (like closing connections)

.. code:: tsx

   import { useEffect, useState } from 'react';

   function UserProfile({ userId }) {
     const [user, setUser] = useState(null);

     useEffect(() => {
       // This runs AFTER the component renders
       console.log('Effect running');

       fetchUser(userId).then(data => setUser(data));
     }, [userId]);  // Dependencies: re-run when userId changes

     if (!user) return <Text>Loading...</Text>;
     return <Text>{user.name}</Text>;
   }

The Dependency Array Explained
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The dependency array is the second argument to ``useEffect``. It
controls when the effect runs:

.. code:: tsx

   // No array - runs after EVERY render (usually wrong!)
   useEffect(() => {
     console.log('Runs every render');
   });

   // Empty array - runs ONCE after first render
   useEffect(() => {
     console.log('Runs once on mount');
   }, []);

   // With dependencies - runs when dependencies change
   useEffect(() => {
     console.log('Runs when userId changes');
   }, [userId]);

   // Multiple dependencies - runs when ANY change
   useEffect(() => {
     console.log('Runs when userId OR settings change');
   }, [userId, settings]);

Real Example: useMonitorStream Periodic Refresh
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   // app/src/hooks/useMonitorStream.ts
   export function useMonitorStream({ monitorId }) {
     const [cacheBuster, setCacheBuster] = useState(Date.now());
     const settings = useSettingsStore(state => state.getProfileSettings());

     // Snapshot mode: periodically update cacheBuster to refresh image
     useEffect(() => {
       // Only run in snapshot mode
       if (settings.viewMode !== 'snapshot') return;

       // Set up interval to update cacheBuster every N seconds
       const interval = setInterval(() => {
         setCacheBuster(Date.now());  // Triggers re-render with new URL
       }, settings.snapshotRefreshInterval * 1000);

       // Cleanup: clear interval when component unmounts or dependencies change
       return () => {
         clearInterval(interval);
       };
     }, [settings.viewMode, settings.snapshotRefreshInterval]);
     // Re-run effect when viewMode or interval changes
   }

**What happens:** 1. Component mounts → effect runs → sets up interval
2. Every N seconds → interval fires → updates cacheBuster → component
re-renders 3. When ``viewMode`` or ``snapshotRefreshInterval`` changes →
cleanup runs (clears old interval) → effect re-runs (sets up new
interval) 4. Component unmounts → cleanup runs → interval cleared

Cleanup Functions
~~~~~~~~~~~~~~~~~

Cleanup functions prevent memory leaks and unwanted behavior:

.. code:: tsx

   useEffect(() => {
     // Setup
     const timer = setInterval(() => {
       console.log('Tick');
     }, 1000);

     // Cleanup: runs when component unmounts OR before re-running effect
     return () => {
       clearInterval(timer);
     };
   }, []);

**When does cleanup run?** - Before re-running the effect (if
dependencies change) - When the component unmounts

Real Example: Cleanup in useMonitorStream
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   // app/src/hooks/useMonitorStream.ts
   useEffect(() => {
     return () => {
       const params = cleanupParamsRef.current;

       // Send CMD_QUIT to close stream connection
       if (params.viewMode === 'streaming' && params.connKey !== 0) {
         const controlUrl = getZmsControlUrl(
           params.profile.portalUrl,
           ZMS_COMMANDS.cmdQuit,
           params.connKey.toString()
         );

         httpGet(controlUrl).catch(() => {
           // Ignore errors - connection may already be closed
         });
       }

       // Abort image loading to release browser connection
       if (imgRef.current) {
         imgRef.current.src = 'data:image/gif;base64,...';
       }
     };
   }, []); // Empty deps = only run on unmount

This ensures when the component unmounts: 1. The stream connection is
properly closed on the server 2. The browser stops loading the image

useRef: Persistent Storage Without Re-renders
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``useRef`` gives you a mutable container that persists across renders
but **doesn’t trigger re-renders** when changed.

.. code:: tsx

   import { useRef } from 'react';

   function VideoPlayer() {
     // Create a ref with initial value null
     const playerRef = useRef(null);

     const play = () => {
       // Access the current value via .current
       playerRef.current?.play();
     };

     // Attach ref to DOM element
     return <video ref={playerRef} />;
   }

useRef vs useState
~~~~~~~~~~~~~~~~~~

================== ================== =======================
Feature            useState           useRef
================== ================== =======================
Triggers re-render ✅ Yes             ❌ No
Read/write         Async (via setter) Sync (via ``.current``)
Use for            UI state           Non-UI values, DOM refs
================== ================== =======================

Common useRef Use Cases
~~~~~~~~~~~~~~~~~~~~~~~

**1. Storing DOM elements:**

.. code:: tsx

   const imgRef = useRef<HTMLImageElement>(null);

   return <img ref={imgRef} src={url} />;
   // Later: imgRef.current.width, imgRef.current.src, etc.

**2. Storing previous values:**

.. code:: tsx

   function Counter() {
     const [count, setCount] = useState(0);
     const prevCountRef = useRef(0);

     useEffect(() => {
       prevCountRef.current = count;  // Update after render
     });

     return (
       <View>
         <Text>Current: {count}</Text>
         <Text>Previous: {prevCountRef.current}</Text>
       </View>
     );
   }

**3. Storing values for cleanup (see useMonitorStream above):**

.. code:: tsx

   const paramsRef = useRef({ id: monitorId, key: connKey });

   useEffect(() => {
     paramsRef.current = { id: monitorId, key: connKey };
   }, [monitorId, connKey]);

   useEffect(() => {
     return () => {
       // Access latest values in cleanup
       const params = paramsRef.current;
     };
   }, []);

useCallback: Memoizing Functions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Every render creates new function instances. This can cause problems
with child re-renders and effect dependencies.

.. code:: tsx

   function Parent() {
     const [count, setCount] = useState(0);

     // This creates a NEW function on every render
     const handleClick = () => {
       console.log('Clicked');
     };

     // Child sees a "new" prop every time Parent re-renders
     return <Child onClick={handleClick} />;
   }

``useCallback`` returns the same function instance across renders:

.. code:: tsx

   import { useCallback } from 'react';

   function Parent() {
     const [count, setCount] = useState(0);

     // Returns the SAME function instance if dependencies don't change
     const handleClick = useCallback(() => {
       console.log('Clicked');
     }, []); // Empty deps = function never changes

     // Child sees the same function reference
     return <Child onClick={handleClick} />;
   }

When to Use useCallback
~~~~~~~~~~~~~~~~~~~~~~~

✅ **Use when:** - Passing callbacks to child components wrapped in
``React.memo`` - Using functions as dependencies in ``useEffect`` or
other hooks - Creating event handlers that shouldn’t change

❌ **Don’t use when:** - Function isn’t passed to children - No
performance issue (premature optimization) - Function needs to capture
latest state (better to omit useCallback)

useCallback with Dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   function MonitorCard({ monitorId }) {
     const [settings, setSettings] = useState({});

     // Function re-creates when monitorId or settings change
     const handleSave = useCallback(() => {
       saveMonitorSettings(monitorId, settings);
     }, [monitorId, settings]);  // Re-create when these change

     return <Button onClick={handleSave}>Save</Button>;
   }

useMemo: Memoizing Values
~~~~~~~~~~~~~~~~~~~~~~~~~

Similar to ``useCallback`` but for values instead of functions. Use it
to cache expensive calculations.

.. code:: tsx

   import { useMemo } from 'react';

   function MonitorList({ monitors }) {
     // Expensive calculation only runs when monitors array changes
     const sortedMonitors = useMemo(() => {
       console.log('Sorting...');
       return monitors.sort((a, b) => a.name.localeCompare(b.name));
     }, [monitors]);  // Only re-sort when monitors changes

     return (
       <View>
         {sortedMonitors.map(m => <MonitorCard key={m.id} monitor={m} />)}
       </View>
     );
   }

**When to use useMemo:** - Expensive calculations (sorting, filtering
large arrays) - Creating objects/arrays used as dependencies in hooks -
After profiling shows a performance issue

**Don’t use for:** - Simple calculations (more overhead than benefit) -
Premature optimization

Object Identity and References
------------------------------

This is crucial for understanding why effects re-run and why components
re-render.

JavaScript Reference Equality
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   // Primitive values: compared by value
   1 === 1              // true
   'hello' === 'hello'  // true

   // Objects/Arrays: compared by reference
   { x: 1 } === { x: 1 }    // false! Different objects
   [1, 2] === [1, 2]        // false! Different arrays

   const obj1 = { x: 1 };
   const obj2 = obj1;
   obj1 === obj2            // true - same reference

Why This Matters in React
~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   function Component() {
     // New object created every render
     const config = { width: 100, height: 200 };

     useEffect(() => {
       console.log('Config changed!');
     }, [config]);  // Runs on EVERY render! config is always a new object
   }

Every render creates a new ``config`` object. Even though the values are
identical, the reference is different, so React thinks it changed.

Solutions
~~~~~~~~~

**Option 1: useMemo**

.. code:: tsx

   const config = useMemo(() => ({ width: 100, height: 200 }), []);
   // Same object reference across renders

**Option 2: Move outside component**

.. code:: tsx

   const CONFIG = { width: 100, height: 200 };  // Created once

   function Component() {
     useEffect(() => {
       console.log('Config changed!');
     }, [CONFIG]);  // Only runs once - CONFIG never changes
   }

**Option 3: Don’t use as dependency (use specific values)**

.. code:: tsx

   const config = { width: 100, height: 200 };

   useEffect(() => {
     console.log('Dimensions changed!');
   }, [config.width, config.height]);  // Depend on values, not object

React.memo: Preventing Re-renders
---------------------------------

``React.memo`` is a higher-order component that prevents a component
from re-rendering when its props haven’t changed.

The Problem: Unnecessary Re-renders
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

By default, a component re-renders whenever its parent re-renders, even
if its props are identical:

.. code:: tsx

   function Parent() {
     const [count, setCount] = useState(0);

     return (
       <View>
         <Pressable onPress={() => setCount(count + 1)}>
           <Text>Count: {count}</Text>
         </Pressable>

         {/* Re-renders every time, even though name never changes! */}
         <ExpensiveChild name="Alice" />
       </View>
     );
   }

   function ExpensiveChild({ name }) {
     console.log('ExpensiveChild rendered');
     // Expensive rendering logic...
     return <Text>Hello, {name}</Text>;
   }

Every time you click the button, ``ExpensiveChild`` re-renders even
though its ``name`` prop is always ``"Alice"``.

The Solution: React.memo
~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   import { memo } from 'react';

   const ExpensiveChild = memo(function ExpensiveChild({ name }) {
     console.log('ExpensiveChild rendered');
     return <Text>Hello, {name}</Text>;
   });

Now ``ExpensiveChild`` only re-renders when the ``name`` prop changes.

How React.memo Works
~~~~~~~~~~~~~~~~~~~~

1. React compares the **new props** with the **previous props**
2. Uses **shallow equality** - compares references, not deep values
3. If all props are identical (same references), skip re-render
4. If any prop changed, re-render normally

.. code:: tsx

   // Shallow comparison:
   const prev = { name: 'Alice', age: 30 };
   const next = { name: 'Alice', age: 30 };

   prev === next           // false - different object references
   prev.name === next.name // true - same string value
   prev.age === next.age   // true - same number value

   // React.memo does:
   prev.name === next.name && prev.age === next.age  // true - skip re-render

Real Example: MonitorCard and EventCard
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Both MonitorCard and EventCard are wrapped in ``memo``:

.. code:: tsx

   // app/src/components/monitors/MonitorCard.tsx
   function MonitorCardComponent({ monitor, status, eventCount, onShowSettings }) {
     // ... component logic
   }

   // Memoize to prevent unnecessary re-renders when monitor data hasn't changed
   export const MonitorCard = memo(MonitorCardComponent);

.. code:: tsx

   // app/src/components/events/EventCard.tsx
   function EventCardComponent({ event, monitorName, thumbnailUrl }) {
     // ... component logic
   }

   // Memoize to prevent unnecessary re-renders in virtualized event lists
   export const EventCard = memo(EventCardComponent);

**Why?** In the Monitors page, you might have 10+ MonitorCards. When one
monitor’s status changes, only that card should re-render, not all 10.
``memo`` makes this optimization automatic.

When to Use React.memo
~~~~~~~~~~~~~~~~~~~~~~

✅ **Good use cases:** - Component renders expensive UI (complex
calculations, animations) - Component is in a large list (50+ items) -
Props rarely change - Parent re-renders frequently

❌ **Don’t use when:** - Component is cheap to render - Props change on
every render anyway - Only one instance exists - You haven’t profiled to
confirm it’s slow

**Rule of thumb**: Use ``memo`` for list items and components with
expensive rendering. Otherwise, only add it after profiling shows a
performance issue.

Common Pitfall: memo with Inline Objects/Functions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   function Parent() {
     const [count, setCount] = useState(0);

     return (
       <View>
         <Pressable onPress={() => setCount(count + 1)}>Count: {count}</Pressable>

         {/* ❌ memo doesn't help here! */}
         <ExpensiveChild
           config={{ width: 100 }}        // New object every render
           onClick={() => console.log()}  // New function every render
         />
       </View>
     );
   }

   const ExpensiveChild = memo(function ExpensiveChild({ config, onClick }) {
     // Still re-renders every time because config and onClick are new references
   });

**Solution**: Use ``useMemo`` for objects and ``useCallback`` for
functions:

.. code:: tsx

   function Parent() {
     const [count, setCount] = useState(0);

     const config = useMemo(() => ({ width: 100 }), []);
     const handleClick = useCallback(() => console.log(), []);

     return (
       <View>
         <Pressable onPress={() => setCount(count + 1)}>Count: {count}</Pressable>

         {/* ✅ Now memo works! Props have stable references */}
         <ExpensiveChild config={config} onClick={handleClick} />
       </View>
     );
   }

memo with Global State (Zustand)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Critical**: ``memo()`` only compares **props**. It doesn’t prevent
re-renders from state changes inside the component.

.. code:: tsx

   // app/src/components/events/EventCard.tsx
   const EventCard = memo(function EventCard({ event }) {
     // This subscription still causes re-renders when favorites change
     const isFav = useEventFavoritesStore((state) =>
       state.isFavorited(currentProfile.id, event.Id)
     );

     return <Star filled={isFav} />;
   });

``memo`` blocks re-renders from the parent, but the component **still
subscribes to the Zustand store**. When favorites change, the store
notifies this component, and it re-renders.

**This is correct behavior!** The component needs to update when its
data changes.

Common Mistake: Extracting Functions Without Subscribing
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: tsx

   // ❌ WRONG - Won't update when favorites change
   const EventCard = memo(function EventCard({ event }) {
     // Extracts function but doesn't subscribe to state
     const { isFavorited } = useEventFavoritesStore();
     const isFav = isFavorited(event.Id);

     return <Star filled={isFav} />;
     // When favorites change:
     // - Store doesn't notify this component (no subscription)
     // - Parent doesn't re-render (no prop change)
     // - memo() blocks re-render from parent
     // - Star stays stale!
   });

   // ✅ CORRECT - Subscribe to state with selector
   const EventCard = memo(function EventCard({ event }) {
     // Subscribes to this specific state value
     const isFav = useEventFavoritesStore((state) =>
       state.isFavorited(currentProfile.id, event.Id)
     );

     return <Star filled={isFav} />;
     // When favorites change:
     // - Store notifies this component (subscribed)
     // - Component re-renders with new value
     // - Star updates correctly!
   });

**Key principle**: When using :doc:``memo()`` with global state (Zustand,
Redux, Context), you must **subscribe** to the state with a selector.
Extracting functions without subscribing breaks reactivity.

See `Chapter 3: State Management with
Zustand <03-state-management-zustand>` for detailed explanation
of selectors and subscriptions.

React Native Specifics
----------------------

zmNinjaNG uses React Native (via Capacitor), so instead of HTML elements, you
use React Native components:

=================== ============================= ====================
HTML                React Native                  zmNinjaNG Usage
=================== ============================= ====================
``<div>``           ``<View>``                    Layout containers
``<span>``, ``<p>`` ``<Text>``                    Text display
``<button>``        ``<Pressable>``, ``<Button>`` Interactive elements
``<input>``         ``<TextInput>``               Form inputs
``<img>``           ``<Image>:doc:``                   Images
=================== ============================= ====================

But **all React concepts are identical** - components, props, state,
hooks, memo, etc.

Key Takeaways
-------------

1.  **React is declarative**: Describe the UI for any state, React
    handles updates automatically

2.  **Components are functions**: They take props and return UI

3.  **Props are immutable**: Data flows one-way from parent to child

4.  **State triggers re-renders**: Changing state causes the component
    to re-render with new values

5.  **Each render is a snapshot**: Variables and functions capture
    values from that render

6.  **Hooks have rules**:

    - Top-level only (no conditions, loops)
    - React functions only (components, custom hooks)

7.  **useEffect runs after render**: Use for side effects, cleanup,
    subscriptions

    - Dependency array controls when it re-runs
    - Return cleanup function to prevent leaks

8.  **useRef persists without re-rendering**: Use for DOM references,
    storing non-UI values

9.  **Object identity matters**:

    - ``{ x: 1 } !== { x: 1 }`` (different references)
    - Use ``useMemo``/``useCallback`` for stable references
    - Or move values outside component

10. **React.memo prevents re-renders**:

    - Compares props shallowly
    - Use for expensive components and list items
    - Pair with ``useMemo``/``useCallback`` for stable props
    - Still re-renders from internal state changes

11. **Subscribe to global state with selectors**: When using ``memo()``
    with Zustand/Redux, use selectors to subscribe, don’t extract
    functions

Next Steps
----------

Continue to `Chapter 3: State Management with
Zustand <03-state-management-zustand>` to understand how we
manage global application state and how subscriptions work.
