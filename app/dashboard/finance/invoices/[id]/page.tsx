'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Clock, CheckCircle2, AlertTriangle, X,
  ArrowDownLeft, ArrowUpRight, Calendar, DollarSign, Copy,
  Bookmark, Trash2, Loader2, Send, CreditCard, Undo2, Pencil, Plus,
  MapPin, User, Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import InvoiceTemplateModal from '@/components/finance/InvoiceTemplateModal';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import CategorySelect from '@/components/finance/CategorySelect';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  item_type?: string;
}

interface Invoice {
  id: string;
  direction: 'receivable' | 'payable';
  status: string;
  contact_name: string;
  contact_id: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  invoice_date: string;
  due_date: string | null;
  paid_date: string | null;
  invoice_number: string | null;
  invoice_number_prefix: string | null;
  custom_fields: Record<string, string> | null;
  account_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  invoice_items: InvoiceItem[];
  budget_categories: { id: string; name: string; color: string } | null;
}

interface LinkedTransaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string;
}

interface Account { id: string; name: string; account_type: string; }
interface Category { id: string; name: string; color: string; }
interface Brand { id: string; name: string; }

const STATUS_BADGE: Record<string, { bg: string; text: string; Icon: typeof Clock }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', Icon: FileText },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', Icon: Clock },
  paid: { bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle2 },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', Icon: AlertTriangle },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', Icon: X },
};

const CUSTOM_FIELD_ICONS: Record<string, typeof User> = {
  poc_name: User,
  location: MapPin,
  job_reference: Briefcase,
  crew_coordinator: User,
  project_name: Briefcase,
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [linkedTx, setLinkedTx] = useState<LinkedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editForm, setEditForm] = useState({
    direction: 'receivable' as 'receivable' | 'payable',
    contact_name: '',
    invoice_number: '',
    invoice_number_prefix: '',
    invoice_date: '',
    due_date: '',
    tax_amount: '',
    account_id: '',
    brand_id: '',
    category_id: '',
    notes: '',
    custom_fields: {} as Record<string, string>,
  });
  const [editItems, setEditItems] = useState<{ description: string; quantity: string; unit_price: string; item_type: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data.invoice || null);
        setLinkedTx(data.linked_transaction || null);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Load dropdowns when entering edit mode
  const startEditing = async () => {
    if (!invoice) return;
    setEditForm({
      direction: invoice.direction,
      contact_name: invoice.contact_name,
      invoice_number: invoice.invoice_number || '',
      invoice_number_prefix: invoice.invoice_number_prefix || '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || '',
      tax_amount: invoice.tax_amount > 0 ? String(invoice.tax_amount) : '',
      account_id: invoice.account_id || '',
      brand_id: invoice.brand_id || '',
      category_id: invoice.category_id || '',
      notes: invoice.notes || '',
      custom_fields: invoice.custom_fields || {},
    });
    setEditItems(
      invoice.invoice_items.length > 0
        ? invoice.invoice_items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit_price: String(item.unit_price),
            item_type: item.item_type || 'line_item',
          }))
        : [{ description: '', quantity: '1', unit_price: '', item_type: 'line_item' }]
    );
    const [acctRes, catRes, brandRes] = await Promise.all([
      offlineFetch('/api/finance/accounts'),
      offlineFetch('/api/finance/categories'),
      offlineFetch('/api/brands'),
    ]);
    const acctData = await acctRes.json();
    const catData = await catRes.json();
    const brandData = await brandRes.json();
    setAccounts(Array.isArray(acctData) ? acctData.filter((a: Account & { is_active: boolean }) => a.is_active) : []);
    setCategories(catData.categories || []);
    setBrands(Array.isArray(brandData) ? brandData : []);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = editItems
        .filter((li) => li.description.trim())
        .map((li, i) => ({
          description: li.description,
          quantity: Number(li.quantity) || 1,
          unit_price: Number(li.unit_price) || 0,
          sort_order: i,
          item_type: li.item_type,
        }));

      const taxAmount = Number(editForm.tax_amount) || 0;
      const earnings = items.filter((i) => i.item_type === 'line_item');
      const subtotal = earnings.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      const res = await offlineFetch(`/api/finance/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: editForm.direction,
          contact_name: editForm.contact_name,
          invoice_number: editForm.invoice_number || null,
          invoice_number_prefix: editForm.invoice_number_prefix || null,
          invoice_date: editForm.invoice_date,
          due_date: editForm.due_date || null,
          tax_amount: taxAmount,
          total,
          account_id: editForm.account_id || null,
          brand_id: editForm.brand_id || null,
          category_id: editForm.category_id || null,
          notes: editForm.notes || null,
          custom_fields: editForm.custom_fields,
          items,
        }),
      });

      if (res.ok) {
        setEditing(false);
        load();
      } else {
        const err = await res.json();
        alert(err.error || 'Save failed');
      }
    } finally { setSaving(false); }
  };

  const handleAction = async (action: string, body: Record<string, unknown> = {}) => {
    setActionLoading(action);
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) load();
      else {
        const err = await res.json();
        alert(err.error || 'Action failed');
      }
    } finally { setActionLoading(null); }
  };

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/finance/invoices/${data.id}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Duplicate failed');
      }
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    setActionLoading('delete');
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/dashboard/finance/invoices');
      else {
        const err = await res.json();
        alert(err.error || 'Delete failed');
      }
    } finally { setActionLoading(null); }
  };

  // Line item helpers
  const addLineItem = (type: string = 'line_item') => setEditItems([...editItems, { description: '', quantity: '1', unit_price: '', item_type: type }]);
  const removeLineItem = (i: number) => { if (editItems.length > 1) setEditItems(editItems.filter((_, idx) => idx !== i)); };
  const updateLineItem = (i: number, field: string, value: string) => {
    const updated = [...editItems];
    updated[i] = { ...updated[i], [field]: value };
    setEditItems(updated);
  };
  const toggleItemType = (i: number) => {
    const updated = [...editItems];
    updated[i] = { ...updated[i], item_type: updated[i].item_type === 'line_item' ? 'benefit' : 'line_item' };
    setEditItems(updated);
  };

  const editEarnings = editItems.filter((li) => li.item_type === 'line_item');
  const editBenefits = editItems.filter((li) => li.item_type === 'benefit');
  const editLineTotal = editEarnings.reduce((s, li) => s + (Number(li.quantity) || 1) * (Number(li.unit_price) || 0), 0);
  const editBenefitTotal = editBenefits.reduce((s, li) => s + (Number(li.quantity) || 1) * (Number(li.unit_price) || 0), 0);
  const editTaxAmount = Number(editForm.tax_amount) || 0;
  const editGrandTotal = Math.round((editLineTotal + editTaxAmount) * 100) / 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Invoice not found.</p>
        <Link href="/dashboard/finance/invoices" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back to invoices</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[invoice.status] || STATUS_BADGE.draft;
  const StatusIcon = badge.Icon;
  const balanceDue = invoice.total - invoice.amount_paid;
  const isReceivable = invoice.direction === 'receivable';

  // Separate earnings and benefits
  const earningItems = invoice.invoice_items.filter((i) => (i.item_type || 'line_item') === 'line_item');
  const benefitItems = invoice.invoice_items.filter((i) => i.item_type === 'benefit');
  const benefitTotal = benefitItems.reduce((s, i) => s + Number(i.amount), 0);

  // Custom fields with values
  const customFieldEntries = invoice.custom_fields
    ? Object.entries(invoice.custom_fields).filter(([, v]) => v && v.trim())
    : [];

  // ──── EDIT MODE ────
  if (editing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing(false)} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Invoice</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editForm.contact_name.trim()}
              className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          {/* Direction */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, direction: 'receivable' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition ${
                editForm.direction === 'receivable' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" /> Receivable
            </button>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, direction: 'payable' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition ${
                editForm.direction === 'payable' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> Payable
            </button>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editForm.direction === 'receivable' ? 'Client / Customer' : 'Vendor / Creditor'}
            </label>
            <ContactAutocomplete
              value={editForm.contact_name}
              onChange={(val) => setEditForm({ ...editForm, contact_name: val })}
              contactType={editForm.direction === 'receivable' ? 'customer' : 'vendor'}
            />
          </div>

          {/* Invoice number + prefix + dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Invoice # Prefix</label>
              <input
                type="text"
                value={editForm.invoice_number_prefix}
                onChange={(e) => setEditForm({ ...editForm, invoice_number_prefix: e.target.value })}
                placeholder="e.g. PPI-CBS-Sports"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Invoice #</label>
              <input
                type="text"
                value={editForm.invoice_number}
                onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })}
                placeholder="INV-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Date</label>
              <input
                type="date"
                value={editForm.invoice_date}
                onChange={(e) => setEditForm({ ...editForm, invoice_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          {/* Custom fields */}
          {Object.keys(editForm.custom_fields).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Fields</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(editForm.custom_fields).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type={key.includes('time') ? 'time' : key.includes('date') ? 'date' : 'text'}
                      value={value}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        custom_fields: { ...editForm.custom_fields, [key]: e.target.value },
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Earnings (line items) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Earnings / Line Items</label>
            <div className="space-y-2">
              {editItems.map((li, i) => {
                if (li.item_type === 'benefit') return null;
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      type="text"
                      placeholder="Description (e.g. ST, OT, Vacation)"
                      value={li.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    />
                    <input
                      type="number"
                      placeholder="Hrs"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(i, 'quantity', e.target.value)}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center text-gray-900"
                      min="0"
                      step="0.01"
                    />
                    <input
                      type="number"
                      placeholder="Rate"
                      value={li.unit_price}
                      onChange={(e) => updateLineItem(i, 'unit_price', e.target.value)}
                      className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm text-right text-gray-900"
                      step="0.01"
                      min="0"
                    />
                    <button
                      onClick={() => toggleItemType(i)}
                      className="shrink-0 px-1.5 py-2 text-[10px] font-medium text-blue-600 hover:text-amber-600 transition"
                      title="Move to benefits"
                    >
                      BEN
                    </button>
                    {editItems.length > 1 && (
                      <button onClick={() => removeLineItem(i)} className="p-2 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => addLineItem('line_item')} className="mt-2 text-xs text-fuchsia-600 hover:underline font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add earning
            </button>
          </div>

          {/* Benefits section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Benefits</label>
            <div className="space-y-2">
              {editItems.map((li, i) => {
                if (li.item_type !== 'benefit') return null;
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="shrink-0 px-1.5 py-2 text-[10px] font-medium text-amber-700">BEN</span>
                    <input
                      type="text"
                      placeholder="Benefit type (e.g. 401K, Health & Welfare)"
                      value={li.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={li.unit_price}
                      onChange={(e) => updateLineItem(i, 'unit_price', e.target.value)}
                      className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm text-right text-gray-900"
                      step="0.01"
                      min="0"
                    />
                    <button
                      onClick={() => toggleItemType(i)}
                      className="shrink-0 px-1.5 py-2 text-[10px] font-medium text-amber-600 hover:text-blue-600 transition"
                      title="Move to earnings"
                    >
                      EARN
                    </button>
                    <button onClick={() => removeLineItem(i)} className="p-2 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => addLineItem('benefit')} className="mt-2 text-xs text-amber-600 hover:underline font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add benefit
            </button>
          </div>

          {/* Tax + Totals */}
          <div className="flex items-end gap-4 justify-end">
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tax Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.tax_amount}
                onChange={(e) => setEditForm({ ...editForm, tax_amount: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right text-gray-900"
                placeholder="0.00"
              />
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-xs text-gray-500">Earnings: {fmtCurrency(editLineTotal)}</p>
              {editBenefitTotal > 0 && (
                <p className="text-xs text-amber-600">Benefits: {fmtCurrency(editBenefitTotal)}</p>
              )}
              <p className="text-sm font-bold text-gray-900">Total: {fmtCurrency(editGrandTotal)}</p>
            </div>
          </div>

          {/* Account, Category, Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
              <select
                value={editForm.account_id}
                onChange={(e) => setEditForm({ ...editForm, account_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              >
                <option value="">None</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <CategorySelect
              value={editForm.category_id}
              onChange={(cid) => setEditForm({ ...editForm, category_id: cid })}
              categories={categories}
              onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
            />
          </div>

          {brands.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
              <select
                value={editForm.brand_id}
                onChange={(e) => setEditForm({ ...editForm, brand_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              >
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>

        {/* Bottom save bar */}
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editForm.contact_name.trim()}
            className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // ──── READ MODE ────
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance/invoices" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                <StatusIcon className="w-3 h-3" />
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isReceivable ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                {isReceivable ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                {isReceivable ? 'Receivable' : 'Payable'}
              </span>
              {invoice.invoice_number_prefix && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-fuchsia-50 text-fuchsia-700">
                  {invoice.invoice_number_prefix}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Invoice'}
            </h1>
            <p className="text-gray-500 text-sm">{invoice.contact_name}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">{fmtCurrency(invoice.total)}</div>
          {balanceDue > 0 && invoice.status !== 'paid' && (
            <div className="text-sm text-red-600 font-medium">Balance due: {fmtCurrency(balanceDue)}</div>
          )}
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Invoice Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(invoice.invoice_date)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">Due Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(invoice.due_date)}
            </span>
          </div>
          {invoice.paid_date && (
            <div>
              <span className="text-gray-400 text-xs block">Paid Date</span>
              <span className="text-green-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {fmtDate(invoice.paid_date)}
              </span>
            </div>
          )}
        </div>

        {invoice.budget_categories && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: invoice.budget_categories.color }} />
            <span className="text-gray-600">{invoice.budget_categories.name}</span>
          </div>
        )}

        {/* Custom fields display */}
        {customFieldEntries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            {customFieldEntries.map(([key, value]) => {
              const FieldIcon = CUSTOM_FIELD_ICONS[key] || FileText;
              return (
                <div key={key}>
                  <span className="text-gray-400 text-xs block capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-gray-900 font-medium flex items-center gap-1 text-sm">
                    <FieldIcon className="w-3.5 h-3.5 text-gray-400" />
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {invoice.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {invoice.notes}
          </div>
        )}
      </div>

      {/* Earnings / Line Items */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            {benefitItems.length > 0 ? 'Earnings' : 'Line Items'}
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Description</th>
              <th className="px-6 py-3 text-right">Qty / Hrs</th>
              <th className="px-6 py-3 text-right">Rate</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {earningItems.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-3 text-gray-900">{item.description}</td>
                <td className="px-6 py-3 text-right text-gray-600">{item.quantity}</td>
                <td className="px-6 py-3 text-right text-gray-600">{fmtCurrency(item.unit_price)}</td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">{fmtCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50/50">
            <tr>
              <td colSpan={3} className="px-6 py-2 text-right text-gray-500 text-xs">Subtotal</td>
              <td className="px-6 py-2 text-right font-medium text-gray-900">{fmtCurrency(invoice.subtotal)}</td>
            </tr>
            {invoice.tax_amount > 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-2 text-right text-gray-500 text-xs">Tax</td>
                <td className="px-6 py-2 text-right font-medium text-gray-900">{fmtCurrency(invoice.tax_amount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-6 py-2 text-right font-semibold text-gray-900">Total</td>
              <td className="px-6 py-2 text-right font-bold text-gray-900 text-base">{fmtCurrency(invoice.total)}</td>
            </tr>
            {invoice.amount_paid > 0 && invoice.status !== 'paid' && (
              <>
                <tr>
                  <td colSpan={3} className="px-6 py-2 text-right text-gray-500 text-xs">Paid</td>
                  <td className="px-6 py-2 text-right text-green-600">{fmtCurrency(invoice.amount_paid)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-6 py-2 text-right font-semibold text-red-600">Balance Due</td>
                  <td className="px-6 py-2 text-right font-bold text-red-600">{fmtCurrency(balanceDue)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {/* Benefits */}
      {benefitItems.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50">
            <h2 className="text-sm font-semibold text-amber-800">Benefits</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-50/30 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {benefitItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-3 text-gray-900">{item.description}</td>
                  <td className="px-6 py-3 text-right font-medium text-gray-900">{fmtCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-amber-200 bg-amber-50/50">
              <tr>
                <td className="px-6 py-2 text-right font-semibold text-amber-800">Est. Benefits</td>
                <td className="px-6 py-2 text-right font-bold text-amber-800">{fmtCurrency(benefitTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Linked Transaction */}
      {linkedTx && (
        <Link
          href={`/dashboard/finance/transactions/${linkedTx.id}`}
          className="block bg-green-50 border border-green-200 rounded-2xl p-4 hover:bg-green-100 transition"
        >
          <h3 className="text-sm font-medium text-green-800 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Linked Transaction
          </h3>
          <p className="text-sm text-green-700">
            {linkedTx.description} &mdash; {fmtCurrency(linkedTx.amount)} on {fmtDate(linkedTx.transaction_date)}
          </p>
        </Link>
      )}

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
          {/* Edit */}
          <button
            onClick={startEditing}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>

          {/* Status actions */}
          {invoice.status === 'draft' && (
            <button
              onClick={() => handleAction('mark_sent', { status: 'sent' })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Send className="w-3.5 h-3.5" /> Mark Sent
            </button>
          )}
          {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
            <button
              onClick={() => handleAction('mark_paid', { mark_paid: true })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CreditCard className="w-3.5 h-3.5" /> Mark Paid
            </button>
          )}
          {invoice.status === 'paid' && (
            <button
              onClick={() => handleAction('unmark_paid', { unmark_paid: true })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 disabled:opacity-50 transition"
            >
              <Undo2 className="w-3.5 h-3.5" /> Un-mark Paid
            </button>
          )}
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <button
              onClick={() => handleAction('unmark_sent', { unmark_sent: true })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
            >
              <Undo2 className="w-3.5 h-3.5" /> Revert to Draft
            </button>
          )}

          {/* Duplicate */}
          <button
            onClick={handleDuplicate}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-100 disabled:opacity-50 transition"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>

          {/* Save as Template */}
          <button
            onClick={() => setShowTemplateModal(true)}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 disabled:opacity-50 transition"
          >
            <Bookmark className="w-3.5 h-3.5" /> Save as Template
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>

          {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
        </div>
      </div>

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="invoice" entityId={invoice.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="invoice" entityId={invoice.id} />
      </div>

      {/* Template Modal */}
      <InvoiceTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        invoice={invoice}
        onSaved={() => {}}
      />
    </div>
  );
}
