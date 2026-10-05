// app/api/equipment/depreciation/route.ts
// Depreciation settings and report for one equipment item or vehicle (migration 214).
//
// GET ?kind=equipment|vehicle&id=<uuid>
//   { ready: true, item, settings (null until saved), report }
//   Before migration 214: { ready: false, error, item, report } (report from defaults).
// PUT { kind, id, ...settings }  saves (creates or updates) the item's settings row.
//   Before migration 214: 503 with code asset_depreciation_not_migrated.
//
// Figures are estimates, not tax advice (see lib/equipment/depreciation.ts).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReport, parseSettingsBody, SETTINGS_COLUMNS, type AssetKind } from '@/lib/equipment/depreciation-settings';
import {
  DEPRECIATION_NOT_READY,
  isDepreciationMissing,
  loadEquipmentUses,
  loadItem,
  loadSettingsRow,
  loadVehicleMiles,
} from '@/lib/equipment/depreciation-server';
import { isUuid } from '@/lib/auth/ownership';

function parseKind(value: unknown): AssetKind | null {
  return value === 'equipment' || value === 'vehicle' ? value : null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kind = parseKind(request.nextUrl.searchParams.get('kind'));
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!kind || !isUuid(id)) return NextResponse.json({ error: 'kind and id required' }, { status: 400 });

  const item = await loadItem(supabase, user.id, kind, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [settings, usesMap] = await Promise.all([
    loadSettingsRow(supabase, user.id, kind, id),
    kind === 'equipment' ? loadEquipmentUses(supabase, user.id, [id]) : loadVehicleMiles(supabase, user.id, [id]),
  ]);
  if (settings.error) return NextResponse.json({ error: settings.error }, { status: 500 });

  const report = buildReport(settings.row, item, usesMap.get(id) ?? []);
  if (settings.missing) {
    return NextResponse.json({ ready: false, ...DEPRECIATION_NOT_READY, item, settings: null, report });
  }
  return NextResponse.json({ ready: true, item, settings: settings.row, report });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const kind = parseKind(body.kind);
  const id = typeof body.id === 'string' ? body.id : '';
  if (!kind || !isUuid(id)) return NextResponse.json({ error: 'kind and id required' }, { status: 400 });

  const parsed = parseSettingsBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const item = await loadItem(supabase, user.id, kind, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const existing = await loadSettingsRow(supabase, user.id, kind, id);
  if (existing.missing) return NextResponse.json(DEPRECIATION_NOT_READY, { status: 503 });
  if (existing.error) return NextResponse.json({ error: existing.error }, { status: 500 });

  const query = existing.row
    ? supabase
        .from('asset_depreciation')
        .update(parsed.values)
        .eq('id', String(existing.row.id))
        .eq('user_id', user.id)
    : supabase.from('asset_depreciation').insert({
        ...parsed.values,
        user_id: user.id,
        equipment_id: kind === 'equipment' ? id : null,
        vehicle_id: kind === 'vehicle' ? id : null,
      });
  const { data, error } = await query.select(SETTINGS_COLUMNS).maybeSingle();
  if (error) {
    if (isDepreciationMissing(error)) return NextResponse.json(DEPRECIATION_NOT_READY, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
