/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/dashboard/analytics/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { CorrelationEngine, Correlation } from '@/lib/analytics/correlation-engine';
import { TrendingUp, Activity, Brain, Zap, AlertCircle } from 'lucide-react';

export default function AnalyticsPage() {
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [moduleStats, setModuleStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(30);
  

  useEffect(() => {
    const engine = new CorrelationEngine();
    const loadAnalytics = async () => {
    setLoading(true);
    
    const [corrs, stats] = await Promise.all([
      engine.findCorrelations(),
      engine.getModuleStats(timeRange)
    ]);

    setCorrelations(corrs);
    setModuleStats(stats);
    setLoading(false);
  };

    loadAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Analytics Engine</h1>
          <p className="text-gray-600">Auto-detected patterns across your journey</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex-shrink-0 w-full md:w-auto flex gap-2">
          {[30, 60, 90].map(days => (
            <button
              key={days}
              onClick={() => setTimeRange(days as 30 | 60 | 90)}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-medium transition ${
                timeRange === days
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </header>

      {/* Correlation Insights */}
      <section>
        <div className="flex items-center mb-6">
          <Brain className="w-8 h-8 text-fuchsia-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Discovered Correlations</h2>
            <p className="text-sm text-gray-600">Patterns detected by the engine</p>
          </div>
        </div>

        {correlations.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Not enough data yet</h3>
            <p className="text-gray-600">
              Continue logging for {30 - (moduleStats?.planner?.total_tasks || 0)} more days to detect patterns.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {correlations.map(corr => (
              <CorrelationCard key={corr.id} correlation={corr} />
            ))}
          </div>
        )}
      </section>

      {/* Module Breakdowns */}
      {moduleStats && (
        <>
          {/* Planner Stats */}
          <ModuleStatsCard
            title="Planner Performance"
            icon={<TrendingUp className="w-6 h-6" />}
            color="sky"
            stats={[
              { label: 'Completion Rate', value: `${moduleStats.planner.avg_completion_rate.toFixed(0)}%` },
              { label: 'Tasks Completed', value: moduleStats.planner.total_tasks_completed },
              { label: 'Current Streak', value: `${moduleStats.planner.streak} days` },
            ]}
          />

          {/* Fuel Stats */}
          <ModuleStatsCard
            title="Fuel Quality"
            icon={<Activity className="w-6 h-6" />}
            color="lime"
            stats={[
              { label: 'Green Days', value: `${moduleStats.fuel.green_days_percentage.toFixed(0)}%` },
              { label: 'Total Meals', value: moduleStats.fuel.total_meals },
              { label: 'Weekly Cost', value: `$${(moduleStats.fuel.total_cost / (timeRange / 7)).toFixed(0)}` },
            ]}
          />

          {/* Engine Stats */}
          <ModuleStatsCard
            title="Focus & Energy"
            icon={<Zap className="w-6 h-6" />}
            color="amber"
            stats={[
              { label: 'Total Focus Hours', value: moduleStats.engine.total_focus_hours.toFixed(1) },
              { label: 'Avg Energy Rating', value: `${moduleStats.engine.avg_energy_rating.toFixed(1)}/5` },
              { label: 'Sessions/Day', value: moduleStats.engine.avg_sessions_per_day.toFixed(1) },
            ]}
          />

          {/* Body Stats */}
          <ModuleStatsCard
            title="Body Tracking"
            icon={<Activity className="w-6 h-6" />}
            color="red"
            stats={[
              { label: 'Avg Pain Score', value: `${moduleStats.body.avg_pain_score.toFixed(1)}/10` },
              { label: 'Pain-Free Days', value: `${moduleStats.body.pain_free_percentage.toFixed(0)}%` },
              { label: 'Total Logged', value: moduleStats.body.pain_free_days + Math.ceil(moduleStats.body.avg_pain_score) },
            ]}
          />
        </>
      )}

      {/* Export Section */}
      <section className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Data Export</h3>
        <div className="flex space-x-4">
          <button
            onClick={async () => {
              const data = { correlations, moduleStats };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
            }}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
          >
            Export JSON
          </button>
          <button
            onClick={async () => {
              // CSV export logic
              alert('CSV export coming in Phase 2');
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Export CSV
          </button>
        </div>
      </section>
    </div>
  );
}

// ===== Sub-Components =====

function CorrelationCard({ correlation }: { correlation: Correlation }) {
  const getCategoryColor = (category: Correlation['category']) => {
    const colors = {
      nutrition: 'lime',
      focus: 'sky',
      pain: 'red',
      completion: 'amber',
      energy: 'fuchsia',
    };
    return colors[category];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-lime-600';
    if (confidence >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const color = getCategoryColor(correlation.category);

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-l-4 border-${color}-500`}>
      <div className="flex items-start justify-between mb-3">
        <span className={`px-3 py-1 bg-${color}-100 text-${color}-700 text-xs font-bold uppercase rounded-full`}>
          {correlation.category}
        </span>
        <div className="text-right">
          <div className={`text-2xl font-bold ${getConfidenceColor(correlation.confidence)}`}>
            {correlation.confidence}%
          </div>
          <div className="text-xs text-gray-500">confidence</div>
        </div>
      </div>

      <p className="text-gray-900 font-medium mb-2">{correlation.insight}</p>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div>
          <div className="text-xs text-gray-500">Sample Size</div>
          <div className="font-semibold text-gray-900">{correlation.sample_size} days</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Impact</div>
          <div className={`font-semibold ${correlation.improvement_percentage > 0 ? 'text-lime-600' : 'text-red-600'}`}>
            {correlation.improvement_percentage > 0 ? '+' : ''}{correlation.improvement_percentage.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs font-semibold text-gray-700 mb-1">💡 Suggestion</div>
        <p className="text-sm text-gray-600">{correlation.suggestion}</p>
      </div>
    </div>
  );
}

interface ModuleStatsCardProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  stats: Array<{ label: string; value: string | number }>;
}

function ModuleStatsCard({ title, icon, color, stats }: ModuleStatsCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-t-4 border-${color}-500`}>
      <div className="flex items-center mb-4">
        <div className={`p-2 bg-${color}-100 text-${color}-600 rounded-lg mr-3`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}