// app/api/finance/import/drafts/[id]/resume/route.ts
// POST: resume a saved statement import. The saved rows are planned again
// against the transactions as they are now, so a row imported some other way
// since then shows as a duplicate. Writes nothing.
//
// POST rather than GET so the service worker never keeps a copy of the rows in
// the browser's cache (public/sw.js caches API GETs for offline use).
//
// 200 -> { preview (the same shape as POST /api/finance/import/preview),
//          draft: { id, source, file_name, created_at, updated_at, expires_at,
//                   decisions, options, mapping },
//          changedSinceSave: number }
// 404 -> not the user's, or imported, discarded or expired

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { resumeDraft } from '@/lib/finance/import-drafts/drafts';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await resumeDraft(supabase, user.id, id));
  } catch (error) {
    return importErrorResponse(error);
  }
}
