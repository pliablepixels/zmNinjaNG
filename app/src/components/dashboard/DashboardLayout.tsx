/**
 * Dashboard Layout Component
 *
 * Manages the grid layout for dashboard widgets using react-grid-layout.
 * Features:
 * - Single responsive grid that scales with the viewport
 * - Drag and drop widget positioning
 * - Resizable widgets
 * - Profile-specific widget configurations
 * - Empty state display when no widgets exist
 */

import { useDashboardStore } from '../../stores/dashboard';
import { useProfileStore } from '../../stores/profile';
import { useShallow } from 'zustand/react/shallow';
import { GRID_LAYOUT } from '../../lib/zmninja-ng-constants';
import { DashboardWidget } from './DashboardWidget';
import { MonitorWidget } from './widgets/MonitorWidget';
import { EventsWidget } from './widgets/EventsWidget';
import { TimelineWidget } from './widgets/TimelineWidget';
import { HeatmapWidget } from './widgets/HeatmapWidget';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const WrappedGridLayout = WidthProvider(GridLayout);

export function DashboardLayout() {
    const { t } = useTranslation();
    const currentProfile = useProfileStore(
        useShallow((state) => {
            const { profiles, currentProfileId } = state;
            return profiles.find((p) => p.id === currentProfileId) || null;
        })
    );
    const profileId = currentProfile?.id || 'default';

    const widgets = useDashboardStore(
        useShallow((state) => state.widgets[profileId] ?? [])
    );
    const updateLayouts = useDashboardStore((state) => state.updateLayouts);
    const isEditing = useDashboardStore((state) => state.isEditing);

    const [mounted, setMounted] = useState(false);
    const [layout, setLayout] = useState<Layout[]>([]);

    // Use ref to track profileId without making it a dependency
    const profileIdRef = useRef(profileId);
    
    // Track when we're syncing from store to prevent feedback loop
    const isSyncingFromStoreRef = useRef(false);

    // Keep ref updated with current profileId
    useEffect(() => {
        profileIdRef.current = profileId;
    }, [profileId]);

    // Force component to mount properly
    useEffect(() => {
        setMounted(true);
    }, []);

    const layouts = useMemo(() => {
        return widgets.map((w) => ({ ...w.layout, i: w.id }));
    }, [widgets]);

    const areLayoutsEqual = useCallback((a: Layout[], b: Layout[]) => {
        if (a.length !== b.length) return false;
        const map = new Map(a.map((item) => [item.i, item]));
        return b.every((item) => {
            const match = map.get(item.i);
            return (
                match &&
                match.x === item.x &&
                match.y === item.y &&
                match.w === item.w &&
                match.h === item.h
            );
        });
    }, []);

    useEffect(() => {
        // Mark that we're syncing from store - this prevents handleLayoutChange from 
        // writing back to store and causing an infinite loop
        isSyncingFromStoreRef.current = true;
        setLayout((prev) => (areLayoutsEqual(prev, layouts) ? prev : layouts));
        // Reset the flag after React has processed the state update
        // Use requestAnimationFrame for more predictable timing than queueMicrotask
        requestAnimationFrame(() => {
            isSyncingFromStoreRef.current = false;
        });
    }, [layouts, areLayoutsEqual]);

    const handleLayoutChange = useCallback((nextLayout: Layout[]) => {
        setLayout((prev) => (areLayoutsEqual(prev, nextLayout) ? prev : nextLayout));
        
        // Don't update store if:
        // 1. Not in edit mode
        // 2. We're just syncing from store (would cause infinite loop)
        if (!isEditing || isSyncingFromStoreRef.current) return;

        // Use ref to access current profileId without adding it to dependencies
        updateLayouts(profileIdRef.current, { lg: nextLayout });
    }, [areLayoutsEqual, isEditing]);

    // Merge local layout state with store layouts to ensure newly added widgets
    // always have their correct dimensions. The local state may lag behind the store
    // (useEffect is async), so new widgets could be missing from it.
    const activeLayout = useMemo(() => {
        if (layout.length === 0) return layouts;
        const localMap = new Map(layout.map(l => [l.i, l]));
        return layouts.map(l => localMap.get(l.i) || l);
    }, [layout, layouts]);

    if (widgets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                <div className="bg-muted/30 p-6 rounded-full mb-4">
                    <svg
                        className="w-12 h-12 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('dashboard.empty_title')}</h3>
                <p className="text-muted-foreground max-w-sm">
                    {t('dashboard.empty_desc')}
                </p>
            </div>
        );
    }

    // Don't render until mounted to avoid hydration issues
    if (!mounted) {
        return null;
    }

    return (
        <div className="p-4 min-h-screen w-full">
            <WrappedGridLayout
                className="layout"
                layout={activeLayout}
                cols={GRID_LAYOUT.cols}
                rowHeight={GRID_LAYOUT.rowHeight}
                onLayoutChange={handleLayoutChange}
                isDraggable={isEditing}
                isResizable={isEditing}
                draggableHandle=".drag-handle"
                margin={[GRID_LAYOUT.margin, GRID_LAYOUT.margin]}
                containerPadding={[0, 0]}
                compactType="vertical"
                preventCollision={false}
            >
                {widgets.map((widget) => {
                    // Memoize monitorIds to prevent new array references
                    const monitorIds = widget.settings.monitorIds ?? 
                        (widget.settings.monitorId ? [widget.settings.monitorId] : []);
                    
                    return (
                        <div key={widget.id}>
                            <DashboardWidget id={widget.id} title={widget.title} profileId={profileId}>
                                {widget.type === 'monitor' && monitorIds.length > 0 && (
                                    <MonitorWidget
                                        monitorIds={monitorIds}
                                        objectFit={widget.settings.feedFit || 'contain'}
                                    />
                                )}
                                {widget.type === 'events' && (
                                    <EventsWidget
                                        monitorIds={widget.settings.monitorIds ?? (widget.settings.monitorId ? [widget.settings.monitorId] : undefined)}
                                        limit={widget.settings.eventCount}
                                        refreshInterval={widget.settings.refreshInterval}
                                    />
                                )}
                                {widget.type === 'timeline' && (
                                    <TimelineWidget />
                                )}
                                {widget.type === 'heatmap' && (
                                    <HeatmapWidget title={widget.title} />
                                )}
                            </DashboardWidget>
                        </div>
                    );
                })}
            </WrappedGridLayout>
        </div>
    );
}
