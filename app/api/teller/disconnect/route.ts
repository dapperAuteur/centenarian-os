// app/api/teller/disconnect/route.ts
// POST: Disconnect a Teller enrollment. Preserves account and transaction history.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { decryptToken, deleteEnrollment } from '@/lib/teller';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { enrollment_id } = body;
  if (!enrollment_id) return NextResponse.json({ error: 'enrollment_id required' }, { status: 400 });

  const db = getDb();

  // Verify ownership
  const { data: enrollment } = await db
    .from('teller_enrollments')
    .select('*')
    .eq('id', enrollment_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Call Teller API to revoke the enrollment
  try {
    const accessToken = decryptToken(enrollment.access_token);
    await deleteEnrollment(accessToken);
  } catch {
    // Non-fatal — still update local status even if Teller API fails
  }

  // Update local enrollment status
  await db
    .from('teller_enrollments')
    .update({ status: 'disconnected' })
    .eq('id', enrollment_id);

  // Clear teller link from accounts but preserve the accounts themselves
  await db
    .from('financial_accounts')
    .update({ teller_enrollment_id: null })
    .eq('teller_enrollment_id', enrollment_id);

  return NextResponse.json({ disconnected: true });
}
