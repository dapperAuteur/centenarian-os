'use client';

import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface InvoiceItemData {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  item_type?: string;
}

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
  invoice_number_prefix?: string | null;
  custom_fields?: Record<string, string> | CustomFieldDef[] | null;
  invoice_items: InvoiceItemData[];
}

interface CustomFieldDef {
  key: string;
  label: string;
  type: 'text' | 'time' | 'date';
  default_value?: string;
}

// Predefined fields users can choose from
const AVAILABLE_FIELDS: CustomFieldDef[] = [
  { key: 'poc_name', label: 'Point of Contact', type: 'text' },
  { key: 'location', label: 'Location / Venue', type: 'text' },
  { key: 'job_reference', label: 'Job Reference', type: 'text' },
  { key: 'crew_coordinator', label: 'Crew Coordinator', type: 'text' },
  { key: 'project_name', label: 'Project Name', type: 'text' },
  { key: 'po_number', label: 'PO Number', type: 'text' },
  { key: 'time_in', label: 'Time In', type: 'time' },
  { key: 'time_out', label: 'Time Out', type: 'time' },
  { key: 'work_date', label: 'Work Date', type: 'date' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData;
  onSaved: () => void;
}

export default function InvoiceTemplateModal({ isOpen, onClose, invoice, onSaved }: Props) {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState(invoice.invoice_number_prefix || '');
  const [selectedFields, setSelectedFields] = useState<CustomFieldDef[]>(() => {
    // If invoice already has custom_fields definitions (array), use those
    if (Array.isArray(invoice.custom_fields)) {
      return invoice.custom_fields;
    }
    // If invoice has custom_fields as object (values), derive field defs
    if (invoice.custom_fields && typeof invoice.custom_fields === 'object' && !Array.isArray(invoice.custom_fields)) {
      const keys = Object.keys(invoice.custom_fields);
      return keys.map((k) => {
        const predefined = AVAILABLE_FIELDS.find((f) => f.key === k);
        return predefined || { key: k, label: k, type: 'text' as const };
      });
    }
    return [];
  });
  const [customFieldLabel, setCustomFieldLabel] = useState('');
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  // Line items with item_type
  const [items, setItems] = useState<(InvoiceItemData & { item_type: string })[]>(
    invoice.invoice_items.map((i) => ({ ...i, item_type: i.item_type || 'line_item' }))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleField = (field: CustomFieldDef) => {
    const exists = selectedFields.find((f) => f.key === field.key);
    if (exists) {
      setSelectedFields(selectedFields.filter((f) => f.key !== field.key));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const addCustomField = () => {
    if (!customFieldLabel.trim()) return;
    const key = customFieldLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (selectedFields.find((f) => f.key === key)) return;
    setSelectedFields([...selectedFields, { key, label: customFieldLabel.trim(), type: 'text' }]);
    setCustomFieldLabel('');
  };

  const removeField = (key: string) => {
    setSelectedFields(selectedFields.filter((f) => f.key !== key));
  };

  const toggleItemType = (idx: number) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      item_type: updated[idx].item_type === 'line_item' ? 'benefit' : 'line_item',
    };
    setItems(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await offlineFetch('/api/finance/invoice-templates', {
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
          invoice_number_prefix: prefix.trim() || null,
          custom_fields: selectedFields.map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            default_value: f.default_value || '',
          })),
          items: items.map((item, idx) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
            sort_order: idx,
            item_type: item.item_type,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save template');
        return;
      }
      setName('');
      setPrefix('');
      onSaved();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const unusedFields = AVAILABLE_FIELDS.filter(
    (f) => !selectedFields.find((s) => s.key === f.key)
  );

  const lineItems = items.filter((i) => i.item_type === 'line_item');
  const benefitItems = items.filter((i) => i.item_type === 'benefit');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save as Template" size="lg">
      <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        <p className="text-sm text-gray-500">
          Save this invoice as a reusable template. Customize which fields and line items are included.
        </p>

        {/* Template name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. PPI CBS Sports Weekly"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            autoFocus
            required
          />
        </div>

        {/* Invoice number prefix */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Invoice # Prefix</label>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="e.g. PPI-CBS-Sports"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">
            Invoices created from this template will be numbered {prefix ? `${prefix}-001, ${prefix}-002, ...` : 'automatically'}
          </p>
        </div>

        {/* Custom fields */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Custom Fields</label>

          {/* Selected fields */}
          {selectedFields.length > 0 && (
            <div className="space-y-1 mb-3">
              {selectedFields.map((field) => (
                <div key={field.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                  <GripVertical className="w-3 h-3 text-gray-300" />
                  <span className="flex-1 text-gray-700">{field.label}</span>
                  <span className="text-xs text-gray-400">{field.type}</span>
                  <button
                    type="button"
                    onClick={() => removeField(field.key)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add field buttons */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFieldPicker(!showFieldPicker)}
              className="text-xs text-fuchsia-600 hover:underline font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add field
            </button>

            {showFieldPicker && (
              <div className="absolute z-20 top-6 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
                {/* Predefined fields */}
                {unusedFields.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Quick add</p>
                    <div className="flex flex-wrap gap-1">
                      {unusedFields.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => { toggleField(f); setShowFieldPicker(false); }}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-fuchsia-50 hover:text-fuchsia-700 transition"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom field */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Custom field</p>
                  <div className="flex gap-1">
                    <input
                      value={customFieldLabel}
                      onChange={(e) => setCustomFieldLabel(e.target.value)}
                      placeholder="Field label"
                      className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomField(); setShowFieldPicker(false); } }}
                    />
                    <button
                      type="button"
                      onClick={() => { addCustomField(); setShowFieldPicker(false); }}
                      disabled={!customFieldLabel.trim()}
                      className="px-2 py-1 bg-fuchsia-600 text-white rounded-md text-xs disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFieldPicker(false)}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Line items with type toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Line Items ({lineItems.length} earnings, {benefitItems.length} benefits)
          </label>
          <div className="space-y-1 text-xs">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleItemType(idx)}
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                    item.item_type === 'benefit'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                  title="Toggle line item / benefit"
                >
                  {item.item_type === 'benefit' ? 'BEN' : 'EARN'}
                </button>
                <span className="flex-1 text-gray-700 truncate">{item.description || '(empty)'}</span>
                <span className="text-gray-500">{item.quantity} x ${Number(item.unit_price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="text-xs text-gray-400 space-y-1 bg-gray-50 rounded-lg p-3">
          {invoice.contact_name && <p>Contact: {invoice.contact_name}</p>}
          <p>Direction: {invoice.direction}</p>
          {prefix && <p>Prefix: {prefix}</p>}
          <p>Custom fields: {selectedFields.length > 0 ? selectedFields.map((f) => f.label).join(', ') : 'None'}</p>
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
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
