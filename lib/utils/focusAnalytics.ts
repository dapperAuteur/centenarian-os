/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/utils/focusAnalytics.ts

import { createClient } from '@/lib/supabase/client';

export interface TagInsight {
  tag: string;
  count: number;
  totalDuration: number; // seconds
  avgDuration: number;
  totalRevenue: number;
  avgQuality: number | null;
}

export interface PomodoroEffectiveness {
  totalPomodoros: number;
  avgPomodoroLength: number; // minutes
  avgBreakLength: number; // minutes
  completionRate: number; // % of sessions completed
  avgQuality: number | null;
  revenue: number;
}

export interface TemplateUsage {
  templateId: string;
  templateName: string;
  useCount: number;
  totalDuration: number;
  avgQuality: number | null;
  lastUsed: string;
}

export interface TimeDistribution {
  hour: number;
  sessionCount: number;
  avgDuration: number;
  avgQuality: number | null;
}

export interface DailyTrend {
  date: string;
  sessionCount: number;
  totalDuration: number;
  pomodoroCount: number;
  avgQuality: number | null;
}

/**
 * Get insights by tags for a date range
 */
export async function getTagInsights(
  userId: string,
  startDate: string,
  endDate: string
): Promise<TagInsight[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('focus_sessions')
    .select('tags, duration, net_work_duration, revenue, quality_rating')
    .eq('user_id', userId)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .not('end_time', 'is', null);

  if (error || !data) return [];

  // Flatten tags and aggregate
  const tagMap = new Map<string, {
    count: number;
    totalDuration: number;
    totalRevenue: number;
    qualitySum: number;
    qualityCount: number;
  }>();

  data.forEach(session => {
    const duration = session.net_work_duration || session.duration || 0;
    const quality = session.quality_rating;

    (session.tags || []).forEach((tag: string) => {
      const existing = tagMap.get(tag) || {
        count: 0,
        totalDuration: 0,
        totalRevenue: 0,
        qualitySum: 0,
        qualityCount: 0,
      };

      tagMap.set(tag, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + duration,
        totalRevenue: existing.totalRevenue + (session.revenue || 0),
        qualitySum: existing.qualitySum + (quality || 0),
        qualityCount: existing.qualityCount + (quality ? 1 : 0),
      });
    });
  });

  return Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      totalDuration: stats.totalDuration,
      avgDuration: stats.totalDuration / stats.count,
      totalRevenue: stats.totalRevenue,
      avgQuality: stats.qualityCount > 0 ? stats.qualitySum / stats.qualityCount : null,
    }))
    .sort((a, b) => b.totalDuration - a.totalDuration);
}

/**
 * Get Pomodoro effectiveness metrics
 */
export async function getPomodoroEffectiveness(
  userId: string,
  startDate: string,
  endDate: string
): Promise<PomodoroEffectiveness> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('focus_sessions')
    .select('work_intervals, break_intervals, quality_rating, revenue, duration')
    .eq('user_id', userId)
    .eq('pomodoro_mode', true)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .not('end_time', 'is', null);

  if (error || !data || data.length === 0) {
    return {
      totalPomodoros: 0,
      avgPomodoroLength: 0,
      avgBreakLength: 0,
      completionRate: 0,
      avgQuality: null,
      revenue: 0,
    };
  }

  let totalPomodoros = 0;
  let totalPomodoroSeconds = 0;
  let totalBreakSeconds = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  let totalRevenue = 0;

  data.forEach(session => {
    const workIntervals = session.work_intervals || [];
    const breakIntervals = session.break_intervals || [];

    totalPomodoros += workIntervals.length;

    workIntervals.forEach((interval: any) => {
      totalPomodoroSeconds += interval.duration || 0;
    });

    breakIntervals.forEach((interval: any) => {
      totalBreakSeconds += interval.duration || 0;
    });

    if (session.quality_rating) {
      qualitySum += session.quality_rating;
      qualityCount++;
    }

    totalRevenue += session.revenue || 0;
  });

  return {
    totalPomodoros,
    avgPomodoroLength: totalPomodoros > 0 ? totalPomodoroSeconds / totalPomodoros / 60 : 0,
    avgBreakLength: totalBreakSeconds > 0 ? totalBreakSeconds / (data.length * 2) / 60 : 0,
    completionRate: (data.length / (data.length + 1)) * 100, // Simplified
    avgQuality: qualityCount > 0 ? qualitySum / qualityCount : null,
    revenue: totalRevenue,
  };
}

/**
 * Get template usage statistics
 */
export async function getTemplateUsage(
  userId: string,
  startDate: string,
  endDate: string
): Promise<TemplateUsage[]> {
  const supabase = createClient();

  // Get sessions with template references
  const { data: sessions, error: sessionsError } = await supabase
    .from('focus_sessions')
    .select('template_id, duration, net_work_duration, quality_rating, start_time')
    .eq('user_id', userId)
    .not('template_id', 'is', null)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .not('end_time', 'is', null);

  if (sessionsError || !sessions) return [];

  // Get template names
  const templateIds = [...new Set(sessions.map(s => s.template_id).filter(Boolean))];
  const { data: templates } = await supabase
    .from('session_templates')
    .select('id, name')
    .in('id', templateIds);

  const templateMap = new Map(templates?.map(t => [t.id, t.name]) || []);

  // Aggregate by template
  const usageMap = new Map<string, {
    name: string;
    count: number;
    totalDuration: number;
    qualitySum: number;
    qualityCount: number;
    lastUsed: string;
  }>();

  sessions.forEach(session => {
    const templateId = session.template_id!;
    const existing = usageMap.get(templateId) || {
      name: templateMap.get(templateId) || 'Unknown',
      count: 0,
      totalDuration: 0,
      qualitySum: 0,
      qualityCount: 0,
      lastUsed: session.start_time,
    };

    const duration = session.net_work_duration || session.duration || 0;
    const quality = session.quality_rating;

    usageMap.set(templateId, {
      ...existing,
      count: existing.count + 1,
      totalDuration: existing.totalDuration + duration,
      qualitySum: existing.qualitySum + (quality || 0),
      qualityCount: existing.qualityCount + (quality ? 1 : 0),
      lastUsed: session.start_time > existing.lastUsed ? session.start_time : existing.lastUsed,
    });
  });

  return Array.from(usageMap.entries())
    .map(([templateId, stats]) => ({
      templateId,
      templateName: stats.name,
      useCount: stats.count,
      totalDuration: stats.totalDuration,
      avgQuality: stats.qualityCount > 0 ? stats.qualitySum / stats.qualityCount : null,
      lastUsed: stats.lastUsed,
    }))
    .sort((a, b) => b.useCount - a.useCount);
}

/**
 * Get time-of-day distribution
 */
export async function getTimeDistribution(
  userId: string,
  startDate: string,
  endDate: string
): Promise<TimeDistribution[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('focus_sessions')
    .select('start_time, duration, net_work_duration, quality_rating')
    .eq('user_id', userId)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .not('end_time', 'is', null);

  if (error || !data) return [];

  const hourMap = new Map<number, {
    count: number;
    totalDuration: number;
    qualitySum: number;
    qualityCount: number;
  }>();

  data.forEach(session => {
    const hour = new Date(session.start_time).getHours();
    const existing = hourMap.get(hour) || {
      count: 0,
      totalDuration: 0,
      qualitySum: 0,
      qualityCount: 0,
    };

    const duration = session.net_work_duration || session.duration || 0;
    const quality = session.quality_rating;

    hourMap.set(hour, {
      count: existing.count + 1,
      totalDuration: existing.totalDuration + duration,
      qualitySum: existing.qualitySum + (quality || 0),
      qualityCount: existing.qualityCount + (quality ? 1 : 0),
    });
  });

  return Array.from({ length: 24 }, (_, hour) => {
    const stats = hourMap.get(hour) || { count: 0, totalDuration: 0, qualitySum: 0, qualityCount: 0 };
    return {
      hour,
      sessionCount: stats.count,
      avgDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
      avgQuality: stats.qualityCount > 0 ? stats.qualitySum / stats.qualityCount : null,
    };
  });
}

/**
 * Get daily trends
 */
export async function getDailyTrends(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyTrend[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('focus_sessions')
    .select('start_time, duration, net_work_duration, pomodoro_mode, quality_rating, work_intervals')
    .eq('user_id', userId)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .not('end_time', 'is', null)
    .order('start_time');

  if (error || !data) return [];

  const dateMap = new Map<string, {
    count: number;
    totalDuration: number;
    pomodoroCount: number;
    qualitySum: number;
    qualityCount: number;
  }>();

  data.forEach(session => {
    const date = session.start_time.split('T')[0];
    const existing = dateMap.get(date) || {
      count: 0,
      totalDuration: 0,
      pomodoroCount: 0,
      qualitySum: 0,
      qualityCount: 0,
    };

    const duration = session.net_work_duration || session.duration || 0;
    const quality = session.quality_rating;

    dateMap.set(date, {
      count: existing.count + 1,
      totalDuration: existing.totalDuration + duration,
      pomodoroCount: existing.pomodoroCount + (session.pomodoro_mode ? (session.work_intervals?.length || 0) : 0),
      qualitySum: existing.qualitySum + (quality || 0),
      qualityCount: existing.qualityCount + (quality ? 1 : 0),
    });
  });

  return Array.from(dateMap.entries())
    .map(([date, stats]) => ({
      date,
      sessionCount: stats.count,
      totalDuration: stats.totalDuration,
      pomodoroCount: stats.pomodoroCount,
      avgQuality: stats.qualityCount > 0 ? stats.qualitySum / stats.qualityCount : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}