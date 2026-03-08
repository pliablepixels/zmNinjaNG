# Settings

Settings are stored per profile. Each ZoneMinder server profile has its own independent settings.

## Display Settings

| Setting | Description |
|---------|-------------|
| **Language** | Interface language (English, German, Spanish, French, Chinese) |
| **Theme** | Light, Cream, Dark, Slate, Amber, or System (follows system setting by default) |

## Bandwidth Settings

Control how frequently the app fetches data from your server. Useful for mobile data or slow connections.

| Mode | Description |
|------|-------------|
| **Normal** | Standard refresh intervals (10-30s depending on the data type) |
| **Low** | Reduced refresh rates (2x slower) and lower image quality |

Low bandwidth mode affects:

- Monitor snapshot refresh rate
- Dashboard widget refresh intervals
- Event list polling
- Timeline/heatmap data loading
- Image quality and scale

:::{tip}
Switch to **Low bandwidth mode** when on mobile data or a slow connection. You can switch back to Normal when on WiFi.
:::

## Notification Settings

Configure how zmNinjaNG handles event notifications. See {doc}`notifications` for details.

## Server Information

The Settings screen also shows information about the connected ZoneMinder server:

- Server version
- API version
- Daemon status

## Resetting Settings

Settings can be reset to defaults from the Settings screen. This affects only the current profile's settings, not your connection details or other profiles.
