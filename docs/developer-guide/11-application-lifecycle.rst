Application Lifecycle
=====================

This chapter bridges the gap between individual concepts by explaining
*how* the application runs from start to finish. It is the “Runtime Map”
of zmNinjaNG.

1. The Entry Point (``index.html`` → ``main.tsx``)
--------------------------------------------------

Everything starts at ``app/index.html``. It acts as the container for
the React app.

1. **Load**: Browser/Electron/Webview loads ``index.html``.
2. **Script**: It loads ``src/main.tsx`` (the TypeScript entry point).
3. **Mount**: ``main.tsx`` finds the ``<div id="root">`` element and
   “mounts” the React application into it.

.. code:: tsx

   // src/main.tsx
   ReactDOM.createRoot(document.getElementById('root')!).render(
     <React.StrictMode>
       <App />
     </React.StrictMode>
   );

2. Bootstrapping Phase (``App.tsx``)
------------------------------------

When ``<App />`` renders, the app is not yet ready to use. It must
“hydrate” its state from storage and bootstrap the active profile.

Data Hydration
~~~~~~~~~~~~~~

The ``useProfileStore`` attempts to read saved profiles and the last
active user from ``AsyncStorage`` (mobile) or ``localStorage`` (web).

- **State**: ``isInitialized`` starts as ``false``.
- **Visual**: User sees ``<RouteLoadingFallback />:doc:`` (a spinner).
- **Mechanism**: ``zustand/persist`` triggers ``onRehydrateStorage``.

Profile Bootstrap
~~~~~~~~~~~~~~~~~

Once storage is hydrated and a profile exists, the app bootstraps the
profile:

1. **State**: ``isBootstrapping`` becomes ``true``.
2. **Visual**: User sees a bootstrap overlay with progress steps and a
   **Cancel** button.
3. **Steps**:

   - Clear stale auth/cache from previous session
   - Initialize API client with profile’s ``apiUrl``
   - Authenticate with stored credentials
   - Fetch server timezone
   - Fetch ZMS path from server config
   - Fetch Go2RTC path (if configured)
   - Check multi-port streaming configuration

Bootstrap Cancellation
~~~~~~~~~~~~~~~~~~~~~~

If the server is unreachable or bootstrap takes too long, users can
cancel:

- **Action**: Click “Cancel” button on bootstrap overlay
- **Effect**: Calls ``cancelBootstrap()`` which clears
  ``currentProfileId``
- **Navigation**:

  - If other profiles exist → redirects to ``/profiles`` (profile
    selection)
  - If no profiles exist → redirects to ``/profiles/new`` (add profile)

Initialization Complete
~~~~~~~~~~~~~~~~~~~~~~~

Once bootstrap completes (or is cancelled): 1. ``isInitialized`` becomes
``true``, ``isBootstrapping`` becomes ``false``. 2. ``AppRoutes``
decides where to send the user: - **No Profile**: Redirects to
``/profiles/new``. - **Has Profile**: Redirects to ``/monitors`` (or
last visited route).

3. The Authentication Flow
--------------------------

zmNinjaNG handles authentication differently than a typical SaaS app because
it connects to potentially *any* ZoneMinder server, each with different
auth requirements.

A. Token Exchange
~~~~~~~~~~~~~~~~~

When you log in or the app wakes up: 1. **Credentials**: We retrieve the
username/password (decrypted from SecureStorage). 2. **Login API**: We
call ``POST /api/host/login``. 3. **Response**: Server returns
``access_token`` and ``refresh_token``. 4. **Store**: Tokens are saved
to ``useAuthStore`` (in memory mostly, refresh token persisted).

B. The “Refresh Loop”
~~~~~~~~~~~~~~~~~~~~~

Tokens expire (usually after 1 hour). We need to verify we are still
logged in. - **Hook**: ``useTokenRefresh`` runs in ``App.tsx``. -
**Logic**: It sets a timer. When the token is about to expire, it
silently calls the refresh API to get a new one. - **Nuance**: If
refresh fails (e.g., user changed password), we forcibly logout and
redirect to login screen.

4. The “Main Loop” (Runtime)
----------------------------

Once logged in and on the Dashboard, several background processes keep
the app alive.

1. **Token Refresh**: Background timer checks token expiry every 60
   seconds and refreshes 5 minutes before expiry
2. **Event Polling**: Dashboard widgets and event views poll for new
   events at configurable intervals (30-60 seconds)
3. **Monitor Status**: Alarm status polling (5 seconds on Monitor Detail
   page)
4. **Stream Keep-Alive**: Streaming connections (``useMonitorStream``)
   monitor their own health. If a stream dies (socket close), they
   automatically try to reconnect with a new “Connection Key”
5. **WebSocket Keepalive & Reconnect**: The notification WebSocket
   (``services/notifications.ts``) sends a version-request ping every 60
   seconds to maintain the connection. On disconnection, it reconnects
   automatically using exponential backoff with jitter (2s, 4s, 8s, ...
   capped at 2 minutes). An ``intentionalDisconnect`` flag ensures only
   user-initiated disconnects stop reconnection; network drops always
   retry. On mobile, ``@capacitor/network`` triggers immediate reconnect
   when connectivity is restored. On desktop, a ``visibilitychange``
   listener checks liveness when a tab becomes visible
6. **Daemon Status**: Server page checks ZoneMinder daemon health every
   30 seconds

For a complete reference of all timers, polling intervals, and scheduled
actions across the application, see `Chapter 7: Complete Timer and
Polling
Reference <07-api-and-data-fetching>`.

5. Mobile Lifecycle (Capacitor)
-------------------------------

On iOS and Android, the app has unique lifecycle states handled by the
OS.

Backgrounding
~~~~~~~~~~~~~

When the user swipes the app away (but doesn’t close it): - **State**:
App goes to “Background”. - **Limit**: JS execution pauses (mostly). -
**Streams**: Video streams are paused to save battery/data.

Resuming
~~~~~~~~

When the user re-opens the app: - **State**: App comes to “Foreground”.
- **Check**: We check ``last_interaction`` timestamp. - **Security**: If
enabled, we might ask for Biometric Auth (FaceID) before revealing the
screen. - **Reconnect**: Video streams detect the interruption and
reconnect. - **WebSocket Liveness**: ``NotificationHandler`` sends a
ping to the notification WebSocket and waits for a response. If the
server doesn't respond within 5 seconds, the connection is treated as
dead and an immediate reconnect is triggered. - **Badge Clear**: Delivered
notifications and the native badge are cleared via
``FirebaseMessaging.removeAllDeliveredNotifications()``.

6. Navigation Lifecycle
-----------------------

We use ``react-router-dom`` for navigation.

- **Routes**: Defined in ``App.tsx``.
- **Behavior**: When you navigate from ``/monitors`` to ``/events``:

  1. ``MonitorList`` component **unmounts** (cleanup functions run,
     streams close).
  2. ``EventList`` component **mounts** (useEffect runs, API calls
     start).

**Critical Nuance**: Because components unmount, **local state is
lost**. If you scroll down the event list, click an event, and go back,
you lose your scroll position *unless* you save it in a global Store
(Zustand).

Summary: The flow of a generic session
--------------------------------------

1.  **Launch**: App opens (``main.tsx``).
2.  **Hydrate**: Spinner shows while loading Storage.
3.  **Route**: Storage says “User was on Monitors page”.
4.  **Auth**: App silently refreshes the old token.
5.  **Render**: ``MonitorList`` mounts.
6.  **Fetch**: Component calls ``useQuery`` to get monitors.
7.  **Stream**: ``MonitorCard`` calls ``useMonitorStream`` to get a
    video URL.
8.  **Interaction**: User clicks a monitor.
9.  **Navigate**: App switches URL to ``/monitors/1``.
10. **Cleanup**: List unmounts, Detail view mounts.
