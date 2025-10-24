// app/dashboard/engine/analytics/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import GoalProgressWidget from '@/components/focus/GoalProgressWidget';
import { calculateDailyProgress, calculateWeeklyProgress, formatGoalTime } from '@/lib/utils/goalUtils';
import { UserProfile } from '@/lib/types';
import { PREDEFINED_TAGS, getTagById, getTagColorClasses } from '@/lib/utils/tagUtils';

import { FocusSession } from '@/lib/types';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Target,
  Calendar,
  Activity,
} from 'lucide-react';
import {
  calculateDailyStats,
  calculateWeeklyStats,
  calculateTimeOfDayStats,
  calculateOverviewMetrics,
  formatHours,
  formatHoursMinutes,
} from '@/lib/utils/analyticsUtils';

type TimeRange = '7d' | '30d' | '90d' | 'all';

/**
 * Analytics Dashboard for Focus Sessions
 * Shows trends, patterns, and insights about focus time
 */
export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('focus_sessions')
        .select('*')
        .order('start_time', { ascending: false });

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);
    } catch (err) {
      console.error('Load data error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        setUserProfile(profile);
      }
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter sessions by time range
  const filteredSessions = sessions.filter(s => {
    if (!s.end_time || !s.duration) return false;
    
    if (timeRange === 'all') return true;

    const now = new Date();
    const sessionDate = new Date(s.start_time);
    const daysAgo = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

    switch (timeRange) {
      case '7d':
        return daysAgo <= 7;
      case '30d':
        return daysAgo <= 30;
      case '90d':
        return daysAgo <= 90;
      default:
        return true;
    }
  });

  // Calculate stats
  const dailyStats = calculateDailyStats(filteredSessions);
  const weeklyStats = calculateWeeklyStats(filteredSessions);
  const timeOfDayStats = calculateTimeOfDayStats(filteredSessions);
  const metrics = calculateOverviewMetrics(filteredSessions);

  const dailyProgress = userProfile
    ? calculateDailyProgress(
        filteredSessions,
        userProfile.daily_focus_goal_minutes
      )
    : null;

  const weeklyProgress = userProfile
    ? calculateWeeklyProgress(
        filteredSessions,
        userProfile.weekly_focus_goal_minutes,
        userProfile.daily_focus_goal_minutes
      )
    : null;

  // Prepare chart data
  const dailyChartData = dailyStats.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    hours: parseFloat((day.totalSeconds / 3600).toFixed(2)),
    sessions: day.sessionCount,
    revenue: day.revenue,
  }));

  const weeklyChartData = weeklyStats.map(week => ({
    week: week.week,
    hours: parseFloat((week.totalSeconds / 3600).toFixed(2)),
    sessions: week.sessionCount,
    revenue: week.revenue,
  }));

  const timeOfDayChartData = timeOfDayStats
    .filter(stat => stat.sessionCount > 0)
    .map(stat => ({
      hour: `${stat.hour}:00`,
      sessions: stat.sessionCount,
      hours: parseFloat((stat.totalSeconds / 3600).toFixed(2)),
    }));

  const dayOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeekChartData = metrics.dayOfWeekCounts.map((count, idx) => ({
    day: dayOfWeekLabels[idx],
    sessions: count,
  }));

  const tagStats = PREDEFINED_TAGS.map(tag => {
  const tagSessions = filteredSessions.filter(
    s => s.tags && s.tags.includes(tag.id)
  );
  const totalSeconds = tagSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  

  return {
    tag,
    sessionCount: tagSessions.length,
    totalSeconds,
    percentage: metrics.totalTime > 0 ? (totalSeconds / metrics.totalTime) * 100 : 0,
  };
}).filter(stat => stat.sessionCount > 0);

const tagChartData = tagStats.map(stat => ({
  name: stat.tag.label,
  value: parseFloat((stat.totalSeconds / 3600).toFixed(2)),
  color: getTagColorClasses(stat.tag.color).bg.replace('bg-', ''),
}));

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Focus Analytics</h1>
            <p className="text-gray-600">Track your productivity patterns and trends</p>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center space-x-2 bg-white rounded-lg border border-gray-300 p-1">
            {[
              { value: '7d' as TimeRange, label: '7 Days' },
              { value: '30d' as TimeRange, label: '30 Days' },
              { value: '90d' as TimeRange, label: '90 Days' },
              { value: 'all' as TimeRange, label: 'All Time' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  timeRange === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          icon={<Clock className="w-6 h-6" />}
          title="Total Focus Time"
          value={formatHours(metrics.totalTime)}
          subtitle={`${metrics.totalSessions} sessions`}
          color="indigo"
        />
        <MetricCard
          icon={<Target className="w-6 h-6" />}
          title="Avg Session"
          value={formatHoursMinutes(metrics.avgSessionLength)}
          subtitle="per session"
          color="purple"
        />
        <MetricCard
          icon={<TrendingUp className="w-6 h-6" />}
          title="Longest Session"
          value={formatHoursMinutes(metrics.longestSession)}
          subtitle="personal best"
          color="blue"
        />
        <MetricCard
          icon={<DollarSign className="w-6 h-6" />}
          title="Total Revenue"
          value={`$${metrics.totalRevenue.toFixed(0)}`}
          subtitle={`$${(metrics.totalRevenue / (metrics.totalTime / 3600)).toFixed(0)}/hr avg`}
          color="lime"
        />
      </div>

      {/* Goal Progress */}
      {userProfile && dailyProgress && weeklyProgress && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <GoalProgressWidget
            title="Today's Goal"
            completedMinutes={dailyProgress.completedMinutes}
            goalMinutes={dailyProgress.goalMinutes}
            percentage={dailyProgress.percentage}
            icon="target"
          />
          <GoalProgressWidget
            title="This Week's Goal"
            completedMinutes={weeklyProgress.completedMinutes}
            goalMinutes={weeklyProgress.goalMinutes}
            percentage={weeklyProgress.percentage}
            icon="calendar"
          />
        </div>
      )}

      {/* Most Productive Day */}
      {metrics.mostProductiveDay && (
        <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-900">Most Productive Day</p>
              <p className="text-2xl font-bold text-indigo-700">
                {new Date(metrics.mostProductiveDay.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-indigo-600">
                {formatHours(metrics.mostProductiveDay.totalSeconds)} across{' '}
                {metrics.mostProductiveDay.sessionCount} sessions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Focus Time */}
        <ChartCard title="Daily Focus Time" subtitle="Hours per day">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="hours" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Weekly Trend */}
        <ChartCard title="Weekly Trend" subtitle="Focus time by week">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ fill: '#4f46e5', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Time of Day Distribution */}
        <ChartCard title="Time of Day" subtitle="When you focus most">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeOfDayChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                label={{ value: 'Sessions', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="sessions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Day of Week */}
        <ChartCard title="Day of Week" subtitle="Sessions per day">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dayOfWeekChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                label={{ value: 'Sessions', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Weekly Goal Breakdown */}
      {userProfile && weeklyProgress && (
        <ChartCard title="Weekly Goal Progress" subtitle="Daily breakdown of this week">
          <div className="space-y-3">
            {weeklyProgress.dailyBreakdown.map((day, idx) => {
              const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx];
              const dayDate = new Date(day.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">
                      {dayName} - {dayDate}
                    </span>
                    <span className="text-gray-600">
                      {formatGoalTime(day.completedMinutes)} / {formatGoalTime(day.goalMinutes)}
                    </span>
                  </div>
                  <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full transition-all ${
                        day.percentage >= 100
                          ? 'bg-lime-600'
                          : day.percentage >= 75
                          ? 'bg-blue-600'
                          : day.percentage >= 50
                          ? 'bg-indigo-600'
                          : day.percentage >= 25
                          ? 'bg-amber-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${Math.min(day.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.round(day.percentage)}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-600 mb-1">Days Completed</p>
                <p className="text-lg font-bold text-lime-600">
                  {weeklyProgress.dailyBreakdown.filter(d => d.percentage >= 100).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Days On Track</p>
                <p className="text-lg font-bold text-blue-600">
                  {weeklyProgress.dailyBreakdown.filter(
                    d => d.percentage >= 50 && d.percentage < 100
                  ).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Days Behind</p>
                <p className="text-lg font-bold text-amber-600">
                  {weeklyProgress.dailyBreakdown.filter(d => d.percentage < 50 && d.percentage > 0)
                    .length}
                </p>
              </div>
            </div>
          </div>
        </ChartCard>
      )}

      {/* Tag Distribution */}
      {tagStats.length > 0 && (
        <ChartCard title="Tag Distribution" subtitle="Time spent by category">
          <div className="grid grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tagChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tagChartData.map((entry, index) => {
                    const colors = getTagColorClasses(entry.color);
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={colors.bg.includes('indigo') ? '#4f46e5' : 
                            colors.bg.includes('blue') ? '#3b82f6' :
                            colors.bg.includes('purple') ? '#8b5cf6' :
                            colors.bg.includes('pink') ? '#ec4899' :
                            colors.bg.includes('green') ? '#10b981' :
                            colors.bg.includes('amber') ? '#f59e0b' :
                            colors.bg.includes('cyan') ? '#06b6d4' : '#6b7280'}
                      />
                    );
                  })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {tagStats
                .sort((a, b) => b.totalSeconds - a.totalSeconds)
                .map(stat => {
                  const colors = getTagColorClasses(stat.tag.color);

                  return (
                    <div
                      key={stat.tag.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{stat.tag.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {stat.tag.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {stat.sessionCount} sessions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {formatHours(stat.totalSeconds)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {stat.percentage.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </ChartCard>
      )}

      {/* Revenue Chart (if revenue exists) */}
      {metrics.totalRevenue > 0 && (
        <div className="mb-8">
          <ChartCard title="Revenue Over Time" subtitle="Earnings from focus time">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                  label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#84cc16"
                  strokeWidth={3}
                  dot={{ fill: '#84cc16', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Insights */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-900">Insights</h3>
        </div>
        <div className="space-y-3">
          <InsightItem
            text={`You've completed ${metrics.totalSessions} focus sessions, totaling ${formatHours(metrics.totalTime)} of deep work.`}
          />
          <InsightItem
            text={`Your average session length is ${formatHoursMinutes(metrics.avgSessionLength)}, which is ${
              metrics.avgSessionLength > 3600
                ? 'excellent for deep work'
                : 'good for task-based work'
            }.`}
          />
          {metrics.dayOfWeekCounts[1] + metrics.dayOfWeekCounts[2] + metrics.dayOfWeekCounts[3] + metrics.dayOfWeekCounts[4] + metrics.dayOfWeekCounts[5] >
            metrics.dayOfWeekCounts[0] + metrics.dayOfWeekCounts[6] && (
            <InsightItem
              text="You focus more on weekdays than weekends. Consider maintaining some focus time on weekends for personal projects."
            />
          )}
          {metrics.totalRevenue > 0 && (
            <InsightItem
              text={`You've earned $${metrics.totalRevenue.toFixed(2)} from ${formatHours(metrics.totalTime)} of tracked work, averaging $${(metrics.totalRevenue / (metrics.totalTime / 3600)).toFixed(2)}/hour.`}
            />
          )}
        </div>
        {userProfile && dailyProgress && (
          <>
            <InsightItem
              text={`Your daily goal is ${formatGoalTime(userProfile.daily_focus_goal_minutes)}. ${
                dailyProgress.percentage >= 100
                  ? "You've hit your goal today! 🎉"
                  : dailyProgress.percentage >= 50
                  ? `You're ${Math.round(dailyProgress.percentage)}% of the way there.`
                  : `You need ${formatGoalTime(
                      dailyProgress.goalMinutes - dailyProgress.completedMinutes
                    )} more to reach your goal.`
              }`}
            />
            {weeklyProgress && (
              <InsightItem
                text={`This week you've completed ${weeklyProgress.dailyBreakdown.filter(d => d.percentage >= 100).length} out of 7 days. ${
                  weeklyProgress.percentage >= 100
                    ? 'Weekly goal achieved! 🎯'
                    : weeklyProgress.percentage >= 70
                    ? 'Great progress toward your weekly goal.'
                    : 'Focus on consistency to hit your weekly target.'
                }`}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper Components

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: 'indigo' | 'purple' | 'blue' | 'lime';
}

function MetricCard({ icon, title, value, subtitle, color }: MetricCardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-600',
    purple: 'bg-purple-600',
    blue: 'bg-blue-600',
    lime: 'bg-lime-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 ${colorClasses[color]} rounded-lg text-white`}>
          {icon}
        </div>
      </div>
      <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function InsightItem({ text }: { text: string }) {
  return (
    <div className="flex items-start space-x-2">
      <div className="flex-shrink-0 mt-1">
        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
      </div>
      <p className="text-sm text-gray-700">{text}</p>
    </div>
  );
}