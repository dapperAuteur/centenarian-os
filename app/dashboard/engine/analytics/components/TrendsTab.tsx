// app/dashboard/engine/analytics/components/TrendsTab.tsx
'use client';

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
} from 'recharts';
import {
  calculateDailyStats,
  calculateWeeklyStats,
  calculateTimeOfDayStats,
} from '@/lib/utils/analyticsUtils';

interface TrendsTabProps {
  sessions: FocusSession[];
  timeRange: string;
}

/**
 * Trends Tab: Visualize patterns over time with charts
 * For 6th graders: "See when and how you work with colorful charts"
 * For managers: "Identify productivity patterns and capacity planning data"
 */
export default function TrendsTab({ sessions, timeRange }: TrendsTabProps) {
  const dailyStats = calculateDailyStats(sessions);
  const weeklyStats = calculateWeeklyStats(sessions);
  const timeOfDayStats = calculateTimeOfDayStats(sessions);

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

  // Day of week analysis
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  sessions.forEach(session => {
    const day = new Date(session.start_time).getDay();
    dayOfWeekCounts[day]++;
  });

  const dayOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeekChartData = dayOfWeekCounts.map((count, idx) => ({
    day: dayOfWeekLabels[idx],
    sessions: count,
  }));

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No session data to display trends yet.</p>
        <p className="text-sm text-gray-400 mt-2">Start tracking focus time to see patterns here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Daily Trend */}
      <ChartCard 
        title="Daily Focus Time" 
        subtitle="Track your consistency day by day"
      >
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
            <Legend />
            <Bar dataKey="hours" fill="#6366f1" name="Focus Hours" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Weekly Trend */}
      {weeklyStats.length > 1 && (
        <ChartCard 
          title="Weekly Focus Time" 
          subtitle="See your long-term trends"
        >
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
              <Legend />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 4 }}
                name="Focus Hours"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Time of Day Distribution */}
      <ChartCard 
        title="Time of Day Distribution" 
        subtitle="When do you focus best?"
      >
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
            <Legend />
            <Bar dataKey="sessions" fill="#10b981" name="Sessions" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>💡 For 6th Graders:</strong> This chart shows what time of day you work best. 
            The tallest bars are your "power hours" - try to schedule important work during these times!
          </p>
        </div>
      </ChartCard>

      {/* Day of Week Distribution */}
      <ChartCard 
        title="Day of Week Distribution" 
        subtitle="Which days are you most productive?"
      >
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
            <Bar dataKey="sessions" fill="#f59e0b" name="Sessions" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-900">
            <strong>📊 For Hiring Managers:</strong>{' '}
            {dayOfWeekCounts[1] + dayOfWeekCounts[2] + dayOfWeekCounts[3] + 
             dayOfWeekCounts[4] + dayOfWeekCounts[5] > 
             dayOfWeekCounts[0] + dayOfWeekCounts[6]
              ? 'This person focuses primarily on weekdays, indicating good work/life balance boundaries.'
              : 'This person works weekends frequently - may indicate passion projects or potential burnout risk.'}
          </p>
        </div>
      </ChartCard>

      {/* Revenue Over Time (if applicable) */}
      {sessions.some(s => s.revenue && s.revenue > 0) && (
        <ChartCard 
          title="Revenue Over Time" 
          subtitle="Track your earnings from focus time"
        >
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
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#84cc16"
                strokeWidth={3}
                dot={{ fill: '#84cc16', r: 4 }}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 p-4 bg-lime-50 rounded-lg">
            <p className="text-sm text-lime-900">
              <strong>💰 For Vendors:</strong> This shows your billable time value over the selected period. 
              Use this to forecast project completion and invoice accurately.
            </p>
          </div>
        </ChartCard>
      )}
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
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
