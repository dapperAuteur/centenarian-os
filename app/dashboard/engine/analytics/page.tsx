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

/**
 * Tabbed Analytics Dashboard for Focus Sessions
 * Comprehensive insights with organized sections
 */
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
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

      setSessions(sessionsData.data || []);
      setUserProfile(profileData.data);
    } catch (err) {
      console.error('Load data error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Focus Analytics</h1>
          <p className="text-gray-600">Track productivity patterns and optimize performance</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center space-x-2 bg-white rounded-lg border border-gray-300 p-1 shadow-sm">
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group relative flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition
                    ${isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {!isActive && (
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-0 group-hover:opacity-100 transition" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
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

      {/* Quick Stats Footer (visible across all tabs) */}
      <div className="grid grid-cols-4 gap-4">
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
