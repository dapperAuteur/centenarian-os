// lib/pain/options.ts
// The choices the pain form offers, shared by the form (app/dashboard/engine/pain),
// the history page and its filters (app/dashboard/engine/history/pain) and the API.
//
// Locations and sensations are stored as plain strings (pain_entries.locations /
// sensations text[], daily_logs.pain_* jsonb arrays), so an entry keeps whatever it
// was saved with even if this list changes later. Filters match the exact string.
//
// No imports on purpose: runs in client components, API routes and under
// `node --test --experimental-strip-types` (tests/unit/pain-entries.test.ts).

/** Body locations, in the order the form shows them. Paired limbs have a Left and a Right. */
export const BODY_LOCATIONS = [
  'Right Hip Flexor',
  'Left Hip Flexor',
  'Right Glute',
  'Left Glute',
  'SI Joint',
  'Lower Back (L5/S1)',
  'Mid Back (Thoracic)',
  'Neck',
  'Left Shoulder',
  'Right Shoulder',
  'Left Hamstring',
  'Right Knee',
  'Left Hand',
  'Right Hand',
  'Left Foot',
  'Right Foot',
] as const;

export const SENSATIONS = ['Tightness', 'Pinching', 'Dull Ache', 'Sharp Stab', 'Burning', 'Numbness'] as const;

/** The form's scale: 1 = no discomfort, 10 = acute, debilitating pain. The table allows 0-10. */
export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 10;
export const INTENSITY_SCALE = Array.from(
  { length: INTENSITY_MAX - INTENSITY_MIN + 1 },
  (_, i) => i + INTENSITY_MIN,
);

export interface LocationFilterOption {
  /** What the history page sends as ?location=. */
  value: string;
  label: string;
  /** An entry matches when it has any of these locations. */
  matches: string[];
}

const GROUP_PREFIX = 'either:';

/**
 * The history page's location filter: every location on its own, plus one
 * "either side" choice for each Left/Right pair (Hand, Foot, Shoulder, ...).
 */
export function locationFilterOptions(): LocationFilterOption[] {
  const singles: LocationFilterOption[] = BODY_LOCATIONS.map((loc) => ({ value: loc, label: loc, matches: [loc] }));
  const pairs: LocationFilterOption[] = [];
  for (const loc of BODY_LOCATIONS) {
    if (!loc.startsWith('Left ')) continue;
    const part = loc.slice('Left '.length);
    const right = `Right ${part}`;
    if (!(BODY_LOCATIONS as readonly string[]).includes(right)) continue;
    pairs.push({ value: `${GROUP_PREFIX}${part}`, label: `${part} (left or right)`, matches: [loc, right] });
  }
  return [...pairs, ...singles];
}

/**
 * The locations a ?location= value stands for: a group ("either:Hand") expands to
 * both sides; anything else is matched as the exact location string. Empty → null.
 */
export function resolveLocationFilter(value: string | null | undefined): string[] | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(GROUP_PREFIX)) {
    const group = locationFilterOptions().find((option) => option.value === trimmed);
    return group ? group.matches : [trimmed.slice(GROUP_PREFIX.length)];
  }
  return [trimmed];
}

/** Badge colors for an intensity, light theme. */
export function intensityBadgeClass(n: number): string {
  if (n <= 2) return 'bg-lime-100 text-lime-800';
  if (n <= 4) return 'bg-amber-100 text-amber-800';
  if (n <= 6) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}
