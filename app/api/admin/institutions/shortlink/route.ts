// app/api/admin/institutions/shortlink/route.ts
// POST: Create a short link for an institution or offer page.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createShortLink, toSwitchySlug } from '@/lib/switchy';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { type, id } = body; // type: 'institution' | 'offer'

  if (!type || !id) {
    return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
  }

  const db = getDb();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://centenarianos.com';

  if (type === 'institution') {
    const { data: inst } = await db
      .from('institutions')
      .select('slug, name, short_link_id')
      .eq('id', id)
      .maybeSingle();

    if (!inst) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
    if (inst.short_link_id) return NextResponse.json({ error: 'Short link already exists' }, { status: 409 });

    const link = await createShortLink({
      url: `${siteUrl}/institutions/${inst.slug}`,
      slug: toSwitchySlug('i', inst.slug),
      title: inst.name,
      tags: ['institution'],
    });

    if (!link) return NextResponse.json({ error: 'Failed to create short link' }, { status: 502 });

    await db
      .from('institutions')
      .update({ short_link_id: link.id, short_link_url: link.short_url })
      .eq('id', id);

    return NextResponse.json(link);
  }

  if (type === 'offer') {
    const { data: offer } = await db
      .from('institution_offers')
      .select('slug, title, url, short_link_id')
      .eq('id', id)
      .maybeSingle();

    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    if (offer.short_link_id) return NextResponse.json({ error: 'Short link already exists' }, { status: 409 });

    // Short link points to the offer's URL if set, otherwise the institution page
    const destUrl = offer.url || `${siteUrl}/institutions`;
    const link = await createShortLink({
      url: destUrl,
      slug: toSwitchySlug('o', offer.slug),
      title: offer.title,
      tags: ['offer'],
    });

    if (!link) return NextResponse.json({ error: 'Failed to create short link' }, { status: 502 });

    await db
      .from('institution_offers')
      .update({ short_link_id: link.id, short_link_url: link.short_url })
      .eq('id', id);

    return NextResponse.json(link);
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
