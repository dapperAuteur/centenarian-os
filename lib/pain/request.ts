// lib/pain/request.ts
// Small helpers the pain-entry API routes share: reading the list filters from the URL and
// turning thrown errors into responses.

import { NextResponse } from 'next/server';
import { PainRuleError, isDateString } from './logic';
import { resolveLocationFilter } from './options';
import type { EntryFilters } from './server';

function intParam(value: string | null, min: number, max: number): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new PainRuleError(`Expected a whole number from ${min} to ${max}.`);
  return n;
}

function dateParam(value: string | null, name: string): string | null {
  if (value == null || value.trim() === '') return null;
  if (!isDateString(value)) throw new PainRuleError(`${name} must look like YYYY-MM-DD.`);
  return value;
}

/**
 * ?date= (one day) or ?from=&to=, ?min=&max= (intensity), ?location= (a location, or
 * "either:<part>" for both sides of a pair), ?q= (text in the notes), ?offset=&limit=.
 */
export function readFilters(params: URLSearchParams): EntryFilters {
  const date = dateParam(params.get('date'), 'date');
  return {
    from: date ?? dateParam(params.get('from'), 'from'),
    to: date ?? dateParam(params.get('to'), 'to'),
    minIntensity: intParam(params.get('min'), 0, 10),
    maxIntensity: intParam(params.get('max'), 0, 10),
    locations: resolveLocationFilter(params.get('location')),
    q: params.get('q')?.slice(0, 200) ?? null,
    offset: intParam(params.get('offset'), 0, 1_000_000) ?? 0,
    limit: intParam(params.get('limit'), 1, 200) ?? undefined,
  };
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof PainRuleError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('[pain-entries]', err);
  return NextResponse.json({ error: 'Something went wrong saving your pain log. Please try again.' }, { status: 500 });
}
