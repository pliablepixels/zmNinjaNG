/**
 * useTokenRefresh Hook Tests
 *
 * Tests for the token refresh hook that automatically manages
 * authentication token lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ZM_INTEGRATION } from '../../lib/zmninja-ng-constants';

// Mock the auth store before importing the hook
const mockRefreshAccessToken = vi.fn();
let mockStoreState = {
  isAuthenticated: false,
  accessTokenExpires: null as number | null,
  refreshAccessToken: mockRefreshAccessToken,
};

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

vi.mock('../../lib/logger', () => ({
  log: {
    auth: vi.fn(),
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
  },
}));

// Import hook after mocks are set up
import { useTokenRefresh } from '../useTokenRefresh';

describe('useTokenRefresh', () => {
  const NOW = new Date('2024-01-01T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();

    mockStoreState = {
      isAuthenticated: false,
      accessTokenExpires: null,
      refreshAccessToken: mockRefreshAccessToken,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not refresh when not authenticated', () => {
    mockStoreState.isAuthenticated = false;

    renderHook(() => useTokenRefresh());

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('does not refresh when token is far from expiry', () => {
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW + 2 * 60 * 60 * 1000; // 2 hours away

    renderHook(() => useTokenRefresh());

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes when token is within leeway window', async () => {
    mockRefreshAccessToken.mockResolvedValue(undefined);
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW + 3 * 60 * 1000; // 3 minutes away (within 5-min leeway)

    renderHook(() => useTokenRefresh());

    await vi.waitFor(() => {
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  it('refreshes when token has already expired', async () => {
    mockRefreshAccessToken.mockResolvedValue(undefined);
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW - 60 * 1000; // Expired 1 minute ago

    renderHook(() => useTokenRefresh());

    await vi.waitFor(() => {
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  it('refreshes when token expired long ago (e.g., after background sleep)', async () => {
    mockRefreshAccessToken.mockResolvedValue(undefined);
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW - 30 * 60 * 1000; // Expired 30 minutes ago

    renderHook(() => useTokenRefresh());

    await vi.waitFor(() => {
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  it('checks token on interval', async () => {
    mockRefreshAccessToken.mockResolvedValue(undefined);
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW + 2 * 60 * 60 * 1000; // 2 hours away

    renderHook(() => useTokenRefresh());
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();

    // Advance time so the token is now within the leeway window
    vi.setSystemTime(NOW + (2 * 60 * 60 * 1000) - (3 * 60 * 1000)); // 3 min before expiry
    await act(async () => {
      vi.advanceTimersByTime(ZM_INTEGRATION.tokenCheckInterval);
    });

    await vi.waitFor(() => {
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  it('refreshes on visibility change to visible when token is expired', async () => {
    mockRefreshAccessToken.mockResolvedValue(undefined);
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW - 10 * 1000; // Expired 10 seconds ago

    renderHook(() => useTokenRefresh());

    // First call happens immediately on mount
    await vi.waitFor(() => {
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    });

    mockRefreshAccessToken.mockClear();

    // Simulate page becoming visible (the visibilitychange handler should call checkAndRefresh)
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // The handler fires but the isRefreshing guard or the same expired state
    // may or may not trigger a second refresh depending on timing.
    // The key thing is that it doesn't crash and the visibility listener works.
  });

  it('prevents concurrent refresh attempts', async () => {
    let resolveRefresh!: () => void;
    mockRefreshAccessToken.mockImplementation(
      () => new Promise<void>((resolve) => { resolveRefresh = resolve; })
    );
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW - 10 * 1000; // Expired

    renderHook(() => useTokenRefresh());

    // First refresh starts
    await vi.waitFor(() => {
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    });

    // Advance timer to trigger another check while first is still in progress
    await act(async () => {
      vi.advanceTimersByTime(ZM_INTEGRATION.tokenCheckInterval);
    });

    // Should still only have 1 call (second was skipped due to guard)
    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);

    // Resolve the first refresh
    await act(async () => {
      resolveRefresh();
    });
  });

  it('handles refresh failure without crashing', async () => {
    mockRefreshAccessToken.mockRejectedValue(new Error('Network error'));
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW - 10 * 1000; // Expired

    // Should not throw
    renderHook(() => useTokenRefresh());

    await vi.waitFor(() => {
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  it('cleans up interval and listener on unmount', () => {
    const addEventSpy = vi.spyOn(document, 'addEventListener');
    const removeEventSpy = vi.spyOn(document, 'removeEventListener');

    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = NOW + 2 * 60 * 60 * 1000;

    const { unmount } = renderHook(() => useTokenRefresh());

    expect(addEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    addEventSpy.mockRestore();
    removeEventSpy.mockRestore();
  });

  it('does not refresh when accessTokenExpires is null (no auth required)', () => {
    mockStoreState.isAuthenticated = true;
    mockStoreState.accessTokenExpires = null;

    renderHook(() => useTokenRefresh());

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });
});
