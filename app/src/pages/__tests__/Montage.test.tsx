import { describe, expect, it } from 'vitest';
import type { Monitor } from '../../api/types';
import { getMonitorAspectRatio } from '../../lib/monitor-rotation';
import { GRID_LAYOUT } from '../../lib/zmninja-ng-constants';

/**
 * Unit tests for Montage layout calculations
 *
 * These tests verify that rotated monitors maintain correct aspect ratios
 * during window resize and layout changes.
 */

/**
 * Parse aspect ratio string to numeric value
 */
function parseAspectRatioValue(monitor: Monitor): number {
  const ratio = getMonitorAspectRatio(monitor.Width, monitor.Height, monitor.Orientation);

  if (!ratio) {
    return 9 / 16;
  }

  const match = ratio.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return 9 / 16;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 9 / 16;
  }

  return height / width;
}

/**
 * Calculate height units for a monitor based on its aspect ratio
 */
function calculateHeightUnits(
  monitorMap: Map<string, Monitor>,
  monitorId: string,
  widthUnits: number,
  gridWidth: number,
  cols: number,
  margin: number
): number {
  const monitor = monitorMap.get(monitorId);
  if (!monitor) {
    return 6;
  }

  const aspectRatio = parseAspectRatioValue(monitor);
  const columnWidth = (gridWidth - margin * (cols - 1)) / cols;
  const itemWidth = columnWidth * widthUnits + margin * (widthUnits - 1);
  const heightPx = itemWidth * aspectRatio;
  const unit = (heightPx + margin) / (GRID_LAYOUT.montageRowHeight + margin);
  const result = Math.max(2, Math.round(unit));

  return result;
}

describe('Montage Layout Calculations', () => {
  describe('calculateHeightUnits with rotation', () => {
    it('calculates correct height for normal (non-rotated) 1920x1080 monitor', () => {
      const monitor: Monitor = {
        Id: '1',
        Name: 'Test Monitor',
        Width: '1920',
        Height: '1080',
        Orientation: null,
      } as Monitor;

      const monitorMap = new Map([['1', monitor]]);
      const gridWidth = 1200;
      const cols = 2;
      const margin = GRID_LAYOUT.montageMargin;

      const height = calculateHeightUnits(monitorMap, '1', 1, gridWidth, cols, margin);

      // Aspect ratio should be 1080/1920 = 0.5625
      // With gridWidth=1200, cols=2, margin=4:
      // columnWidth = (1200 - 4 * (2-1)) / 2 = (1200 - 4) / 2 = 598
      // itemWidth = 598 * 1 + 4 * 0 = 598
      // heightPx = 598 * 0.5625 = 336.375
      // unit = (336.375 + 4) / (10 + 4) = 340.375 / 14 = 24.31
      // rounded = 24
      expect(height).toBe(24);
    });

    it('calculates correct height for 90° rotated 1920x1080 monitor (should become 1080x1920)', () => {
      const monitor: Monitor = {
        Id: '2',
        Name: 'Rotated Monitor',
        Width: '1920',
        Height: '1080',
        Orientation: 'ROTATE_90',
      } as Monitor;

      const monitorMap = new Map([['2', monitor]]);
      const gridWidth = 1200;
      const cols = 2;
      const margin = GRID_LAYOUT.montageMargin;

      const height = calculateHeightUnits(monitorMap, '2', 1, gridWidth, cols, margin);

      // For 90° rotation, dimensions should swap: 1080x1920
      // Aspect ratio should be 1920/1080 = 1.777... (tall)
      // With gridWidth=1200, cols=2, margin=4:
      // columnWidth = (1200 - 4) / 2 = 598
      // itemWidth = 598 * 1 + 4 * 0 = 598
      // heightPx = 598 * 1.777... = 1063.11
      // unit = (1063.11 + 4) / (10 + 4) = 1067.11 / 14 = 76.22
      // rounded = 76
      expect(height).toBe(76);
    });

    it('calculates correct height for 270° rotated monitor (should also swap dimensions)', () => {
      const monitor: Monitor = {
        Id: '3',
        Name: 'Rotated 270',
        Width: '1920',
        Height: '1080',
        Orientation: 'ROTATE_270',
      } as Monitor;

      const monitorMap = new Map([['3', monitor]]);
      const gridWidth = 1200;
      const cols = 2;
      const margin = GRID_LAYOUT.montageMargin;

      const height = calculateHeightUnits(monitorMap, '3', 1, gridWidth, cols, margin);

      // 270° rotation should also swap dimensions like 90°
      expect(height).toBe(76);
    });

    it('returns default height when monitor not found in map', () => {
      const monitorMap = new Map<string, Monitor>();
      const gridWidth = 1200;
      const cols = 2;
      const margin = GRID_LAYOUT.montageMargin;

      const height = calculateHeightUnits(monitorMap, 'non-existent', 1, gridWidth, cols, margin);

      // Should return default of 6
      expect(height).toBe(6);
    });

    it('maintains aspect ratio across different grid widths (rotation preserved)', () => {
      const monitor: Monitor = {
        Id: '4',
        Name: 'Rotated Monitor',
        Width: '1920',
        Height: '1080',
        Orientation: 'ROTATE_90',
      } as Monitor;

      const monitorMap = new Map([['4', monitor]]);
      const cols = 2;
      const margin = GRID_LAYOUT.montageMargin;

      // Calculate at different widths (simulating window resize)
      const height1 = calculateHeightUnits(monitorMap, '4', 1, 1200, cols, margin);
      const height2 = calculateHeightUnits(monitorMap, '4', 1, 1000, cols, margin);
      const height3 = calculateHeightUnits(monitorMap, '4', 1, 800, cols, margin);

      // All should maintain the tall aspect ratio (height > 6)
      // The exact values will differ based on grid width, but all should be > 6
      expect(height1).toBeGreaterThan(6);
      expect(height2).toBeGreaterThan(6);
      expect(height3).toBeGreaterThan(6);

      // The ratio of heights should be proportional to the ratio of widths
      // (accounting for rounding)
      const ratio1to2 = height1 / height2;
      const widthRatio1to2 = 1200 / 1000;
      expect(Math.abs(ratio1to2 - widthRatio1to2)).toBeLessThan(0.2); // Within 20% due to rounding
    });

    it('calculates different heights for rotated vs non-rotated monitors', () => {
      const normalMonitor: Monitor = {
        Id: '5',
        Name: 'Normal',
        Width: '1920',
        Height: '1080',
        Orientation: null,
      } as Monitor;

      const rotatedMonitor: Monitor = {
        Id: '6',
        Name: 'Rotated',
        Width: '1920',
        Height: '1080',
        Orientation: 'ROTATE_90',
      } as Monitor;

      const monitorMap = new Map([
        ['5', normalMonitor],
        ['6', rotatedMonitor],
      ]);

      const gridWidth = 1200;
      const cols = 2;
      const margin = GRID_LAYOUT.montageMargin;

      const normalHeight = calculateHeightUnits(monitorMap, '5', 1, gridWidth, cols, margin);
      const rotatedHeight = calculateHeightUnits(monitorMap, '6', 1, gridWidth, cols, margin);

      // Rotated monitor should be significantly taller
      expect(rotatedHeight).toBeGreaterThan(normalHeight);
      expect(rotatedHeight).toBeGreaterThan(normalHeight * 2); // At least 2x taller
    });
  });

  describe('aspect ratio parsing', () => {
    it('correctly parses aspect ratio for normal monitor', () => {
      const monitor: Monitor = {
        Id: '1',
        Width: '1920',
        Height: '1080',
        Orientation: null,
      } as Monitor;

      const ratio = parseAspectRatioValue(monitor);
      expect(ratio).toBeCloseTo(1080 / 1920, 4); // 0.5625
    });

    it('correctly swaps aspect ratio for 90° rotated monitor', () => {
      const monitor: Monitor = {
        Id: '2',
        Width: '1920',
        Height: '1080',
        Orientation: 'ROTATE_90',
      } as Monitor;

      const ratio = parseAspectRatioValue(monitor);
      expect(ratio).toBeCloseTo(1920 / 1080, 4); // 1.777...
    });

    it('returns default ratio for invalid data', () => {
      const monitor: Monitor = {
        Id: '3',
        Width: '',
        Height: '',
        Orientation: null,
      } as Monitor;

      const ratio = parseAspectRatioValue(monitor);
      expect(ratio).toBe(9 / 16); // Default fallback
    });
  });
});
