'use client';

// app/dashboard/engine/history/page.tsx
// Engine History Hub — summary cards linking to debrief, pain, and focus session history.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ClipboardList, Heart, Timer, ChevronRight, Search } from 'lucide-react';
import { formatDuration } from '@/lib/utils/sessionValidation';

interface Stats {
  debriefStreak: number;
  avgEnergy: number | null;
  painDaysAbove3: number;
  avgPainIntensity: number | null;
  focusHoursWeek: number;
  focusSessionsWeek: number;
}

interface RecentSession {
  id: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  session_type: string;
  notes: string | null;
  tags: string[] | null;
}

export default function EngineHistoryHub() {
  const [stats, setStats] = useState<Stats>({
    debriefStreak: 0, avgEnergy: null,
    painDaysAbove3: 0, avgPainIntensity: null,
    focusHoursWeek: 0, focusSessionsWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const supabase = createClient();

  const load = useCallback(async () => {
    const today = new Date();
    const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(today.getDate() - 30);

    const [logsRes, focusRes, recentRes] = await Promise.all([
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
      supabase
        .from('focus_sessions')
        .select('id, start_time, end_time, duration, session_type, notes, tags')
        .order('start_time', { ascending: false })
        .limit(50),
    ]);

    if (recentRes.data) setRecentSessions(recentRes.data);

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
      color: 'text-blue-400',
      bg: 'bg-blue-900/20 border-blue-800/40',
    },
    {
      title: 'Pain Tracking',
      icon: Heart,
      href: '/dashboard/engine/history/pain',
      stats: [
        { label: 'Days > 3 (month)', value: String(stats.painDaysAbove3) },
        { label: 'Avg intensity', value: stats.avgPainIntensity != null ? `${stats.avgPainIntensity}/10` : '—' },
      ],
      color: 'text-red-400',
      bg: 'bg-red-900/20 border-red-800/40',
    },
    {
      title: 'Focus Sessions',
      icon: Timer,
      href: '/dashboard/engine/sessions',
      stats: [
        { label: 'Hours (week)', value: `${stats.focusHoursWeek}h` },
        { label: 'Sessions', value: String(stats.focusSessionsWeek) },
      ],
      color: 'text-fuchsia-400',
      bg: 'bg-fuchsia-900/20 border-fuchsia-800/40',
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
        <h1 className="text-2xl font-bold text-white">Engine History</h1>
        <p className="text-gray-400 text-sm mt-1">Review past debrief entries, pain logs, and focus sessions.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`border rounded-xl p-5 hover:brightness-110 transition group ${card.bg}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${card.color}`} />
                  <h2 className="font-semibold text-white text-sm">{card.title}</h2>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition" />
              </div>
              <div className="space-y-2">
                {card.stats.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{s.label}</span>
                    <span className="text-sm font-semibold text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Searchable Recent Sessions */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
          <Link href="/dashboard/engine/sessions" className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
            View all &rarr;
          </Link>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search sessions by notes, type, tags..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
          />
        </div>
        <div className="space-y-2">
          {recentSessions
            .filter(s => {
              if (!historySearch.trim()) return true;
              const q = historySearch.trim().toLowerCase();
              const text = `${s.notes || ''} ${s.session_type || ''} ${(s.tags || []).join(' ')} ${s.start_time}`.toLowerCase();
              return text.includes(q);
            })
            .slice(0, 20)
            .map(s => (
              <Link
                key={s.id}
                href="/dashboard/engine/sessions"
                className="flex items-center justify-between p-3 rounded-lg border border-gray-800 bg-gray-900/40 hover:bg-gray-800/60 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                    s.session_type === 'work' ? 'bg-green-900/40 text-green-400' : 'bg-indigo-900/40 text-indigo-400'
                  }`}>
                    {s.session_type || 'focus'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">
                      {s.notes ? s.notes.slice(0, 60) : 'No notes'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(s.start_time).toLocaleDateString()} · {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-semibold text-white">
                    {s.duration ? formatDuration(s.duration, true) : s.end_time ? '—' : 'Running'}
                  </p>
                  {s.tags && s.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 justify-end">
                      {s.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          {recentSessions.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No sessions recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
