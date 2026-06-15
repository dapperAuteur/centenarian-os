'use client';

// app/admin/academy/lead-funnel/page.tsx
// Admin dashboard: academy lead funnel. Shows free-download volume, optional emails
// captured, and how many of those lead sessions became signups and enrollments, so BAM
// can see what converts. Admin route is guarded by the admin layout/middleware.

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts';

interface FunnelData {
  summary: { downloads: number; emails: number; downloadSessions: number; leadsSignedUp: number; leadsEnrolled: number };
  byDocument: { document: string; count: number }[];
  daily: { date: string; count: number }[];
}

export default function LeadFunnelPage() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/academy/lead-funnel')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load'))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-sm text-red-600" role="alert">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-500" role="status">Loading lead funnel…</div>;

  const s = data.summary;
  const funnel = [
    { stage: 'Downloads', count: s.downloads },
    { stage: 'Emails', count: s.emails },
    { stage: 'Signed up', count: s.leadsSignedUp },
    { stage: 'Enrolled', count: s.leadsEnrolled },
  ];
  const cards = [
    { label: 'Downloads', value: s.downloads },
    { label: 'Download sessions', value: s.downloadSessions },
    { label: 'Emails captured', value: s.emails },
    { label: 'Signed up (from leads)', value: s.leadsSignedUp },
    { label: 'Enrolled (from leads)', value: s.leadsEnrolled },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Academy Lead Funnel</h1>
      <p className="text-sm text-gray-500 mb-6">
        Free-download activity and how it converts to signups and enrollments. Lead emails
        are optional, so the email count is lower than downloads by design.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-sky-600">{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Funnel</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="stage" fontSize={12} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#0284c7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Downloads by document</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byDocument} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="document" fontSize={11} width={160} />
              <Tooltip />
              <Bar dataKey="count" fill="#d946ef" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Downloads over time</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0284c7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
