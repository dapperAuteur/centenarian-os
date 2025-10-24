/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// app/dashboard/engine/analytics/components/PerformanceTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FocusSession } from '@/lib/types';
import {
  getTagInsights,
  getTemplateUsage,
  type TagInsight,
  type TemplateUsage,
} from '@/lib/utils/focusAnalytics';
import { PREDEFINED_TAGS, getTagColorClasses } from '@/lib/utils/tagUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Tag, FileText, Star, TrendingUp } from 'lucide-react';

interface PerformanceTabProps {
  sessions: FocusSession[];
  timeRange: string;
}

/**
 * Performance Tab: Analyze categories, templates, and quality ratings
 * For 6th graders: "See what types of work you do and how well you do them"
 * For managers: "Resource allocation and output quality metrics"
 */
export default function PerformanceTab({ sessions, timeRange }: PerformanceTabProps) {
  const [tagInsights, setTagInsights] = useState<TagInsight[]>([]);
  const [templateUsage, setTemplateUsage] = useState<TemplateUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadPerformanceData();
  }, [sessions]);

  const loadPerformanceData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (sessions.length === 0) {
      setTagInsights([]);
      setTemplateUsage([]);
      setLoading(false);
      return;
    }

    // Get date range
    const dates = sessions.map(s => new Date(s.start_time).getTime());
    const startDate = new Date(Math.min(...dates)).toISOString();
    const endDate = new Date(Math.max(...dates)).toISOString();

    const [tags, templates] = await Promise.all([
      getTagInsights(user.id, startDate, endDate),
      getTemplateUsage(user.id, startDate, endDate),
    ]);

    setTagInsights(tags);
    setTemplateUsage(templates);
    setLoading(false);
  };

  // Calculate quality stats
  const qualityRatings = sessions.filter(s => s.quality_rating).map(s => s.quality_rating!);
  const avgQuality = qualityRatings.length > 0
    ? qualityRatings.reduce((sum, q) => sum + q, 0) / qualityRatings.length
    : null;

  const qualityDistribution = [1, 2, 3, 4, 5].map(rating => ({
    rating,
    count: qualityRatings.filter(q => q === rating).length,
  }));

  // Predefined tags stats (for existing tag system)
  const predefinedTagStats = PREDEFINED_TAGS.map(tag => {
    const tagSessions = sessions.filter(s => s.tags && s.tags.includes(tag.id));
    const totalSeconds = tagSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    return {
      tag,
      sessionCount: tagSessions.length,
      totalSeconds,
      percentage: sessions.length > 0 ? (tagSessions.length / sessions.length) * 100 : 0,
    };
  }).filter(stat => stat.sessionCount > 0);

  const tagChartData = predefinedTagStats.map(stat => ({
    name: stat.tag.label,
    value: parseFloat((stat.totalSeconds / 3600).toFixed(2)),
    sessions: stat.sessionCount,
  }));

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16'];

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading performance data...</div>;
  }
  // const renderLabel = (props: { name: string; percent: number }) => {
  //   return `${props.name} ${(props.percent * 100).toFixed(0)}%`;
  // };

  return (
    <div className="space-y-8">
      {/* Tag-Based Insights */}
      {(tagInsights.length > 0 || predefinedTagStats.length > 0) && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Tag className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Work Categories</h2>
              <p className="text-sm text-gray-600">Where your time and effort go</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tag Breakdown List */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Time by Category</h3>
              
              {tagInsights.length > 0 ? (
                <div className="space-y-4">
                  {tagInsights.slice(0, 10).map((tag, idx) => {
                    const totalMinutes = Math.floor(tag.totalDuration / 60);
                    const maxDuration = Math.max(...tagInsights.map(t => t.totalDuration));
                    const percentage = (tag.totalDuration / maxDuration) * 100;

                    return (
                      <div key={tag.tag} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                            <span className="font-semibold text-gray-900">{tag.tag}</span>
                            <span className="text-xs text-gray-500">({tag.count} sessions)</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-indigo-600">{totalMinutes}m</p>
                            {tag.avgQuality && (
                              <p className="text-xs text-purple-600">⭐ {tag.avgQuality.toFixed(1)}</p>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : predefinedTagStats.length > 0 ? (
                <div className="space-y-3">
                  {predefinedTagStats
                    .sort((a, b) => b.totalSeconds - a.totalSeconds)
                    .map(stat => {
                      const colors = getTagColorClasses(stat.tag.color);
                      return (
                        <div
                          key={stat.tag.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
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
                              {(stat.totalSeconds / 3600).toFixed(1)}h
                            </p>
                            <p className="text-xs text-gray-500">
                              {stat.percentage.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  No tagged sessions yet. Add tags to sessions to see category breakdown!
                </p>
              )}
            </div>

            {/* Tag Pie Chart */}
            {tagChartData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Time Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
  data={tagChartData}
  cx="50%"
  cy="50%"
  labelLine={false}
  label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
  outerRadius={80}
  fill="#8884d8"
  dataKey="value"
>
  {tagChartData.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
  ))}
</Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>📊 For Hiring Managers:</strong> This breakdown shows resource allocation. 
              If &quot;meetings&quot; dominate, reduce collaborative overhead. 
              If &quot;deep work&quot; is low, protect focused time blocks.
            </p>
          </div>
        </div>
      )}

      {/* Template Usage */}
      {templateUsage.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Template Performance</h2>
              <p className="text-sm text-gray-600">Which workflows produce the best results</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Template
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Usage
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Total Time
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Avg Quality
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Last Used
                  </th>
                </tr>
              </thead>
              <tbody>
                {templateUsage.map((template) => (
                  <tr key={template.templateId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {template.templateName}
                    </td>
                    <td className="text-center py-3 px-4 text-gray-700">
                      {template.useCount}×
                    </td>
                    <td className="text-center py-3 px-4 text-indigo-600 font-semibold">
                      {(template.totalDuration / 3600).toFixed(1)}h
                    </td>
                    <td className="text-center py-3 px-4">
                      {template.avgQuality ? (
                        <span className="text-purple-600 font-semibold">
                          ⭐ {template.avgQuality.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-500">
                      {new Date(template.lastUsed).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-900">
              <strong>💡 What This Means:</strong> Templates with high usage + high quality are your 
              &quot;winning formulas.&quot; Create more templates like these. Templates with low quality should be 
              reviewed and improved.
            </p>
          </div>
        </div>
      )}

      {/* Quality Ratings */}
      {qualityRatings.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quality Self-Assessment</h2>
              <p className="text-sm text-gray-600">How you rate your output quality</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Quality */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-amber-600 mb-2">
                  {avgQuality?.toFixed(1)}
                </div>
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  Average Quality Rating
                </div>
                <div className="text-sm text-gray-600">
                  Based on {qualityRatings.length} rated sessions
                </div>
                <div className="mt-4 flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${
                        star <= (avgQuality || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Quality Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Rating Distribution</h3>
              <div className="space-y-3">
                {qualityDistribution.reverse().map(({ rating, count }) => {
                  const percentage = qualityRatings.length > 0
                    ? (count / qualityRatings.length) * 100
                    : 0;

                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-20">
                        {[...Array(rating)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-amber-500 h-3 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-700 w-16 text-right">
                        {count} ({percentage.toFixed(0)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-900">
              <strong>⭐ For Vendors:</strong> Quality ratings help you communicate output confidence to clients. 
              Low ratings? Allocate more time. High ratings? Use as portfolio evidence of consistent quality.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {tagInsights.length === 0 && predefinedTagStats.length === 0 && 
       templateUsage.length === 0 && qualityRatings.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Performance Data Yet</h3>
          <p className="text-gray-600 mb-6">
            Start adding tags, using templates, and rating session quality to see insights here!
          </p>
        </div>
      )}
    </div>
  );
}
