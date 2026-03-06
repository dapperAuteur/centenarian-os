// app/api/admin/shortlinks/sync/route.ts
// POST: backfill short links for published content missing them

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createShortLink, toSwitchySlug } from '@/lib/switchy';
import { MODULES } from '@/lib/features/modules';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const type = request.nextUrl.searchParams.get('type') || 'all';
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const db = getDb();
  let created = 0;
  let failed = 0;

  // Blog posts
  if (type === 'all' || type === 'blog') {
    const { data: posts } = await db
      .from('blog_posts')
      .select('id, slug, title, excerpt, cover_image_url, user_id')
      .not('published_at', 'is', null)
      .is('short_link_id', null);

    for (const post of posts || []) {
      const { data: profile } = await db.from('profiles').select('username').eq('id', post.user_id).maybeSingle();
      const username = profile?.username || post.user_id;

      const link = await createShortLink({
        url: `${siteUrl}/blog/${username}/${post.slug}`,
        slug: toSwitchySlug('b', post.slug),
        title: post.title,
        description: post.excerpt || undefined,
        image: post.cover_image_url || undefined,
        tags: ['blog'],
      });

      if (link) {
        await db.from('blog_posts')
          .update({ short_link_id: link.id, short_link_url: link.short_url })
          .eq('id', post.id);
        created++;
      } else {
        failed++;
      }
      await delay(100);
    }
  }

  // Recipes
  if (type === 'all' || type === 'recipe') {
    const { data: recipes } = await db
      .from('recipes')
      .select('id, slug, title, description, cover_image_url, user_id')
      .not('published_at', 'is', null)
      .is('short_link_id', null);

    for (const recipe of recipes || []) {
      const { data: profile } = await db.from('profiles').select('username').eq('id', recipe.user_id).maybeSingle();
      const username = profile?.username || recipe.user_id;

      const link = await createShortLink({
        url: `${siteUrl}/recipes/cooks/${username}/${recipe.slug}`,
        slug: toSwitchySlug('r', recipe.slug),
        title: recipe.title,
        description: recipe.description || undefined,
        image: recipe.cover_image_url || undefined,
        tags: ['recipe'],
      });

      if (link) {
        await db.from('recipes')
          .update({ short_link_id: link.id, short_link_url: link.short_url })
          .eq('id', recipe.id);
        created++;
      } else {
        failed++;
      }
      await delay(100);
    }
  }

  // Courses
  if (type === 'all' || type === 'course') {
    const { data: courses } = await db
      .from('courses')
      .select('id, title, description, cover_image_url')
      .eq('is_published', true)
      .is('short_link_id', null);

    for (const course of courses || []) {
      const link = await createShortLink({
        url: `${siteUrl}/academy/${course.id}`,
        slug: toSwitchySlug('c', course.title),
        title: course.title,
        description: course.description || undefined,
        image: course.cover_image_url || undefined,
        tags: ['course'],
      });

      if (link) {
        await db.from('courses')
          .update({ short_link_id: link.id, short_link_url: link.short_url })
          .eq('id', course.id);
        created++;
      } else {
        failed++;
      }
      await delay(100);
    }
  }

  // Feature pages (static — no DB tracking, uses Switchy 409 as idempotency guard)
  if (type === 'all' || type === 'feature') {
    for (const mod of MODULES) {
      const link = await createShortLink({
        url: `${siteUrl}/features/${mod.slug}`,
        slug: toSwitchySlug('f', mod.slug),
        title: `${mod.name} — CentenarianOS`,
        description: mod.tagline,
        tags: ['feature'],
      });

      if (link) {
        created++;
      }
      // 409/422 = already exists (not a failure)
      await delay(100);
    }
  }

  return NextResponse.json({ created, failed });
}

// GET: return counts of content with/without short links
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();

  const [blogWith, blogWithout, recipeWith, recipeWithout, courseWith, courseWithout] = await Promise.all([
    db.from('blog_posts').select('id', { count: 'exact', head: true }).not('short_link_id', 'is', null),
    db.from('blog_posts').select('id', { count: 'exact', head: true }).not('published_at', 'is', null).is('short_link_id', null),
    db.from('recipes').select('id', { count: 'exact', head: true }).not('short_link_id', 'is', null),
    db.from('recipes').select('id', { count: 'exact', head: true }).not('published_at', 'is', null).is('short_link_id', null),
    db.from('courses').select('id', { count: 'exact', head: true }).not('short_link_id', 'is', null),
    db.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true).is('short_link_id', null),
  ]);

  // Feature pages don't have DB rows — report total count
  // (actual "with" tracking would need a Switchy list API; approximate with total)
  const featureTotal = MODULES.length;

  return NextResponse.json({
    blog: { with: blogWith.count || 0, without: blogWithout.count || 0 },
    recipe: { with: recipeWith.count || 0, without: recipeWithout.count || 0 },
    course: { with: courseWith.count || 0, without: courseWithout.count || 0 },
    feature: { total: featureTotal },
  });
}
