'use client';

// app/dashboard/engine/history/page.tsx
// Engine History Hub — summary cards linking to debrief, pain, and focus session history.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ClipboardList, Heart, Timer, ChevronRight } from 'lucide-react';

interface Stats {
  debriefStreak: number;
  avgEnergy: number | null;
  painDaysAbove3: number;
  avgPainIntensity: number | null;
  focusHoursWeek: number;
  focusSessionsWeek: number;
}

export default function EngineHistoryHub() {
  const [stats, setStats] = useState<Stats>({
    debriefStreak: 0, avgEnergy: null,
    painDaysAbove3: 0, avgPainIntensity: null,
    focusHoursWeek: 0, focusSessionsWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    const today = new Date();
    const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(today.getDate() - 30);

    const [logsRes, focusRes] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('date, energy_rating, pain_intensity')
        .gte('date', monthAgo.toISOString().split('T')[0])
        .order('date', { ascending: false }),
      supabase
        .from('focus_sessions')
        .select('duration_seconds')
        .gte('start_time', weekAgo.toISOString())
        .not('end_time', 'is', null),
    ]);

    const logs = logsRes.data || [];

    // Debrief streak (consecutive days from today)
    let streak = 0;
    const todayStr = today.toISOString().split('T')[0];
    const logDates = new Set(logs.map((l) => l.date));
    for (let d = new Date(today); ; d.setDate(d.getDate() - 1)) {
      const ds = d.toISOString().split('T')[0];
      if (ds === todayStr && !logDates.has(ds)) break; // today not logged yet, that's ok
      if (ds !== todayStr && !logDates.has(ds)) break;
      if (logDates.has(ds)) streak++;
    }

    // Avg energy this week
    const weekLogs = logs.filter((l) => l.date >= weekAgo.toISOString().split('T')[0]);
    const energyVals = weekLogs.map((l) => l.energy_rating).filter((v): v is number => v != null);
    const avgEnergy = energyVals.length ? +(energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(1) : null;

    // Pain stats this month
    const painLogs = logs.filter((l) => l.pain_intensity != null && l.pain_intensity > 0);
    const painDaysAbove3 = painLogs.filter((l) => (l.pain_intensity ?? 0) > 3).length;
    const painVals = painLogs.map((l) => l.pain_intensity!);
    const avgPainIntensity = painVals.length ? +(painVals.reduce((a, b) => a + b, 0) / painVals.length).toFixed(1) : null;

    // Focus stats this week
    const focusSessions = focusRes.data || [];
    const totalSec = focusSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

    setStats({
      debriefStreak: streak,
      avgEnergy,
      painDaysAbove3,
      avgPainIntensity,
      focusHoursWeek: +(totalSec / 3600).toFixed(1),
      focusSessionsWeek: focusSessions.length,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const cards = [
    {
      title: 'Daily Debrief',
      icon: ClipboardList,
      href: '/dashboard/engine/history/debrief',
      stats: [
        { label: 'Streak', value: `${stats.debriefStreak} day${stats.debriefStreak !== 1 ? 's' : ''}` },
        { label: 'Avg energy (week)', value: stats.avgEnergy != null ? `${stats.avgEnergy}/5` : '—' },
      ],
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
    },
    {
      title: 'Pain Tracking',
      icon: Heart,
      href: '/dashboard/engine/history/pain',
      stats: [
        { label: 'Days > 3 (month)', value: String(stats.painDaysAbove3) },
        { label: 'Avg intensity', value: stats.avgPainIntensity != null ? `${stats.avgPainIntensity}/10` : '—' },
      ],
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200',
    },
    {
      title: 'Focus Sessions',
      icon: Timer,
      href: '/dashboard/engine/sessions',
      stats: [
        { label: 'Hours (week)', value: `${stats.focusHoursWeek}h` },
        { label: 'Sessions', value: String(stats.focusSessionsWeek) },
      ],
      color: 'text-fuchsia-600',
      bg: 'bg-fuchsia-50 border-fuchsia-200',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Engine History</h1>
        <p className="text-gray-500 text-sm mt-1">Review past debrief entries, pain logs, and focus sessions.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`border rounded-xl p-5 shadow-sm hover:shadow-md transition group ${card.bg}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${card.color}`} />
                  <h2 className="font-semibold text-gray-900 text-sm">{card.title}</h2>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition" />
              </div>
              <div className="space-y-2">
                {card.stats.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{s.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
