/**
 * Montage Page
 *
 * Displays a customizable grid of live monitor streams.
 * Supports drag-and-drop layout, resizing, and fullscreen mode.
 */

import { useQuery } from '@tanstack/react-query';
import { getMonitors } from '../api/monitors';
import { GRID_LAYOUT } from '../lib/zmninja-ng-constants';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useBandwidthSettings } from '../hooks/useBandwidthSettings';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { MontageMonitor } from '../components/monitors/MontageMonitor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RefreshCw, Video, AlertCircle, LayoutDashboard, Maximize, Pencil } from 'lucide-react';
import { filterEnabledMonitors, filterMonitorsByGroup } from '../lib/filters';
import { useGroupFilter } from '../hooks/useGroupFilter';
import { GroupFilterSelect } from '../components/filters/GroupFilterSelect';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { usePinchZoom } from '../hooks/usePinchZoom';
import { useInsomnia } from '../hooks/useInsomnia';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Extracted hooks and components
import {
  GridLayoutControls,
  FullscreenControls,
  useMontageGrid,
  useContainerResize,
  useFullscreenMode,
} from '../components/montage';

const WrappedGridLayout = WidthProvider(GridLayout);

export default function Montage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const bandwidth = useBandwidthSettings();
  const { currentProfile, settings } = useCurrentProfile();
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitors'],
    queryFn: getMonitors,
    enabled: !!currentProfile && isAuthenticated,
    refetchInterval: bandwidth.monitorStatusInterval,
  });
  const updateSettings = useSettingsStore((state) => state.updateProfileSettings);
  const { isFilterActive, filteredMonitorIds } = useGroupFilter();

  // Keep screen awake when Insomnia is enabled
  useInsomnia({ enabled: settings.insomnia });

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Show enabled monitors only, filtered by group if active
  const enabledMonitors = useMemo(
    () => (data?.monitors ? filterEnabledMonitors(data.monitors) : []),
    [data]
  );

  const monitors = useMemo(() => {
    if (!isFilterActive) return enabledMonitors;
    return filterMonitorsByGroup(enabledMonitors, filteredMonitorIds);
  }, [enabledMonitors, isFilterActive, filteredMonitorIds]);

  // Edit mode state lifted to page level
  const [isEditMode, setIsEditMode] = useState(false);

  // Fullscreen mode
  const { isFullscreen, handleToggleFullscreen } =
    useFullscreenMode({
      currentProfile,
      settings,
    });


  // Grid layout management
  const {
    layout,
    gridCols,
    isScreenTooSmall,
    currentWidthRef,
    handleApplyGridLayout,
    handleLayoutChange,
    handleResizeStop,
    handleWidthChange,
  } = useMontageGrid({
    monitors,
    currentProfile,
    settings,
    isFullscreen,
    isEditMode,
  });

  // Container resize observation
  const { containerRef } = useContainerResize({
    onWidthChange: handleWidthChange,
    currentWidthRef,
  });

  // Pinch-to-zoom (disabled in fullscreen to avoid gesture conflicts)
  const pinchZoom = usePinchZoom({
    minScale: 0.5,
    maxScale: 3,
    initialScale: 1,
    enabled: !isFullscreen,
  });

  const handleFeedFitChange = (value: string) => {
    if (!currentProfile) return;
    updateSettings(currentProfile.id, {
      montageFeedFit: value as typeof settings.montageFeedFit,
    });
  };

  const handleEditModeToggle = () => {
    if (!isEditMode && window.innerWidth < 640) {
      toast.error(t('montage.screen_too_small_for_editing'));
      return;
    }
    setIsEditMode((prev) => !prev);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-video bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('montage.title')}</h1>
        </div>
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {t('common.error')}: {(error as Error).message}
        </div>
      </div>
    );
  }

  // Empty state
  if (monitors.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('montage.title')}</h1>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>
        <div className="text-center py-20 text-muted-foreground">
          <Video className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>{t('montage.no_monitors')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        isFullscreen
          ? 'fixed inset-0 z-40 bg-black flex flex-col'
          : 'flex flex-col bg-background relative'
      )}
    >
      {/* Header - Hidden in fullscreen mode */}
      {!isFullscreen && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 sm:p-3 border-b bg-card/50 backdrop-blur-sm shrink-0 z-10">
            <div className="flex items-center gap-2 sm:gap-3">
              <div>
                <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('montage.title')}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <GroupFilterSelect />
              <GridLayoutControls
                isMobile={isMobile}
                gridCols={gridCols}
                onApplyGridLayout={handleApplyGridLayout}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {t('montage.feed_fit')}
                </span>
                <Select value={settings.montageFeedFit} onValueChange={handleFeedFitChange}>
                  <SelectTrigger className="h-8 sm:h-9 w-[170px]" data-testid="montage-fit-select">
                    <SelectValue placeholder={t('montage.feed_fit')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain" data-testid="montage-fit-contain">
                      {t('montage.fit_contain')}
                    </SelectItem>
                    <SelectItem value="cover" data-testid="montage-fit-cover">
                      {t('montage.fit_cover')}
                    </SelectItem>
                    <SelectItem value="fill" data-testid="montage-fit-fill">
                      {t('montage.fit_fill')}
                    </SelectItem>
                    <SelectItem value="none" data-testid="montage-fit-none">
                      {t('montage.fit_none')}
                    </SelectItem>
                    <SelectItem value="scale-down" data-testid="montage-fit-scale-down">
                      {t('montage.fit_scale_down')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm" className="h-8 sm:h-9">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('common.refresh')}</span>
              </Button>
              <Button
                onClick={handleEditModeToggle}
                variant={isEditMode ? 'default' : 'outline'}
                size="sm"
                className="h-8 sm:h-9"
                title={isEditMode ? t('montage.done_editing') : t('montage.edit_layout')}
                data-testid="montage-edit-toggle"
              >
                <Pencil className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {isEditMode ? t('montage.done_editing') : t('montage.edit_layout')}
                </span>
              </Button>
              <Button
                onClick={() => handleToggleFullscreen(true)}
                variant="default"
                size="sm"
                className="h-8 sm:h-9"
                title={t('montage.fullscreen')}
              >
                <Maximize className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('montage.fullscreen')}</span>
              </Button>
            </div>
          </div>
          {isScreenTooSmall && (
            <p className="text-xs text-destructive px-2 sm:px-3 pb-2">
              {t('montage.screen_too_small')}
            </p>
          )}
        </>
      )}

      {/* Fullscreen toolbar — always visible, thin, translucent */}
      {isFullscreen && (
        <FullscreenControls
          onRefetch={() => refetch()}
          onExitFullscreen={() => handleToggleFullscreen(false)}
        />
      )}

      {/* Grid Content */}
      <div
        ref={containerRef}
        {...pinchZoom.bind()}
        className={cn(
          'flex-1 overflow-auto bg-muted/10',
          isFullscreen
            ? 'pt-[calc(2rem+env(safe-area-inset-top))] overscroll-contain'
            : 'p-2 sm:p-3 md:p-4 touch-pan-y'
        )}
      >
        <div
          style={{
            transform: `scale(${pinchZoom.scale})`,
            transformOrigin: 'top left',
            transition: pinchZoom.isPinching ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <div
            className={cn(
              'w-full',
              isFullscreen && 'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]'
            )}
            data-testid="montage-grid"
          >
            <WrappedGridLayout
              layout={layout}
              cols={gridCols}
              rowHeight={GRID_LAYOUT.montageRowHeight}
              margin={[isFullscreen ? 0 : GRID_LAYOUT.montageMargin, isFullscreen ? 0 : GRID_LAYOUT.montageMargin]}
              containerPadding={[0, 0]}
              compactType="vertical"
              preventCollision={false}
              isResizable={isEditMode}
              isDraggable={isEditMode}
              draggableHandle=".drag-handle"
              onLayoutChange={handleLayoutChange}
              onResizeStop={handleResizeStop}
            >
              {monitors.map(({ Monitor, Monitor_Status }) => (
                <div key={Monitor.Id} className="relative group">
                  <MontageMonitor
                    monitor={Monitor}
                    status={Monitor_Status}
                    currentProfile={currentProfile}
                    accessToken={accessToken}
                    navigate={navigate}
                    isFullscreen={isFullscreen}
                    isEditing={isEditMode}
                    objectFit={settings.montageFeedFit}
                  />
                </div>
              ))}
            </WrappedGridLayout>
          </div>
        </div>
      </div>
    </div>
  );
}
