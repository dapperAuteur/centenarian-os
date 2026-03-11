'use client';

// lib/hooks/useClockFormat.ts
// Provides the user's clock format preference (12h or 24h).
// Caches in sessionStorage to avoid refetching on every component mount.

import { useState, useEffect } from 'react';

type ClockFormat = '12h' | '24h';

const CACHE_KEY = 'centos_clock_format';

let _cached: ClockFormat | null = null;

export function useClockFormat(): ClockFormat {
  const [format, setFormat] = useState<ClockFormat>(() => {
    if (_cached) return _cached;
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(CACHE_KEY);
      if (stored === '12h' || stored === '24h') return stored;
    }
    return '12h';
  });

  useEffect(() => {
    if (_cached) {
      setFormat(_cached);
      return;
    }
    fetch('/api/user/preferences')
      .then((r) => r.json())
      .then((d) => {
        const f: ClockFormat = d.clock_format === '24h' ? '24h' : '12h';
        _cached = f;
        sessionStorage.setItem(CACHE_KEY, f);
        setFormat(f);
      })
      .catch(() => {});
  }, []);

  return format;
}

/** Call after updating the preference to bust cache */
export function invalidateClockFormatCache(newFormat: ClockFormat) {
  _cached = newFormat;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(CACHE_KEY, newFormat);
  }
}

/**
 * Format a time value according to the given clock format.
 * Pure function — use with the hook value or pass format directly.
 */
export function formatTime(date: Date | string, clockFormat: ClockFormat = '12h'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (clockFormat === '24h') {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  // 12h format
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${ampm}`;
}
