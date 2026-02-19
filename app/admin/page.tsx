'use client';

// app/admin/page.tsx
// Admin overview dashboard

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ChefHat, BookOpen, DollarSign, Zap, AlertTriangle, Timer, Utensils, CalendarDays, Map } from 'lucide-react';

interface Stats {
  users: { total: number; free: number; monthly: number; lifetime: number; newThisWeek: number };
  content: { recipes: number; publicRecipes: number; blogPosts: number; publicPosts: number; newRecipesThisWeek: number; newBlogThisWeek: number };
  featureUsage: { focusSessions: number; mealLogs: number; dailyLogs: number; roadmapTasks: number; recipeViews: number; blogViews: number };
  revenue: { lifetimeRevenue: number; monthlyMRR: number };
  promoCodesPending: number;
}

function StatCard({ label, value, sub, icon: Icon, color = 'fuchsia' }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string }) {
  const colors: Record<string, string> = {
    fuchsia: 'bg-fuchsia-900/30 text-fuchsia-400',
    sky: 'bg-sky-900/30 text-sky-400',
    lime: 'bg-lime-900/30 text-lime-400',
    amber: 'bg-amber-900/30 text-amber-400',
  };
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-red-400">Failed to load stats.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
      <p className="text-gray-400 text-sm mb-8">Your app at a glance.</p>

      {/* Promo code alert */}
      {stats.promoCodesPending > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-amber-900/30 border border-amber-700 rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-amber-300 text-sm">
            <strong>{stats.promoCodesPending}</strong> lifetime member{stats.promoCodesPending > 1 ? 's have' : ' has'} no promo code yet.{' '}
            <Link href="/admin/users?filter=promo_pending" className="underline font-semibold">View them →</Link>
          </p>
        </div>
      )}

      {/* Users */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Users</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.users.total} icon={Users} />
        <StatCard label="Free" value={stats.users.free} sub={`${Math.round(stats.users.free / Math.max(stats.users.total, 1) * 100)}% of users`} icon={Users} color="sky" />
        <StatCard label="Monthly ($10)" value={stats.users.monthly} sub={`$${stats.revenue.monthlyMRR}/mo MRR`} icon={Zap} color="fuchsia" />
        <StatCard label="Lifetime ($100)" value={stats.users.lifetime} sub={`$${stats.revenue.lifetimeRevenue} total`} icon={DollarSign} color="lime" />
      </div>

      {/* Content */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Content</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Recipes" value={stats.content.recipes} sub={`${stats.content.publicRecipes} public`} icon={ChefHat} color="lime" />
        <StatCard label="New Recipes" value={stats.content.newRecipesThisWeek} sub="this week" icon={ChefHat} color="sky" />
        <StatCard label="Blog Posts" value={stats.content.blogPosts} sub={`${stats.content.publicPosts} public`} icon={BookOpen} color="fuchsia" />
        <StatCard label="New Posts" value={stats.content.newBlogThisWeek} sub="this week" icon={BookOpen} color="amber" />
      </div>

      {/* Feature usage */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Feature Usage (all-time)</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Focus Sessions" value={stats.featureUsage.focusSessions} icon={Timer} color="fuchsia" />
        <StatCard label="Meal Logs" value={stats.featureUsage.mealLogs} icon={Utensils} color="sky" />
        <StatCard label="Daily Debriefs" value={stats.featureUsage.dailyLogs} icon={CalendarDays} color="lime" />
        <StatCard label="Roadmap Tasks" value={stats.featureUsage.roadmapTasks} icon={Map} color="amber" />
        <StatCard label="Recipe Views" value={stats.featureUsage.recipeViews} icon={ChefHat} color="lime" />
        <StatCard label="Blog Views" value={stats.featureUsage.blogViews} icon={BookOpen} color="fuchsia" />
      </div>

      {/* New users this week */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-gray-400 text-sm mb-1">New users this week</p>
        <p className="text-4xl font-bold text-white">{stats.users.newThisWeek}</p>
      </div>
    </div>
  );
}
