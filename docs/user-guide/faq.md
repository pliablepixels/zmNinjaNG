# FAQ

## General

### What ZoneMinder version do I need?

ZoneMinder 1.36 or newer with API access enabled (`OPT_USE_API = 1`).

### Does zmNinjaNG work with self-signed certificates?

No. Self-signed or untrusted certificates are not supported. Use [Let's Encrypt](https://letsencrypt.org/) (free) or another trusted certificate authority. You can also use plain HTTP if your server is on a local network.

### Is zmNinjaNG free?

Yes. zmNinjaNG is open source and free to use. The source code is available on [GitHub](https://github.com/pliablepixels/zmNinjaNG).

### How is zmNinjaNG different from zmNinja?

zmNinjaNG is a ground-up rewrite of zmNinja using modern web technologies (React, TypeScript, Capacitor). It has the same core features but with a modern UI, better performance, and encrypted credential storage. See {doc}`Getting Started <getting-started>` for the full comparison.

## Connection Issues

### "Connection failed" when adding a profile

- Check that your ZoneMinder server is accessible from your device
- Verify the Portal URL format (typically `https://your-server/zm`)
- Ensure the ZoneMinder API is enabled
- If using HTTPS, verify the certificate is from a trusted authority

### The app connects but shows no monitors

- Check that your ZoneMinder user has permission to view monitors
- Verify monitors exist and are enabled in ZoneMinder
- Try refreshing the page or pulling down to refresh on mobile

### Cameras show but snapshots don't load

- Check that ZoneMinder is running and monitors are online
- Verify the monitor capture is functioning in ZoneMinder's web console
- If using a reverse proxy, ensure it forwards image requests correctly

## Notifications

### Why don't push notifications work?

Push notifications on mobile (iOS/Android) require:
1. Building the app yourself with Firebase credentials
2. One of the following backends:
   - **ES mode**: The Event Notification Server with FCM support
   - **Direct mode**: ZoneMinder with the Notifications REST API (no Event Server needed)
3. Enabling notifications in zmNinjaNG settings and selecting the appropriate mode

See {doc}`notifications` for the full setup guide.

### Can I get notifications on desktop?

Yes. Desktop apps show in-app toast notifications while the app is open:
- **ES mode**: Events arrive in real time via WebSocket.
- **Direct mode**: zmNinjaNG polls the ZM events API at a configurable interval.

Background/push notifications (via FCM) are only available on mobile (iOS/Android). Desktop apps (Tauri) do not support FCM.

## Performance

### The app is slow on my phone

Try switching to **Low bandwidth mode** in Settings. This reduces refresh rates and image quality, which helps on slower connections or older devices.

### Montage view is laggy with many cameras

The montage view loads snapshot images for each camera. With many cameras, this can be data-intensive. Try:
- Using Low bandwidth mode
- Filtering to show fewer cameras
- Using monitor groups to view cameras in smaller batches

## Building

### Can I build for iOS without a Mac?

No. iOS builds require Xcode, which only runs on macOS.

### Do I need an Apple Developer account?

For personal use, you can use a free Apple Developer account to side-load the app to your own device. For distributing to others or using push notifications, a paid ($99/year) account is required.

### The pre-built Linux binary doesn't work

The pre-built binaries are built for specific distributions. Check the [GitHub Actions workflows](https://github.com/pliablepixels/zmNinjaNG/tree/main/.github/workflows) to see the build configuration and adjust for your system. You can also {doc}`build from source <installation>`.

## Data & Privacy

### Does zmNinjaNG send data to third parties?

No. zmNinjaNG does not include any analytics, tracking, or third-party data collection. All communication is between the app and your ZoneMinder server.

### Where are my credentials stored?

Credentials are encrypted and stored locally on your device:
- **Web/Desktop**: AES-256-GCM encrypted in the browser's local storage
- **Android**: Hardware-backed encryption via Android Keystore
- **iOS**: iOS Keychain

### Can I export my profiles?

You can share profiles via QR code. Open a profile and select the share/QR option. The QR code contains the encrypted profile data.
