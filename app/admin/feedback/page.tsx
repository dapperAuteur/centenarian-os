'use client';

// app/admin/feedback/page.tsx
// Admin view: user feedback submissions with category chart and table.

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Bug, Lightbulb, MessageSquare } from 'lucide-react';

interface FeedbackEntry {
  id: string;
  category: 'bug' | 'feature' | 'general';
  message: string;
  created_at: string;
  user_id: string;
}

const CATEGORY_CONFIG = {
  bug:     { label: 'Bug Reports',      color: '#ef4444', icon: Bug,            badgeClass: 'bg-red-900/30 text-red-300' },
  feature: { label: 'Feature Requests', color: '#a855f7', icon: Lightbulb,      badgeClass: 'bg-purple-900/30 text-purple-300' },
  general: { label: 'General',          color: '#6b7280', icon: MessageSquare,   badgeClass: 'bg-gray-800 text-gray-400' },
};

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/feedback')
      .then((r) => r.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const counts = {
    bug:     items.filter((i) => i.category === 'bug').length,
    feature: items.filter((i) => i.category === 'feature').length,
    general: items.filter((i) => i.category === 'general').length,
  };

  const chartData = Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    count: counts[key as keyof typeof counts],
    fill: cfg.color,
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">User Feedback</h1>
      <p className="text-gray-400 text-sm mb-8">{items.length} total submissions</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <Icon className="w-5 h-5 mx-auto mb-2" style={{ color: cfg.color }} />
              <p className="text-2xl font-bold text-white">{counts[key as keyof typeof counts]}</p>
              <p className="text-gray-500 text-xs mt-1">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      {items.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
          <h2 className="font-semibold text-white mb-4">By Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <rect key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feedback table */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No feedback submitted yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-500 font-medium w-32">Category</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Message</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium w-36">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cfg = CATEGORY_CONFIG[item.category];
                return (
                  <tr key={item.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badgeClass}`}>
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-300 max-w-sm">
                      <p className="line-clamp-2">{item.message}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
