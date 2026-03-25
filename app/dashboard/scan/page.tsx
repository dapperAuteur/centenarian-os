'use client';

// app/dashboard/scan/page.tsx
// Universal Smart Scan page — scan any document and route to the right module.

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ScanLine, ExternalLink } from 'lucide-react';
import ScanButton from '@/components/scan/ScanButton';
import ScanResultRouter from '@/components/scan/ScanResultRouter';
import type { ScanResult } from '@/components/scan/ScanButton';
import type { ReceiptExtraction, RecipeExtraction, MaintenanceExtraction } from '@/lib/ocr/extractors';
import { offlineFetch } from '@/lib/offline/offline-fetch';

export default function ScanPage() {
  const router = useRouter();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState<{ type: string; href: string } | null>(null);

  const handleScanResult = useCallback((data: ScanResult) => {
    setScanResult(data);
    setError('');
    setSuccess(null);
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    setScanResult(null);
  }, []);

  const handleCreateTransaction = useCallback(
    async (data: ReceiptExtraction, contactId?: string, scanImageId?: string) => {
      setCreating(true);
      try {
        // Build description from line items
        const description = data.line_items?.length
          ? data.line_items.map((li) => li.description).join(', ')
          : undefined;

        const res = await offlineFetch('/api/finance/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: data.total_amount,
            type: 'expense',
            description: description?.slice(0, 500),
            vendor: data.vendor,
            transaction_date: data.date || new Date().toISOString().slice(0, 10),
            source: 'scan',
            tags: data.suggested_category ? [data.suggested_category] : [],
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to create transaction' }));
          setError(err.error);
          return;
        }

        const { transaction } = await res.json();

        // Record line item prices + persist receipt_line_items
        if (data.line_items?.length) {
          await Promise.allSettled([
            // Record price history for each item
            ...data.line_items.map((li) =>
              offlineFetch('/api/items/prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  item_name: li.description,
                  category: li.category_hint || data.suggested_category,
                  price: li.total,
                  unit: 'each',
                  unit_price: li.unit_price,
                  vendor_contact_id: contactId || null,
                  vendor_name: data.vendor,
                  recorded_date: data.date || new Date().toISOString().slice(0, 10),
                  source: 'scan',
                }),
              }),
            ),
            // Persist receipt line items for future reference
            offlineFetch('/api/scan/receipt-line-items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scan_image_id: scanImageId || null,
                transaction_id: transaction.id,
                items: data.line_items.map((li) => ({
                  item_name: li.description,
                  quantity: li.quantity,
                  unit_price: li.unit_price,
                  total_price: li.total,
                  category_hint: li.category_hint || null,
                  matched_item_id: null,
                })),
              }),
            }),
          ]);

          // Link transaction to scan source
          await offlineFetch('/api/finance/transactions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: transaction.id,
              source_module: 'scan',
              source_module_id: scanImageId || transaction.id,
            }),
          });
        }

        setSuccess({ type: 'Transaction', href: `/dashboard/finance/transactions/${transaction.id}` });
        setScanResult(null);
      } catch {
        setError('Failed to create transaction');
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const handleCreateRecipe = useCallback(
    async (data: RecipeExtraction) => {
      setCreating(true);
      try {
        const res = await offlineFetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title || 'Scanned Recipe',
            description: data.author ? `From ${data.author}` : undefined,
            visibility: 'draft',
            servings: data.servings,
            prep_time_minutes: data.prep_time_minutes,
            cook_time_minutes: data.cook_time_minutes,
            source_url: null,
            ingredients: data.ingredients?.map((ing, i) => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              sort_order: i,
            })),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to create recipe' }));
          setError(err.error);
          return;
        }

        const result = await res.json();
        setSuccess({ type: 'Recipe', href: `/dashboard/recipes/${result.id}/edit` });
        setScanResult(null);
      } catch {
        setError('Failed to create recipe');
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const handleCreateMaintenance = useCallback(
    async (data: MaintenanceExtraction) => {
      setCreating(true);
      try {
        // For maintenance, redirect to the maintenance form with pre-filled data
        const params = new URLSearchParams();
        if (data.shop_name) params.set('vendor', data.shop_name);
        if (data.date) params.set('date', data.date);
        if (data.total_cost != null) params.set('cost', String(data.total_cost));
        if (data.odometer != null) params.set('odometer', String(data.odometer));
        if (data.services?.length) {
          params.set('description', data.services.map((s) => s.description).join(', '));
        }

        router.push(`/dashboard/travel/maintenance?${params.toString()}`);
      } finally {
        setCreating(false);
      }
    },
    [router],
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-100 rounded-xl">
          <ScanLine className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Scan</h1>
          <p className="text-sm text-gray-500">
            Scan receipts, recipes, and invoices to auto-fill your data
          </p>
        </div>
      </div>

      {/* Scan area */}
      {!scanResult && !success && (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center space-y-4 hover:border-purple-400 transition">
          <Camera className="w-12 h-12 text-gray-400 mx-auto" />
          <div>
            <p className="text-gray-700 font-medium">
              Take a photo or select images
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Supports receipts, recipe cards, and maintenance invoices
            </p>
          </div>
          <ScanButton
            onResult={handleScanResult}
            onError={handleError}
            label="Scan Document"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition cursor-pointer text-base"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Scan result */}
      {scanResult && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <ScanResultRouter
            result={scanResult}
            onCreateTransaction={handleCreateTransaction}
            onCreateRecipe={handleCreateRecipe}
            onCreateMaintenance={handleCreateMaintenance}
            onDismiss={() => setScanResult(null)}
          />
          {creating && (
            <div className="mt-4 text-center text-sm text-purple-600">
              Creating...
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-green-800 font-medium">
            {success.type} created successfully!
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push(success.href)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition"
            >
              <ExternalLink className="w-4 h-4" />
              View {success.type}
            </button>
            <ScanButton
              onResult={handleScanResult}
              onError={handleError}
              label="Scan Another"
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
        <h3 className="font-semibold text-gray-900">Tips for best results</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>- Use good lighting and lay documents flat</li>
          <li>- Avoid glare on thermal receipt paper</li>
          <li>- Fill the frame with the document text</li>
          <li>- Up to 4 images per scan for multi-page documents</li>
          <li>- Always review extracted values before saving</li>
        </ul>
      </div>
    </div>
  );
}
