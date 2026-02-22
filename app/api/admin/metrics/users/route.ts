// app/api/admin/metrics/users/route.ts
// GET  — get metric permissions for a specific user (admin: test any user)
// POST — admin grants or revokes a metric permission for any user

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

// GET /api/admin/metrics/users?userId=<uuid>
export async function GET(request: NextRequest) {
  const adminUser = await assertAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const admin = adminClient();
  const { data, error } = await admin
    .from('user_metric_permissions')
    .select('*, metric_config(label, is_locked, unlock_type)')
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/admin/metrics/users
// Body: { userId, metricKey, isEnabled }
// Admin can grant or revoke any metric for any user (for testing)
export async function POST(request: NextRequest) {
  const adminUser = await assertAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { userId?: string; metricKey?: string; isEnabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { userId, metricKey, isEnabled } = body;
  if (!userId || !metricKey || isEnabled === undefined) {
    return NextResponse.json(
      { error: 'userId, metricKey, and isEnabled are required' },
      { status: 400 }
    );
  }

  const admin = adminClient();
  const { data, error } = await admin
    .from('user_metric_permissions')
    .upsert(
      {
        user_id: userId,
        metric_key: metricKey,
        is_enabled: isEnabled,
        acknowledged_disclaimer: true,     // admin overrides always count as acknowledged
        unlocked_by: adminUser.id,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,metric_key' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
