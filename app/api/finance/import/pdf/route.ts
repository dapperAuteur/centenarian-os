// app/api/finance/import/pdf/route.ts
// POST: read a statement PDF and say what it is, before an account is chosen.
// Writes nothing.
//
// Body: { pdf_base64, file_name? }
// 200 -> { statement: { issuer, issuerLabel, confidence, accountLastFour,
//          period, facts, reconciliation, warnings, pageCount, rowCount },
//          matchingAccountIds: string[] }   (the user's accounts with the same last four)
// 400 -> { error, code } e.g. 'pdf_no_text' for a scanned statement,
//        'pdf_encrypted', 'not_pdf'; 413 'file_too_large'.
//
// PRIVACY: the PDF is read in this process with pdfjs-dist and never sent to
// any other service.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, readJson, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { inspectPdf } from '@/lib/finance/pdf-import/service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  try {
    return NextResponse.json(await inspectPdf(supabase, user.id, await readJson(request)));
  } catch (error) {
    return importErrorResponse(error);
  }
}
