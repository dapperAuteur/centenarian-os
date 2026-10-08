// lib/fitness-import/device-steps.ts
// Steps for one day when several devices report them, for scripts/import-apple-health.mjs.
//
// Apple Health keeps a StepCount record from every device and app that writes into it (iPhone,
// Watch, Garmin Connect, ...). They count the same walking, so adding every record together
// inflates the day. Steps are added up per device (sourceName), and the day takes the largest
// device total, never the sum of devices.
//
// Pure, no imports: the script and the unit tests load this file directly.

/** Adds one StepCount record to its device's running total for the day. Ignores non-numbers. */
export function addDeviceSteps(bySource: Map<string, number>, device: string | null | undefined, value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  const name = typeof device === 'string' && device.trim() !== '' ? device.trim() : 'unknown';
  bySource.set(name, (bySource.get(name) ?? 0) + value);
}

/** The day's steps: the largest single-device total (0 when nothing was recorded). */
export function daySteps(bySource: ReadonlyMap<string, number>): number {
  let best = 0;
  for (const total of bySource.values()) if (total > best) best = total;
  return best;
}
