/**
 * Dashboard Configuration Component
 *
 * Provides a dialog for adding new widgets to the dashboard.
 * Features:
 * - Widget type selection (monitor, events, timeline, heatmap)
 * - Monitor selection for monitor widgets
 * - Custom widget titles
 * - Form validation
 * - Profile-aware widget creation
 */

import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Plus, Video, Clock, ChartGantt, TrendingUp } from 'lucide-react';
import type { WidgetType } from '../../stores/dashboard';
import type { MonitorFeedFit } from '../../stores/settings';
import { useDashboardStore } from '../../stores/dashboard';
import { useProfileStore } from '../../stores/profile';
import { useShallow } from 'zustand/react/shallow';
import { useQuery } from '@tanstack/react-query';
import { getMonitors } from '../../api/monitors';
import { filterEnabledMonitors } from '../../lib/filters';
import { GRID_LAYOUT } from '../../lib/zmninja-ng-constants';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { useTranslation } from 'react-i18next';

export function DashboardConfig() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<WidgetType>('monitor');
    const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [feedFit, setFeedFit] = useState<MonitorFeedFit>('contain');
    const addWidget = useDashboardStore((state) => state.addWidget);
    const currentProfile = useProfileStore(
        useShallow((state) => {
            const { profiles, currentProfileId } = state;
            return profiles.find((p) => p.id === currentProfileId) || null;
        })
    );
    const profileId = currentProfile?.id || 'default';

    const { data: monitors } = useQuery({
        queryKey: ['monitors'],
        queryFn: getMonitors,
    });

    // Filter out deleted monitors
    const enabledMonitors = useMemo(() => {
        return monitors?.monitors ? filterEnabledMonitors(monitors.monitors) : [];
    }, [monitors?.monitors]);

    /**
     * Get default title for a widget type
     */
    const getDefaultTitle = (type: WidgetType): string => {
        switch (type) {
            case 'monitor':
                return t('dashboard.widget_monitor');
            case 'events':
                return t('dashboard.widget_events');
            case 'timeline':
                return t('dashboard.widget_timeline');
            case 'heatmap':
                return t('dashboard.widget_heatmap');
            default:
                return '';
        }
    };

    /**
     * Get default layout dimensions for a widget type
     * Includes minimum width/height constraints to prevent content overflow
     */
    const getDefaultLayout = (type: WidgetType, monitorCount: number = 1) => {
        // All widgets start at full width. Users can resize narrower in edit mode.
        // minW prevents resizing below a usable size for each widget type.
        switch (type) {
            case 'monitor': {
                const monitorMinW = monitorCount === 1 ? 4 : monitorCount <= 4 ? 6 : 8;
                return { w: GRID_LAYOUT.cols, h: 2, minW: monitorMinW, minH: 2 };
            }
            case 'timeline':
                return { w: GRID_LAYOUT.cols, h: 3, minW: 6, minH: 3 };
            case 'heatmap':
                return { w: GRID_LAYOUT.cols, h: 3, minW: 6, minH: 3 };
            case 'events':
            default:
                return { w: GRID_LAYOUT.cols, h: 2, minW: 3, minH: 2 };
        }
    };

    /**
     * Get widget settings based on type and monitor selection
     */
    const getWidgetSettings = (type: WidgetType, monitors: string[], fit: MonitorFeedFit) => {
        const settings: any = {};

        if (type === 'monitor') {
            settings.monitorIds = monitors;
            settings.feedFit = fit;
        } else if (type === 'events') {
            settings.monitorId = monitors[0] || undefined;
            settings.eventCount = 5;
        }

        return settings;
    };

    /**
     * Handle adding a new widget to the dashboard
     */
    const handleAdd = () => {
        // Validation: Monitor widgets require at least one monitor
        if (selectedType === 'monitor' && selectedMonitors.length === 0) {
            return;
        }

        addWidget(profileId, {
            type: selectedType,
            title: title || getDefaultTitle(selectedType),
            settings: getWidgetSettings(selectedType, selectedMonitors, feedFit),
            layout: getDefaultLayout(selectedType, selectedMonitors.length),
        });

        setOpen(false);
        resetForm();
    };

    /**
     * Reset the form to default state
     */
    const resetForm = () => {
        setSelectedType('monitor');
        setSelectedMonitors([]);
        setTitle('');
        setFeedFit('contain');
    };

    /**
     * Toggle monitor selection
     */
    const toggleMonitor = (id: string) => {
        setSelectedMonitors(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button title={t('dashboard.add_widget')} data-testid="add-widget-trigger">
                    <Plus className="sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t('dashboard.add_widget')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-widget-dialog">
                <DialogHeader>
                    <DialogTitle>{t('dashboard.add_widget')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Add a new widget to the dashboard.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div
                            className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 flex flex-col items-center gap-2 ${selectedType === 'monitor' ? 'border-primary bg-primary/5' : ''}`}
                            onClick={() => setSelectedType('monitor')}
                            data-testid="widget-type-monitor"
                        >
                            <Video className="h-8 w-8" />
                            <span className="font-medium text-xs text-center">{t('dashboard.widget_monitor')}</span>
                        </div>
                        <div
                            className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 flex flex-col items-center gap-2 ${selectedType === 'events' ? 'border-primary bg-primary/5' : ''}`}
                            onClick={() => setSelectedType('events')}
                            data-testid="widget-type-events"
                        >
                            <Clock className="h-8 w-8" />
                            <span className="font-medium text-xs text-center">{t('dashboard.widget_events')}</span>
                        </div>
                        <div
                            className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 flex flex-col items-center gap-2 ${selectedType === 'timeline' ? 'border-primary bg-primary/5' : ''}`}
                            onClick={() => setSelectedType('timeline')}
                            data-testid="widget-type-timeline"
                        >
                            <ChartGantt className="h-8 w-8" />
                            <span className="font-medium text-xs text-center">{t('dashboard.widget_timeline')}</span>
                        </div>
                        <div
                            className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 flex flex-col items-center gap-2 ${selectedType === 'heatmap' ? 'border-primary bg-primary/5' : ''}`}
                            onClick={() => setSelectedType('heatmap')}
                            data-testid="widget-type-heatmap"
                        >
                            <TrendingUp className="h-8 w-8" />
                            <span className="font-medium text-xs text-center">{t('dashboard.widget_heatmap')}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="widget-title">{t('dashboard.widget_title')}</Label>
                        <Input
                            id="widget-title"
                            placeholder={t('dashboard.widget_title_placeholder')}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            data-testid="widget-title-input"
                        />
                    </div>

                    {selectedType === 'monitor' && (
                        <div className="space-y-2">
                            <Label>{t('dashboard.select_monitors')}</Label>
                            <ScrollArea className="h-[200px] border rounded-md p-2" data-testid="monitor-selection-list">
                                <div className="space-y-2">
                                    {enabledMonitors.map((m) => (
                                        <div key={m.Monitor.Id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`monitor-${m.Monitor.Id}`}
                                                checked={selectedMonitors.includes(m.Monitor.Id)}
                                                onCheckedChange={() => toggleMonitor(m.Monitor.Id)}
                                                data-testid={`monitor-checkbox-${m.Monitor.Id}`}
                                            />
                                            <label
                                                htmlFor={`monitor-${m.Monitor.Id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {m.Monitor.Name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            {selectedMonitors.length === 0 && (
                                <p className="text-xs text-destructive">{t('dashboard.monitor_required')}</p>
                            )}
                        </div>
                    )}
                    {selectedType === 'monitor' && (
                        <div className="space-y-2">
                            <Label>{t('dashboard.feed_fit')}</Label>
                            <Select value={feedFit} onValueChange={(value) => setFeedFit(value as MonitorFeedFit)}>
                                <SelectTrigger data-testid="dashboard-monitor-feed-fit-select">
                                    <SelectValue placeholder={t('dashboard.feed_fit')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="contain" data-testid="dashboard-monitor-fit-contain">
                                        {t('dashboard.fit_contain')}
                                    </SelectItem>
                                    <SelectItem value="cover" data-testid="dashboard-monitor-fit-cover">
                                        {t('dashboard.fit_cover')}
                                    </SelectItem>
                                    <SelectItem value="fill" data-testid="dashboard-monitor-fit-fill">
                                        {t('dashboard.fit_fill')}
                                    </SelectItem>
                                    <SelectItem value="none" data-testid="dashboard-monitor-fit-none">
                                        {t('dashboard.fit_none')}
                                    </SelectItem>
                                    <SelectItem value="scale-down" data-testid="dashboard-monitor-fit-scale-down">
                                        {t('dashboard.fit_scale_down')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {selectedType === 'events' && (
                        <div className="space-y-2">
                            <Label>{t('dashboard.select_monitor')}</Label>
                            <Select value={selectedMonitors[0] || 'all'} onValueChange={(val) => setSelectedMonitors(val === 'all' ? [] : [val])}>
                                <SelectTrigger data-testid="events-monitor-select">
                                    <SelectValue placeholder={t('dashboard.select_monitor')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('dashboard.all_monitors')}</SelectItem>
                                    {enabledMonitors.map((m) => (
                                        <SelectItem key={m.Monitor.Id} value={m.Monitor.Id}>
                                            {m.Monitor.Name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)} data-testid="widget-cancel-button">{t('dashboard.cancel')}</Button>
                    <Button onClick={handleAdd} disabled={selectedType === 'monitor' && selectedMonitors.length === 0} data-testid="widget-add-button">
                        {t('dashboard.add')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
