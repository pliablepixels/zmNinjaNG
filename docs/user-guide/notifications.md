# Notifications

zmNinjaNG can notify you when ZoneMinder detects events. There are two notification modes, plus in-app toast notifications.

## Notification Modes

zmNinjaNG supports two notification modes. You choose the mode in **Notification Settings** based on your ZoneMinder setup.

### Event Server (ES) Mode

Uses a WebSocket connection to the [ZoneMinder Event Notification Server](https://github.com/pliablepixels/zmeventnotification) (zmeventnotification). Choose this mode if you run ES.

- **Desktop/Web**: WebSocket delivers events in real time while the app is open; toast notifications shown in-app.
- **Mobile (iOS/Android)**: ES sends FCM push notifications for background delivery. When the app is in the foreground, events arrive via WebSocket and are shown as in-app toasts; FCM duplicates are suppressed automatically.

### Direct Mode

Uses ZoneMinder's built-in Notifications REST API (no Event Server required). Choose this mode if you do not run ES but still want notifications. Requires ZoneMinder with the Notifications API (see ZM PR #4685).

- **Desktop/Web**: zmNinjaNG polls the ZM events API at a configurable interval (10s–120s). Events appear as in-app toasts while the app is open.
- **Mobile (iOS/Android)**: ZoneMinder sends FCM push notifications directly. Notifications work even when the app is closed or in the background. When the app is in the foreground, push events are shown as in-app toasts.

## Push Notifications (Mobile)

Both modes support native push notifications on iOS and Android via Firebase Cloud Messaging (FCM).

:::{important}
Push notifications require building the mobile app yourself with your own Firebase credentials. Pre-built binaries do not include push notification support. See the {doc}`../building/ANDROID` and {doc}`../building/IOS` build guides.
:::

### Requirements

1. A Firebase project with Cloud Messaging enabled
2. A custom-built zmNinjaNG mobile app with your Firebase credentials
3. **ES mode**: The [Event Notification Server](https://github.com/pliablepixels/zmeventnotification) with FCM support
4. **Direct mode**: ZoneMinder with the Notifications REST API

### Setup

1. Create a Firebase project and enable Cloud Messaging
2. Download the `google-services.json` (Android) or `GoogleService-Info.plist` (iOS)
3. Place the file in the appropriate directory (see build guides)
4. Build the app
5. In zmNinjaNG **Notification Settings**, enable notifications and select your mode
6. The app registers its FCM token with the appropriate backend (ES via WebSocket, or ZM via REST API)

### Per-Monitor Configuration

You can configure notifications per monitor:

- Enable or disable notifications for individual cameras
- Useful for ignoring high-traffic cameras that would generate too many alerts

### Direct Mode Options

When using Direct mode, additional settings are available:

- **Polling interval** (desktop only): How often to check for new events (10s–120s)
- **Only detected events**: Filter to only notify for events processed by object detection (zm_detect)

## Notification History

zmNinjaNG keeps a history of the last 100 notifications received. Access it from the **View History** button on the Notification Settings page.

Each history entry shows:

- Monitor name
- Event cause and timestamp
- Event thumbnail (if available)

Tap a notification entry to jump to the corresponding event.

## Troubleshooting

**No in-app notifications (ES mode)**
- Verify the Event Notification Server is running and accessible
- Check the connection status badge in Notification Settings
- Ensure the server hostname is correct
- Check app logs for WebSocket connection errors

**No in-app notifications (Direct mode, desktop)**
- Verify ZoneMinder's Notifications API is available (the Direct option will be greyed out if not detected)
- Check that the polling interval is configured
- Check app logs for polling errors

**No push notifications (mobile)**
- Verify you built the app with your own Firebase credentials
- Check that FCM token registration succeeded (check app logs)
- ES mode: Verify the Event Notification Server has FCM support
- Direct mode: Verify ZoneMinder's Notifications API is available
- On Android, check that battery optimization isn't killing the app in the background
