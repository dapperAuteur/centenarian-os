'use client';

// components/settings/CurrencySettingsSection.tsx
// "Currencies" on the Settings page (anchor #my-currencies): home currency, the user's currencies
// with today's rate to home, adding a currency (including ones no free source covers), entering
// your own rate, rate history per currency, and "Update rates now".
//
// Everything goes through this app's /api/finance/fx/* routes; the rate APIs are only called
// server-side. Fetched rates carry the ExchangeRate-API attribution its terms require.

import { useCallback, useEffect, useState } from 'react';
import { Coins, Loader2, RefreshCw, Trash2, History } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import FxAttribution from '@/components/finance/FxAttribution';
import { RATE_SOURCE_LABEL, formatRate } from '@/lib/finance/fx/math';
import type { RateSource } from '@/lib/finance/fx/math';
import { currencyOptions, fetchCurrencies, rateAsOf } from '@/lib/finance/fx/client';
import type { CurrenciesResponse } from '@/lib/finance/fx/client';

interface HistoryRow {
  id: string;
  base: string;
  quote: string;
  rate: number;
  rate_date: string;
  source: RateSource;
  manual: boolean;
}

const input = 'w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900';
const primary = 'min-h-11 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-2';

export default function CurrencySettingsSection() {
  const [data, setData] = useState<CurrenciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');

  const [rateFrom, setRateFrom] = useState('');
  const [rateTo, setRateTo] = useState('');
  const [rateValue, setRateValue] = useState('');
  const [rateDate, setRateDate] = useState(todayLocal());

  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const body = await fetchCurrencies();
    setData(body);
    if (body?.code === 'fx_not_migrated') setError(body.error ?? 'Currencies are not set up yet.');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const home = data?.home_currency ?? 'USD';
  const options = currencyOptions(data, home);
  const mine = data?.mine ?? [];

  async function call(label: string, url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      const res = await offlineFetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error || 'Something went wrong. Try again.');
        return null;
      }
      return body as Record<string, unknown>;
    } finally {
      setBusy(null);
    }
  }

  async function setHome(code: string) {
    const body = await call('home', '/api/finance/fx/home', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home_currency: code }),
    });
    if (body) {
      setMessage(`Home currency set to ${code}. Totals are now shown in ${code}.`);
      load();
    }
  }

  async function addCurrency(e: React.FormEvent) {
    e.preventDefault();
    const body = await call('add', '/api/finance/fx/currencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode, name: newName || undefined, symbol: newSymbol || undefined }),
    });
    if (body) {
      setNewCode('');
      setNewName('');
      setNewSymbol('');
      setMessage((body.warning as string | null) ?? `${String(newCode).toUpperCase()} added.`);
      load();
    }
  }

  async function removeCurrency(code: string) {
    const body = await call(`remove-${code}`, `/api/finance/fx/currencies?code=${code}`, { method: 'DELETE' });
    if (body) load();
  }

  async function saveRate(e: React.FormEvent) {
    e.preventDefault();
    const from = rateFrom || mine.find((c) => !c.is_home)?.code || '';
    const to = rateTo || home;
    const body = await call('rate', '/api/finance/fx/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, rate: Number(rateValue), date: rateDate }),
    });
    if (body) {
      setRateValue('');
      setMessage(`Saved: 1 ${from} = ${formatRate(Number(body.rate))} ${to} on ${rateDate}. Your rate wins over fetched ones.`);
      load();
      if (historyFor) showHistory(historyFor);
    }
  }

  async function refreshNow() {
    const body = await call('refresh', '/api/finance/fx/refresh', { method: 'POST' });
    if (body) {
      const stored = Number(body.stored ?? 0);
      const converted = Number(body.converted ?? 0);
      const uncovered = (body.uncovered as string[] | undefined) ?? [];
      const parts = [
        stored > 0 ? `${stored} new rate${stored === 1 ? '' : 's'} saved.` : 'Rates are already up to date.',
        converted > 0 ? `${converted} transaction${converted === 1 ? '' : 's'} converted to ${home}.` : '',
        uncovered.length > 0 ? `No free source for ${uncovered.join(', ')}: enter those rates yourself.` : '',
      ].filter(Boolean);
      setMessage(parts.join(' '));
      load();
    }
  }

  async function showHistory(code: string) {
    if (historyFor === code && history.length > 0) {
      setHistoryFor(null);
      setHistory([]);
      return;
    }
    setHistoryFor(code);
    const res = await offlineFetch(`/api/finance/fx/rates?from=${code}&to=${home}`);
    const body = await res.json().catch(() => ({}));
    setHistory(res.ok ? ((body.history ?? []) as HistoryRow[]) : []);
  }

  async function deleteRate(id: string) {
    const body = await call(`del-${id}`, `/api/finance/fx/rates?id=${id}`, { method: 'DELETE' });
    if (body && historyFor) {
      setHistory((rows) => rows.filter((r) => r.id !== id));
      load();
    }
  }

  return (
    <div id="my-currencies" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6 scroll-mt-20">
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-5 h-5 text-fuchsia-600" aria-hidden="true" />
        <h2 className="text-base font-semibold text-gray-800">Currencies</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Keep cash in other currencies when you travel. Totals are shown in your home currency.
      </p>

      {error && <div role="alert" className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
      {message && <div role="status" className="mb-3 text-sm text-sky-900 bg-sky-50 border border-sky-200 px-3 py-2 rounded-lg">{message}</div>}

      {loading ? (
        <div role="status" className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading currencies…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Home currency */}
          <div>
            <label htmlFor="fx-home" className="text-sm font-medium text-gray-700">Home currency</label>
            <select
              id="fx-home"
              value={home}
              disabled={busy === 'home'}
              onChange={(e) => setHome(e.target.value)}
              className={input}
            >
              {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Changing it recomputes converted amounts on your transactions.</p>
          </div>

          {/* My currencies */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-800">My currencies</h3>
              <button type="button" onClick={refreshNow} disabled={busy === 'refresh'} className={primary}>
                {busy === 'refresh'
                  ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
                Update rates now
              </button>
            </div>
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
              {mine.map((c) => (
                <li key={c.code} className="p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {c.code} <span className="text-gray-500 font-normal">{c.symbol !== c.code ? c.symbol : ''} {c.name}</span>
                        {c.is_home && <span className="ml-2 text-xs bg-fuchsia-50 text-fuchsia-700 px-2 py-0.5 rounded-full">Home</span>}
                        {c.covered === false && (
                          <span className="ml-2 text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full">Your rates only</span>
                        )}
                      </p>
                      {!c.is_home && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          {c.rate_to_home
                            ? <>1 {c.code} = {formatRate(c.rate_to_home.rate)} {home} · {rateAsOf(c.rate_to_home)}</>
                            : 'No rate yet. Enter the rate you got below.'}
                        </p>
                      )}
                    </div>
                    {!c.is_home && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => showHistory(c.code)}
                          aria-expanded={historyFor === c.code}
                          className="min-h-11 px-3 flex items-center gap-1 text-sm text-sky-700 hover:bg-sky-50 rounded-lg"
                        >
                          <History className="w-4 h-4" aria-hidden="true" /> History
                        </button>
                        {c.added && !c.in_accounts && (
                          <button
                            type="button"
                            onClick={() => removeCurrency(c.code)}
                            disabled={busy === `remove-${c.code}`}
                            aria-label={`Remove ${c.code}`}
                            className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {historyFor === c.code && (
                    <div className="mt-2">
                      {history.length === 0 ? (
                        <p className="text-xs text-gray-500">No stored rates yet.</p>
                      ) : (
                        <ul className="text-xs text-gray-700 space-y-1 max-h-48 overflow-y-auto" aria-label={`${c.code} rate history`}>
                          {history.map((h) => (
                            <li key={h.id} className="flex items-center justify-between gap-2">
                              <span>
                                {h.rate_date}: 1 {h.base} = {formatRate(h.rate)} {h.quote}
                                <span className="text-gray-500"> · {RATE_SOURCE_LABEL[h.source] ?? h.source}</span>
                              </span>
                              {h.manual && (
                                <button
                                  type="button"
                                  onClick={() => deleteRate(h.id)}
                                  aria-label={`Delete your ${h.base} to ${h.quote} rate of ${h.rate_date}`}
                                  className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Add a currency */}
          <form onSubmit={addCurrency} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Add a currency</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="fx-new-code" className="text-xs font-medium text-gray-600">Code *</label>
                <input
                  id="fx-new-code"
                  required
                  aria-required="true"
                  maxLength={3}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  list="fx-supported-codes"
                  className={input}
                  placeholder="MXN"
                />
                <datalist id="fx-supported-codes">
                  {(data?.supported ?? []).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </datalist>
              </div>
              <div>
                <label htmlFor="fx-new-name" className="text-xs font-medium text-gray-600">Name</label>
                <input id="fx-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} className={input} placeholder="Mexican Peso" />
              </div>
              <div>
                <label htmlFor="fx-new-symbol" className="text-xs font-medium text-gray-600">Symbol</label>
                <input id="fx-new-symbol" maxLength={8} value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} className={input} placeholder="$" />
              </div>
            </div>
            <button type="submit" disabled={busy === 'add' || newCode.length !== 3} className={primary}>
              {busy === 'add' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Add currency
            </button>
          </form>

          {/* Manual rate */}
          <form onSubmit={saveRate} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Add a rate</h3>
            <p className="text-xs text-gray-500">
              The rate you actually got at a booth or ATM. It wins over fetched rates from that date on.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label htmlFor="fx-rate-from" className="text-xs font-medium text-gray-600">1 unit of</label>
                <select
                  id="fx-rate-from"
                  value={rateFrom || mine.find((c) => !c.is_home)?.code || ''}
                  onChange={(e) => setRateFrom(e.target.value)}
                  className={input}
                >
                  {options.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fx-rate-value" className="text-xs font-medium text-gray-600">equals</label>
                <input
                  id="fx-rate-value"
                  required
                  aria-required="true"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  className={input}
                  placeholder="17.50"
                />
              </div>
              <div>
                <label htmlFor="fx-rate-to" className="text-xs font-medium text-gray-600">of</label>
                <select id="fx-rate-to" value={rateTo || home} onChange={(e) => setRateTo(e.target.value)} className={input}>
                  {options.map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fx-rate-date" className="text-xs font-medium text-gray-600">Date</label>
                <input id="fx-rate-date" required type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} className={input} />
              </div>
            </div>
            <button type="submit" disabled={busy === 'rate' || !rateValue} className={primary}>
              {busy === 'rate' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Save rate
            </button>
          </form>

          <FxAttribution />
        </div>
      )}
    </div>
  );
}
