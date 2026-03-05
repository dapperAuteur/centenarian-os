'use client';

// app/institutions/[slug]/InstitutionDetail.tsx
// Client component for institution detail — rates, policies, offers.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Building2, Loader2, CreditCard, PiggyBank,
  Shield, RotateCcw, Gift, ExternalLink, Clock, Users,
} from 'lucide-react';
import Link from 'next/link';
import InstitutionDisclosure from '@/components/finance/InstitutionDisclosure';

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
  common_monthly_fees: { account_type: string; fee_amount: number }[] | null;
  avg_credit_limit: number | null;
  known_dispute_window_days: number | null;
  known_return_days: number | null;
  rewards_summary: string | null;
  account_count: number;
  last_aggregated_at: string | null;
}

interface Offer {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  offer_type: string;
  details: Record<string, unknown> | null;
  expires_at: string | null;
  url: string | null;
  short_link_url: string | null;
}

const OFFER_TYPE_LABELS: Record<string, string> = {
  promo_apr: 'Promo APR',
  balance_transfer: 'Balance Transfer',
  cashback: 'Cash Back',
  signup_bonus: 'Sign-up Bonus',
  fee_waiver: 'Fee Waiver',
  other: 'Other',
};

const ACCT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  loan: 'Loan',
};

export default function InstitutionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/institutions/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setInstitution(data.institution);
        setOffers(data.offers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Institution not found.</p>
        <Link href="/institutions" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back to directory</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/institutions" className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex items-center gap-4">
          {institution.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={institution.logo_url} alt={institution.name} className="w-14 h-14 rounded-xl object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-gray-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{institution.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {institution.account_count} user{institution.account_count !== 1 ? 's' : ''}
              </span>
              {institution.website && (
                <a href={institution.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-fuchsia-600 hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Website
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {institution.description && (
        <p className="text-gray-600">{institution.description}</p>
      )}

      {/* APR Rates */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Average Rates (APR)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Checking', value: institution.avg_checking_apr, icon: Building2, color: 'text-blue-500' },
            { label: 'Savings', value: institution.avg_savings_apr, icon: PiggyBank, color: 'text-green-500' },
            { label: 'Credit Card', value: institution.avg_credit_card_apr, icon: CreditCard, color: 'text-purple-500' },
            { label: 'Loan', value: institution.avg_loan_apr, icon: Building2, color: 'text-orange-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <p className="text-2xl font-bold text-gray-900">{value != null ? `${value}%` : '—'}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Policies & Limits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-blue-500" /> Dispute Policy
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {institution.known_dispute_window_days ? `${institution.known_dispute_window_days} days` : '—'}
          </p>
          <p className="text-xs text-gray-500">Window to file a dispute</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <RotateCcw className="w-4 h-4 text-green-500" /> Return Policy
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {institution.known_return_days ? `${institution.known_return_days} days` : '—'}
          </p>
          <p className="text-xs text-gray-500">Default return window</p>
        </div>
      </div>

      {/* Fees & Limits */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Fees & Limits</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {institution.avg_credit_limit != null && (
            <div>
              <span className="text-gray-400 text-xs">Avg Credit Limit</span>
              <p className="text-gray-900 font-semibold">${Number(institution.avg_credit_limit).toLocaleString()}</p>
            </div>
          )}
          {institution.common_monthly_fees?.map((fee) => (
            <div key={fee.account_type}>
              <span className="text-gray-400 text-xs">{ACCT_TYPE_LABELS[fee.account_type] ?? fee.account_type} Fee</span>
              <p className="text-gray-900 font-semibold">${fee.fee_amount.toFixed(2)}/mo</p>
            </div>
          ))}
          {institution.rewards_summary && (
            <div className="col-span-full">
              <span className="text-gray-400 text-xs flex items-center gap-1">
                <Gift className="w-3 h-3" /> Rewards
              </span>
              <p className="text-gray-900">{institution.rewards_summary}</p>
            </div>
          )}
        </div>
      </div>

      {/* Offers */}
      {offers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Current Offers</h2>
          {offers.map((offer) => (
            <div key={offer.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700">
                    {OFFER_TYPE_LABELS[offer.offer_type] ?? offer.offer_type}
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 mt-1">{offer.title}</h3>
                  {offer.description && <p className="text-sm text-gray-600 mt-1">{offer.description}</p>}
                  {offer.expires_at && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3" /> Expires {offer.expires_at}
                    </p>
                  )}
                </div>
                {(offer.short_link_url || offer.url) && (
                  <a
                    href={offer.short_link_url || offer.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {institution.last_aggregated_at && (
        <p className="text-xs text-gray-400 text-center">
          Last updated {new Date(institution.last_aggregated_at).toLocaleDateString()}
        </p>
      )}

      <InstitutionDisclosure variant="banner" />
    </div>
  );
}
