// app/api/contractor/jobs/[id]/scan/route.ts
// POST: upload screenshot/photo of pay stub → Gemini Vision extracts hours, rates, benefits
// Returns extracted data for user review before saving

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { filesToImageParts, extractDocument } from '@/lib/ocr';
import type { PayStubExtraction } from '@/lib/ocr';

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

  if (files.length > 4) {
    return NextResponse.json({ error: 'Maximum 4 images allowed' }, { status: 400 });
  }

  try {
    const imageParts = await filesToImageParts(files);
    const result = await extractDocument('pay_stub', imageParts);
    const extracted = result.data as PayStubExtraction;

    // Compute derived fields
    const totalEarnings = extracted.earnings?.reduce((sum, e) => sum + (e.amount || 0), 0) ?? 0;
    const totalBenefits = extracted.benefits?.reduce((sum, b) => sum + (b.amount || 0), 0) ?? 0;

    // Map earnings to ST/OT/DT hours for time entry pre-fill
    let st_hours: number | null = null;
    let ot_hours: number | null = null;
    let dt_hours: number | null = null;
    let pay_rate: number | null = null;
    let ot_rate: number | null = null;
    let dt_rate: number | null = null;

    for (const e of extracted.earnings ?? []) {
      const type = e.type?.toUpperCase();
      if (type === 'ST') {
        st_hours = e.hours;
        pay_rate = e.rate;
      } else if (type === 'OT') {
        ot_hours = e.hours;
        ot_rate = e.rate;
      } else if (type === 'DT') {
        dt_hours = e.hours;
        dt_rate = e.rate;
      }
    }

    return NextResponse.json({
      extracted: {
        ...extracted,
        total_earnings_computed: Math.round(totalEarnings * 100) / 100,
        total_benefits_computed: Math.round(totalBenefits * 100) / 100,
      },
      // Pre-fill suggestions for the time entry form
      time_entry_prefill: {
        work_date: extracted.work_date,
        time_in: extracted.time_in,
        time_out: extracted.time_out,
        total_hours: extracted.total_hours,
        st_hours,
        ot_hours,
        dt_hours,
      },
      // Pre-fill suggestions for the job form (if creating from scan)
      job_prefill: {
        job_number: extracted.job_number,
        client_name: extracted.client_name,
        event_name: extracted.event_name,
        location_name: extracted.location_name,
        poc_name: extracted.poc_name,
        crew_coordinator_name: extracted.crew_coordinator,
        pay_rate,
        ot_rate,
        dt_rate,
        est_pay_date: extracted.est_pay_date,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pay stub scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
