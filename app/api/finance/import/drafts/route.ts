// app/api/finance/import/drafts/route.ts
// Saved statement imports (import_drafts, migration 219).
//
// GET: the signed-in user's unfinished imports, newest first (expired ones are
//      deleted on the way).
//   200 -> { drafts: [{ id, account_id, source: 'csv' | 'pdf', file_name, row_count,
//            created_at, updated_at, expires_at, financial_accounts }] }
//   503 -> { error: "... Run migration 219 first ...", code: 'review_migration_required' }
//
// POST: the import preview, saved as a draft on the way. The body is what
//       POST /api/finance/import/preview takes (a CSV's text and settings, or a
//       PDF as base64), plus `draft_id` (replace this draft) and `remember`
//       (CSV: remember the settings for the account when it is imported).
//   200 -> the preview, plus { draft: { id, updated_at, expires_at } | null,
//          draftError?: { code, message } } when it couldn't be kept.
//   The rows saved are the server's own reading of the file; the file itself
//   (CSV text or PDF bytes) is never stored.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, readJson, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { listDrafts } from '@/lib/finance/import-drafts/drafts';
import { previewAndSaveDraft } from '@/lib/finance/import-drafts/preview';

// pdfjs reads PDFs with Node APIs.
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json({ drafts: await listDrafts(supabase, user.id) });
  } catch (error) {
    return importErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();
  try {
    return NextResponse.json(await previewAndSaveDraft(supabase, user.id, await readJson(request)));
  } catch (error) {
    return importErrorResponse(error);
  }
}
