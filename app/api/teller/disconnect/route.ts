// app/api/teller/disconnect/route.ts
// POST: Disconnect a Teller enrollment. Preserves account and transaction history.
//
// The enrollment is revoked at Teller first (DELETE /accounts), which is what stops
// Teller's per-enrollment billing. If Teller does not confirm the revoke, nothing
// changes locally: the enrollment stays "connected" with its token so the user can
// retry, and the response carries an error the UI can show.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { decryptToken, deleteEnrollment, TellerApiError } from '@/lib/teller';
import { logError, logInfo, logWarn } from '@/lib/logging';

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

  const body = await request.json().catch(() => ({}));
  const { enrollment_id } = body as { enrollment_id?: string };
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

  // Revoke at Teller. Only continue once Teller confirms the enrollment is gone.
  let accessToken: string;
  try {
    accessToken = decryptToken(enrollment.access_token);
  } catch (err) {
    logError({
      source: 'api',
      module: 'finance',
      message: 'Teller disconnect: could not decrypt access token; enrollment left connected',
      metadata: { enrollmentRowId: enrollment.id, error: err instanceof Error ? err.message : 'Unknown' },
      userId: user.id,
    });
    return NextResponse.json(
      { error: 'We could not disconnect this bank. It is still connected. Please contact support.' },
      { status: 500 },
    );
  }

  try {
    const { alreadyGone } = await deleteEnrollment(accessToken);
    if (alreadyGone) {
      logWarn({
        source: 'api',
        module: 'finance',
        message: 'Teller disconnect: enrollment was already revoked at Teller',
        metadata: { enrollmentRowId: enrollment.id },
        userId: user.id,
      });
    }
  } catch (err) {
    const status = err instanceof TellerApiError ? err.status : null;
    const code = err instanceof TellerApiError ? err.code : null;
    logError({
      source: 'api',
      module: 'finance',
      message: 'Teller revoke failed; enrollment left connected',
      metadata: {
        enrollmentRowId: enrollment.id,
        tellerStatus: status,
        tellerCode: code,
        error: err instanceof Error ? err.message : 'Unknown',
      },
      userId: user.id,
    });

    const error = code?.startsWith('enrollment.disconnected')
      ? 'Teller could not disconnect this bank because the connection to your bank needs attention. It is still connected. Please try again later or contact support.'
      : status === 429
        ? 'Teller is busy right now, so this bank is still connected. Please try again in a few minutes.'
        : 'We could not reach Teller to disconnect this bank, so it is still connected. Please try again in a few minutes.';

    return NextResponse.json({ error, retryable: true }, { status: 502 });
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

  logInfo({
    source: 'api',
    module: 'finance',
    message: 'Teller enrollment disconnected by user',
    metadata: { enrollmentRowId: enrollment.id },
    userId: user.id,
  });

  return NextResponse.json({ disconnected: true });
}
