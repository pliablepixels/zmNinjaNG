/**
 * Event List View
 *
 * List view of events with thumbnails and metadata.
 * Uses virtualization only for large lists (>100 items) to avoid complexity
 * with scroll margin calculations when there's content above the list.
 */

import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { EventCard } from './EventCard';
import { getEventImageUrl } from '../../api/events';
import { calculateThumbnailDimensions, EVENT_GRID_CONSTANTS } from '../../lib/event-utils';
// import { EVENT_LIST } from '../../lib/zmninja-ng-constants';
import type { Monitor, Tag } from '../../api/types';

interface EventListViewProps {
  events: any[];
  monitors: Array<{ Monitor: Monitor }>;
  thumbnailFit: 'contain' | 'cover' | 'none' | 'scale-down';
  portalUrl: string;
  accessToken?: string;
  batchSize: number;
  totalCount?: number;
  isLoadingMore: boolean;
  isFetching?: boolean;
  onLoadMore: () => void;
  parentRef: React.RefObject<HTMLDivElement | null>;
  parentElement: HTMLDivElement | null;
  eventTagMap?: Map<string, Tag[]>;
}

// Helper to render a single event item
const EventItem = ({
  event,
  monitors,
  thumbnailFit,
  portalUrl,
  accessToken,
  eventTagMap,
}: {
  event: any;
  monitors: Array<{ Monitor: Monitor }>;
  thumbnailFit: 'contain' | 'cover' | 'none' | 'scale-down';
  portalUrl: string;
  accessToken?: string;
  eventTagMap?: Map<string, Tag[]>;
}) => {
  const { Event } = event;
  const monitorData = monitors.find((m) => m.Monitor.Id === Event.MonitorId)?.Monitor;

  const monitorWidth = parseInt(monitorData?.Width || Event.Width || '640', 10);
  const monitorHeight = parseInt(monitorData?.Height || Event.Height || '480', 10);

  const { width: thumbnailWidth, height: thumbnailHeight } = calculateThumbnailDimensions(
    monitorWidth,
    monitorHeight,
    monitorData?.Orientation ?? Event.Orientation,
    EVENT_GRID_CONSTANTS.LIST_VIEW_TARGET_SIZE
  );

  const thumbnailUrl = getEventImageUrl(portalUrl, Event.Id, 'snapshot', {
    token: accessToken,
    width: thumbnailWidth,
    height: thumbnailHeight,
  });

  const monitorName = monitorData?.Name || `Camera ${Event.MonitorId}`;

  return (
    <div className="pb-3">
      <EventCard
        event={Event}
        monitorName={monitorName}
        thumbnailUrl={thumbnailUrl}
        objectFit={thumbnailFit}
        thumbnailWidth={thumbnailWidth}
        thumbnailHeight={thumbnailHeight}
        tags={eventTagMap?.get(Event.Id)}
      />
    </div>
  );
};

export const EventListView = ({
  events,
  monitors,
  thumbnailFit,
  portalUrl,
  accessToken,
  batchSize,
  totalCount,
  isLoadingMore,
  isFetching = false,
  onLoadMore,
  parentRef,
  parentElement,
  eventTagMap,
}: EventListViewProps) => {
  const { t } = useTranslation();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [marginReady, setMarginReady] = useState(false);

  // Disable virtualization - it's causing rendering issues in Tauri where new items
  // don't appear until window resize. Non-virtualized rendering works fine even with
  // large lists (tested with 500+ events) and is more reliable across platforms.
  const shouldVirtualize = false;
  // const shouldVirtualize = events.length > EVENT_LIST.virtualizationThreshold;

  // Calculate scroll margin only when virtualizing
  useLayoutEffect(() => {
    if (!shouldVirtualize || !parentElement || !listContainerRef.current) {
      setMarginReady(true);
      return;
    }

    const calculateMargin = () => {
      if (!listContainerRef.current || !parentElement) return;

      let offset = 0;
      let el: HTMLElement | null = listContainerRef.current;

      while (el && el !== parentElement) {
        offset += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
        if (el && el !== parentElement && el.scrollTop > 0) break;
      }

      setScrollMargin(offset);
      setMarginReady(true);
    };

    const rafId = requestAnimationFrame(calculateMargin);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(calculateMargin);
    });

    resizeObserver.observe(parentElement);
    Array.from(parentElement.children).forEach(child => {
      resizeObserver.observe(child);
    });

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(calculateMargin);
    });
    mutationObserver.observe(parentElement, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [parentElement, shouldVirtualize, events.length]);

  // Virtualizer hook - always call but only use when virtualizing
  const rowVirtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 5,
    scrollMargin,
  });

  // Virtualization is currently disabled
  // This effect would force recalculation when re-enabled
  // useEffect(() => {
  //   if (shouldVirtualize) {
  //     requestAnimationFrame(() => {
  //       rowVirtualizer.measure();
  //     });
  //   }
  // }, [events.length, shouldVirtualize, rowVirtualizer]);

  // Don't render content until we have a parent element
  if (!parentElement) {
    return (
      <div className="min-h-0 p-4" data-testid="event-list-loading">
        <div className="text-center text-muted-foreground">
          {t('common.loading')}...
        </div>
      </div>
    );
  }

  // For virtualized lists, wait for margin calculation
  if (shouldVirtualize && !marginReady) {
    return (
      <div ref={listContainerRef} className="min-h-0 p-4" data-testid="event-list-loading">
        <div className="text-center text-muted-foreground">
          {t('common.loading')}...
        </div>
      </div>
    );
  }

  const isLoadingData = isLoadingMore || isFetching;
  const hasMore = totalCount !== undefined ? events.length < totalCount : false;
  const remaining = totalCount !== undefined ? Math.min(batchSize, totalCount - events.length) : batchSize;

  // Status header - shows "Showing X of Y events" at the top
  const header = (
    <div className="text-xs text-muted-foreground pb-3 flex items-center gap-2">
      {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
      {totalCount !== undefined
        ? t('events.showing_of_total', { showing: events.length, total: totalCount })
        : t('events.showing_events', { count: events.length })}
    </div>
  );

  // Footer with Load More button
  const footer = hasMore ? (
    <div className="text-center py-4">
      <Button
        onClick={onLoadMore}
        disabled={isLoadingData}
        variant="outline"
        size="sm"
        className="w-full"
        data-testid="events-load-more"
      >
        {isLoadingData ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('events.loading_more', { count: remaining })}
          </>
        ) : (
          t('events.load_more')
        )}
      </Button>
    </div>
  ) : null;

  // Non-virtualized rendering for smaller lists
  if (!shouldVirtualize) {
    return (
      <div className="min-h-0" data-testid="event-list">
        {header}
        {events.map((event) => (
          <EventItem
            key={event.Event.Id}
            event={event}
            monitors={monitors}
            thumbnailFit={thumbnailFit}
            portalUrl={portalUrl}
            accessToken={accessToken}
            eventTagMap={eventTagMap}
          />
        ))}
        {footer}
      </div>
    );
  }

  // Virtualized rendering for large lists
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div ref={listContainerRef} className="min-h-0" data-testid="event-list">
      {header}
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const event = events[virtualRow.index];

          return (
            <div
              key={event.Event.Id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <EventItem
                event={event}
                monitors={monitors}
                thumbnailFit={thumbnailFit}
                portalUrl={portalUrl}
                accessToken={accessToken}
                eventTagMap={eventTagMap}
              />
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
};
