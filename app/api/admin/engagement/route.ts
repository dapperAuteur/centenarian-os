// app/api/admin/engagement/route.ts
// Admin-only engagement analytics: top liked/saved content + activity timeline

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove: (name: string, options: CookieOptions) => { try { cookieStore.set({ name, value: '', ...options }); } catch {} },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type ActivityEntry = {
  type: 'blog_like' | 'blog_save' | 'recipe_like' | 'recipe_save';
  created_at: string;
  actor_username: string;
  content_title: string;
  content_url: string;
};

type DayEntry = {
  date: string;
  blog_likes: number;
  blog_saves: number;
  recipe_likes: number;
  recipe_saves: number;
};

function toDateStr(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function buildDayMap(dates: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const d of dates) {
    const day = toDateStr(d);
    map[day] = (map[day] ?? 0) + 1;
  }
  return map;
}

export async function GET(_request: NextRequest) {
  const user = await getAdminUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── Parallel fetch all data ───────────────────────────────────────────────
  const [
    topLikedPostsRes,
    topSavedPostsRes,
    topLikedRecipesRes,
    topSavedRecipesRes,
    recentBlogLikesRes,
    recentBlogSavesRes,
    recentRecipeLikesRes,
    recentRecipeSavesRes,
    blogLikesDatesRes,
    blogSavesDatesRes,
    recipeLikesDatesRes,
    recipeSavesDatesRes,
  ] = await Promise.all([
    // Top liked blog posts (join profiles for author username)
    db.from('blog_posts')
      .select('id, title, slug, like_count, save_count, profiles!blog_posts_user_id_fkey(username)')
      .order('like_count', { ascending: false })
      .limit(10),

    // Top saved blog posts
    db.from('blog_posts')
      .select('id, title, slug, like_count, save_count, profiles!blog_posts_user_id_fkey(username)')
      .order('save_count', { ascending: false })
      .limit(10),

    // Top liked recipes
    db.from('recipes')
      .select('id, title, slug, like_count, save_count, profiles!recipes_user_id_fkey(username)')
      .order('like_count', { ascending: false })
      .limit(10),

    // Top saved recipes
    db.from('recipes')
      .select('id, title, slug, like_count, save_count, profiles!recipes_user_id_fkey(username)')
      .order('save_count', { ascending: false })
      .limit(10),

    // Recent blog likes (with post info)
    db.from('blog_likes')
      .select('user_id, post_id, created_at, blog_posts(title, slug)')
      .order('created_at', { ascending: false })
      .limit(25),

    // Recent blog saves
    db.from('blog_saves')
      .select('user_id, post_id, created_at, blog_posts(title, slug)')
      .order('created_at', { ascending: false })
      .limit(25),

    // Recent recipe likes (with recipe info)
    db.from('recipe_likes')
      .select('user_id, recipe_id, created_at, recipes(title, slug)')
      .order('created_at', { ascending: false })
      .limit(25),

    // Recent recipe saves
    db.from('recipe_saves')
      .select('user_id, recipe_id, created_at, recipes(title, slug)')
      .order('created_at', { ascending: false })
      .limit(25),

    // Activity by day — blog likes
    db.from('blog_likes').select('created_at').gte('created_at', thirtyDaysAgo),
    db.from('blog_saves').select('created_at').gte('created_at', thirtyDaysAgo),
    db.from('recipe_likes').select('created_at').gte('created_at', thirtyDaysAgo),
    db.from('recipe_saves').select('created_at').gte('created_at', thirtyDaysAgo),
  ]);

  // ── Collect unique user_ids from all recent activity ─────────────────────
  type AnyRow = { user_id: string; created_at: string };
  const allRecentRows: AnyRow[] = [
    ...(recentBlogLikesRes.data ?? []) as AnyRow[],
    ...(recentBlogSavesRes.data ?? []) as AnyRow[],
    ...(recentRecipeLikesRes.data ?? []) as AnyRow[],
    ...(recentRecipeSavesRes.data ?? []) as AnyRow[],
  ];
  const uniqueUserIds = [...new Set(allRecentRows.map((r) => r.user_id))];

  // Batch-fetch profiles for actor usernames
  const { data: actorProfiles } = uniqueUserIds.length
    ? await db.from('profiles').select('id, username').in('id', uniqueUserIds)
    : { data: [] };

  const profileMap: Record<string, string> = {};
  for (const p of actorProfiles ?? []) {
    profileMap[p.id] = p.username;
  }

  // ── Build recent activity feed ────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapBlogLike(row: any): ActivityEntry | null {
    const post = row.blog_posts;
    if (!post) return null;
    // Need author username for the URL — look up via topLikedPosts or leave blank
    return {
      type: 'blog_like',
      created_at: row.created_at,
      actor_username: profileMap[row.user_id] ?? 'unknown',
      content_title: post.title,
      content_url: `${appUrl}/blog/${post.slug}`, // slug only, no username here
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapBlogSave(row: any): ActivityEntry | null {
    const post = row.blog_posts;
    if (!post) return null;
    return {
      type: 'blog_save',
      created_at: row.created_at,
      actor_username: profileMap[row.user_id] ?? 'unknown',
      content_title: post.title,
      content_url: `${appUrl}/blog/${post.slug}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapRecipeLike(row: any): ActivityEntry | null {
    const recipe = row.recipes;
    if (!recipe) return null;
    return {
      type: 'recipe_like',
      created_at: row.created_at,
      actor_username: profileMap[row.user_id] ?? 'unknown',
      content_title: recipe.title,
      content_url: `${appUrl}/recipes/cooks/${recipe.slug}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapRecipeSave(row: any): ActivityEntry | null {
    const recipe = row.recipes;
    if (!recipe) return null;
    return {
      type: 'recipe_save',
      created_at: row.created_at,
      actor_username: profileMap[row.user_id] ?? 'unknown',
      content_title: recipe.title,
      content_url: `${appUrl}/recipes/cooks/${recipe.slug}`,
    };
  }

  const recentActivity: ActivityEntry[] = [
    ...(recentBlogLikesRes.data ?? []).map(mapBlogLike).filter(Boolean) as ActivityEntry[],
    ...(recentBlogSavesRes.data ?? []).map(mapBlogSave).filter(Boolean) as ActivityEntry[],
    ...(recentRecipeLikesRes.data ?? []).map(mapRecipeLike).filter(Boolean) as ActivityEntry[],
    ...(recentRecipeSavesRes.data ?? []).map(mapRecipeSave).filter(Boolean) as ActivityEntry[],
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  // ── Build activity-by-day ─────────────────────────────────────────────────
  const blMap = buildDayMap((blogLikesDatesRes.data ?? []).map((r) => r.created_at));
  const bsMap = buildDayMap((blogSavesDatesRes.data ?? []).map((r) => r.created_at));
  const rlMap = buildDayMap((recipeLikesDatesRes.data ?? []).map((r) => r.created_at));
  const rsMap = buildDayMap((recipeSavesDatesRes.data ?? []).map((r) => r.created_at));

  // Generate last 30 days
  const activityByDay: DayEntry[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = toDateStr(d.toISOString());
    activityByDay.push({
      date,
      blog_likes: blMap[date] ?? 0,
      blog_saves: bsMap[date] ?? 0,
      recipe_likes: rlMap[date] ?? 0,
      recipe_saves: rsMap[date] ?? 0,
    });
  }

  // ── Shape top content ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function shapePost(row: any) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      username: profile?.username ?? '',
      like_count: row.like_count ?? 0,
      save_count: row.save_count ?? 0,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function shapeRecipe(row: any) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      name: row.title,
      slug: row.slug,
      username: profile?.username ?? '',
      like_count: row.like_count ?? 0,
      save_count: row.save_count ?? 0,
    };
  }

  return NextResponse.json({
    topLikedPosts:   (topLikedPostsRes.data ?? []).map(shapePost),
    topSavedPosts:   (topSavedPostsRes.data ?? []).map(shapePost),
    topLikedRecipes: (topLikedRecipesRes.data ?? []).map(shapeRecipe),
    topSavedRecipes: (topSavedRecipesRes.data ?? []).map(shapeRecipe),
    recentActivity,
    activityByDay,
  });
}
