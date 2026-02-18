'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Eye, BarChart2, Share2 } from 'lucide-react';
import type { BlogEvent, BlogPost } from '@/lib/types';

interface BlogAnalyticsProps {
  userId: string;
}

interface DayBucket { date: string; views: number; [key: string]: unknown }
interface DepthBucket { label: string; count: number; [key: string]: unknown }
interface ShareBucket { name: string; value: number; [key: string]: unknown }
interface ReferrerRow { referrer: string; count: number }

const SHARE_COLORS = ['#0ea5e9', '#6366f1', '#22c55e'];

function groupByDay(events: BlogEvent[]): DayBucket[] {
  const map = new Map<string, number>();
  events.forEach((e) => {
    const day = e.created_at.slice(0, 10);
    map.set(day, (map.get(day) || 0) + 1);
  });

  // Fill last 30 days
  const result: DayBucket[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key.slice(5), views: map.get(key) || 0 });
  }
  return result;
}

function groupByDepth(events: BlogEvent[]): DepthBucket[] {
  const counts = { view: 0, read_25: 0, read_50: 0, read_75: 0, read_100: 0 };
  events.forEach((e) => {
    if (e.event_type in counts) counts[e.event_type as keyof typeof counts]++;
  });
  return [
    { label: 'Views', count: counts.view },
    { label: '25%', count: counts.read_25 },
    { label: '50%', count: counts.read_50 },
    { label: '75%', count: counts.read_75 },
    { label: '100%', count: counts.read_100 },
  ];
}

function groupByShare(events: BlogEvent[]): ShareBucket[] {
  const copy = events.filter((e) => e.event_type === 'share_copy').length;
  const email = events.filter((e) => e.event_type === 'share_email').length;
  const linkedin = events.filter((e) => e.event_type === 'share_linkedin').length;
  return [
    { name: 'Copy link', value: copy },
    { name: 'Email', value: email },
    { name: 'LinkedIn', value: linkedin },
  ].filter((b) => b.value > 0);
}

function topReferrers(events: BlogEvent[]): ReferrerRow[] {
  const map = new Map<string, number>();
  events.forEach((e) => {
    const ref = e.referrer?.trim() || '(direct)';
    map.set(ref, (map.get(ref) || 0) + 1);
  });
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([referrer, count]) => ({ referrer, count }));
}

export default function BlogAnalytics({ userId }: BlogAnalyticsProps) {
  const [events, setEvents] = useState<BlogEvent[]>([]);
  const [posts, setPosts] = useState<Pick<BlogPost, 'id' | 'title' | 'view_count' | 'published_at'>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch user's posts
      const { data: postData } = await supabase
        .from('blog_posts')
        .select('id, title, view_count, published_at')
        .eq('user_id', userId)
        .order('published_at', { ascending: false });

      setPosts(postData || []);

      if (!postData?.length) {
        setLoading(false);
        return;
      }

      const postIds = postData.map((p) => p.id);
      const since = new Date();
      since.setDate(since.getDate() - 30);

      // Fetch events for user's posts in last 30 days
      const { data: eventData } = await supabase
        .from('blog_events')
        .select('*')
        .in('post_id', postIds)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      setEvents(eventData || []);
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">Loading analytics…</div>
    );
  }

  if (!posts.length) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No posts yet. Publish your first post to see analytics.
      </div>
    );
  }

  const viewEvents = events.filter((e) => e.event_type === 'view');
  const totalViews = posts.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const totalShares = events.filter((e) => e.event_type.startsWith('share_')).length;
  const dayBuckets = groupByDay(viewEvents);
  const depthBuckets = groupByDepth(events);
  const shareBuckets = groupByShare(events);
  const referrers = topReferrers(events);

  return (
    <div className="space-y-8 py-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total views', value: totalViews, icon: <Eye className="w-5 h-5 text-sky-500" /> },
          { label: 'Posts', value: posts.length, icon: <BarChart2 className="w-5 h-5 text-indigo-500" /> },
          { label: 'Views (30d)', value: viewEvents.length, icon: <TrendingUp className="w-5 h-5 text-green-500" /> },
          { label: 'Shares (30d)', value: totalShares, icon: <Share2 className="w-5 h-5 text-orange-500" /> },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">{card.icon}<span className="text-xs text-gray-500">{card.label}</span></div>
            <div className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Views over time */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Views — last 30 days</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dayBuckets}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={30} />
            <Tooltip />
            <Line type="monotone" dataKey="views" stroke="#0ea5e9" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Read depth funnel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Read depth funnel</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={depthBuckets} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={40} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Share breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Share breakdown</h3>
          {shareBuckets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No share events yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={shareBuckets} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                  {shareBuckets.map((_, i) => (
                    <Cell key={i} fill={SHARE_COLORS[i % SHARE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top referrers */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top referrers (30d)</h3>
        {referrers.length === 0 ? (
          <p className="text-sm text-gray-400">No referrer data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium text-right">Views</th>
              </tr>
            </thead>
            <tbody>
              {referrers.map((row) => (
                <tr key={row.referrer} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-700 truncate max-w-xs">{row.referrer}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top posts */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Posts by all-time views</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">Title</th>
              <th className="pb-2 font-medium text-right">Views</th>
            </tr>
          </thead>
          <tbody>
            {[...posts].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).map((post) => (
              <tr key={post.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-gray-700 truncate max-w-xs">{post.title}</td>
                <td className="py-2 text-right text-gray-900 font-medium">{post.view_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
