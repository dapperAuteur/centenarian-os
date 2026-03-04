import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { filesToImageParts, extractDocument } from '@/lib/ocr';
import type { FuelReceiptExtraction } from '@/lib/ocr';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }

  const formData = await request.formData();
  const files = formData.getAll('images') as File[];

  if (!files.length) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 });
  }

  try {
    const imageParts = await filesToImageParts(files);
    const result = await extractDocument('fuel_receipt', imageParts);
    const extracted = result.data as FuelReceiptExtraction;

    // Auto-calculate MPG and cost_per_gallon (preserve existing behavior)
    const mpg_calculated =
      extracted.miles_since_last_fill && extracted.gallons && extracted.gallons > 0
        ? parseFloat((extracted.miles_since_last_fill / extracted.gallons).toFixed(2))
        : null;

    const cost_per_gallon =
      extracted.cost_per_gallon ??
      (extracted.total_cost && extracted.gallons && extracted.gallons > 0
        ? parseFloat((extracted.total_cost / extracted.gallons).toFixed(3))
        : null);

    return NextResponse.json({
      extracted: { ...extracted, mpg_calculated, cost_per_gallon },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
