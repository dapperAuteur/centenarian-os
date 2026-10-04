// lib/finance/csv-import/respond.ts
// Turns anything the statement import throws into a JSON response whose body
// always has a readable `error`. Used by the /api/finance/import routes.
//
// `errors` repeats the message as a list because the Import page renders
// `errors` and nothing else when a request fails.

import { NextResponse } from 'next/server';
import { ImportError } from './errors.ts';

export function importErrorBody(message: string, code: string, details: Record<string, unknown> = {}) {
  return { ...details, error: message, code, errors: [message] };
}

export function importErrorResponse(error: unknown): NextResponse {
  if (error instanceof ImportError) {
    return NextResponse.json(importErrorBody(error.message, error.code, error.details), {
      status: error.status,
    });
  }
  console.error('[finance/import] unexpected error', error);
  return NextResponse.json(
    importErrorBody('Something went wrong on the server. Check your transactions, then try again.', 'unexpected'),
    { status: 500 },
  );
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(importErrorBody('You are signed out. Sign in and try again.', 'unauthorized'), {
    status: 401,
  });
}

/** The request body as JSON, or null when it isn't JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
