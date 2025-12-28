// app/dashboard/engine/analytics/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession, UserProfile } from '@/lib/types';
import { BarChart3, TrendingUp, Target, Award } from 'lucide-react';
import OverviewTab from './components/OverviewTab';
import TrendsTab from './components/TrendsTab';
import PomodoroTab from './components/PomodoroTab';
import PerformanceTab from './components/PerformanceTab';

type Tab = 'overview' | 'trends' | 'pomodoro' | 'performance';
type TimeRange = '7d' | '30d' | '90d' | 'all';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Separate metrics for focus vs work sessions
  const [focusMetrics, setFocusMetrics] = useState({
    totalMinutes: 0,
    avgQuality: 0,
    sessionCount: 0,
  });

  const [workMetrics, setWorkMetrics] = useState({
    totalMinutes: 0,
    totalRevenue: 0,
    sessionCount: 0,
  });

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [sessionsData, profileData] = await Promise.all([
        supabase
          .from('focus_sessions')
          .select('*')
          .order('start_time', { ascending: false }),
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
      ]);

      if (sessionsData.error) throw sessionsData.error;

      const allSessions = sessionsData.data || [];
      setSessions(allSessions);
      setUserProfile(profileData.data);

      // Calculate separate metrics
      calculateMetrics(allSessions);
    } catch (err) {
      console.error('Load data error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const calculateMetrics = (allSessions: FocusSession[]) => {
    // Filter completed sessions
    const completedSessions = allSessions.filter(s => s.end_time && s.duration);

    // Separate by session type (default to 'focus' for backward compatibility)
    const focusSessions = completedSessions.filter(s => s.session_type === 'focus' || !s.session_type);
    const workSessions = completedSessions.filter(s => s.session_type === 'work');

    // Calculate focus metrics
    const focusMinutes = focusSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
    const focusWithQuality = focusSessions.filter(s => s.quality_rating);
    const avgQuality = focusWithQuality.length > 0
      ? focusWithQuality.reduce((sum, s) => sum + (s.quality_rating || 0), 0) / focusWithQuality.length
      : 0;

    setFocusMetrics({
      totalMinutes: focusMinutes,
      avgQuality,
      sessionCount: focusSessions.length,
    });

    // Calculate work metrics
    const workMinutes = workSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
    const workRevenue = workSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);

    setWorkMetrics({
      totalMinutes: workMinutes,
      totalRevenue: workRevenue,
      sessionCount: workSessions.length,
    });
  };

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

  const tabs = [
    { 
      id: 'overview' as Tab, 
      label: 'Overview', 
      icon: BarChart3,
      description: 'Key metrics and goal progress'
    },
    { 
      id: 'trends' as Tab, 
      label: 'Trends', 
      icon: TrendingUp,
      description: 'Charts and patterns over time'
    },
    { 
      id: 'pomodoro' as Tab, 
      label: 'Pomodoro', 
      icon: Target,
      description: 'Work/break effectiveness'
    },
    { 
      id: 'performance' as Tab, 
      label: 'Performance', 
      icon: Award,
      description: 'Tags, templates & quality'
    },
  ];

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">Focus Analytics</h1>
          <p className="text-gray-600">Track productivity patterns and optimize performance</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center space-x-2 bg-white rounded-lg border border-gray-300 p-1 shadow-sm mt-4">
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Focus vs Work Session Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Focus Time Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl shadow-lg border border-indigo-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-indigo-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-indigo-900">Focus Time</h3>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-4xl font-bold text-indigo-600">
                {Math.floor(focusMetrics.totalMinutes / 60)}h {Math.round(focusMetrics.totalMinutes % 60)}m
              </p>
              <p className="text-sm text-gray-600">{focusMetrics.sessionCount} sessions</p>
            </div>
            
            {focusMetrics.avgQuality > 0 && (
              <div className="pt-2 border-t border-indigo-200">
                <p className="text-sm text-gray-700">
                  Avg Quality: <span className="font-bold text-indigo-600">
                    {focusMetrics.avgQuality.toFixed(1)} ⭐
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Work Time Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-lg border border-green-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-green-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-green-900">Work Time</h3>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-4xl font-bold text-green-600">
                {Math.floor(workMetrics.totalMinutes / 60)}h {Math.round(workMetrics.totalMinutes % 60)}m
              </p>
              <p className="text-sm text-gray-600">{workMetrics.sessionCount} sessions</p>
            </div>
            
            {workMetrics.totalRevenue > 0 && (
              <div className="pt-2 border-t border-green-200">
                <p className="text-sm text-gray-700">
                  Revenue: <span className="font-bold text-green-600">
                    ${workMetrics.totalRevenue.toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="grid grid-cols-2 sm:grid-cols-4" aria-label="Tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group relative py-4 px-4 text-center text-sm font-medium hover:bg-gray-50 transition-all
                    ${isActive
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {activeTab === 'overview' && (
            <OverviewTab
              sessions={filteredSessions}
              userProfile={userProfile}
              timeRange={timeRange}
            />
          )}
          
          {activeTab === 'trends' && (
            <TrendsTab
              sessions={filteredSessions}
              timeRange={timeRange}
            />
          )}
          
          {activeTab === 'pomodoro' && (
            <PomodoroTab
              sessions={filteredSessions}
              timeRange={timeRange}
            />
          )}
          
          {activeTab === 'performance' && (
            <PerformanceTab
              sessions={filteredSessions}
              timeRange={timeRange}
            />
          )}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-sm text-gray-600">Total Sessions</div>
          <div className="text-2xl font-bold text-indigo-600">{filteredSessions.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-sm text-gray-600">Total Hours</div>
          <div className="text-2xl font-bold text-purple-600">
            {(filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 3600).toFixed(1)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-sm text-gray-600">Pomodoros</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredSessions
              .filter(s => s.pomodoro_mode)
              .reduce((sum, s) => sum + (s.work_intervals?.length || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-sm text-gray-600">Revenue</div>
          <div className="text-2xl font-bold text-lime-600">
            ${filteredSessions.reduce((sum, s) => sum + (s.revenue || 0), 0).toFixed(0)}
          </div>
        </div>
      </div>
    </div>
  );
}