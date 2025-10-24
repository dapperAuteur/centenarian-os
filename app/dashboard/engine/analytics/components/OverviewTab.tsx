// app/dashboard/engine/analytics/components/OverviewTab.tsx
'use client';

import { FocusSession, UserProfile } from '@/lib/types';
import { Clock, Target, TrendingUp, DollarSign } from 'lucide-react';
import GoalProgressWidget from '@/components/focus/GoalProgressWidget';
import { calculateDailyProgress, calculateWeeklyProgress, formatGoalTime } from '@/lib/utils/goalUtils';
import { calculateOverviewMetrics, formatHours, formatHoursMinutes } from '@/lib/utils/analyticsUtils';

interface OverviewTabProps {
  sessions: FocusSession[];
  userProfile: UserProfile | null;
  timeRange: string;
}

/**
 * Overview Tab: High-level metrics, goal progress, and actionable insights
 * For 6th graders: "The quick summary of how you're doing"
 */
export default function OverviewTab({ sessions, userProfile, timeRange }: OverviewTabProps) {
  const metrics = calculateOverviewMetrics(sessions);
  
  // Calculate goal progress (only for today and this week)
  const dailyProgress = userProfile
    ? calculateDailyProgress(sessions, userProfile.daily_focus_goal_minutes)
    : null;

  const weeklyProgress = userProfile
    ? calculateWeeklyProgress(
        sessions,
        userProfile.weekly_focus_goal_minutes,
        userProfile.daily_focus_goal_minutes
      )
    : null;

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            subtitle={
              metrics.totalTime > 0
                ? `$${(metrics.totalRevenue / (metrics.totalTime / 3600)).toFixed(0)}/hr avg`
                : 'No revenue'
            }
            color="lime"
          />
        </div>
      </div>

      {/* Goal Progress */}
      {userProfile && dailyProgress && weeklyProgress && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Goal Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      )}

      {/* Insights */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Insights</h2>
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 space-y-4">
          {sessions.length === 0 ? (
            <InsightItem
              text="No sessions yet. Start tracking focus time to see insights here!"
              emoji="🚀"
            />
          ) : (
            <>
              <InsightItem
                text={`You've completed ${metrics.totalSessions} focus sessions, totaling ${formatHours(metrics.totalTime)} of deep work.`}
                emoji="📊"
              />
              
              <InsightItem
                text={`Your average session is ${formatHoursMinutes(metrics.avgSessionLength)}, which is ${
                  metrics.avgSessionLength > 3600
                    ? 'excellent for deep work (over 1 hour)'
                    : metrics.avgSessionLength > 1800
                    ? 'good for focused tasks (30-60 min)'
                    : 'best for quick tasks (under 30 min)'
                }.`}
                emoji="⏱️"
              />

              {metrics.dayOfWeekCounts[1] + metrics.dayOfWeekCounts[2] + metrics.dayOfWeekCounts[3] + 
               metrics.dayOfWeekCounts[4] + metrics.dayOfWeekCounts[5] >
               metrics.dayOfWeekCounts[0] + metrics.dayOfWeekCounts[6] && (
                <InsightItem
                  text="You focus more on weekdays than weekends. Consider some weekend focus time for personal projects!"
                  emoji="📅"
                />
              )}

              {metrics.totalRevenue > 0 && (
                <InsightItem
                  text={`You've earned $${metrics.totalRevenue.toFixed(2)} from ${formatHours(metrics.totalTime)} of tracked work, averaging $${(metrics.totalRevenue / (metrics.totalTime / 3600)).toFixed(2)}/hour.`}
                  emoji="💰"
                />
              )}

              {dailyProgress && (
                <InsightItem
                  text={
                    dailyProgress.percentage >= 100
                      ? `You've hit your daily goal of ${formatGoalTime(userProfile?.daily_focus_goal_minutes || 0)}! 🎉`
                      : dailyProgress.percentage >= 50
                      ? `You're ${Math.round(dailyProgress.percentage)}% toward today's goal. ${formatGoalTime(dailyProgress.goalMinutes - dailyProgress.completedMinutes)} to go!`
                      : `You need ${formatGoalTime(dailyProgress.goalMinutes - dailyProgress.completedMinutes)} more to reach today's goal.`
                  }
                  emoji="🎯"
                />
              )}

              {weeklyProgress && weeklyProgress.percentage >= 100 && (
                <InsightItem
                  text="You've completed your weekly goal! You're crushing it! 💪"
                  emoji="🏆"
                />
              )}

              {sessions.filter(s => s.pomodoro_mode).length > 0 && (
                <InsightItem
                  text={`${sessions.filter(s => s.pomodoro_mode).length} of your sessions used Pomodoro technique. Check the Pomodoro tab for detailed effectiveness metrics!`}
                  emoji="🍅"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.href = '/dashboard/engine/focus'}
            className="p-4 bg-white rounded-lg border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition text-left group"
          >
            <div className="text-2xl mb-2">⏱️</div>
            <div className="font-semibold text-gray-900 group-hover:text-indigo-600">Start Focus Session</div>
            <div className="text-sm text-gray-600">Track your deep work time</div>
          </button>

          <button
            onClick={() => window.location.href = '/dashboard/engine/sessions'}
            className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition text-left group"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-gray-900 group-hover:text-purple-600">View All Sessions</div>
            <div className="text-sm text-gray-600">Manage and edit sessions</div>
          </button>

          <button
            onClick={() => window.location.href = '/dashboard/settings'}
            className="p-4 bg-white rounded-lg border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition text-left group"
          >
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold text-gray-900 group-hover:text-amber-600">Set Goals</div>
            <div className="text-sm text-gray-600">Configure daily/weekly targets</div>
          </button>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: 'indigo' | 'purple' | 'blue' | 'lime';
}

function MetricCard({ icon, title, value, subtitle, color }: MetricCardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-100 text-indigo-600',
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    lime: 'bg-lime-100 text-lime-600',
  };

  const textColorClasses = {
    indigo: 'text-indigo-600',
    purple: 'text-purple-600',
    blue: 'text-blue-600',
    lime: 'text-lime-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-bold mb-1 ${textColorClasses[color]}`}>
        {value}
      </div>
      <div className="text-sm font-medium text-gray-900 mb-1">{title}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}

interface InsightItemProps {
  text: string;
  emoji: string;
}

function InsightItem({ text, emoji }: InsightItemProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}
