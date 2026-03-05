'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, ArrowRight,
  Upload, Download, Settings, Loader2, CreditCard, Wallet, FileText, AlertTriangle,
  ArrowRightLeft, RefreshCw, Building2,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import CategorySelect from '@/components/finance/CategorySelect';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import TransferModal from '@/components/finance/TransferModal';
import Modal from '@/components/ui/Modal';
import ScanButton from '@/components/scan/ScanButton';
import type { ScanResult } from '@/components/scan/ScanButton';
import type { ReceiptExtraction } from '@/lib/ocr/extractors';

interface CategoryBreakdown {
  id: string;
  name: string;
  color: string;
  monthly_budget: number | null;
  spent: number;
  remaining: number | null;
}

interface MonthlyTrend {
  month: string;
  label: string;
  expenses: number;
  income: number;
  net: number;
}

interface MonthlyProjection {
  month: string;
  label: string;
  receivable: number;
  payable: number;
  count: number;
}

interface Projections {
  currentMonth: { receivable: number; payable: number; net: number };
  invoiceCount: { receivable: number; payable: number };
  monthlyTimeline: MonthlyProjection[];
}

interface ProjectionToggles {
  showCard: boolean;
  showTimeline: boolean;
  showChart: boolean;
}

const PROJECTIONS_KEY = 'centos_finance_projections';
const DEFAULT_TOGGLES: ProjectionToggles = { showCard: true, showTimeline: true, showChart: true };

interface Summary {
  currentMonth: { expenses: number; income: number; net: number };
  categoryBreakdown: CategoryBreakdown[];
  monthlyTrend: MonthlyTrend[];
  projections?: Projections | null;
}

interface Category {
  id: string;
  name: string;
  monthly_budget: number | null;
  color: string;
}

interface Account {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  balance: number;
  is_active: boolean;
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  loan: 'Loan',
  cash: 'Cash',
};

export default function FinanceDashboardPage() {
  useTrackPageView('finance', '/dashboard/finance');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string; color: string }[]>([]);
  const [reminders, setReminders] = useState<{ overdue_count: number; due_soon_count: number; invoices: { id: string; direction: string; contact_name: string; balance_due: number; due_date: string; urgency: string }[]; accounts: { id: string; name: string; due_day: number; urgency: string }[] }>({ overdue_count: 0, due_soon_count: 0, invoices: [], accounts: [] });
  const [loading, setLoading] = useState(true);

  // Add transaction modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    amount: '', type: 'expense', description: '', vendor: '',
    transaction_date: new Date().toISOString().split('T')[0],
    category_id: '', account_id: '', brand_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false);

  // Projection toggles
  const [projectionToggles, setProjectionToggles] = useState<ProjectionToggles>(DEFAULT_TOGGLES);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROJECTIONS_KEY);
      if (saved) setProjectionToggles(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const updateToggle = (key: keyof ProjectionToggles) => {
    setProjectionToggles(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(PROJECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Add category modal
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', monthly_budget: '', color: '#6366f1' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, catRes, acctRes, brandsRes, remRes] = await Promise.all([
        offlineFetch('/api/finance/summary?months=6'),
        offlineFetch('/api/finance/categories'),
        offlineFetch('/api/finance/accounts'),
        offlineFetch('/api/brands'),
        offlineFetch('/api/finance/reminders'),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (catRes.ok) {
        const { categories: cats } = await catRes.json();
        setCategories(cats || []);
      }
      if (acctRes.ok) setAccounts(await acctRes.json());
      if (brandsRes.ok) {
        const d = await brandsRes.json();
        setBrands(Array.isArray(d) ? d.filter((b: { is_active: boolean }) => b.is_active) : []);
      }
      if (remRes.ok) setReminders(await remRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-generate due recurring transactions
    offlineFetch('/api/finance/recurring/generate', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (d.generated > 0) load(); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddForm({
          amount: '', type: 'expense', description: '', vendor: '',
          transaction_date: new Date().toISOString().split('T')[0],
          category_id: '', account_id: '', brand_id: '',
        });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleScanResult = (data: ScanResult) => {
    const receipt = data.extracted as unknown as ReceiptExtraction;
    setAddForm({
      amount: receipt.total_amount ? String(receipt.total_amount) : '',
      type: 'expense',
      description: receipt.line_items?.map((li) => li.description).join(', ').slice(0, 500) || '',
      vendor: receipt.vendor || '',
      transaction_date: receipt.date || new Date().toISOString().split('T')[0],
      category_id: '',
      account_id: '',
      brand_id: '',
    });
    setShowAdd(true);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await offlineFetch('/api/finance/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: catForm.name,
        monthly_budget: catForm.monthly_budget ? parseFloat(catForm.monthly_budget) : null,
        color: catForm.color,
      }),
    });
    if (res.ok) {
      setShowCatForm(false);
      setCatForm({ name: '', monthly_budget: '', color: '#6366f1' });
      load();
    }
  };

  const chartData = useMemo(() => {
    const base = summary?.monthlyTrend || [];
    if (!projectionToggles.showChart || !summary?.projections?.monthlyTimeline) return base;
    const projMap = new Map(summary.projections.monthlyTimeline.filter(m => m.month !== 'undated').map(m => [m.month, m]));
    const allMonths = new Set([...base.map(b => b.month), ...Array.from(projMap.keys())]);
    return Array.from(allMonths).sort().map(month => {
      const existing = base.find(b => b.month === month);
      const proj = projMap.get(month);
      return {
        month,
        label: existing?.label || new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        income: existing?.income || 0,
        expenses: existing?.expenses || 0,
        net: existing?.net || 0,
        projectedIncome: proj?.receivable || 0,
        projectedExpenses: proj?.payable || 0,
      };
    });
  }, [summary, projectionToggles.showChart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-10 w-10 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const cm = summary?.currentMonth || { expenses: 0, income: 0, net: 0 };
  const pieData = (summary?.categoryBreakdown || []).filter((c) => c.spent > 0);
  const hasProjections = !!(summary?.projections && (summary.projections.invoiceCount.receivable > 0 || summary.projections.invoiceCount.payable > 0));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-fuchsia-600" />
            Finance Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Track spending, budgets, and income</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
          <ScanButton
            onResult={handleScanResult}
            moduleHint="receipt"
            label="Scan Receipt"
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition cursor-pointer"
          />
          <button
            onClick={() => setShowTransfer(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-100 transition"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transfer
          </button>
          <Link
            href="/dashboard/finance/import"
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-100 transition"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <Link
            href="/dashboard/finance/accounts"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            <CreditCard className="w-4 h-4" />
            Accounts
          </Link>
          <Link
            href="/dashboard/finance/recurring"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Recurring
          </Link>
          <Link
            href="/dashboard/finance/invoices"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            <FileText className="w-4 h-4" />
            Invoices
          </Link>
          <Link
            href="/dashboard/finance/brands"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            <Wallet className="w-4 h-4" />
            Brands
          </Link>
          <Link
            href="/institutions"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition"
          >
            <Building2 className="w-4 h-4" />
            Institutions
          </Link>
          <a
            href="/api/finance/export"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </a>
        </div>
      </div>

      {/* Reminders Banner */}
      {(reminders.overdue_count > 0 || reminders.due_soon_count > 0) && (
        <div className={`rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${reminders.overdue_count > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${reminders.overdue_count > 0 ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`text-sm font-medium ${reminders.overdue_count > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                {reminders.overdue_count > 0 && `${reminders.overdue_count} overdue`}
                {reminders.overdue_count > 0 && reminders.due_soon_count > 0 && ' · '}
                {reminders.due_soon_count > 0 && `${reminders.due_soon_count} due soon`}
              </p>
              <p className="text-xs text-gray-500">
                {reminders.invoices.filter((r) => r.urgency === 'overdue').map((r) => r.contact_name).join(', ')}
                {reminders.accounts.filter((r) => r.urgency === 'due_now' || r.urgency === 'due_soon').map((r) => r.name).join(', ')}
              </p>
            </div>
          </div>
          <Link href="/dashboard/finance/invoices" className="text-sm font-medium text-fuchsia-600 hover:underline">
            View Invoices
          </Link>
        </div>
      )}

      {/* Accounts Row */}
      {accounts.filter((a) => a.is_active).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-fuchsia-600" />
              Accounts
            </h2>
            <Link href="/dashboard/finance/accounts" className="text-xs text-fuchsia-600 hover:underline">
              Manage
            </Link>
          </div>
          <div className="flex gap-3 flex-wrap">
            {accounts.filter((a) => a.is_active).map((acct) => (
              <div key={acct.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 min-w-[160px]">
                <p className="text-xs text-gray-500 mb-0.5">
                  {ACCOUNT_TYPE_LABEL[acct.account_type] ?? acct.account_type}
                  {acct.last_four && <span className="ml-1">··{acct.last_four}</span>}
                </p>
                <p className="text-sm font-semibold text-gray-800 truncate">{acct.name}</p>
                <p className={`text-base font-bold mt-0.5 ${acct.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {acct.balance < 0 ? '-' : ''}${Math.abs(acct.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Expenses This Month
          </div>
          <p className="text-2xl font-bold text-gray-900">${cm.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Income This Month
          </div>
          <p className="text-2xl font-bold text-gray-900">${cm.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`bg-white border rounded-2xl p-5 ${cm.net >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            Net This Month
          </div>
          <p className={`text-2xl font-bold ${cm.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {cm.net >= 0 ? '+' : ''}{cm.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Projection Toggle Bar + Cards + Timeline */}
      {hasProjections && (
        <>
          <div className="flex items-center gap-3 flex-wrap" role="group" aria-label="Projection display options">
            <span className="text-xs font-medium text-gray-500">Projections:</span>
            {(['showCard', 'showTimeline', 'showChart'] as const).map((key) => {
              const labels = { showCard: 'Summary Card', showTimeline: 'Timeline', showChart: 'Chart Overlay' };
              return (
                <button
                  key={key}
                  onClick={() => updateToggle(key)}
                  role="switch"
                  aria-checked={projectionToggles[key]}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                    projectionToggles[key]
                      ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  {labels[key]}
                </button>
              );
            })}
          </div>

          {projectionToggles.showCard && summary?.projections && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summary.projections.currentMonth.receivable > 0 && (
                <div className="bg-white border border-dashed border-green-300 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <FileText className="w-4 h-4 text-green-500" aria-hidden="true" />
                    Projected Income
                    <span className="ml-auto text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">
                      {summary.projections.invoiceCount.receivable} invoice{summary.projections.invoiceCount.receivable !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    +${summary.projections.currentMonth.receivable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              {summary.projections.currentMonth.payable > 0 && (
                <div className="bg-white border border-dashed border-red-300 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <FileText className="w-4 h-4 text-red-500" aria-hidden="true" />
                    Projected Expenses
                    <span className="ml-auto text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">
                      {summary.projections.invoiceCount.payable} invoice{summary.projections.invoiceCount.payable !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    -${summary.projections.currentMonth.payable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          )}

          {projectionToggles.showTimeline && summary?.projections?.monthlyTimeline && summary.projections.monthlyTimeline.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Timeline</h2>
              <div className="flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Monthly projected invoice amounts">
                {summary.projections.monthlyTimeline.map((m) => (
                  <div
                    key={m.month}
                    className="min-w-[140px] border border-gray-100 rounded-xl p-3 shrink-0"
                    role="listitem"
                  >
                    <p className="text-xs font-medium text-gray-500 mb-2">{m.label}</p>
                    {m.receivable > 0 && (
                      <p className="text-sm font-semibold text-green-600">
                        +${m.receivable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {m.payable > 0 && (
                      <p className="text-sm font-semibold text-red-600">
                        -${m.payable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {m.count} invoice{m.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Bar Chart */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h2>
          {chartData.length > 0 ? (
            <div className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                  {projectionToggles.showChart && hasProjections && (
                    <>
                      <Bar dataKey="projectedIncome" fill="#86efac" name="Projected Income" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="projectedExpenses" fill="#fca5a5" name="Projected Expenses" radius={[4, 4, 0, 0]} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">No transaction data yet</p>
          )}
        </div>

        {/* Category Spending Pie Chart */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Spending by Category</h2>
            <button
              onClick={() => setShowCatForm(true)}
              className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              Manage
            </button>
          </div>
          {pieData.length > 0 ? (
            <div className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData as unknown as Record<string, unknown>[]}
                    dataKey="spent"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">No categorized spending yet</p>
          )}
        </div>
      </div>

      {/* Budget Progress */}
      {(summary?.categoryBreakdown || []).some((c) => c.monthly_budget) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Progress</h2>
          <div className="space-y-3">
            {(summary?.categoryBreakdown || [])
              .filter((c) => c.monthly_budget)
              .map((cat) => {
                const pct = cat.monthly_budget ? Math.min((cat.spent / cat.monthly_budget) * 100, 100) : 0;
                const over = cat.remaining !== null && cat.remaining < 0;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{cat.name}</span>
                      <span className={`text-xs font-medium ${over ? 'text-red-600' : 'text-gray-500'}`}>
                        ${cat.spent.toFixed(2)} / ${cat.monthly_budget?.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: over ? '#ef4444' : cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* View All Transactions Link */}
      <div className="flex justify-center">
        <Link
          href="/dashboard/finance/transactions"
          className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-xl transition"
        >
          View All Transactions
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <TransferModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
        accounts={accounts}
        onSuccess={load}
      />

      {/* Add Transaction Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Transaction" size="sm">
        <form onSubmit={handleAddTransaction} className="flex flex-col">
          <div className="p-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="txn-type" className="text-xs font-medium text-gray-600">Type</label>
                <select
                  id="txn-type"
                  value={addForm.type}
                  onChange={(e) => setAddForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label htmlFor="txn-amount" className="text-xs font-medium text-gray-600">Amount ($)</label>
                <input
                  id="txn-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  aria-required="true"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label htmlFor="txn-date" className="text-xs font-medium text-gray-600">Date</label>
              <input
                id="txn-date"
                type="date"
                required
                aria-required="true"
                value={addForm.transaction_date}
                onChange={(e) => setAddForm((p) => ({ ...p, transaction_date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="txn-description" className="text-xs font-medium text-gray-600">Description</label>
              <input
                id="txn-description"
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                placeholder="What was this for?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="txn-vendor" className="text-xs font-medium text-gray-600">
                  {addForm.type === 'income' ? 'Source / Payer' : 'Vendor'}
                </label>
                <ContactAutocomplete
                  value={addForm.vendor}
                  contactType={addForm.type === 'income' ? 'customer' : 'vendor'}
                  placeholder={addForm.type === 'income' ? 'Employer, client…' : 'Store/company'}
                  onChange={(name, defaultCategoryId) => {
                    setAddForm((p) => ({
                      ...p,
                      vendor: name,
                      category_id: defaultCategoryId ?? p.category_id,
                    }));
                  }}
                  inputClassName="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <CategorySelect
                value={addForm.category_id}
                onChange={(id) => setAddForm((p) => ({ ...p, category_id: id }))}
                categories={categories}
                onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
              />
            </div>
            {accounts.filter((a) => a.is_active).length > 0 && (
              <div>
                <label htmlFor="txn-account" className="text-xs font-medium text-gray-600">Account</label>
                <select
                  id="txn-account"
                  value={addForm.account_id}
                  onChange={(e) => setAddForm((p) => ({ ...p, account_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">No account</option>
                  {accounts.filter((a) => a.is_active).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.last_four ? ` ··${a.last_four}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {brands.length > 0 && (
              <div>
                <label htmlFor="txn-brand" className="text-xs font-medium text-gray-600">Brand (optional)</label>
                <select
                  id="txn-brand"
                  value={addForm.brand_id}
                  onChange={(e) => setAddForm((p) => ({ ...p, brand_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex gap-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal isOpen={showCatForm} onClose={() => setShowCatForm(false)} title="Add Budget Category" size="sm">
        <div className="p-6 space-y-4">
          <form onSubmit={handleAddCategory} className="space-y-3">
            <div>
              <label htmlFor="cat-name" className="text-xs font-medium text-gray-600">Name</label>
              <input
                id="cat-name"
                type="text"
                required
                aria-required="true"
                value={catForm.name}
                onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                placeholder="e.g. Supplements, Gym, Food"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cat-budget" className="text-xs font-medium text-gray-600">Monthly Budget ($)</label>
                <input
                  id="cat-budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={catForm.monthly_budget}
                  onChange={(e) => setCatForm((p) => ({ ...p, monthly_budget: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="cat-color" className="text-xs font-medium text-gray-600">Color</label>
                <input
                  id="cat-color"
                  type="color"
                  value={catForm.color}
                  onChange={(e) => setCatForm((p) => ({ ...p, color: e.target.value }))}
                  className="w-full mt-1 h-[38px] border border-gray-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCatForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Existing categories list */}
          {categories.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500">Existing Categories</p>
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                    <span className="text-gray-700">{c.name}</span>
                  </div>
                  {c.monthly_budget && (
                    <span className="text-xs text-gray-400">${c.monthly_budget}/mo</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
