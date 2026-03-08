# Monitors

The Monitors screen shows all cameras configured on your ZoneMinder server. Each monitor is displayed as a card with a live snapshot and status information.

## Monitor Cards

Each card shows:

- **Live snapshot** - A periodically refreshed image from the camera
- **Monitor name** - The name configured in ZoneMinder
- **Function** - The current monitoring mode (Monitor, Modect, Record, etc.)
- **Status** - Whether the monitor is online, in alarm, or offline
- **Event count** - Number of recent events

Tap a card to open the [Monitor Detail](#monitor-detail) view.

## Filtering Monitors

Use the filter controls at the top of the screen to narrow down which monitors are shown:

- **Groups**: Filter by ZoneMinder monitor groups
- **Status**: Show only monitors in a specific state
- **Search**: Type to filter by monitor name

Filters persist across navigation within the same session.

## Monitor Detail

The detail view for a single monitor provides:

### Live View

A live stream from the camera. zmNinjaNG supports multiple streaming modes:

- **Snapshot mode** - Periodically refreshed JPEG images (lower bandwidth)
- **MJPEG streaming** - Motion JPEG stream via ZoneMinder's zms
- **go2rtc streaming** - Real-time streaming via go2rtc if configured on your server, with multiple protocol options:
  - WebRTC (lowest latency)
  - MSE (Media Source Extensions)
  - HLS (HTTP Live Streaming)

### PTZ Controls

If the monitor has PTZ (Pan-Tilt-Zoom) configured in ZoneMinder, directional controls appear below the live view. Use these to pan, tilt, and zoom the camera.

### Recent Events

A list of recent events for this specific monitor, with thumbnails and timestamps.

### Monitor Info

Technical details about the monitor configuration (resolution, source type, function, etc.).

## Monitor Status Indicators

| Status | Meaning |
|--------|---------|
| Green | Monitor is online and functioning |
| Red | Monitor is in alarm state |
| Gray | Monitor is disabled or offline |
| Orange | Monitor is in an error state |

## Refresh Rate

Monitor snapshots refresh automatically. The interval depends on your bandwidth setting:

- **Normal mode**: Every 10 seconds
- **Low bandwidth mode**: Every 30 seconds

See {doc}`settings` to configure bandwidth mode.
