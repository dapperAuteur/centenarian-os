import type { MetadataRoute } from 'next';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MODULES } from '@/lib/features/modules';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const now = new Date().toISOString();

  // ── Static routes ──────────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,             lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/pricing`,      lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/features`,     lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/academy`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${SITE_URL}/academy/paths`,lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${SITE_URL}/blog`,         lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${SITE_URL}/recipes`,      lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${SITE_URL}/recipes/cooks`,lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${SITE_URL}/institutions`, lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${SITE_URL}/coaching`,     lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/tech-roadmap`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contribute`,   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/live`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.4 },
    { url: `${SITE_URL}/privacy`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/terms`,        lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/safety`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/exercises`,   lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${SITE_URL}/workouts`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${SITE_URL}/demo`,        lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    // Feature module landing pages (from MODULES static list)
    ...MODULES.map((m) => ({
      url: `${SITE_URL}/features/${m.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8 as number,
    })),
  ];

  // ── Dynamic: public profiles ───────────────────────────────────────────────
  const { data: profiles } = await db
    .from('profiles')
    .select('username, updated_at')
    .not('username', 'is', null)
    .limit(5000);

  const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${SITE_URL}/profiles/${p.username}`,
    lastModified: p.updated_at ?? now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // ── Dynamic: public blog posts ────────────────────────────────────────────
  const { data: posts } = await db
    .from('blog_posts')
    .select('slug, published_at, updated_at, profiles!inner(username)')
    .eq('visibility', 'public')
    .not('published_at', 'is', null)
    .limit(5000);

  const blogRoutes: MetadataRoute.Sitemap = (posts ?? []).map((p) => {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    const username = (profile as { username: string } | null)?.username ?? '';
    return {
      url: `${SITE_URL}/blog/${username}/${p.slug}`,
      lastModified: p.updated_at ?? p.published_at ?? now,
      changeFrequency: 'monthly' as const,
      priority: 0.9 as number,
    };
  }).filter((r) => !r.url.endsWith('/'));

  // ── Dynamic: public recipes ───────────────────────────────────────────────
  const { data: recipes } = await db
    .from('recipes')
    .select('slug, published_at, updated_at, profiles!inner(username)')
    .eq('visibility', 'public')
    .not('published_at', 'is', null)
    .limit(5000);

  const recipeRoutes: MetadataRoute.Sitemap = (recipes ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const username = (profile as { username: string } | null)?.username ?? '';
    return {
      url: `${SITE_URL}/recipes/cooks/${username}/${r.slug}`,
      lastModified: r.updated_at ?? r.published_at ?? now,
      changeFrequency: 'monthly' as const,
      priority: 0.7 as number,
    };
  }).filter((r) => !r.url.endsWith('/'));

  // ── Dynamic: published academy courses ───────────────────────────────────
  const { data: courses } = await db
    .from('courses')
    .select('id, updated_at')
    .eq('status', 'published')
    .limit(2000);

  const courseRoutes: MetadataRoute.Sitemap = (courses ?? []).map((c) => ({
    url: `${SITE_URL}/academy/${c.id}`,
    lastModified: c.updated_at ?? now,
    changeFrequency: 'weekly' as const,
    priority: 0.7 as number,
  }));

  // ── Dynamic: active institutions ─────────────────────────────────────────
  const { data: institutions } = await db
    .from('institutions')
    .select('slug, updated_at')
    .eq('is_active', true)
    .limit(500);

  const institutionRoutes: MetadataRoute.Sitemap = (institutions ?? []).map((i) => ({
    url: `${SITE_URL}/institutions/${i.slug}`,
    lastModified: i.updated_at ?? now,
    changeFrequency: 'monthly' as const,
    priority: 0.6 as number,
  }));

  // ── Dynamic: public exercises ──────────────────────────────────────────
  const { data: exercises } = await db
    .from('exercises')
    .select('id, updated_at')
    .eq('is_active', true)
    .limit(5000);

  const exerciseRoutes: MetadataRoute.Sitemap = (exercises ?? []).map((e) => ({
    url: `${SITE_URL}/exercises/${e.id}`,
    lastModified: e.updated_at ?? now,
    changeFrequency: 'monthly' as const,
    priority: 0.5 as number,
  }));

  return [
    ...staticRoutes,
    ...profileRoutes,
    ...blogRoutes,
    ...recipeRoutes,
    ...courseRoutes,
    ...institutionRoutes,
    ...exerciseRoutes,
  ];
}
