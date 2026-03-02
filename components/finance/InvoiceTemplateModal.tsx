'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

interface InvoiceData {
  direction: string;
  contact_name: string;
  contact_id: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  account_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  notes: string | null;
  invoice_items: { description: string; quantity: number; unit_price: number; amount: number; sort_order: number }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData;
  onSaved: () => void;
}

export default function InvoiceTemplateModal({ isOpen, onClose, invoice, onSaved }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/finance/invoice-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          direction: invoice.direction,
          contact_name: invoice.contact_name || null,
          contact_id: invoice.contact_id,
          subtotal: invoice.subtotal,
          tax_amount: invoice.tax_amount,
          total: invoice.total,
          account_id: invoice.account_id,
          brand_id: invoice.brand_id,
          category_id: invoice.category_id,
          notes: invoice.notes,
          items: invoice.invoice_items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
            sort_order: item.sort_order,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save template');
        return;
      }
      setName('');
      onSaved();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save as Template" size="sm">
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <p className="text-sm text-gray-500">
          Save this invoice as a reusable template. All line items, amounts, and settings will be preserved.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly Consulting Invoice"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            autoFocus
            required
          />
        </div>
        <div className="text-xs text-gray-400 space-y-1">
          <p>Will include: {invoice.invoice_items.length} line item{invoice.invoice_items.length !== 1 ? 's' : ''}</p>
          {invoice.contact_name && <p>Contact: {invoice.contact_name}</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="flex-1 bg-violet-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
