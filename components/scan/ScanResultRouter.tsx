'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  ChevronDown,
  DollarSign,
  ChefHat,
  Wrench,
  Fuel,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
  Package,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { DocumentType } from '@/lib/ocr/classify';
import type {
  ReceiptExtraction,
  ReceiptLineItem,
  RecipeExtraction,
  MaintenanceExtraction,
} from '@/lib/ocr/extractors';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import type { ScanResult } from './ScanButton';

interface ItemMatch {
  original_name: string;
  normalized_name: string;
  matches: {
    id: string;
    name: string;
    last_price: number | null;
    last_date: string | null;
    vendor_name: string | null;
    source_table: string;
  }[];
  is_new: boolean;
}

interface ScanResultRouterProps {
  result: ScanResult;
  onCreateTransaction?: (data: ReceiptExtraction, contactId?: string, scanImageId?: string) => void;
  onCreateRecipe?: (data: RecipeExtraction, contactId?: string) => void;
  onCreateMaintenance?: (data: MaintenanceExtraction, contactId?: string) => void;
  onDismiss: () => void;
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  receipt: 'Store/Restaurant Receipt',
  recipe: 'Recipe',
  fuel_receipt: 'Fuel Receipt',
  maintenance_invoice: 'Maintenance Invoice',
  pay_stub: 'Pay Stub / Estimated Pay',
  medical: 'Medical Document',
  unknown: 'Unknown Document',
};

const DOC_TYPE_ICONS: Record<DocumentType, typeof DollarSign> = {
  receipt: DollarSign,
  recipe: ChefHat,
  fuel_receipt: Fuel,
  maintenance_invoice: Wrench,
  pay_stub: DollarSign,
  medical: AlertCircle,
  unknown: AlertCircle,
};

const OVERRIDE_OPTIONS: DocumentType[] = [
  'receipt', 'recipe', 'fuel_receipt', 'maintenance_invoice', 'pay_stub', 'medical',
];

export default function ScanResultRouter({
  result,
  onCreateTransaction,
  onCreateRecipe,
  onCreateMaintenance,
  onDismiss,
}: ScanResultRouterProps) {
  const [documentType, setDocumentType] = useState<DocumentType>(result.documentType);
  const [extracted] = useState<Record<string, unknown>>(result.extracted);
  const [showOverride, setShowOverride] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactId] = useState<string | undefined>();
  const [itemMatches, setItemMatches] = useState<ItemMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  // Set initial contact name from extracted data
  useEffect(() => {
    const data = result.extracted;
    if (result.documentType === 'receipt' && (data as unknown as ReceiptExtraction).vendor) {
      setContactName((data as unknown as ReceiptExtraction).vendor || '');
    } else if (result.documentType === 'maintenance_invoice' && (data as unknown as MaintenanceExtraction).shop_name) {
      setContactName((data as unknown as MaintenanceExtraction).shop_name || '');
    } else if (result.documentType === 'recipe' && (data as unknown as RecipeExtraction).author) {
      setContactName((data as unknown as RecipeExtraction).author || '');
    }
  }, [result]);

  // Match line items for receipts
  const matchItems = useCallback(async (data: Record<string, unknown>) => {
    const receipt = data as unknown as ReceiptExtraction;
    if (!receipt.line_items?.length) return;

    setMatchLoading(true);
    try {
      const res = await offlineFetch('/api/ocr/match-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: receipt.line_items.map((li: ReceiptLineItem) => ({
            name: li.description,
            unit_price: li.unit_price,
            category_hint: li.category_hint,
          })),
        }),
      });
      if (res.ok) {
        const { results } = await res.json();
        setItemMatches(results);
      }
    } catch {
      // Non-fatal
    } finally {
      setMatchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (documentType === 'receipt') {
      matchItems(extracted);
    }
  }, [documentType, extracted, matchItems]);

  // Re-extract with overridden document type
  const handleOverride = async (newType: DocumentType) => {
    if (newType === documentType) {
      setShowOverride(false);
      return;
    }
    setReExtracting(true);
    setShowOverride(false);
    setDocumentType(newType);

    // Note: we can't re-extract without re-sending images.
    // For now, keep the extracted data and let the user know.
    // A full re-extraction would require storing the images temporarily.
    setReExtracting(false);
  };

  const confidenceColor =
    result.confidence >= 0.8
      ? 'text-green-700 bg-green-50'
      : result.confidence >= 0.5
        ? 'text-amber-700 bg-amber-50'
        : 'text-red-700 bg-red-50';

  const Icon = DOC_TYPE_ICONS[documentType];

  return (
    <div className="space-y-6">
      {/* Header: Document type + confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Icon className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {DOC_TYPE_LABELS[documentType]}
            </h3>
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${confidenceColor}`}>
              {Math.round(result.confidence * 100)}% confidence
            </span>
          </div>
        </div>

        {/* Override dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowOverride(!showOverride)}
            className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            Change type <ChevronDown className="w-3 h-3" />
          </button>
          {showOverride && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-10 w-56">
              {OVERRIDE_OPTIONS.map((type) => (
                <button
                  key={type}
                  onClick={() => handleOverride(type)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl ${
                    type === documentType ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  {DOC_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {reExtracting && (
        <div className="flex items-center gap-2 text-sm text-purple-600">
          <Sparkles className="w-4 h-4 animate-pulse" />
          Re-analyzing document...
        </div>
      )}

      {/* Contact attachment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {documentType === 'recipe' ? 'Author / Source' : 'Vendor / Provider'}
        </label>
        <ContactAutocomplete
          value={contactName}
          onChange={(name, defaultCategoryId) => {
            setContactName(name);
            // contactId will be set by the autocomplete internally
            void defaultCategoryId;
          }}
          contactType="vendor"
          placeholder={
            documentType === 'recipe'
              ? 'Recipe author or source...'
              : 'Store, restaurant, or service provider...'
          }
        />
      </div>

      {/* Saved image indicator */}
      {result.imageUrl && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          <ImageIcon className="w-4 h-4" />
          Image saved
        </div>
      )}

      {/* Module-specific preview */}
      {documentType === 'receipt' && (
        <ReceiptPreview
          data={extracted as unknown as ReceiptExtraction}
          itemMatches={itemMatches}
          matchLoading={matchLoading}
        />
      )}
      {documentType === 'recipe' && (
        <RecipePreview data={extracted as unknown as RecipeExtraction} />
      )}
      {documentType === 'maintenance_invoice' && (
        <MaintenancePreview data={extracted as unknown as MaintenanceExtraction} />
      )}

      {/* Confidence notes */}
      {(extracted as { confidence_notes?: string }).confidence_notes && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {(extracted as { confidence_notes: string }).confidence_notes}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        {documentType === 'receipt' && onCreateTransaction && (
          <button
            onClick={() =>
              onCreateTransaction(
                extracted as unknown as ReceiptExtraction,
                contactId,
                result.scanImageId,
              )
            }
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
          >
            <DollarSign className="w-4 h-4" />
            Create Transaction
          </button>
        )}
        {documentType === 'recipe' && onCreateRecipe && (
          <button
            onClick={() =>
              onCreateRecipe(extracted as unknown as RecipeExtraction, contactId)
            }
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
          >
            <ChefHat className="w-4 h-4" />
            Create Recipe
          </button>
        )}
        {documentType === 'maintenance_invoice' && onCreateMaintenance && (
          <button
            onClick={() =>
              onCreateMaintenance(
                extracted as unknown as MaintenanceExtraction,
                contactId,
              )
            }
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
          >
            <Wrench className="w-4 h-4" />
            Create Maintenance Record
          </button>
        )}
        <button
          onClick={onDismiss}
          className="px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Receipt Preview ─────────────────────────────────────────────

function ReceiptPreview({
  data,
  itemMatches,
  matchLoading,
}: {
  data: ReceiptExtraction;
  itemMatches: ItemMatch[];
  matchLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.vendor && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Vendor</div>
            <div className="font-medium text-gray-900 truncate">{data.vendor}</div>
          </div>
        )}
        {data.date && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Date</div>
            <div className="font-medium text-gray-900">{data.date}</div>
          </div>
        )}
        {data.total_amount != null && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Total</div>
            <div className="font-medium text-gray-900">${data.total_amount.toFixed(2)}</div>
          </div>
        )}
        {data.suggested_category && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Category</div>
            <div className="font-medium text-gray-900 capitalize">{data.suggested_category}</div>
          </div>
        )}
      </div>

      {/* Line items */}
      {data.line_items?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Line Items ({data.line_items.length})
          </h4>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Item</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Price</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.line_items.map((item, i) => {
                  const match = itemMatches.find(
                    (m) =>
                      m.original_name.toLowerCase() === item.description.toLowerCase(),
                  );
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{item.description}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-900">
                        ${item.total.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {matchLoading ? (
                          <span className="text-xs text-gray-400">...</span>
                        ) : match && !match.is_new ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                            Found
                            {match.matches[0]?.last_price != null && (
                              <span className="text-green-600">
                                (${match.matches[0].last_price.toFixed(2)})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            <Package className="w-3 h-3" />
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax / tip breakdown */}
      <div className="flex gap-4 text-sm text-gray-600">
        {data.subtotal != null && <span>Subtotal: ${data.subtotal.toFixed(2)}</span>}
        {data.tax != null && <span>Tax: ${data.tax.toFixed(2)}</span>}
        {data.tip != null && <span>Tip: ${data.tip.toFixed(2)}</span>}
        {data.payment_method && <span className="capitalize">{data.payment_method}</span>}
      </div>
    </div>
  );
}

// ── Recipe Preview ──────────────────────────────────────────────

function RecipePreview({ data }: { data: RecipeExtraction }) {
  return (
    <div className="space-y-4">
      {data.title && (
        <h4 className="text-lg font-semibold text-gray-900">{data.title}</h4>
      )}

      <div className="flex gap-4 text-sm text-gray-600">
        {data.servings && <span>Serves {data.servings}</span>}
        {data.prep_time_minutes && <span>Prep: {data.prep_time_minutes}m</span>}
        {data.cook_time_minutes && <span>Cook: {data.cook_time_minutes}m</span>}
      </div>

      {data.ingredients?.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">
            Ingredients ({data.ingredients.length})
          </h5>
          <ul className="space-y-1 text-sm text-gray-800">
            {data.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-500 min-w-[4rem] text-right">
                  {ing.quantity != null ? `${ing.quantity} ${ing.unit || ''}` : ''}
                </span>
                <span>{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.instructions && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-1">Instructions</h5>
          <p className="text-sm text-gray-600 line-clamp-4 whitespace-pre-wrap">
            {data.instructions}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Maintenance Preview ─────────────────────────────────────────

function MaintenancePreview({ data }: { data: MaintenanceExtraction }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.shop_name && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Shop</div>
            <div className="font-medium text-gray-900 truncate">{data.shop_name}</div>
          </div>
        )}
        {data.date && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Date</div>
            <div className="font-medium text-gray-900">{data.date}</div>
          </div>
        )}
        {data.total_cost != null && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Total</div>
            <div className="font-medium text-gray-900">${data.total_cost.toFixed(2)}</div>
          </div>
        )}
        {data.odometer != null && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Odometer</div>
            <div className="font-medium text-gray-900">
              {data.odometer.toLocaleString()} mi
            </div>
          </div>
        )}
      </div>

      {data.services?.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Services</h5>
          <ul className="space-y-1 text-sm">
            {data.services.map((s, i) => (
              <li key={i} className="flex justify-between text-gray-800">
                <span>{s.description}</span>
                <span className="text-gray-600">${s.cost.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.parts?.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Parts</h5>
          <ul className="space-y-1 text-sm">
            {data.parts.map((p, i) => (
              <li key={i} className="flex justify-between text-gray-800">
                <span>
                  {p.name} {p.quantity > 1 ? `x${p.quantity}` : ''}
                </span>
                <span className="text-gray-600">${p.cost.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(data.labor_cost != null || data.parts_cost != null) && (
        <div className="flex gap-4 text-sm text-gray-600">
          {data.labor_cost != null && <span>Labor: ${data.labor_cost.toFixed(2)}</span>}
          {data.parts_cost != null && <span>Parts: ${data.parts_cost.toFixed(2)}</span>}
        </div>
      )}
    </div>
  );
}
