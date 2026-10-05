// lib/capture/tokens.ts
// The vocabulary of capture tokens: the `#word` tags, trip-mode words, meal
// words and units that lib/capture/parse-tokens.ts reads out of a calendar
// event title (and, later, the quick-add field).
//
// Constants only, no imports, so a help page or the quick-add hint can list the
// accepted words without loading the parser. English and Spanish words are
// accepted whatever the user's language setting. Every key and alias here is
// lowercase: the parser lowercases a word before looking it up.

export type CaptureKind = 'task' | 'expense' | 'income' | 'trip' | 'meal' | 'workout';

/** The values the trips.mode CHECK accepts (supabase/migrations/052_travel_schema.sql). */
export const TRIP_MODES = [
  'bike',
  'car',
  'bus',
  'train',
  'plane',
  'walk',
  'run',
  'ferry',
  'rideshare',
  'other',
] as const;

export type TripMode = (typeof TRIP_MODES)[number];

/** The values the meal_logs.meal_type CHECK accepts. */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** The `#word` tags for each kind of record: English first, then Spanish. */
export const TOKEN_ALIASES: Record<CaptureKind, readonly string[]> = {
  expense: ['expense', 'gasto'],
  income: ['income', 'ingreso'],
  trip: ['trip', 'viaje'],
  meal: ['meal', 'comida'],
  workout: ['workout', 'entreno', 'ejercicio'],
  task: ['task', 'tarea'],
};

/**
 * Words that name a trip mode, written as `mode:word` or bare in the title
 * ("Drive to Tucson"). `mode:` also accepts a TRIP_MODES value as is, which is
 * the only way to say `other`.
 */
export const MODE_WORDS: Record<string, TripMode> = {
  drive: 'car',
  car: 'car',
  coche: 'car',
  carro: 'car',
  bike: 'bike',
  bici: 'bike',
  walk: 'walk',
  caminar: 'walk',
  run: 'run',
  correr: 'run',
  flight: 'plane',
  fly: 'plane',
  plane: 'plane',
  avión: 'plane',
  avion: 'plane',
  bus: 'bus',
  train: 'train',
  tren: 'train',
  ferry: 'ferry',
  uber: 'rideshare',
  lyft: 'rideshare',
  rideshare: 'rideshare',
};

/** Words that name a meal, written as a tag (`#lunch`) or bare in the title. */
export const MEAL_WORDS: Record<string, MealType> = {
  breakfast: 'breakfast',
  desayuno: 'breakfast',
  lunch: 'lunch',
  almuerzo: 'lunch',
  dinner: 'dinner',
  cena: 'dinner',
  snack: 'snack',
  merienda: 'snack',
};

/**
 * Meal type by the event's local start time, in minutes from midnight (`from`
 * inclusive, `to` exclusive). A start time outside every window is a snack.
 */
export const MEAL_TIME_WINDOWS: readonly { mealType: MealType; from: number; to: number }[] = [
  { mealType: 'breakfast', from: 5 * 60, to: 10 * 60 + 30 }, // 05:00-10:29
  { mealType: 'lunch', from: 10 * 60 + 30, to: 14 * 60 + 30 }, // 10:30-14:29
  { mealType: 'dinner', from: 17 * 60, to: 21 * 60 + 30 }, // 17:00-21:29
];

// Same factor as kmToMiles() in lib/geo/distance.ts.
const MILES_PER_KM = 0.621371;

/** Distance units after a number ("115mi", "12.5 mi", "185km"), in miles per unit. */
export const DISTANCE_UNITS: Record<string, number> = {
  mi: 1,
  mile: 1,
  miles: 1,
  milla: 1,
  millas: 1,
  km: MILES_PER_KM,
  kms: MILES_PER_KM,
  kilometer: MILES_PER_KM,
  kilometers: MILES_PER_KM,
  kilómetro: MILES_PER_KM,
  kilómetros: MILES_PER_KM,
  kilometro: MILES_PER_KM,
  kilometros: MILES_PER_KM,
};

/**
 * Duration units a trip reads after a number ("45min", "1.5h"), in minutes per
 * unit. A bare "m" is left out: on a trip "Walk 800m" is meters, not minutes.
 */
export const TRIP_DURATION_UNITS: Record<string, number> = {
  min: 1,
  mins: 1,
  minute: 1,
  minutes: 1,
  minuto: 1,
  minutos: 1,
  h: 60,
  hr: 60,
  hrs: 60,
  hour: 60,
  hours: 60,
  hora: 60,
  horas: 60,
};

/** Duration units every other kind reads: the same, plus the bare "m" of "90m". */
export const DURATION_UNITS: Record<string, number> = {
  ...TRIP_DURATION_UNITS,
  m: 1,
};

/**
 * Words that join a meal to its vendor ("Lunch at Chipotle", "Almuerzo en
 * Chipotle"). The vendor drops one of them after a leading meal word.
 */
export const VENDOR_CONNECTORS: readonly string[] = ['at', '@', 'en'];
