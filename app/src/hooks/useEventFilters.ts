/**
 * Event Filters Hook
 *
 * Filter selections are saved to settings immediately on change (no Apply needed).
 * Settings store is the source of truth for persistence.
 * The "Filter" button syncs to URL params for deep linking.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useCurrentProfile } from './useCurrentProfile';
import { useSettingsStore } from '../stores/settings';
import type { EventFilters } from '../api/events';

/** Sentinel value for the "All tagged events" filter option */
export const ALL_TAGS_FILTER_ID = '__all_tags__';

interface UseEventFiltersReturn {
  filters: EventFilters;
  selectedMonitorIds: string[];
  selectedTagIds: string[];
  startDateInput: string;
  endDateInput: string;
  favoritesOnly: boolean;
  onlyDetectedObjects: boolean;
  setSelectedMonitorIds: (ids: string[]) => void;
  setSelectedTagIds: (ids: string[]) => void;
  setStartDateInput: (date: string) => void;
  setEndDateInput: (date: string) => void;
  setFavoritesOnly: (enabled: boolean) => void;
  setOnlyDetectedObjects: (enabled: boolean) => void;
  applyFilters: () => void;
  clearFilters: () => void;
  toggleMonitorSelection: (monitorId: string) => void;
  toggleTagSelection: (tagId: string) => void;
  activeFilterCount: number;
}

function formatInputDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

/** Save a single filter field to the settings store (merge with existing) */
function saveFilterField(profileId: string, field: string, value: unknown) {
  const store = useSettingsStore.getState();
  const current = store.getProfileSettings(profileId).eventsPageFilters;
  store.updateProfileSettings(profileId, {
    eventsPageFilters: { ...current, [field]: value },
  });
}

export function useEventFilters(): UseEventFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { currentProfile, settings } = useCurrentProfile();

  // Local filter state
  const [selectedMonitorIds, _setMonitorIds] = useState<string[]>([]);
  const [startDateInput, _setStartDate] = useState('');
  const [endDateInput, _setEndDate] = useState('');
  const [favoritesOnly, _setFavoritesOnly] = useState(false);
  const [selectedTagIds, _setTagIds] = useState<string[]>([]);
  const [onlyDetectedObjects, _setOnlyDetected] = useState(false);

  // Wrapped setters that also save to settings store immediately.
  // No effects needed — saves happen synchronously on user action.
  const profileIdRef = useRef<string | null>(null);
  profileIdRef.current = currentProfile?.id ?? null;

  const setSelectedMonitorIds = useCallback((ids: string[]) => {
    _setMonitorIds(ids);
    if (profileIdRef.current) saveFilterField(profileIdRef.current, 'monitorIds', ids);
  }, []);

  const setSelectedTagIds = useCallback((ids: string[]) => {
    _setTagIds(ids);
    if (profileIdRef.current) saveFilterField(profileIdRef.current, 'tagIds', ids);
  }, []);

  const setStartDateInput = useCallback((date: string) => {
    _setStartDate(date);
    if (profileIdRef.current) saveFilterField(profileIdRef.current, 'startDateTime', date);
  }, []);

  const setEndDateInput = useCallback((date: string) => {
    _setEndDate(date);
    if (profileIdRef.current) saveFilterField(profileIdRef.current, 'endDateTime', date);
  }, []);

  const setFavoritesOnly = useCallback((enabled: boolean) => {
    _setFavoritesOnly(enabled);
    if (profileIdRef.current) saveFilterField(profileIdRef.current, 'favoritesOnly', enabled);
  }, []);

  const setOnlyDetectedObjects = useCallback((enabled: boolean) => {
    _setOnlyDetected(enabled);
    if (profileIdRef.current) saveFilterField(profileIdRef.current, 'onlyDetectedObjects', enabled);
  }, []);

  // ----- Restore filters from settings on mount / profile change -----
  // Does NOT trigger auto-save because it uses the raw _set* functions.
  const prevSettingsRef = useRef<string>('');
  useEffect(() => {
    if (!currentProfile) return;

    // Deep-link URL params take priority
    if (
      searchParams.has('monitorId') ||
      searchParams.has('tagIds') ||
      searchParams.has('startDateTime') ||
      searchParams.has('endDateTime') ||
      searchParams.has('favorites')
    ) {
      return;
    }

    const saved = settings.eventsPageFilters;
    const settingsKey = JSON.stringify(saved);
    if (settingsKey === prevSettingsRef.current) return;
    prevSettingsRef.current = settingsKey;

    _setMonitorIds(saved.monitorIds);
    _setTagIds(saved.tagIds);
    _setStartDate(saved.startDateTime);
    _setEndDate(saved.endDateTime);
    _setFavoritesOnly(saved.favoritesOnly);
    _setOnlyDetected(saved.onlyDetectedObjects);
  }, [currentProfile?.id, settings.eventsPageFilters, searchParams]);

  // ----- Handle deep-link URL params -----
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const hasUrlFilters =
        searchParams.has('monitorId') ||
        searchParams.has('tagIds') ||
        searchParams.has('startDateTime') ||
        searchParams.has('endDateTime') ||
        searchParams.has('favorites');

      if (hasUrlFilters) {
        const m = searchParams.get('monitorId');
        const t = searchParams.get('tagIds');
        const s = searchParams.get('startDateTime');
        const e = searchParams.get('endDateTime');
        const f = searchParams.get('favorites');
        _setMonitorIds(m ? m.split(',') : []);
        _setTagIds(t ? t.split(',') : []);
        _setStartDate(s ? formatInputDate(s) : '');
        _setEndDate(e ? formatInputDate(e) : '');
        _setFavoritesOnly(f === 'true');
      }
      return;
    }

    const monitorId = searchParams.get('monitorId');
    const tagIds = searchParams.get('tagIds');
    const startDT = searchParams.get('startDateTime');
    const endDT = searchParams.get('endDateTime');
    const favorites = searchParams.get('favorites');

    if (monitorId !== null) _setMonitorIds(monitorId ? monitorId.split(',') : []);
    if (tagIds !== null) _setTagIds(tagIds ? tagIds.split(',') : []);
    if (startDT !== null) _setStartDate(formatInputDate(startDT));
    if (endDT !== null) _setEndDate(formatInputDate(endDT));
    if (favorites !== null) _setFavoritesOnly(favorites === 'true');
  }, [searchParams]);

  // Derive EventFilters from local state (not URL).
  const filters: EventFilters = useMemo(
    () => ({
      limit: settings.defaultEventLimit || 100,
      sort: searchParams.get('sort') || 'StartDateTime',
      direction: (searchParams.get('direction') as 'asc' | 'desc') || 'desc',
      monitorId: selectedMonitorIds.length > 0 ? selectedMonitorIds.join(',') : undefined,
      startDateTime: startDateInput || undefined,
      endDateTime: endDateInput || undefined,
      notesRegexp: onlyDetectedObjects ? 'detected:' : undefined,
    }),
    [searchParams, settings.defaultEventLimit, selectedMonitorIds, startDateInput, endDateInput, onlyDetectedObjects]
  );

  // "Apply" syncs current filters to URL for deep linking / sharing.
  const applyFilters = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    if (!newParams.has('sort')) newParams.set('sort', 'StartDateTime');
    if (!newParams.has('direction')) newParams.set('direction', 'desc');

    if (selectedMonitorIds.length > 0) {
      newParams.set('monitorId', selectedMonitorIds.join(','));
    } else {
      newParams.delete('monitorId');
    }
    if (startDateInput) {
      newParams.set('startDateTime', startDateInput);
    } else {
      newParams.delete('startDateTime');
    }
    if (endDateInput) {
      newParams.set('endDateTime', endDateInput);
    } else {
      newParams.delete('endDateTime');
    }
    if (favoritesOnly) {
      newParams.set('favorites', 'true');
    } else {
      newParams.delete('favorites');
    }
    if (selectedTagIds.length > 0) {
      newParams.set('tagIds', selectedTagIds.join(','));
    } else {
      newParams.delete('tagIds');
    }

    setSearchParams(newParams, { replace: true, state: location.state });
  }, [
    selectedMonitorIds, selectedTagIds, startDateInput, endDateInput, favoritesOnly,
    searchParams, setSearchParams, location.state,
  ]);

  const clearFilters = useCallback(() => {
    // Use wrapped setters so clearing also saves to settings
    setSelectedMonitorIds([]);
    setSelectedTagIds([]);
    setStartDateInput('');
    setEndDateInput('');
    setFavoritesOnly(false);
    setOnlyDetectedObjects(false);

    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', 'StartDateTime');
    newParams.set('direction', 'desc');
    newParams.delete('monitorId');
    newParams.delete('tagIds');
    newParams.delete('startDateTime');
    newParams.delete('endDateTime');
    newParams.delete('favorites');
    setSearchParams(newParams, { replace: true, state: location.state });
  }, [searchParams, setSearchParams, location.state, setSelectedMonitorIds, setSelectedTagIds, setStartDateInput, setEndDateInput, setFavoritesOnly, setOnlyDetectedObjects]);

  const toggleMonitorSelection = useCallback((monitorId: string) => {
    _setMonitorIds((prev) => {
      const next = prev.includes(monitorId)
        ? prev.filter((id) => id !== monitorId)
        : [...prev, monitorId];
      if (profileIdRef.current) saveFilterField(profileIdRef.current, 'monitorIds', next);
      return next;
    });
  }, []);

  const toggleTagSelection = useCallback((tagId: string) => {
    _setTagIds((prev) => {
      const next = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      if (profileIdRef.current) saveFilterField(profileIdRef.current, 'tagIds', next);
      return next;
    });
  }, []);

  const activeFilterCount = useMemo(
    () =>
      [
        selectedMonitorIds.length > 0 ? 1 : null,
        selectedTagIds.length > 0 ? 1 : null,
        startDateInput ? 1 : null,
        endDateInput ? 1 : null,
        favoritesOnly ? 1 : null,
        onlyDetectedObjects ? 1 : null,
      ].filter(Boolean).length,
    [selectedMonitorIds.length, selectedTagIds.length, startDateInput, endDateInput, favoritesOnly, onlyDetectedObjects]
  );

  return {
    filters, selectedMonitorIds, selectedTagIds, startDateInput, endDateInput, favoritesOnly, onlyDetectedObjects,
    setSelectedMonitorIds, setSelectedTagIds, setStartDateInput, setEndDateInput, setFavoritesOnly, setOnlyDetectedObjects,
    applyFilters, clearFilters, toggleMonitorSelection, toggleTagSelection, activeFilterCount,
  };
}
