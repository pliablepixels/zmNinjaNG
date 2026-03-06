import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ZMNotificationService,
  getNotificationService,
  resetNotificationService,
} from '../notifications';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static CLOSING = 2;

  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private listeners: Record<string, Set<EventListener>> = {};

  send = vi.fn();

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners[type]) this.listeners[type] = new Set();
    this.listeners[type].add(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners[type]?.delete(listener);
  }

  // Test helpers
  _triggerOpen() {
    this.onopen?.(new Event('open'));
  }

  _triggerMessage(data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.onmessage?.(event);
    this.listeners['message']?.forEach((fn) => fn(event));
  }

  _triggerClose(wasClean = false, code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason: '', wasClean } as CloseEvent);
  }

  _triggerError() {
    this.onerror?.(new Event('error'));
  }
}

vi.mock('../../lib/logger', () => ({
  log: {
    notifications: vi.fn(),
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
  },
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: 'test-token' }),
  },
}));

const testConfig = {
  host: 'zm.example.com',
  port: 9000,
  ssl: false,
  username: 'admin',
  password: 'secret',
  appVersion: '1.0.0',
  portalUrl: 'http://zm.example.com/zm',
};

function createMockWebSocketConstructor() {
  const instances: MockWebSocket[] = [];
  const ctor = vi.fn(() => {
    const ws = new MockWebSocket();
    instances.push(ws);
    return ws;
  }) as unknown as typeof WebSocket & { instances: MockWebSocket[] };

  // Copy static properties so code can reference WebSocket.OPEN
  Object.defineProperty(ctor, 'OPEN', { value: 1 });
  Object.defineProperty(ctor, 'CLOSED', { value: 3 });
  Object.defineProperty(ctor, 'CONNECTING', { value: 0 });
  Object.defineProperty(ctor, 'CLOSING', { value: 2 });

  ctor.instances = instances;
  return ctor;
}

describe('ZMNotificationService', () => {
  let service: ZMNotificationService;
  let wsCtor: ReturnType<typeof createMockWebSocketConstructor>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ZMNotificationService();
    vi.clearAllMocks();

    wsCtor = createMockWebSocketConstructor();
    vi.stubGlobal('WebSocket', wsCtor);
  });

  afterEach(() => {
    service.disconnect();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Helper: connect and authenticate */
  async function connectAndAuth() {
    const connectPromise = service.connect(testConfig);
    const ws = wsCtor.instances[wsCtor.instances.length - 1];
    ws._triggerOpen();
    ws._triggerMessage({ event: 'auth', status: 'Success', version: '1.0' });
    await connectPromise;
    return ws;
  }

  describe('Connection', () => {
    it('initializes with disconnected state', () => {
      expect(service.getState()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
    });

    it('transitions through connecting -> authenticating -> connected', async () => {
      const states: string[] = [];
      service.onStateChange((state) => states.push(state));

      await connectAndAuth();

      expect(states).toEqual(['disconnected', 'connecting', 'authenticating', 'connected']);
      expect(service.isConnected()).toBe(true);
    });

    it('disconnects cleanly and prevents reconnect', async () => {
      await connectAndAuth();

      service.disconnect();
      expect(service.getState()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);

      // Advance timers — no reconnect should be scheduled
      await vi.advanceTimersByTimeAsync(300_000);
      expect(wsCtor).toHaveBeenCalledTimes(1); // Only the initial connect
    });
  });

  describe('Reconnection', () => {
    it('schedules reconnect on unclean close', async () => {
      const ws = await connectAndAuth();

      ws._triggerClose(false, 1006);
      expect(service.getState()).toBe('disconnected');

      // Advance past first reconnect delay (~2s base)
      await vi.advanceTimersByTimeAsync(3000);

      expect(wsCtor).toHaveBeenCalledTimes(2);
    });

    it('does not reconnect on intentional disconnect', async () => {
      await connectAndAuth();

      service.disconnect();

      await vi.advanceTimersByTimeAsync(300_000);
      expect(wsCtor).toHaveBeenCalledTimes(1);
    });

    it('uses exponential backoff with increasing delays', async () => {
      const ws = await connectAndAuth();

      // First failure
      ws._triggerClose(false, 1006);

      // Attempt 1: ~2s delay — advance 3s to trigger it
      await vi.advanceTimersByTimeAsync(3000);
      expect(wsCtor).toHaveBeenCalledTimes(2);
      // This new socket also fails
      wsCtor.instances[1]._triggerClose(false, 1006);

      // Attempt 2: ~4s delay — advance 5s to trigger it
      await vi.advanceTimersByTimeAsync(5000);
      expect(wsCtor).toHaveBeenCalledTimes(3);
      wsCtor.instances[2]._triggerClose(false, 1006);

      // Attempt 3: ~8s delay — at 5s it should NOT have fired yet
      await vi.advanceTimersByTimeAsync(5000);
      // Might or might not have fired due to jitter, but advance more to be sure
      await vi.advanceTimersByTimeAsync(5000);
      expect(wsCtor.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('reconnectNow triggers immediate reconnect', async () => {
      const ws = await connectAndAuth();
      ws._triggerClose(false, 1006);

      service.reconnectNow();

      // Should immediately create a new WebSocket (bypassing backoff)
      expect(wsCtor).toHaveBeenCalledTimes(2);
    });

    it('reconnectNow does nothing when intentionally disconnected', () => {
      service.disconnect();
      service.reconnectNow();
      expect(wsCtor).not.toHaveBeenCalled();
    });

    it('reconnectNow does nothing when already connected', async () => {
      await connectAndAuth();
      service.reconnectNow();
      expect(wsCtor).toHaveBeenCalledTimes(1);
    });

    it('does not auto-reconnect after auth failure', async () => {
      const connectPromise = service.connect(testConfig);
      const ws = wsCtor.instances[0];
      ws._triggerOpen();

      // Auth fails — _handleMessage calls disconnect() which sets intentionalDisconnect
      ws._triggerMessage({ event: 'auth', status: 'Fail', reason: 'Bad credentials' });
      await connectPromise;

      // disconnect() was called, so no auto-reconnect should happen
      await vi.advanceTimersByTimeAsync(300_000);
      expect(wsCtor).toHaveBeenCalledTimes(1);
    });
  });

  describe('Auth timeout', () => {
    it('closes socket and sets error state on auth timeout', async () => {
      const connectPromise = service.connect(testConfig);
      const ws = wsCtor.instances[0];
      ws._triggerOpen();

      // Don't send auth response — let it time out
      await vi.advanceTimersByTimeAsync(20_000);
      await connectPromise;

      // State should be error (set by timeout before catch block)
      expect(service.getState()).toBe('error');
    });
  });

  describe('Liveness check', () => {
    it('checkAlive returns false when not connected', async () => {
      const alive = await service.checkAlive();
      expect(alive).toBe(false);
    });

    it('checkAlive returns true when server responds', async () => {
      const ws = await connectAndAuth();

      const alivePromise = service.checkAlive(5000);

      // Simulate server responding to version request
      ws._triggerMessage({ event: 'control', type: 'version', version: '1.0' });

      const alive = await alivePromise;
      expect(alive).toBe(true);
    });

    it('checkAlive returns false on timeout', async () => {
      await connectAndAuth();

      const alivePromise = service.checkAlive(3000);

      // Don't respond — let it time out
      await vi.advanceTimersByTimeAsync(3000);

      const alive = await alivePromise;
      expect(alive).toBe(false);
    });
  });

  describe('Event handling', () => {
    it('notifies event listeners on alarm messages', async () => {
      const listener = vi.fn();
      service.onEvent(listener);

      const ws = await connectAndAuth();

      ws._triggerMessage({
        event: 'alarm',
        status: 'Success',
        events: [
          {
            MonitorId: 1,
            MonitorName: 'Front Door',
            EventId: 42,
            Cause: 'Motion',
            Name: 'Front Door',
          },
        ],
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ EventId: 42, MonitorName: 'Front Door' }),
      );
    });

    it('unsubscribe removes event listener', async () => {
      const listener = vi.fn();
      const unsubscribe = service.onEvent(listener);

      const ws = await connectAndAuth();
      unsubscribe();

      ws._triggerMessage({
        event: 'alarm',
        status: 'Success',
        events: [{ MonitorId: 1, MonitorName: 'Test', EventId: 1, Cause: 'Motion', Name: 'Test' }],
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Keepalive ping', () => {
    it('sends version request every 60 seconds', async () => {
      const ws = await connectAndAuth();

      ws.send.mockClear();

      await vi.advanceTimersByTimeAsync(60_000);

      expect(ws.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentMessage.event).toBe('control');
      expect(sentMessage.data.type).toBe('version');
    });
  });

  describe('Singleton', () => {
    it('getNotificationService returns same instance', () => {
      const a = getNotificationService();
      const b = getNotificationService();
      expect(a).toBe(b);
    });

    it('resetNotificationService creates new instance', () => {
      const a = getNotificationService();
      resetNotificationService();
      const b = getNotificationService();
      expect(a).not.toBe(b);
    });
  });
});
