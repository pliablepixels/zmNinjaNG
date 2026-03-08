import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { log, LogLevel } from '../lib/logger';
import type { MonitorFeedFit } from './settings';
import { GRID_LAYOUT } from '../lib/zmninja-ng-constants';

export type WidgetType = 'monitor' | 'events' | 'timeline' | 'heatmap';

export interface WidgetLayout {
    i: string; // Unique ID for the widget (matches DashboardWidget.id)
    x: number; // x position in grid
    y: number; // y position in grid
    w: number; // width (col span)
    h: number; // height (row span)
    minW?: number;
    minH?: number;
}

export interface DashboardWidget {
    id: string;
    type: WidgetType;
    title?: string;
    settings: {
        monitorId?: string;
        monitorIds?: string[];
        feedFit?: MonitorFeedFit;
        eventCount?: number;
        showThumbnails?: boolean;
        refreshInterval?: number; // in milliseconds
        autoRefresh?: boolean;
        [key: string]: any;
    };
    layout: WidgetLayout; // kept for backward compatibility and as 'current' layout
    layouts?: Record<string, WidgetLayout>; // Multi-breakpoint layouts
}

interface DashboardState {
    widgets: Record<string, DashboardWidget[]>; // Keyed by profileId
    isEditing: boolean;
    addWidget: (profileId: string, widget: Omit<DashboardWidget, 'id' | 'layout' | 'layouts'> & { layout: Omit<WidgetLayout, 'i' | 'x' | 'y'> }) => void;
    removeWidget: (profileId: string, id: string) => void;
    updateWidget: (profileId: string, id: string, updates: Partial<DashboardWidget>) => void;
    updateLayouts: (profileId: string, layouts: Record<string, WidgetLayout[]>) => void;
    resetWidgetWidths: (profileId: string) => void;
    toggleEditMode: () => void;
}

export const useDashboardStore = create<DashboardState>()(
    persist(
        (set) => ({
            widgets: {},
            isEditing: false,

            addWidget: (profileId, widget) =>
                set((state) => {
                    const id = crypto.randomUUID();
                    const profileWidgets = state.widgets[profileId] || [];
                    // Simple auto-placement: put at the bottom
                    const y = profileWidgets.reduce((max, w) => Math.max(max, w.layout.y + w.layout.h), 0);

                    const initialLayout: WidgetLayout = {
                        ...widget.layout,
                        i: id,
                        x: 0,
                        y,
                        // Respect minW/minH from widget.layout, or default to 1
                        minW: widget.layout.minW || 1,
                        minH: widget.layout.minH || 1
                    };

                    log.dashboard('Adding dashboard widget', LogLevel.INFO, { profileId,
                        widgetType: widget.type,
                        minW: initialLayout.minW,
                        minH: initialLayout.minH });

                    return {
                        widgets: {
                            ...state.widgets,
                            [profileId]: [
                                ...profileWidgets,
                                {
                                    ...widget,
                                    id,
                                    layout: initialLayout,
                                    layouts: { lg: { ...initialLayout, w: Math.min(initialLayout.w, GRID_LAYOUT.cols) } }
                                },
                            ]
                        },
                    };
                }),

            removeWidget: (profileId, id) =>
                set((state) => ({
                    widgets: {
                        ...state.widgets,
                        [profileId]: (state.widgets[profileId] || []).filter((w) => w.id !== id),
                    }
                })),

            updateWidget: (profileId, id, updates) =>
                set((state) => ({
                    widgets: {
                        ...state.widgets,
                        [profileId]: (state.widgets[profileId] || []).map((w) =>
                            w.id === id ? { ...w, ...updates } : w
                        ),
                    }
                })),

            updateLayouts: (profileId, allLayouts) => {
                set((state) => ({
                    widgets: {
                        ...state.widgets,
                        [profileId]: (state.widgets[profileId] || []).map((w) => {
                            // Update the main 'layout' with lg (or first available) for legacy/current view
                            // And update 'layouts' map with all new info

                            const updatedLayouts = { ...(w.layouts || {}) };
                            let hasChanges = false;

                            // Update each breakpoint persistence
                            Object.entries(allLayouts).forEach(([breakpoint, layouts]) => {
                                const newLayout = layouts.find(l => l.i === w.id);
                                if (newLayout) {
                                    updatedLayouts[breakpoint] = { ...w.layout, ...newLayout };
                                    hasChanges = true;
                                }
                            });

                            if (!hasChanges) return w;

                            // Prioritize lg > md > sm for the fallback 'layout' property
                            const primaryLayout = updatedLayouts.lg || updatedLayouts.md || updatedLayouts.sm || w.layout;

                            return {
                                ...w,
                                layout: primaryLayout,
                                layouts: updatedLayouts
                            };
                        }),
                    }
                }));
            },

            resetWidgetWidths: (profileId) => {
                set((state) => {
                    const widgetCount = (state.widgets[profileId] || []).length;
                    log.dashboard('Resetting dashboard widget widths to full width', LogLevel.INFO, { profileId,
                        widgetCount });

                    return {
                        widgets: {
                            ...state.widgets,
                            [profileId]: (state.widgets[profileId] || []).map((w) => {
                                const updatedLayouts: Record<string, WidgetLayout> = {};
                                const layoutKeys = Object.keys(w.layouts || {});
                                const keys = layoutKeys.length > 0 ? layoutKeys : ['lg'];
                                keys.forEach((bp) => {
                                    const existingLayout = w.layouts?.[bp] || w.layout;
                                    updatedLayouts[bp] = {
                                        ...existingLayout,
                                        w: GRID_LAYOUT.cols,
                                    };
                                });

                                return {
                                    ...w,
                                    layout: { ...(updatedLayouts.lg || w.layout), w: GRID_LAYOUT.cols },
                                    layouts: updatedLayouts
                                };
                            })
                        }
                    };
                });
            },

            toggleEditMode: () =>
                set((state) => ({ isEditing: !state.isEditing })),
        }),
        {
            name: 'dashboard-storage',
            partialize: (state) => ({ widgets: state.widgets }), // Only persist widgets
            version: 3,
            migrate: (persistedState: any, version: number) => {
                let newState = persistedState;

                if (version === 0) {
                    // Migration from version 0 to 1
                    const widgets = newState.widgets || [];
                    const newWidgets = widgets.map((w: any) => ({
                        ...w,
                        layout: {
                            ...w.layout,
                            i: w.id,
                            x: w.layout.x ?? 0,
                            y: w.layout.y ?? 0,
                            w: w.layout.w ?? 1,
                            h: w.layout.h ?? 1,
                            minW: w.layout.minW ?? 1,
                            minH: w.layout.minH ?? 1,
                        }
                    }));
                    newState = { ...newState, widgets: newWidgets };
                }

                if (version <= 1) {
                    // Migration from version 1 to 2 (Profile Specificity)
                    if (Array.isArray(newState.widgets)) {
                        newState = {
                            ...newState,
                            widgets: {
                                'default': newState.widgets
                            }
                        };
                    }
                }

                if (version <= 2) {
                    // Migration from version 2 to 3 (Multi-breakpoint layouts)
                    // Populate w.layouts['lg'] with w.layout
                    Object.keys(newState.widgets || {}).forEach(profileKey => {
                        newState.widgets[profileKey] = newState.widgets[profileKey].map((w: any) => ({
                            ...w,
                            layouts: { lg: w.layout, md: w.layout, sm: w.layout } // Init all to current to prevent reset
                        }));
                    });
                }

                return newState;
            },
        }
    )
);
