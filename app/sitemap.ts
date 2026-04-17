import type { MetadataRoute } from 'next';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MODULES } from '@/lib/features/modules';
import { LOCALES } from '@/lib/i18n/config';

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
  // Phase 2 of plan 31: each public route emits BOTH the canonical EN
  // URL (un-prefixed) and an ES variant (/es/*), each with hreflang
  // alternates pointing at the full language set. Google's spec: every
  // URL entry in the sitemap must link to every language variant.
  type StaticRoute = { path: string; changeFrequency: 'weekly' | 'monthly' | 'daily' | 'yearly'; priority: number };
  const STATIC_PATHS: StaticRoute[] = [
    { path: '/',               changeFrequency: 'weekly',  priority: 1.0 },
    { path: '/pricing',        changeFrequency: 'monthly', priority: 0.9 },
    { path: '/features',       changeFrequency: 'monthly', priority: 0.8 },
    { path: '/academy',        changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/academy/paths',  changeFrequency: 'weekly',  priority: 0.7 },
    { path: '/blog',           changeFrequency: 'daily',   priority: 0.8 },
    { path: '/recipes',        changeFrequency: 'daily',   priority: 0.7 },
    { path: '/recipes/cooks',  changeFrequency: 'weekly',  priority: 0.6 },
    { path: '/institutions',   changeFrequency: 'weekly',  priority: 0.6 },
    { path: '/coaching',       changeFrequency: 'monthly', priority: 0.5 },
    { path: '/tech-roadmap',   changeFrequency: 'monthly', priority: 0.5 },
    { path: '/contribute',     changeFrequency: 'monthly', priority: 0.4 },
    { path: '/live',           changeFrequency: 'weekly',  priority: 0.4 },
    { path: '/privacy',        changeFrequency: 'yearly',  priority: 0.3 },
    { path: '/terms',          changeFrequency: 'yearly',  priority: 0.3 },
    { path: '/safety',         changeFrequency: 'yearly',  priority: 0.3 },
    { path: '/exercises',      changeFrequency: 'weekly',  priority: 0.6 },
    { path: '/workouts',       changeFrequency: 'weekly',  priority: 0.6 },
    { path: '/demo',           changeFrequency: 'monthly', priority: 0.5 },
    ...MODULES.map((m) => ({ path: `/features/${m.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
  ];

  function localizedUrl(path: string, locale: string): string {
    // EN is the default locale — served at canonical URLs.
    if (locale === 'en') return `${SITE_URL}${path}`;
    // Avoid `/es//` when path = '/'.
    return path === '/' ? `${SITE_URL}/${locale}` : `${SITE_URL}/${locale}${path}`;
  }

  function alternatesFor(path: string): { languages: Record<string, string> } {
    const languages: Record<string, string> = {
      'x-default': `${SITE_URL}${path}`,
    };
    for (const l of LOCALES) languages[l] = localizedUrl(path, l);
    return { languages };
  }

  const staticRoutes: MetadataRoute.Sitemap = STATIC_PATHS.flatMap((r) =>
    LOCALES.map((locale) => ({
      url: localizedUrl(r.path, locale),
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
      alternates: alternatesFor(r.path),
    })),
  );

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
