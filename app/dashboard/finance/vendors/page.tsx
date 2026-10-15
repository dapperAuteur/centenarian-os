'use client';
// app/dashboard/finance/vendors/page.tsx
// Third-party service bills pushed from witus.online (/admin/costs). For each service: the latest
// period's fee and usage, a link to the vendor account, "See transactions" (the transactions page
// filtered by vendor, which shows the payment account used), and "More at WitUS" for the full
// breakdown. Data arrives through /api/events/vendor-bills; nothing here reads another app's tables.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, Receipt } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Bill {
  id: string;
  service_slug: string;
  service_name: string;
  vendor: string;
  plan: string | null;
  billed_via: string | null;
  period_start: string;
  period_end: string;
  base_fee: number | null;
  usage_cost: number;
  currency: string;
  account_url: string | null;
  witus_url: string | null;
  updated_at: string;
}

const money = (n: number | null | undefined, c = 'USD') =>
  n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(Number(n));

export default function VendorBillsPage() {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    offlineFetch('/api/finance/vendor-bills')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setBills(((await r.json()) as { bills: Bill[] }).bills);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Latest period per service.
  const latest = new Map<string, Bill>();
  for (const b of bills ?? []) if (!latest.has(b.service_slug)) latest.set(b.service_slug, b);
  const rows = [...latest.values()].sort((a, b) => (Number(b.usage_cost) + Number(b.base_fee ?? 0)) - (Number(a.usage_cost) + Number(a.base_fee ?? 0)));
  const total = rows.reduce((s, b) => s + Number(b.usage_cost) + Number(b.base_fee ?? 0), 0);
  const witusUrl = rows.find((r) => r.witus_url)?.witus_url ?? null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="text-gray-500 hover:text-gray-800" aria-label="Back to finance">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6" /> Vendor bills</h1>
        </div>
        {witusUrl ? (
          <a href={witusUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-fuchsia-600 hover:underline">
            More at WitUS <ExternalLink className="w-4 h-4" />
          </a>
        ) : null}
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Pushed from witus.online once a day (or on demand there). Latest period per service: {money(total)} across {rows.length} service(s).
        "See transactions" opens your transactions filtered by the vendor name, where the payment account is shown.
      </p>
      {error ? <p className="text-red-700 text-sm">{error}</p> : null}
      {bills === null && !error ? (
        <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading</p>
      ) : rows.length === 0 && !error ? (
        <p className="text-sm text-gray-500">No bills yet. Set VENDOR_BILLS_EVENTS_SECRET and VENDOR_BILLS_OWNER_USER_ID here and CENTOS_EVENTS_URL/SECRET on witus.online, then press Refresh on witus.online/admin/costs.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Service</th><th className="py-2 pr-4">Vendor</th><th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Billed via</th>
                <th className="py-2 pr-4">Period</th><th className="py-2 pr-4 text-right">Fee</th><th className="py-2 pr-4 text-right">Usage</th><th className="py-2 pr-4">Links</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium">{b.service_name}</td>
                  <td className="py-2 pr-4">{b.vendor}</td>
                  <td className="py-2 pr-4">{b.plan ?? ''}</td>
                  <td className="py-2 pr-4">{b.billed_via ?? ''}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{b.period_start} to {b.period_end}</td>
                  <td className="py-2 pr-4 text-right">{money(b.base_fee, b.currency)}</td>
                  <td className="py-2 pr-4 text-right">{money(b.usage_cost, b.currency)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <Link href={`/dashboard/finance/transactions?q=${encodeURIComponent(b.vendor)}`} className="text-fuchsia-600 hover:underline mr-3">See transactions</Link>
                    {b.account_url ? <a href={b.account_url} target="_blank" rel="noreferrer" className="text-gray-700 hover:underline">Account</a> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
