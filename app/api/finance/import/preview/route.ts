// app/api/finance/import/preview/route.ts
// POST: what importing a bank statement would do. Writes nothing.
//
// Body: { account_id, csv_text, mapping?, sign?, dateOrder?, include_pending? }
//   mapping / sign / dateOrder may be left out on the first call: the server
//   then uses its own guess and returns it in `detected`.
// The server parses and maps csv_text itself; rows normalized in the browser
// are never accepted.
//
// 200 -> { account, file, mapping, sign, dateOrder, includePending, detected,
//          rows: PlannedRow[], rejected: [{ row, reason }], totals }
//   Each row has a status: new | duplicate | duplicate_in_file | matches | invalid
//   (see lib/finance/csv-import/plan.ts for the rules).
// 400 -> { error, code, ... } e.g. code 'mapping_incomplete' with missingColumns,
//        file and detected, so the page can ask for the mapping.
// 503 -> { error: "... Run migration 203 first ...", code: 'migration_required' }
//
// PDF statements: { account_id, pdf_base64, file_name? } instead of csv_text.
// The PDF is read in this process (lib/finance/pdf-import), never sent
// anywhere else. The answer has the same shape plus `statement` (issuer,
// period, summary, APRs, promotions, reconciliation) and
// `accountMatchesStatement`. 400 when the PDF has no readable text.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importErrorResponse, readJson, unauthorizedResponse } from '@/lib/finance/csv-import/respond';
import { previewImport } from '@/lib/finance/csv-import/service';
import { isPdfBody, previewPdfImport } from '@/lib/finance/pdf-import/service';

// pdfjs reads PDFs with Node APIs.
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await readJson(request);
    if (isPdfBody(body)) return NextResponse.json(await previewPdfImport(supabase, user.id, body));
    return NextResponse.json(await previewImport(supabase, user.id, body));
  } catch (error) {
    return importErrorResponse(error);
  }
}
