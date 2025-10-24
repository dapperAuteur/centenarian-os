/* eslint-disable @typescript-eslint/no-unused-vars */
// app/dashboard/engine/analytics/components/PomodoroTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession } from '@/lib/types';
import { getPomodoroEffectiveness, type PomodoroEffectiveness } from '@/lib/utils/focusAnalytics';
import { Target, Clock, Coffee, TrendingUp, Award, AlertCircle } from 'lucide-react';

interface PomodoroTabProps {
  sessions: FocusSession[];
  timeRange: string;
}

/**
 * Pomodoro Tab: Analyze work/break patterns and technique effectiveness
 * For 6th graders: "See if taking breaks helps you focus better"
 * For managers: "Measure productivity impact of structured work intervals"
 */
export default function PomodoroTab({ sessions, timeRange }: PomodoroTabProps) {
  const [pomodoroStats, setPomodoroStats] = useState<PomodoroEffectiveness | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadPomodoroStats();
  }, [sessions]);

  const loadPomodoroStats = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get date range based on filtered sessions
    if (sessions.length === 0) {
      setPomodoroStats(null);
      setLoading(false);
      return;
    }

    const dates = sessions.map(s => new Date(s.start_time).getTime());
    const startDate = new Date(Math.min(...dates)).toISOString();
    const endDate = new Date(Math.max(...dates)).toISOString();

    const stats = await getPomodoroEffectiveness(user.id, startDate, endDate);
    setPomodoroStats(stats);
    setLoading(false);
  };

  const pomodoroSessions = sessions.filter(s => s.pomodoro_mode);
  const simpleSessions = sessions.filter(s => !s.pomodoro_mode);

  // Calculate comparison metrics
  const avgPomodoroSessionLength = pomodoroSessions.length > 0
    ? pomodoroSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / pomodoroSessions.length
    : 0;

  const avgSimpleSessionLength = simpleSessions.length > 0
    ? simpleSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / simpleSessions.length
    : 0;

  const pomodoroRevenue = pomodoroSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const simpleRevenue = simpleSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);

  const avgPomodoroQuality = pomodoroSessions.filter(s => s.quality_rating).length > 0
    ? pomodoroSessions.reduce((sum, s) => sum + (s.quality_rating || 0), 0) / 
      pomodoroSessions.filter(s => s.quality_rating).length
    : null;

  const avgSimpleQuality = simpleSessions.filter(s => s.quality_rating).length > 0
    ? simpleSessions.reduce((sum, s) => sum + (s.quality_rating || 0), 0) / 
      simpleSessions.filter(s => s.quality_rating).length
    : null;

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading Pomodoro data...</div>;
  }

  if (!pomodoroStats || pomodoroStats.totalPomodoros === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Pomodoro Sessions Yet</h3>
        <p className="text-gray-600 mb-6">
          Start using Pomodoro technique in your focus sessions to see effectiveness metrics here!
        </p>
        <button
          onClick={() => window.location.href = '/dashboard/engine/focus'}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Try Pomodoro Timer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Stats */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border-2 border-red-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-100 rounded-lg">
            <Target className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pomodoro Effectiveness</h2>
            <p className="text-sm text-gray-600">
              How well does structured work/break rhythm work for you?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <StatBox
            label="Total Pomodoros"
            value={pomodoroStats.totalPomodoros.toString()}
            icon="🍅"
            color="red"
          />
          <StatBox
            label="Avg Work Length"
            value={`${pomodoroStats.avgPomodoroLength.toFixed(0)}m`}
            icon="⏱️"
            color="indigo"
          />
          <StatBox
            label="Avg Break Length"
            value={`${pomodoroStats.avgBreakLength.toFixed(0)}m`}
            icon="☕"
            color="amber"
          />
          <StatBox
            label="Revenue"
            value={`$${pomodoroStats.revenue.toFixed(0)}`}
            icon="💰"
            color="lime"
          />
          {pomodoroStats.avgQuality && (
            <StatBox
              label="Avg Quality"
              value={`${pomodoroStats.avgQuality.toFixed(1)}/5`}
              icon="⭐"
              color="purple"
            />
          )}
        </div>
      </div>

      {/* What This Means */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-2">What This Means (6th Grade Explanation)</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <strong>Your average work interval:</strong> {pomodoroStats.avgPomodoroLength.toFixed(0)} minutes.{' '}
                {pomodoroStats.avgPomodoroLength < 20 && (
                  <span className="text-amber-700">Consider extending to 25 minutes—research shows that&apos;s the sweet spot for most people.</span>
                )}
                {pomodoroStats.avgPomodoroLength >= 20 && pomodoroStats.avgPomodoroLength <= 30 && (
                  <span className="text-lime-700">Perfect! This is right in the recommended 25-minute range.</span>
                )}
                {pomodoroStats.avgPomodoroLength > 30 && (
                  <span className="text-amber-700">You might be working too long without breaks. Try shortening to 25 minutes to maintain peak focus.</span>
                )}
              </p>
              
              <p>
                <strong>Your break length:</strong> {pomodoroStats.avgBreakLength.toFixed(0)} minutes.{' '}
                {pomodoroStats.avgBreakLength < 3 && (
                  <span className="text-amber-700">Your breaks are very short. Aim for 5 minutes to properly rest your brain.</span>
                )}
                {pomodoroStats.avgBreakLength >= 3 && pomodoroStats.avgBreakLength <= 10 && (
                  <span className="text-lime-700">Great! This gives your brain enough time to recharge.</span>
                )}
                {pomodoroStats.avgBreakLength > 10 && (
                  <span className="text-amber-700">Your breaks might be too long. Try keeping them under 10 minutes to maintain momentum.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pomodoro vs Simple Comparison */}
      {simpleSessions.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Pomodoro vs Regular Sessions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Does the Pomodoro technique help you perform better than regular focus sessions?
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pomodoro Card */}
            <ComparisonCard
              title="🍅 Pomodoro Sessions"
              stats={[
                { label: 'Sessions', value: pomodoroSessions.length },
                { 
                  label: 'Avg Duration', 
                  value: `${(avgPomodoroSessionLength / 60).toFixed(0)}m` 
                },
                { 
                  label: 'Total Revenue', 
                  value: `$${pomodoroRevenue.toFixed(0)}` 
                },
                { 
                  label: 'Avg Quality', 
                  value: avgPomodoroQuality ? `${avgPomodoroQuality.toFixed(1)}/5` : 'N/A' 
                },
              ]}
              highlight="red"
            />

            {/* Simple Card */}
            <ComparisonCard
              title="⏱️ Regular Sessions"
              stats={[
                { label: 'Sessions', value: simpleSessions.length },
                { 
                  label: 'Avg Duration', 
                  value: `${(avgSimpleSessionLength / 60).toFixed(0)}m` 
                },
                { 
                  label: 'Total Revenue', 
                  value: `$${simpleRevenue.toFixed(0)}` 
                },
                { 
                  label: 'Avg Quality', 
                  value: avgSimpleQuality ? `${avgSimpleQuality.toFixed(1)}/5` : 'N/A' 
                },
              ]}
              highlight="indigo"
            />
          </div>

          {/* Winner Analysis */}
          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
            <h4 className="font-bold text-gray-900 mb-2">📊 For Hiring Managers:</h4>
            <p className="text-sm text-gray-700">
              {avgPomodoroQuality && avgSimpleQuality && avgPomodoroQuality > avgSimpleQuality ? (
                <>
                  <strong>Pomodoro wins on quality:</strong> Sessions using Pomodoro technique have {((avgPomodoroQuality - avgSimpleQuality) / avgSimpleQuality * 100).toFixed(0)}% higher quality ratings. 
                  This structured approach produces better output.
                </>
              ) : avgPomodoroQuality && avgSimpleQuality && avgSimpleQuality > avgPomodoroQuality ? (
                <>
                  <strong>Regular sessions win on quality:</strong> Non-Pomodoro sessions have {((avgSimpleQuality - avgPomodoroQuality) / avgPomodoroQuality * 100).toFixed(0)}% higher quality ratings. 
                  Continuous work may suit this user&apos;s workflow better.
                </>
              ) : (
                <>
                  <strong>Quality is similar:</strong> Both approaches produce comparable quality. 
                  User flexibility between structured and unstructured work.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Work/Break Balance */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Work/Break Balance</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Work Time</span>
              <span className="font-semibold text-indigo-600">
                {pomodoroStats.avgPomodoroLength.toFixed(0)}m avg
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-indigo-600 h-3 rounded-full transition-all"
                style={{ 
                  width: `${(pomodoroStats.avgPomodoroLength / (pomodoroStats.avgPomodoroLength + pomodoroStats.avgBreakLength)) * 100}%` 
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Break Time</span>
              <span className="font-semibold text-amber-600">
                {pomodoroStats.avgBreakLength.toFixed(0)}m avg
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-amber-600 h-3 rounded-full transition-all"
                style={{ 
                  width: `${(pomodoroStats.avgBreakLength / (pomodoroStats.avgPomodoroLength + pomodoroStats.avgBreakLength)) * 100}%` 
                }}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Ratio: <span className="font-semibold text-gray-900">
                {(pomodoroStats.avgPomodoroLength / pomodoroStats.avgBreakLength).toFixed(1)}:1
              </span> (work:break)
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ideal ratio is around 5:1 (e.g., 25 min work / 5 min break)
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">💡 Optimization Tips</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-2">
            <span className="text-lg">👍</span>
            <p className="text-sm text-gray-700">
              <strong>What&apos;s working:</strong> You&apos;ve completed {pomodoroStats.totalPomodoros} pomodoros! 
              Keep the momentum going.
            </p>
          </li>
          
          {pomodoroStats.avgPomodoroLength < 20 && (
            <li className="flex items-start gap-2">
              <span className="text-lg">📈</span>
              <p className="text-sm text-gray-700">
                <strong>Try longer work periods:</strong> Aim for 25-minute work intervals. 
                Your brain needs 15-20 minutes to reach deep focus.
              </p>
            </li>
          )}

          {pomodoroStats.avgBreakLength < 3 && (
            <li className="flex items-start gap-2">
              <span className="text-lg">⏸️</span>
              <p className="text-sm text-gray-700">
                <strong>Take real breaks:</strong> 5-minute breaks help your brain consolidate information. 
                Stand up, stretch, look away from the screen.
              </p>
            </li>
          )}

          <li className="flex items-start gap-2">
            <span className="text-lg">🎯</span>
            <p className="text-sm text-gray-700">
              <strong>After 4 pomodoros:</strong> Take a longer 15-30 minute break to fully recharge.
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  icon: string;
  color: 'red' | 'indigo' | 'amber' | 'lime' | 'purple';
}

function StatBox({ label, value, icon, color }: StatBoxProps) {
  const bgColors = {
    red: 'bg-red-100',
    indigo: 'bg-indigo-100',
    amber: 'bg-amber-100',
    lime: 'bg-lime-100',
    purple: 'bg-purple-100',
  };

  return (
    <div className={`${bgColors[color]} rounded-lg p-4 text-center`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-xs text-gray-600 font-medium">{label}</div>
    </div>
  );
}

interface ComparisonCardProps {
  title: string;
  stats: Array<{ label: string; value: string | number }>;
  highlight: 'red' | 'indigo';
}

function ComparisonCard({ title, stats, highlight }: ComparisonCardProps) {
  const borderColors = {
    red: 'border-red-300',
    indigo: 'border-indigo-300',
  };

  const bgColors = {
    red: 'bg-red-50',
    indigo: 'bg-indigo-50',
  };

  return (
    <div className={`bg-white rounded-xl border-2 ${borderColors[highlight]} p-6 hover:shadow-lg transition`}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{stat.label}</span>
            <span className="text-lg font-bold text-gray-900">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
