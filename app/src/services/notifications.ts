/**
 * ZoneMinder Event Notification Service
 *
 * Implements WebSocket connection to ZoneMinder event notification server (zmeventnotification.pl)
 * Handles real-time event notifications for both desktop and mobile (foreground)
 *
 * Protocol based on: https://github.com/ZoneMinder/zmeventnotification
 */

import { log, LogLevel } from '../lib/logger';
import { useAuthStore } from '../stores/auth';

import type {
  ZMEventServerConfig,
  ZMNotificationMessage,
  ConnectionState,
  NotificationEventCallback,
  ConnectionStateCallback,
} from '../types/notifications';



interface PendingAuth {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class ZMNotificationService {
  private ws: WebSocket | null = null;
  private config: ZMEventServerConfig | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private baseReconnectDelay = 2000; // 2 seconds initial
  private maxReconnectDelay = 120000; // Cap at 2 minutes
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pendingAuth: PendingAuth | null = null;
  private intentionalDisconnect = false;

  // Event listeners
  private eventCallbacks: Set<NotificationEventCallback> = new Set();
  private stateCallbacks: Set<ConnectionStateCallback> = new Set();

  constructor() {
    log.notifications('ZMNotificationService initialized', LogLevel.INFO);
  }

  /**
   * Connect to ZM event notification server
   */
  public async connect(config: ZMEventServerConfig): Promise<void> {
    if (this.state === 'connected' || this.state === 'authenticating' || this.state === 'connecting') {
      log.notifications('Already connected or connecting to notification server', LogLevel.INFO, { state: this.state });
      return;
    }

    this.config = config;
    this.reconnectAttempts = 0;
    this.intentionalDisconnect = false;

    await this._connect();
  }

  /**
   * Disconnect from notification server
   */
  public disconnect(): void {
    log.notifications('Disconnecting from notification server', LogLevel.INFO);
    this.intentionalDisconnect = true;
    this._clearTimers();

    // Reject pending auth
    if (this.pendingAuth) {
      clearTimeout(this.pendingAuth.timeout);
      this.pendingAuth.reject(new Error('Connection closed'));
      this.pendingAuth = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._setState('disconnected');
  }

  /**
   * Send a ping and verify the connection is alive.
   * Resolves true if the connection responded, false otherwise.
   * Used by the NotificationHandler to verify liveness on app resume.
   */
  public async checkAlive(timeoutMs = 5000): Promise<boolean> {
    if (!this._isConnected()) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.ws?.removeEventListener('message', handleMessage);
        resolve(false);
      }, timeoutMs);

      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as ZMNotificationMessage;
          // Any response to our version request means the connection is alive
          if (data.event === 'control' && data.type === 'version') {
            clearTimeout(timeout);
            this.ws?.removeEventListener('message', handleMessage);
            resolve(true);
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws?.addEventListener('message', handleMessage);
      this._send({ event: 'control', data: { type: 'version' } });
    });
  }

  /**
   * Register mobile push token with server
   */
  public async registerPushToken(
    token: string,
    platform: 'ios' | 'android',
    monitorIds?: number[],
    intervals?: number[]
  ): Promise<void> {
    if (!this._isConnected()) {
      throw new Error('Not connected to notification server');
    }

    const message = {
      event: 'push',
      data: {
        type: 'token',
        token,
        platform,
        ...(monitorIds && { monlist: monitorIds.join(',') }),
        ...(intervals && { intlist: intervals.join(',') }),
        state: 'enabled',
      },
    };

    log.notifications('Registering push token', LogLevel.INFO, {
      platform,
      monitorCount: monitorIds?.length,
    });

    this._send(message);
  }

  /**
   * Deregister mobile push token with server
   */
  public async deregisterPushToken(
    token: string,
    platform: 'ios' | 'android'
  ): Promise<void> {
    if (!this._isConnected()) {
      log.notifications('Cannot deregister push token - not connected', LogLevel.WARN);
      return;
    }

    const message = {
      event: 'push',
      data: {
        type: 'token',
        token,
        platform,
        state: 'disabled',
      },
    };

    log.notifications('Deregistering push token', LogLevel.INFO, { platform, });

    this._send(message);
  }

  /**
   * Update monitor filter
   */
  public async setMonitorFilter(monitorIds: number[], intervals: number[]): Promise<void> {
    if (!this._isConnected()) {
      throw new Error('Not connected to notification server');
    }

    const message = {
      event: 'control',
      data: {
        type: 'filter',
        monlist: monitorIds.join(','),
        intlist: intervals.join(','),
      },
    };

    log.notifications('Setting monitor filter', LogLevel.INFO, {
      monitors: monitorIds,
      intervals,
    });

    this._send(message);
  }

  /**
   * Update badge count (mobile)
   */
  public async updateBadgeCount(count: number): Promise<void> {
    if (!this._isConnected()) {
      log.notifications('Cannot update badge - not connected', LogLevel.WARN);
      return;
    }

    const message = {
      event: 'push',
      data: {
        type: 'badge',
        badge: count,
      },
    };

    log.notifications('Updating badge count', LogLevel.INFO, { count });
    this._send(message);
  }

  /**
   * Get server version
   */
  public async getServerVersion(): Promise<string> {
    if (!this._isConnected()) {
      throw new Error('Not connected to notification server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Version request timeout'));
      }, 5000);

      // Listen for version response once
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as ZMNotificationMessage;
          if (data.event === 'control' && data.type === 'version' && data.version) {
            clearTimeout(timeout);
            this.ws?.removeEventListener('message', handleMessage);
            resolve(data.version);
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws?.addEventListener('message', handleMessage);

      this._send({
        event: 'control',
        data: { type: 'version' },
      });
    });
  }

  /**
   * Add event listener
   */
  public onEvent(callback: NotificationEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Add connection state listener
   */
  public onStateChange(callback: ConnectionStateCallback): () => void {
    this.stateCallbacks.add(callback);
    // Immediately call with current state
    callback(this.state);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected and authenticated
   */
  public isConnected(): boolean {
    return this.state === 'connected';
  }

  // ========== PRIVATE METHODS ==========

  private async _connect(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration provided');
    }

    this._setState('connecting');

    const protocol = this.config.ssl ? 'wss' : 'ws';
    const path = this.config.path || '/';

    // Strip protocol if user entered it in host field
    let host = this.config.host;
    if (host.startsWith('wss://')) host = host.replace('wss://', '');
    if (host.startsWith('ws://')) host = host.replace('ws://', '');
    if (host.startsWith('https://')) host = host.replace('https://', '');
    if (host.startsWith('http://')) host = host.replace('http://', '');

    const url = `${protocol}://${host}:${this.config.port}${path}`;

    log.notifications('Connecting to notification server', LogLevel.INFO, {
      url: url.replace(/\/\/.*@/, '//***@'), // Hide credentials in logs
      ssl: this.config.ssl,
    });

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this._handleOpen();
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        this._handleMessage(event);
      };

      ws.onerror = (error) => {
        if (this.ws !== ws) return;
        log.notifications('WebSocket error', LogLevel.ERROR, error);
        if (this.config?.ssl) {
          log.notifications('If using self-signed certificates, ensure they are trusted by the device/browser.', LogLevel.WARN);
        }
        this._handleError(error);
      };

      ws.onclose = (event) => {
        if (this.ws !== ws) return;
        this._handleClose(event);
      };

      // Wait for authentication to complete
      await this._waitForAuth();
    } catch (error) {
      log.notifications('Failed to connect to notification server', LogLevel.ERROR, error);
      this._setState('error');
      // Don't throw — let _handleClose schedule reconnect for transport failures.
      // For auth failures, disconnect() was already called in _handleMessage.
    }
  }

  private _handleOpen(): void {
    log.notifications('WebSocket connected, authenticating...', LogLevel.INFO);
    this._setState('authenticating');

    // Send authentication message
    if (this.config) {
      const authMessage = {
        event: 'auth',
        data: {
          user: this.config.username,
          password: this.config.password,
          appversion: this.config.appVersion,
        },
        category: 'normal',
      };

      this._send(authMessage);
    }
  }

  private _handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ZMNotificationMessage;

      log.notifications('Received message', LogLevel.INFO, {
        event: message.event,
        status: message.status,
        fullMessage: message, // Log full message for debugging
      });

      // Handle authentication response
      if (message.event === 'auth') {
        if (message.status === 'Success') {
          log.notifications('Authentication successful', LogLevel.INFO, { version: message.version, });
          this.reconnectAttempts = 0;
          this._setState('connected');
          this._startPingInterval();

          if (this.pendingAuth) {
            clearTimeout(this.pendingAuth.timeout);
            this.pendingAuth.resolve();
            this.pendingAuth = null;
          }
        } else {
          const error = new Error(`Authentication failed: ${message.reason || 'Unknown'}`);
          log.notifications('Authentication failed', LogLevel.ERROR, error);
          this._setState('error');

          if (this.pendingAuth) {
            clearTimeout(this.pendingAuth.timeout);
            this.pendingAuth.reject(error);
            this.pendingAuth = null;
          }

          this.disconnect();
        }
      }

      // Handle alarm events
      if (message.event === 'alarm' && message.status === 'Success' && message.events) {
        for (const event of message.events) {
          log.notifications('Alarm event received', LogLevel.INFO, {
            monitor: event.MonitorName,
            eventId: event.EventId,
            cause: event.Cause,
          });

          // Set image URL: prefer server-provided Picture, fall back to client-constructed URL
          if (event.Picture) {
            event.ImageUrl = event.Picture;
            log.notifications('Using server-provided image URL', LogLevel.INFO, {
              eventId: event.EventId,
              imageUrl: event.Picture,
            });
          } else if (this.config && event.EventId) {
            const currentToken = useAuthStore.getState().accessToken;
            let imageUrl = `${this.config.portalUrl}/index.php?view=image&eid=${event.EventId}&fid=snapshot&width=600`;
            if (currentToken) {
              imageUrl += `&token=${currentToken}`;
            }
            event.ImageUrl = imageUrl;
            log.notifications('Using client-constructed image URL (no Picture from server)', LogLevel.INFO, {
              eventId: event.EventId,
              imageUrl,
            });
          }

          // Notify all listeners
          this.eventCallbacks.forEach((callback) => {
            try {
              callback(event);
            } catch (error) {
              log.notifications('Error in event callback', LogLevel.ERROR, error);
            }
          });
        }
      }
    } catch (error) {
      log.notifications('Failed to parse notification message', LogLevel.ERROR, error);
    }
  }

  private _handleError(error: Event): void {
    log.notifications('WebSocket error', LogLevel.ERROR, error);
    this._setState('error');
  }

  private _handleClose(event: CloseEvent): void {
    log.notifications('WebSocket closed', LogLevel.INFO, {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });

    this.ws = null;
    this._clearTimers();

    // Reject pending auth if still waiting
    if (this.pendingAuth) {
      clearTimeout(this.pendingAuth.timeout);
      this.pendingAuth.reject(new Error('Connection closed during authentication'));
      this.pendingAuth = null;
    }

    this._setState('disconnected');

    // Reconnect unless the user explicitly called disconnect()
    if (!this.intentionalDisconnect && this.config) {
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    // Don't schedule if already have a pending reconnect
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;

    // Exponential backoff: 2s, 4s, 8s, 16s, ... capped at maxReconnectDelay
    const exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxReconnectDelay);
    // Add jitter: ±25% to prevent thundering herd
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.round(cappedDelay + jitter);

    log.notifications('Scheduling reconnect', LogLevel.INFO, {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect().catch((error) => {
        log.notifications('Reconnect failed', LogLevel.ERROR, error);
      });
    }, delay);
  }

  /**
   * Trigger an immediate reconnect (e.g., after network comes back online).
   * Cancels any pending scheduled reconnect.
   */
  public reconnectNow(): void {
    if (this.state === 'connected' || this.state === 'connecting' || this.state === 'authenticating') {
      return;
    }
    if (!this.config || this.intentionalDisconnect) {
      return;
    }

    log.notifications('Triggering immediate reconnect', LogLevel.INFO);

    // Cancel any pending scheduled reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset attempt counter on explicit reconnect (e.g., network restored)
    this.reconnectAttempts = 0;

    this._connect().catch((error) => {
      log.notifications('Immediate reconnect failed', LogLevel.ERROR, error);
    });
  }

  private _clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private _startPingInterval(): void {
    // Clear any existing interval first
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    // Send periodic pings to keep connection alive (every 60 seconds)
    this.pingInterval = setInterval(() => {
      if (this._isConnected()) {
        log.notifications('Sending keepalive ping', LogLevel.DEBUG);
        this._send({ event: 'control', data: { type: 'version' } });
      }
    }, 60000);
  }

  private _send(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log.notifications('Cannot send message - WebSocket not open', LogLevel.WARN);
      return;
    }

    const messageStr = JSON.stringify(message);
    log.notifications('Sending message', LogLevel.INFO, {
      message: message, // Log full object instead of truncated string
    });
    this.ws.send(messageStr);
    }

  private _setState(state: ConnectionState): void {
      if (this.state === state) return;

    log.notifications('Connection state changed', LogLevel.INFO, {
      from: this.state,
      to: state,
    });

    this.state = state;

    // Notify all state listeners
    this.stateCallbacks.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        log.notifications('Error in state callback', LogLevel.ERROR, error);
      }
    });
  }

  private _isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.state === 'connected';
  }

  private _waitForAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        log.notifications('Authentication timed out after 20 seconds', LogLevel.ERROR);
        this.pendingAuth = null;
        this._setState('error');

        // Close the socket — this triggers _handleClose which will schedule reconnect
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        reject(new Error('Authentication timeout (20 seconds)'));
      }, 20000);

      this.pendingAuth = { resolve, reject, timeout };
    });
  }
}

// Singleton instance
let notificationService: ZMNotificationService | null = null;

export function getNotificationService(): ZMNotificationService {
  if (!notificationService) {
    notificationService = new ZMNotificationService();
  }
  return notificationService;
}

export function resetNotificationService(): void {
  if (notificationService) {
    notificationService.disconnect();
    notificationService = null;
  }
}
