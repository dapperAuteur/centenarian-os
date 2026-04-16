// app/api/admin/stats/route.ts
// Aggregate stats for the admin overview dashboard

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  STARTER_MODULE_SLUGS,
  STARTER_MODULES,
  type ModuleSlug,
} from '@/lib/access/starter-modules';

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    paidLifetimeRes,
    cashappVerifiedRes,
    foundersLimitRes,
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
    // Paid lifetime only (has stripe_customer_id = paid via Stripe, not gifted/invited)
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_status', 'lifetime').not('stripe_customer_id', 'is', null),
    // Verified CashApp lifetime payments
    db.from('cashapp_payments').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
    // Founders limit
    db.from('platform_settings').select('value').eq('key', 'lifetime_founders_limit').maybeSingle(),
  ]);

  const profiles = profilesRes.data ?? [];
  const free = profiles.filter((p) => p.subscription_status === 'free').length;
  const monthly = profiles.filter((p) => p.subscription_status === 'monthly').length;
  const lifetime = profiles.filter((p) => p.subscription_status === 'lifetime').length;
  const starter = profiles.filter((p) => p.subscription_status === 'starter').length;
  const paidLifetime = paidLifetimeRes.count ?? 0;
  const cashappVerified = cashappVerifiedRes.count ?? 0;
  const giftedLifetime = lifetime - paidLifetime;
  const foundersLimit = Number(foundersLimitRes.data?.value ?? '100');
  const totalPaidLifetime = paidLifetime + cashappVerified;

  // Starter-tier module popularity + top combos. Only fetch the
  // selected_modules column for actual Starter subscribers — small
  // dataset, runs once per admin dashboard load.
  const { data: starterRows } = await db
    .from('profiles')
    .select('selected_modules')
    .eq('subscription_status', 'starter');

  const moduleCounts: Record<ModuleSlug, number> = Object.fromEntries(
    STARTER_MODULE_SLUGS.map((s) => [s, 0]),
  ) as Record<ModuleSlug, number>;
  const comboCounts = new Map<string, number>();

  for (const row of starterRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (row as any).selected_modules;
    if (!Array.isArray(raw)) continue;
    const slugs = raw.filter((s: unknown): s is ModuleSlug =>
      typeof s === 'string' && (STARTER_MODULE_SLUGS as readonly string[]).includes(s),
    );
    for (const slug of slugs) moduleCounts[slug]++;
    // Canonicalize order so [finance, travel, workouts] and
    // [workouts, finance, travel] hash to the same combo key.
    const key = [...slugs].sort().join(',');
    comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
  }

  const modulePopularity = STARTER_MODULE_SLUGS
    .map((slug) => ({
      slug,
      label: STARTER_MODULES[slug].label,
      count: moduleCounts[slug],
      percentage: starter > 0 ? Math.round((moduleCounts[slug] / starter) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topCombos = Array.from(comboCounts.entries())
    .map(([key, count]) => ({ slugs: key.split(','), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const publicRecipes = (recipesRes.data ?? []).filter((r) => r.visibility === 'public').length;
  const publicPosts = (blogPostsRes.data ?? []).filter((p) => p.visibility === 'public').length;

  return NextResponse.json({
    users: {
      total: profilesRes.count ?? 0,
      free,
      monthly,
      lifetime,
      starter,
      giftedLifetime,
      newThisWeek: newUsersRes.count ?? 0,
    },
    starter: {
      total: starter,
      modulePopularity,
      topCombos,
      // MRR is an underestimate — we can't distinguish monthly vs annual
      // subscribers without Stripe API calls per user. Treat as floor.
      estimatedMrrFloor: Math.round(starter * 5.46 * 100) / 100,
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
      lifetimeRevenue: totalPaidLifetime * 103.29,
      monthlyMRR: monthly * 10.60 + starter * 5.46,
    },
    founders: {
      limit: foundersLimit,
      paidLifetime: totalPaidLifetime,
      remaining: Math.max(0, foundersLimit - totalPaidLifetime),
      giftedLifetime,
    },
    promoCodesPending: promoPendingRes.count ?? 0,
  });
}
