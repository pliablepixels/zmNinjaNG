/**
 * useBandwidthSettings Hook
 *
 * Returns the current bandwidth settings based on the profile's bandwidth mode.
 * Provides centralized access to polling intervals and image quality settings.
 */

import { useMemo } from 'react';
import { useCurrentProfile } from './useCurrentProfile';
import { getBandwidthSettings, type BandwidthSettings } from '../lib/zmninja-ng-constants';

/**
 * Hook to get bandwidth settings for the current profile.
 *
 * @returns Bandwidth settings based on the profile's bandwidth mode
 *
 * @example
 * ```typescript
 * const bandwidth = useBandwidthSettings();
 * // Use in useQuery
 * useQuery({
 *   queryKey: ['monitors'],
 *   queryFn: getMonitors,
 *   refetchInterval: bandwidth.monitorStatusInterval,
 * });
 * ```
 */
export function useBandwidthSettings(): BandwidthSettings {
  const { settings } = useCurrentProfile();

  return useMemo(
    () => getBandwidthSettings(settings.bandwidthMode),
    [settings.bandwidthMode]
  );
}
