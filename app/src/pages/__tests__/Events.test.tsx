import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import Events from '../Events';

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: (string | object)[] }) => useQueryMock(options),
  keepPreviousData: (previousData: unknown) => previousData,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 120,
    getVirtualItems: () => [{ index: 0, size: 120, start: 0 }],
  }),
}));

vi.mock('../../stores/profile', () => ({
  useProfileStore: (selector: (state: { currentProfile: () => { id: string; portalUrl: string; apiUrl: string } }) => unknown) =>
    selector({
      currentProfile: () => ({ id: 'profile-1', portalUrl: 'https://portal.test', apiUrl: 'https://api.test' }),
    }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (state: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'token-1' }),
}));

vi.mock('../../stores/settings', () => ({
  DEFAULT_SETTINGS: {
    viewMode: 'snapshot',
    displayMode: 'normal',
    theme: 'light',
    defaultEventLimit: 50,
    eventsViewMode: 'list',
    eventMontageGridCols: 3,
  },
  useSettingsStore: (selector: (state: { getProfileSettings: (id: string) => { defaultEventLimit: number; eventsViewMode: 'list'; eventMontageGridCols: number } }) => unknown) =>
    selector({ getProfileSettings: () => ({ defaultEventLimit: 50, eventsViewMode: 'list', eventMontageGridCols: 3 }) }),
}));

const applyFilters = vi.fn();
const clearFilters = vi.fn();

vi.mock('../../hooks/useEventFilters', () => ({
  ALL_TAGS_FILTER_ID: '__all_tags__',
  useEventFilters: () => ({
    filters: {},
    selectedMonitorIds: [],
    selectedTagIds: [],
    startDateInput: '',
    endDateInput: '',
    favoritesOnly: false,
    setSelectedMonitorIds: vi.fn(),
    setSelectedTagIds: vi.fn(),
    setStartDateInput: vi.fn(),
    setEndDateInput: vi.fn(),
    setFavoritesOnly: vi.fn(),
    applyFilters,
    clearFilters,
    activeFilterCount: 0,
  }),
}));

vi.mock('../../hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    containerRef: { current: null },
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    threshold: 0,
    bind: () => ({}),
  }),
}));

vi.mock('../../components/events/EventCard', () => ({
  EventCard: ({ event, monitorName }: { event: { Id: string }; monitorName: string }) => (
    <div data-testid="event-card-item">
      {event.Id}-{monitorName}
    </div>
  ),
}));

vi.mock('../../components/events/EventHeatmap', () => ({
  EventHeatmap: () => <div data-testid="event-heatmap" />,
}));

vi.mock('../../components/events/EventMontageView', () => ({
  EventMontageView: () => <div data-testid="events-montage-grid" />,
}));

vi.mock('../../components/filters/MonitorFilterPopover', () => ({
  MonitorFilterPopoverContent: () => <div data-testid="monitor-filter" />,
}));

vi.mock('../../components/ui/quick-date-range-buttons', () => ({
  QuickDateRangeButtons: () => <div data-testid="quick-range" />,
}));

vi.mock('../../components/ui/pull-to-refresh-indicator', () => ({
  PullToRefreshIndicator: () => <div data-testid="pull-indicator" />,
}));

vi.mock('../../components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children, ...props }: { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('../../api/events', () => ({
  getEvents: vi.fn(),
  getEventImageUrl: vi.fn(() => 'https://example.test/thumb.jpg'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: {} }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

describe('Events Page', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    applyFilters.mockClear();
    clearFilters.mockClear();
  });

  it('shows empty state when no events exist', () => {
    useQueryMock.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'monitors') {
        return { data: { monitors: [] }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'tags') {
        return { data: { tags: [] }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'eventTags') {
        return { data: new Map(), isLoading: false, error: null, refetch: vi.fn() };
      }
      return { data: null, isLoading: false, error: null, refetch: vi.fn() };
    });

    render(<Events />);

    expect(screen.getByTestId('events-empty-state')).toBeInTheDocument();
  });

  it('renders event list when events are available', () => {
    useQueryMock.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'monitors') {
        return {
          data: {
            monitors: [
              { Monitor: { Id: '1', Name: 'Front Door', Deleted: false } },
            ],
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (queryKey[0] === 'events') {
        return {
          data: {
            events: [
              {
                Event: {
                  Id: '100',
                  MonitorId: '1',
                },
              },
            ],
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (queryKey[0] === 'tags') {
        return { data: { tags: [] }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'eventTags') {
        return { data: new Map(), isLoading: false, error: null, refetch: vi.fn() };
      }
      return { data: null, isLoading: false, error: null, refetch: vi.fn() };
    });

    render(<Events />);

    expect(screen.getByTestId('event-list')).toBeInTheDocument();
    expect(screen.getByTestId('event-card-item')).toHaveTextContent('100-Front Door');
  });

  it('applies and clears filters from the filter panel', async () => {
    useQueryMock.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'monitors') {
        return { data: { monitors: [] }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'tags') {
        return { data: { tags: [] }, isLoading: false, error: null, refetch: vi.fn() };
      }
      if (queryKey[0] === 'eventTags') {
        return { data: new Map(), isLoading: false, error: null, refetch: vi.fn() };
      }
      return { data: null, isLoading: false, error: null, refetch: vi.fn() };
    });

    render(<Events />);

    expect(screen.getByTestId('events-filter-panel')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('events-apply-filters'));
    await user.click(screen.getByTestId('events-clear-filters'));

    expect(applyFilters).toHaveBeenCalled();
    expect(clearFilters).toHaveBeenCalled();
  });
});
