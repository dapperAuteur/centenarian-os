'use client';

// app/admin/seo/page.tsx
// Admin SEO performance dashboard for CentenarianOS.
// Data is filtered to app='centenarian' so it does not include Work.WitUS data.

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Globe, RefreshCw, Image as ImageIcon, Share2, FileSearch, CheckCircle, ExternalLink } from 'lucide-react';

interface SeoStats {
  og_renders: {
    total: number;
    last_7d: number;
    last_30d: number;
    top_items: { key: string; og_renders: number; type: string }[];
  };
  social_referrals: {
    total: number;
    last_7d: number;
    last_30d: number;
    by_source: Record<string, number>;
    recent: { source: string; path: string; created_at: string }[];
  };
  content_shares: {
    total_30d: number;
    by_platform: Record<string, number>;
    by_type: Record<string, number>;
  };
  page_view_referrers: {
    by_source: Record<string, number>;
    total_social_30d: number;
  };
  sitemap_coverage: {
    profiles: number;
    blog_posts: number;
    recipes: number;
    courses: number;
    institutions: number;
    static_pages: number;
    total: number;
  };
}

const SOURCE_COLORS: Record<string, string> = {
  twitter: '#1d9bf0',
  linkedin: '#0a66c2',
  facebook: '#1877f2',
  instagram: '#e1306c',
  other: '#6b7280',
};

const OG_COVERAGE = [
  { page: 'Homepage (/)', done: true },
  { page: 'Pricing', done: true },
  { page: 'Features index', done: true },
  { page: 'Feature detail pages', done: true },
  { page: 'Academy', done: true },
  { page: 'Academy teacher profiles', done: true },
  { page: 'Blog listing', done: true },
  { page: 'Author blog archive', done: true },
  { page: 'Blog post detail', done: true },
  { page: 'Recipes listing', done: false },
  { page: 'Cook profile page', done: true },
  { page: 'Recipe detail', done: true },
  { page: 'Public profile', done: true },
  { page: 'Certificate of completion', done: true },
  { page: 'Institution detail', done: true },
];

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function typeLabel(type: string, key: string): string {
  if (type === 'blog') return key.replace('blog:', '');
  if (type === 'certificate') return `cert ${key.replace('cert:', '').slice(0, 8)}`;
  return key; // profile username
}

export default function AdminSeoPage() {
  const [data, setData] = useState<SeoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/seo/stats');
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sourceBarData = data
    ? Object.entries(data.social_referrals.by_source).map(([src, count]) => ({ source: src, count }))
    : [];

  const pvBarData = data
    ? Object.entries(data.page_view_referrers.by_source).map(([src, count]) => ({ source: src, count }))
    : [];

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-sky-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white">SEO & Social Performance</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm transition disabled:opacity-50 min-h-11"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div role="status" aria-label="Loading..." className="flex items-center gap-3 text-gray-400 py-12">
          <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
          Loading SEO stats…
        </div>
      )}

      {data && (
        <>
          {/* ── Section 1: OG Image Renders ───────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-fuchsia-400" aria-hidden="true" />
              OG Image Renders
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Each render is a proxy for a social share — platforms fetch OG images when links are posted.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard label="Last 7 days" value={data.og_renders.last_7d} />
              <StatCard label="Last 30 days" value={data.og_renders.last_30d} />
              <StatCard label="All time" value={data.og_renders.total} />
            </div>
            {data.og_renders.top_items.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Item</th>
                      <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Type</th>
                      <th className="text-right text-gray-400 px-4 py-2.5 font-medium">Renders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.og_renders.top_items.map((item) => (
                      <tr key={item.key} className="border-b border-gray-700/50 last:border-0">
                        <td className="px-4 py-2.5 text-gray-200 font-mono text-xs">{typeLabel(item.type, item.key)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.type === 'profile' ? 'bg-fuchsia-900/40 text-fuchsia-300' :
                            item.type === 'blog' ? 'bg-sky-900/40 text-sky-300' :
                            'bg-purple-900/40 text-purple-300'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-white font-semibold">{item.og_renders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Section 2: Social Referral Traffic ───────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-sky-400" aria-hidden="true" />
              Social Referral Traffic
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard label="Last 7 days" value={data.social_referrals.last_7d} />
              <StatCard label="Last 30 days" value={data.social_referrals.last_30d} />
              <StatCard label="All time" value={data.social_referrals.total} />
            </div>
            {sourceBarData.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">By Platform (all time)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={sourceBarData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="source" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {data.social_referrals.recent.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <p className="text-gray-400 text-xs uppercase tracking-wide px-4 py-2.5 border-b border-gray-700">Recent Referrals</p>
                <ul role="list">
                  {data.social_referrals.recent.slice(0, 10).map((r, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700/50 last:border-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: SOURCE_COLORS[r.source] ?? '#6b7280' }}
                        aria-hidden="true"
                      />
                      <span className="text-sky-400 text-xs font-medium w-16 shrink-0">{r.source}</span>
                      <span className="text-gray-300 text-sm font-mono flex-1 truncate">{r.path}</span>
                      <span className="text-gray-500 text-xs shrink-0">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── Section 3: Content Shares ─────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-fuchsia-400" aria-hidden="true" />
              Content Shares (last 30 days)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">By Platform</p>
                {Object.keys(data.content_shares.by_platform).length === 0 ? (
                  <p className="text-gray-500 text-sm">No share events yet.</p>
                ) : (
                  <ul role="list" className="space-y-2">
                    {Object.entries(data.content_shares.by_platform)
                      .sort((a, b) => b[1] - a[1])
                      .map(([platform, count]) => (
                        <li key={platform} className="flex items-center justify-between">
                          <span className="text-gray-300 text-sm capitalize">{platform}</span>
                          <span className="text-white font-semibold">{count}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">By Content Type</p>
                {Object.keys(data.content_shares.by_type).length === 0 ? (
                  <p className="text-gray-500 text-sm">No share events yet.</p>
                ) : (
                  <ul role="list" className="space-y-2">
                    {Object.entries(data.content_shares.by_type)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <li key={type} className="flex items-center justify-between">
                          <span className="text-gray-300 text-sm capitalize">{type}</span>
                          <span className="text-white font-semibold">{count}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* ── Section 4: Organic Referrers from Page Views ─────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Organic Social Referrers
              <span className="text-gray-500 font-normal text-sm ml-2">(from page_views — last 30 days)</span>
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Visits detected via HTTP referrer header — captures social clicks even without OG image renders.
              Total: <span className="text-sky-400 font-semibold">{data.page_view_referrers.total_social_30d}</span>
            </p>
            {pvBarData.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={pvBarData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="source" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                    <Bar dataKey="count" fill="#c026d3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ── Section 5: Sitemap Coverage ───────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-sky-400" aria-hidden="true" />
              Sitemap Coverage
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Profiles', value: data.sitemap_coverage.profiles },
                { label: 'Blog Posts', value: data.sitemap_coverage.blog_posts },
                { label: 'Recipes', value: data.sitemap_coverage.recipes },
                { label: 'Courses', value: data.sitemap_coverage.courses },
                { label: 'Institutions', value: data.sitemap_coverage.institutions },
                { label: 'Static Pages', value: data.sitemap_coverage.static_pages },
              ].map(({ label, value }) => (
                <StatCard key={label} label={label} value={value} />
              ))}
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Total indexed URLs</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-white">{data.sitemap_coverage.total.toLocaleString()}</span>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 text-sm transition"
                >
                  View sitemap <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          {/* ── Section 6: OG Tag Coverage Checklist ─────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-sky-400" aria-hidden="true" />
              OG Tag Coverage
            </h2>
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <ul role="list">
                {OG_COVERAGE.map(({ page, done }) => (
                  <li
                    key={page}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700/50 last:border-0"
                  >
                    <span
                      className={`w-4 h-4 rounded-full border-2 shrink-0 ${done ? 'bg-sky-500 border-sky-500' : 'border-gray-600'}`}
                      aria-hidden="true"
                    />
                    <span className={`text-sm ${done ? 'text-gray-200' : 'text-gray-500'}`}>{page}</span>
                    {done ? (
                      <span className="ml-auto text-xs text-sky-400 font-medium">✓ done</span>
                    ) : (
                      <span className="ml-auto text-xs text-gray-600">pending</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
