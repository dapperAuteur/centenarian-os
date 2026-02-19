// app/api/admin/stats/route.ts
// Aggregate stats for the admin overview dashboard

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

export async function GET(_request: NextRequest) {
  const user = await getAdminUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profilesRes,
    newUsersRes,
    recipesRes,
    newRecipesRes,
    blogPostsRes,
    newBlogRes,
    focusRes,
    mealRes,
    dailyLogRes,
    tasksRes,
    recipeViewsRes,
    blogViewsRes,
    promoPendingRes,
  ] = await Promise.all([
    db.from('profiles').select('subscription_status', { count: 'exact' }),
    db.from('profiles').select('id', { count: 'exact' }).gte('created_at', weekAgo),
    db.from('recipes').select('visibility', { count: 'exact' }),
    db.from('recipes').select('id', { count: 'exact' }).gte('created_at', weekAgo),
    db.from('blog_posts').select('visibility', { count: 'exact' }),
    db.from('blog_posts').select('id', { count: 'exact' }).gte('created_at', weekAgo),
    db.from('focus_sessions').select('id', { count: 'exact' }),
    db.from('meal_logs').select('id', { count: 'exact' }),
    db.from('daily_logs').select('id', { count: 'exact' }),
    db.from('tasks').select('id', { count: 'exact' }),
    db.from('recipe_events').select('id', { count: 'exact' }).eq('event_type', 'view'),
    db.from('blog_events').select('id', { count: 'exact' }).eq('event_type', 'view'),
    db.from('profiles').select('id', { count: 'exact' }).eq('subscription_status', 'lifetime').is('shirt_promo_code', null),
  ]);

  const profiles = profilesRes.data ?? [];
  const free = profiles.filter((p) => p.subscription_status === 'free').length;
  const monthly = profiles.filter((p) => p.subscription_status === 'monthly').length;
  const lifetime = profiles.filter((p) => p.subscription_status === 'lifetime').length;

  const publicRecipes = (recipesRes.data ?? []).filter((r) => r.visibility === 'public').length;
  const publicPosts = (blogPostsRes.data ?? []).filter((p) => p.visibility === 'public').length;

  return NextResponse.json({
    users: {
      total: profilesRes.count ?? 0,
      free,
      monthly,
      lifetime,
      newThisWeek: newUsersRes.count ?? 0,
    },
    content: {
      recipes: recipesRes.count ?? 0,
      publicRecipes,
      blogPosts: blogPostsRes.count ?? 0,
      publicPosts,
      newRecipesThisWeek: newRecipesRes.count ?? 0,
      newBlogThisWeek: newBlogRes.count ?? 0,
    },
    featureUsage: {
      focusSessions: focusRes.count ?? 0,
      mealLogs: mealRes.count ?? 0,
      dailyLogs: dailyLogRes.count ?? 0,
      roadmapTasks: tasksRes.count ?? 0,
      recipeViews: recipeViewsRes.count ?? 0,
      blogViews: blogViewsRes.count ?? 0,
    },
    revenue: {
      lifetimeRevenue: lifetime * 100,
      monthlyMRR: monthly * 10,
    },
    promoCodesPending: promoPendingRes.count ?? 0,
  });
}
