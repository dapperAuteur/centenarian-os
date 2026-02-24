import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GEMINI_MODEL = 'gemini-2.5-flash';

interface OcrResult {
  odometer_miles: number | null;
  miles_since_last_fill: number | null; // Trip A
  miles_this_month: number | null;      // Trip B
  mpg_display: number | null;
  gallons: number | null;
  total_cost: number | null;
  cost_per_gallon: number | null;
  fuel_grade: string | null;
  station: string | null;
  date: string | null;
  confidence_notes: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });

  const formData = await request.formData();
  const files = formData.getAll('images') as File[];

  if (!files.length) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 });
  }

  // Convert images to base64 inline data parts
  const imageParts: object[] = [];
  for (const file of files.slice(0, 4)) {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    imageParts.push({
      inlineData: {
        mimeType: file.type || 'image/jpeg',
        data: base64,
      },
    });
  }

  const prompt = `You are extracting fuel fill-up data from photos of a car dashboard and/or fuel pump.

The user photographs their dashboard showing multiple screens:
- Trip A display: miles driven since last fuel fill-up (resets at each fill-up)
- Trip B display: miles driven this calendar month (resets monthly; may equal Trip A if only one fill-up this month)
- ODO display: total odometer reading in miles
- MPG display (labeled "After Reset"): fuel economy since last reset

They may also include a photo of the fuel pump receipt showing total cost, gallons dispensed, and price per gallon.

Extract all available data and return ONLY valid JSON matching this schema exactly:
{
  "odometer_miles": <number or null>,
  "miles_since_last_fill": <number from Trip A display or null>,
  "miles_this_month": <number from Trip B display or null>,
  "mpg_display": <number labeled "After Reset" MPG or null>,
  "gallons": <gallons from pump display or null>,
  "total_cost": <dollar amount from pump or null>,
  "cost_per_gallon": <price per gallon from pump or null>,
  "fuel_grade": <"regular", "midgrade", "premium", "diesel", or null>,
  "station": <station name if visible or null>,
  "date": <date in YYYY-MM-DD format if determinable from image metadata or visible text, else null>,
  "confidence_notes": <brief string noting any uncertainty>
}

Return only the JSON object, no markdown, no explanation.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
  }

  const geminiData = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
  };

  const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  let extracted: OcrResult;
  try {
    extracted = JSON.parse(rawText) as OcrResult;
  } catch {
    return NextResponse.json({ error: 'Failed to parse Gemini response', raw: rawText }, { status: 500 });
  }

  // Auto-calculate mpg_calculated and cost_per_gallon if not already present
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
}
