'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign } from 'lucide-react';

export default function EnginePage() {
  const [stats, setStats] = useState({
    todayFocusMinutes: 0,
    todayLogComplete: false,
    weekFocusSessions: 0,
    todayRevenue: 0,
    weekRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [sessionsRes, logRes, weekSessionsRes] = await Promise.all([
      supabase
        .from('focus_sessions')
        .select('duration_seconds, revenue')
        .gte('start_time', today + 'T00:00:00')
        .not('end_time', 'is', null),
      supabase
        .from('daily_logs')
        .select('id')
        .eq('date', today)
        .single(),
      supabase
        .from('focus_sessions')
        .select('id, revenue', { count: 'exact' })
        .gte('start_time', weekAgo.toISOString())
        .not('end_time', 'is', null)
    ]);

    const totalSeconds = sessionsRes.data?.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) || 0;
    const todayRev = sessionsRes.data?.reduce((sum, s) => sum + (s.revenue || 0), 0) || 0;
    const weekRev = weekSessionsRes.data?.reduce((sum, s) => sum + (s.revenue || 0), 0) || 0;

    setStats({
      todayFocusMinutes: Math.round(totalSeconds / 60),
      todayLogComplete: !!logRes.data,
      weekFocusSessions: weekSessionsRes.count || 0,
      todayRevenue: todayRev,
      weekRevenue: weekRev,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const modules = [
    {
      title: 'Focus Timer',
      description: 'Track deep work sessions with revenue tracking',
      href: '/dashboard/engine/focus',
      icon: '⏱️',
      stat: `${stats.todayFocusMinutes} min`,
      statLabel: 'today',
      revenue: stats.todayRevenue,
    },
    {
      title: 'Daily Debrief',
      description: 'End-of-day reflection and ratings',
      href: '/dashboard/engine/debrief',
      icon: '📝',
      stat: stats.todayLogComplete ? '✓' : '—',
      statLabel: 'logged',
    },
    {
      title: 'Pain Tracking',
      description: 'Body check and pain intensity logging',
      href: '/dashboard/engine/pain',
      icon: '🩺',
      stat: stats.weekFocusSessions,
      statLabel: 'sessions',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">The Engine</h1>
        <p className="text-gray-600">Focus tracking and daily debriefs</p>
      </header>

      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Connect Work + Fuel = Story</h2>
        <p className="mb-4">Track execution and generate insights for content creation.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">{stats.todayFocusMinutes}</div>
            <p className="text-sm">Minutes today</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">{stats.weekFocusSessions}</div>
            <p className="text-sm">Sessions this week</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">{stats.todayLogComplete ? 'Done' : 'Pending'}</div>
            <p className="text-sm">Daily debrief</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">${stats.weekRevenue.toFixed(0)}</div>
            <p className="text-sm">Week revenue</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105"
            >
              <div className="text-5xl mb-4">{module.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{module.description}</p>
              <div className="pt-4 border-t border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{module.stat}</div>
                <div className="text-xs text-gray-500">{module.statLabel}</div>
                {module.revenue !== undefined && module.revenue > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-lime-600">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-semibold">${module.revenue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}