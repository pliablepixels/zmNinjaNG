/**
 * Monitors API
 *
 * Handles fetching monitor lists, details, and controlling monitor state (enable/disable, alarms).
 * Also provides utility for generating stream URLs.
 */

import { getApiClient } from './client';
import type { MonitorsResponse, MonitorData, ControlData, AlarmStatusResponse, DaemonStatusResponse } from './types';
import { MonitorsResponseSchema, MonitorDataSchema, ControlDataSchema, MonitorUpdateResponseSchema, AlarmStatusResponseSchema, DaemonStatusResponseSchema } from './types';
import { validateApiResponse } from '../lib/api-validator';
import {
  getMonitorStreamUrl as buildMonitorStreamUrl,
  getMonitorControlUrl as buildMonitorControlUrl,
} from '../lib/url-builder';
import { log, LogLevel } from '../lib/logger';
import { wrapWithImageProxy } from '../lib/proxy-utils';

/**
 * Get all monitors.
 * 
 * Fetches the list of all monitors from /monitors.json.
 * 
 * @returns Promise resolving to MonitorsResponse containing array of monitors
 */
export async function getMonitors(): Promise<MonitorsResponse> {
  log.api('Fetching monitors list', LogLevel.INFO);

  const client = getApiClient();
  const response = await client.get<MonitorsResponse>('/monitors.json');

  // Validate response with Zod
  const validated = validateApiResponse(MonitorsResponseSchema, response.data, {
    endpoint: '/monitors.json',
    method: 'GET',
  });

  // Exclude deleted monitors at the API boundary so they never enter the app
  validated.monitors = validated.monitors.filter(
    ({ Monitor }) => Monitor.Deleted !== true
  );

  return validated;
}

/**
 * Get a single monitor by ID.
 * 
 * @param monitorId - The ID of the monitor to fetch
 * @returns Promise resolving to MonitorData
 */
export async function getMonitor(monitorId: string): Promise<MonitorData> {
  log.api('Fetching monitor details', LogLevel.INFO, { monitorId });

  const client = getApiClient();
  const response = await client.get<{ monitor: MonitorData }>(`/monitors/${monitorId}.json`);
  // Validate and coerce types (e.g. Controllable number -> string)
  return validateApiResponse(MonitorDataSchema, response.data.monitor, {
    endpoint: `/monitors/${monitorId}.json`,
    method: 'GET',
  });
}

/**
 * Get control capabilities for a monitor.
 * 
 * @param controlId - The ID of the control profile
 * @returns Promise resolving to ControlData
 */
export async function getControl(controlId: string): Promise<ControlData> {
  log.api('Fetching control capabilities', LogLevel.INFO, { controlId });

  const client = getApiClient();
  const response = await client.get(`/controls/${controlId}.json`);
  return validateApiResponse(ControlDataSchema, response.data, {
    endpoint: `/controls/${controlId}.json`,
    method: 'GET',
  });
}

/**
 * Update monitor settings.
 *
 * Sends a PUT request to update specific monitor fields.
 *
 * @param monitorId - The ID of the monitor to update
 * @param updates - Object containing fields to update
 * @returns Promise resolving to updated MonitorData
 */
export async function updateMonitor(
  monitorId: string,
  updates: Record<string, unknown>
): Promise<MonitorData> {
  log.api('Updating monitor settings', LogLevel.INFO, { monitorId, updates });

  const client = getApiClient();
  const body = new URLSearchParams();
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    body.set(key, String(value));
  });
  const response = await client.post(`/monitors/${monitorId}.json`, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  // Validate response with Zod
  const validated = validateApiResponse(MonitorUpdateResponseSchema, response.data, {
    endpoint: `/monitors/${monitorId}.json`,
    method: 'POST',
  });

  return validated.monitor;
}

/**
 * Change monitor function (None/Monitor/Modect/Record/Mocord/Nodect).
 * 
 * Helper wrapper around updateMonitor for changing the function.
 * 
 * @param monitorId - The ID of the monitor
 * @param func - The new function mode
 * @returns Promise resolving to updated MonitorData
 */
export async function changeMonitorFunction(
  monitorId: string,
  func: 'None' | 'Monitor' | 'Modect' | 'Record' | 'Mocord' | 'Nodect'
): Promise<MonitorData> {
  log.api('Changing monitor function', LogLevel.INFO, { monitorId, function: func });

  return updateMonitor(monitorId, {
    'Monitor[Function]': func,
  });
}

/**
 * Enable or disable a monitor.
 * 
 * Helper wrapper around updateMonitor for toggling enabled state.
 * 
 * @param monitorId - The ID of the monitor
 * @param enabled - True to enable, false to disable
 * @returns Promise resolving to updated MonitorData
 */
export async function setMonitorEnabled(monitorId: string, enabled: boolean): Promise<MonitorData> {
  log.api('Setting monitor enabled state', LogLevel.INFO, { monitorId, enabled });

  return updateMonitor(monitorId, {
    'Monitor[Enabled]': enabled ? '1' : '0',
  });
}

/**
 * Trigger alarm on a monitor.
 *
 * Forces an alarm state on the monitor.
 *
 * @param monitorId - The ID of the monitor
 * @throws Error if alarm trigger fails (ZM returns status: 'false' with error)
 */
export async function triggerAlarm(monitorId: string): Promise<void> {
  log.api('Triggering monitor alarm', LogLevel.INFO, { monitorId });

  const client = getApiClient();
  const response = await client.get(`/monitors/alarm/id:${monitorId}/command:on.json`);

  // Validate response with Zod to catch failures
  const validated = validateApiResponse(AlarmStatusResponseSchema, response.data, {
    endpoint: `/monitors/alarm/id:${monitorId}/command:on.json`,
    method: 'GET',
  });

  // Check for error response
  if (validated.status === 'false' && validated.error) {
    throw new Error(`Failed to trigger alarm: ${validated.error} (code: ${validated.code})`);
  }
}

/**
 * Cancel alarm on a monitor.
 *
 * Forces an alarm state off on the monitor.
 *
 * @param monitorId - The ID of the monitor
 * @throws Error if alarm cancel fails (ZM returns status: 'false' with error)
 */
export async function cancelAlarm(monitorId: string): Promise<void> {
  log.api('Cancelling monitor alarm', LogLevel.INFO, { monitorId });

  const client = getApiClient();
  const response = await client.get(`/monitors/alarm/id:${monitorId}/command:off.json`);

  // Validate response with Zod to catch failures
  const validated = validateApiResponse(AlarmStatusResponseSchema, response.data, {
    endpoint: `/monitors/alarm/id:${monitorId}/command:off.json`,
    method: 'GET',
  });

  // Check for error response
  if (validated.status === 'false' && validated.error) {
    throw new Error(`Failed to cancel alarm: ${validated.error} (code: ${validated.code})`);
  }
}

/**
 * Get alarm status of a monitor.
 *
 * Checks if the monitor is currently in alarm state.
 *
 * @param monitorId - The ID of the monitor
 * @returns Promise resolving to object with status string
 */
export async function getAlarmStatus(monitorId: string): Promise<AlarmStatusResponse> {
  log.api('Fetching alarm status', LogLevel.INFO, { monitorId });

  const client = getApiClient();
  const response = await client.get(`/monitors/alarm/id:${monitorId}/command:status.json`);

  // Validate response with Zod
  const validated = validateApiResponse(AlarmStatusResponseSchema, response.data, {
    endpoint: `/monitors/alarm/id:${monitorId}/command:status.json`,
    method: 'GET',
  });

  return validated;
}

/**
 * Get daemon status for a monitor.
 *
 * Checks status of zmc (capture) or zma (analysis) daemons.
 *
 * @param monitorId - The ID of the monitor
 * @param daemon - 'zmc' or 'zma'
 * @returns Promise resolving to object with status string
 */
export async function getDaemonStatus(
  monitorId: string,
  daemon: 'zmc' | 'zma'
): Promise<DaemonStatusResponse> {
  log.api('Fetching daemon status', LogLevel.INFO, { monitorId, daemon });

  const client = getApiClient();
  const response = await client.get(`/monitors/daemonStatus/id:${monitorId}/daemon:${daemon}.json`);

  // Validate response with Zod
  const validated = validateApiResponse(DaemonStatusResponseSchema, response.data, {
    endpoint: `/monitors/daemonStatus/id:${monitorId}/daemon:${daemon}.json`,
    method: 'GET',
  });

  return validated;
}

/**
 * Construct streaming URL for a monitor.
 *
 * Generates the URL for the ZMS CGI script to stream video or images.
 * In development mode on web, routes through proxy to avoid CORS issues.
 *
 * @param cgiUrl - Base CGI URL (e.g. https://zm.example.com/cgi-bin)
 * @param monitorId - The ID of the monitor
 * @param options - Streaming options (mode, scale, dimensions, etc.)
 * @returns Full URL string for the stream
 */
export function getStreamUrl(
  cgiUrl: string,
  monitorId: string,
  options: {
    mode?: 'jpeg' | 'single' | 'stream';
    scale?: number;
    width?: number;
    height?: number;
    maxfps?: number;
    buffer?: number;
    token?: string;
    connkey?: number;
    cacheBuster?: number;
    minStreamingPort?: number;
  } = {}

): string {
  const fullUrl = buildMonitorStreamUrl(cgiUrl, monitorId, options);

  // In dev mode on web, use proxy server to avoid CORS issues
  // Native platforms and production can access directly
  return wrapWithImageProxy(fullUrl);
}

/**
 * Send PTZ control command to a monitor.
 * 
 * @param portalUrl - Base Portal URL (e.g. https://zm.example.com/zm)
 * @param monitorId - The ID of the monitor
 * @param command - The PTZ command to execute
 * @param token - Optional auth token
 */
export async function controlMonitor(
  portalUrl: string,
  monitorId: string,
  command: string,
  token?: string
): Promise<void> {
  log.api('Sending PTZ control command', LogLevel.INFO, { monitorId, command });

  const url = buildMonitorControlUrl(portalUrl, monitorId, command, { token });

  // In dev mode on web, use proxy server to avoid CORS issues
  const proxiedUrl = wrapWithImageProxy(url);

  const client = getApiClient();
  // Use the unified client for cross-platform HTTP while keeping the full URL override.
  // We skip auth interceptor because we manually added the token to the URL
  await client.get(proxiedUrl, {
    headers: {
      'Skip-Auth': 'true'
    }
  });
}
