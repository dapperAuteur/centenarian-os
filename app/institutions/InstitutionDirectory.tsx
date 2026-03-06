'use client';

// app/institutions/InstitutionDirectory.tsx
// Client component for the public institution directory with search.

import { useEffect, useState, useCallback } from 'react';
import { Search, Building2, Loader2, Users, CreditCard, PiggyBank } from 'lucide-react';
import Link from 'next/link';
import InstitutionDisclosure from '@/components/finance/InstitutionDisclosure';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Institution {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  avg_checking_apr: number | null;
  avg_savings_apr: number | null;
  avg_credit_card_apr: number | null;
  avg_loan_apr: number | null;
  avg_credit_limit: number | null;
  known_dispute_window_days: number | null;
  rewards_summary: string | null;
  account_count: number;
}

export default function InstitutionDirectory() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await offlineFetch(`/api/institutions${qs}`);
      if (res.ok) setInstitutions(await res.json());
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-fuchsia-600" />
          Financial Institutions
        </h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Compare rates, fees, rewards, and policies across institutions.
          Data is community-sourced and anonymized.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search institutions..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
        </div>
      ) : institutions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>No institutions found{query ? ` matching "${query}"` : ''}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {institutions.map((inst) => (
            <Link
              key={inst.id}
              href={`/institutions/${inst.slug}`}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-fuchsia-200 transition group"
            >
              <div className="flex items-center gap-3 mb-3">
                {inst.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inst.logo_url} alt={inst.name} className="w-10 h-10 rounded-lg object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-fuchsia-600 transition">{inst.name}</h3>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {inst.account_count} user{inst.account_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {inst.avg_credit_card_apr != null && (
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-gray-600">CC APR: {inst.avg_credit_card_apr}%</span>
                  </div>
                )}
                {inst.avg_savings_apr != null && (
                  <div className="flex items-center gap-1.5">
                    <PiggyBank className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-gray-600">Savings: {inst.avg_savings_apr}%</span>
                  </div>
                )}
                {inst.known_dispute_window_days != null && (
                  <div className="text-gray-500 text-xs">Dispute: {inst.known_dispute_window_days}d</div>
                )}
                {inst.rewards_summary && (
                  <div className="text-gray-500 text-xs truncate">{inst.rewards_summary}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <InstitutionDisclosure variant="banner" />
    </div>
  );
}
