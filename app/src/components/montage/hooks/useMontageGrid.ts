/**
 * Hook for Montage grid layout management
 *
 * Handles grid layout calculations, normalization, and persistence.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { GRID_LAYOUT } from '../../../lib/zmninja-ng-constants';
import { useSettingsStore } from '../../../stores/settings';
import { getMonitorAspectRatio } from '../../../lib/monitor-rotation';
import type { Layout } from 'react-grid-layout';
import type { Monitor, MonitorData } from '../../../api/types';
import type { Profile } from '../../../api/types';
import type { ProfileSettings } from '../../../stores/settings';

export const getMaxColsForWidth = (width: number, minWidth: number, margin: number): number => {
  if (width <= 0) return 1;
  const maxCols = Math.floor((width + margin) / (minWidth + margin));
  return Math.max(1, maxCols);
};

const parseAspectRatioValue = (monitor: Monitor): number => {
  const ratio = getMonitorAspectRatio(monitor.Width, monitor.Height, monitor.Orientation);

  if (!ratio) return 9 / 16;

  const match = ratio.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!match) return 9 / 16;

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 9 / 16;
  }

  return height / width;
};

const calculateHeightUnits = (
  monitorMap: Map<string, Monitor>,
  monitorId: string,
  widthUnits: number,
  gridWidth: number,
  cols: number,
  margin: number
): number => {
  const monitor = monitorMap.get(monitorId);
  if (!monitor) return 6;

  const aspectRatio = parseAspectRatioValue(monitor);
  const columnWidth = (gridWidth - margin * (cols - 1)) / cols;
  const itemWidth = columnWidth * widthUnits + margin * (widthUnits - 1);
  const heightPx = itemWidth * aspectRatio;
  const unit = (heightPx + margin) / (GRID_LAYOUT.montageRowHeight + margin);

  return Math.max(2, Math.round(unit));
};

const areLayoutsEqual = (a: Layout[], b: Layout[]): boolean => {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((item) => [item.i, item]));
  for (const item of b) {
    const match = map.get(item.i);
    if (!match) return false;
    if (match.x !== item.x || match.y !== item.y || match.w !== item.w || match.h !== item.h) {
      return false;
    }
  }
  return true;
};

interface UseMontageGridOptions {
  monitors: MonitorData[];
  currentProfile: Profile | null;
  settings: ProfileSettings;
  isFullscreen: boolean;
  isEditMode: boolean;
}

interface UseMontageGridReturn {
  layout: Layout[];
  gridCols: number;
  isScreenTooSmall: boolean;
  monitorMap: Map<string, Monitor>;
  currentWidthRef: React.MutableRefObject<number>;
  hasWidth: boolean;
  handleApplyGridLayout: (cols: number) => void;
  handleLayoutChange: (nextLayout: Layout[]) => void;
  handleResizeStop: (layout: Layout[], oldItem: Layout, newItem: Layout) => void;
  handleWidthChange: (width: number) => void;
  setGridCols: React.Dispatch<React.SetStateAction<number>>;
}

export function useMontageGrid({
  monitors,
  currentProfile,
  settings,
  isFullscreen,
  isEditMode,
}: UseMontageGridOptions): UseMontageGridReturn {
  const { t } = useTranslation();
  const updateSettings = useSettingsStore((state) => state.updateProfileSettings);
  const saveMontageLayout = useSettingsStore((state) => state.saveMontageLayout);

  const [gridCols, setGridCols] = useState<number>(settings.montageGridCols);
  const [isScreenTooSmall, setIsScreenTooSmall] = useState(false);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [hasWidth, setHasWidth] = useState(false);

  const screenTooSmallRef = useRef(false);
  const currentWidthRef = useRef(0);

  // Refs for callback stability
  const currentProfileRef = useRef(currentProfile);
  const updateSettingsRef = useRef(updateSettings);

  useEffect(() => {
    currentProfileRef.current = currentProfile;
    updateSettingsRef.current = updateSettings;
  }, [currentProfile, updateSettings]);

  const monitorMap = useMemo(() => {
    return new Map(monitors.map((item) => [item.Monitor.Id, item.Monitor]));
  }, [monitors]);

  const buildDefaultLayout = useCallback(
    (monitorList: MonitorData[], cols: number, gridWidth: number, margin: number): Layout[] => {
      return monitorList.map(({ Monitor }, index) => {
        const widthUnits = 1;
        const heightUnits = calculateHeightUnits(
          monitorMap,
          Monitor.Id,
          widthUnits,
          gridWidth,
          cols,
          margin
        );
        return {
          i: Monitor.Id,
          x: index % cols,
          y: Math.floor(index / cols) * heightUnits,
          w: widthUnits,
          h: heightUnits,
          minW: 1,
          minH: 2,
        };
      });
    },
    [monitorMap]
  );

  const normalizeLayout = useCallback(
    (current: Layout[], cols: number, gridWidth: number, margin: number): Layout[] => {
      return current.map((item) => ({
        ...item,
        x: item.x % cols,
        h: calculateHeightUnits(monitorMap, item.i, item.w, gridWidth, cols, margin),
      }));
    },
    [monitorMap]
  );

  // Update grid state when profile changes
  useEffect(() => {
    setGridCols(settings.montageGridCols);
  }, [currentProfile?.id, settings.montageGridCols]);

  // Build/restore layout when monitors or settings change
  useEffect(() => {
    if (monitors.length === 0) return;
    if (!hasWidth || currentWidthRef.current === 0) return;

    const margin = isFullscreen ? 0 : GRID_LAYOUT.montageMargin;
    let nextLayout: Layout[] = [];
    const stored = settings.montageLayouts?.lg;

    if (stored && stored.length > 0) {
      const existingIds = new Set(monitors.map((item) => item.Monitor.Id));
      const filtered = stored.filter((item) => existingIds.has(item.i));
      const presentIds = new Set(filtered.map((item) => item.i));
      const missing = monitors.filter((item) => !presentIds.has(item.Monitor.Id));
      const defaults = buildDefaultLayout(missing, gridCols, currentWidthRef.current, margin);
      nextLayout = [...filtered, ...defaults];
    } else {
      nextLayout = buildDefaultLayout(monitors, gridCols, currentWidthRef.current, margin);
    }

    const normalized = normalizeLayout(
      nextLayout,
      gridCols,
      currentWidthRef.current,
      margin
    );

    setLayout((prev) => (areLayoutsEqual(prev, normalized) ? prev : normalized));
  }, [monitors, gridCols, settings.montageLayouts, hasWidth, isFullscreen, buildDefaultLayout, normalizeLayout]);

  const handleApplyGridLayout = useCallback(
    (cols: number) => {
      if (!currentProfile) return;

      const margin = isFullscreen ? 0 : GRID_LAYOUT.montageMargin;
      const maxCols = getMaxColsForWidth(currentWidthRef.current, GRID_LAYOUT.minCardWidth, margin);
      if (cols > maxCols) {
        toast.error(t('montage.screen_too_small'));
        setIsScreenTooSmall(true);
        screenTooSmallRef.current = true;
        return;
      }

      setGridCols(cols);
      setIsScreenTooSmall(false);
      screenTooSmallRef.current = false;

      updateSettings(currentProfile.id, {
        montageGridRows: cols,
        montageGridCols: cols,
      });

      const nextLayout = buildDefaultLayout(monitors, cols, currentWidthRef.current, margin);
      setLayout(nextLayout);
      saveMontageLayout(currentProfile.id, { ...settings.montageLayouts, lg: nextLayout });

      toast.success(t('montage.grid_applied', { columns: cols }));
    },
    [
      currentProfile,
      isFullscreen,
      monitors,
      settings.montageLayouts,
      updateSettings,
      saveMontageLayout,
      buildDefaultLayout,
      t,
    ]
  );

  const handleWidthChange = useCallback(
    (width: number) => {
      const isFirstMeasurement = currentWidthRef.current === 0;
      currentWidthRef.current = width;

      const maxCols = getMaxColsForWidth(
        width,
        GRID_LAYOUT.minCardWidth,
        isFullscreen ? 0 : GRID_LAYOUT.montageMargin
      );
      const tooSmall = gridCols > maxCols;

      if (isFirstMeasurement) {
        if (tooSmall) {
          setGridCols(maxCols);
          setIsScreenTooSmall(false);
          screenTooSmallRef.current = false;
          if (currentProfileRef.current) {
            updateSettingsRef.current(currentProfileRef.current.id, {
              montageGridCols: maxCols,
            });
          }
        } else {
          setIsScreenTooSmall(false);
          screenTooSmallRef.current = false;
        }

        setHasWidth(true);
        return;
      }

      setIsScreenTooSmall(tooSmall);
      if (tooSmall && !screenTooSmallRef.current) {
        toast.error(t('montage.screen_too_small'));
      }
      screenTooSmallRef.current = tooSmall;

      setLayout((prev) => {
        return normalizeLayout(prev, gridCols, width, isFullscreen ? 0 : GRID_LAYOUT.montageMargin);
      });
    },
    [gridCols, isFullscreen, t, normalizeLayout]
  );

  const handleLayoutChange = useCallback(
    (nextLayout: Layout[]) => {
      setLayout((prev) => (areLayoutsEqual(prev, nextLayout) ? prev : nextLayout));
      if (isEditMode && currentProfile) {
        saveMontageLayout(currentProfile.id, { ...settings.montageLayouts, lg: nextLayout });
      }
    },
    [isEditMode, currentProfile, settings.montageLayouts, saveMontageLayout]
  );

  const handleResizeStop = useCallback(
    (_layout: Layout[], _oldItem: Layout, newItem: Layout) => {
      const adjustedHeight = calculateHeightUnits(
        monitorMap,
        newItem.i,
        newItem.w,
        currentWidthRef.current,
        gridCols,
        isFullscreen ? 0 : GRID_LAYOUT.montageMargin
      );

      setLayout((prev) => {
        const nextLayout = prev.map((item) =>
          item.i === newItem.i ? { ...item, h: adjustedHeight, w: newItem.w } : item
        );
        if (isEditMode && currentProfile) {
          saveMontageLayout(currentProfile.id, { ...settings.montageLayouts, lg: nextLayout });
        }
        return areLayoutsEqual(prev, nextLayout) ? prev : nextLayout;
      });
    },
    [monitorMap, gridCols, isFullscreen, isEditMode, currentProfile, settings.montageLayouts, saveMontageLayout]
  );

  return {
    layout,
    gridCols,
    isScreenTooSmall,
    monitorMap,
    currentWidthRef,
    hasWidth,
    handleApplyGridLayout,
    handleLayoutChange,
    handleResizeStop,
    handleWidthChange,
    setGridCols,
  };
}
