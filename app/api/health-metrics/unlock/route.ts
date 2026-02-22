// app/api/health-metrics/unlock/route.ts
// POST — user self-acknowledges the disclaimer for a locked metric
//        and activates it for their account

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { metricKey?: string; acknowledged?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { metricKey, acknowledged } = body;

  if (!metricKey) {
    return NextResponse.json({ error: 'metricKey is required' }, { status: 400 });
  }
  if (!acknowledged) {
    return NextResponse.json({ error: 'You must acknowledge the disclaimer.' }, { status: 400 });
  }

  // Verify the metric exists and its unlock_type allows self-acknowledgment
  const { data: config, error: configError } = await supabase
    .from('metric_config')
    .select('metric_key, is_locked, unlock_type, is_globally_enabled')
    .eq('metric_key', metricKey)
    .maybeSingle();

  if (configError || !config) {
    return NextResponse.json({ error: 'Unknown metric' }, { status: 404 });
  }
  if (!config.is_globally_enabled) {
    return NextResponse.json({ error: 'This metric is not currently available.' }, { status: 403 });
  }
  if (config.unlock_type === 'admin_only') {
    return NextResponse.json(
      { error: 'This metric requires admin approval to unlock.' },
      { status: 403 }
    );
  }

  // Upsert the permission row — unlocked_by NULL means self-acknowledged
  const { data, error } = await supabase
    .from('user_metric_permissions')
    .upsert(
      {
        user_id: user.id,
        metric_key: metricKey,
        is_enabled: true,
        acknowledged_disclaimer: true,
        unlocked_by: null,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,metric_key' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
