/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Camera } from 'lucide-react';
import { getProductByBarcode, extractOFFNutrients, calculateNCV } from '@/lib/openfoodfacts-api';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ingredientData: any) => void;
}

export function BarcodeScanner({ isOpen, onClose, onSelect }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!manualBarcode.trim()) return;
    
    setLoading(true);
    try {
      const product = await getProductByBarcode(manualBarcode);
      const nutrients = extractOFFNutrients(product);
      const ncv = calculateNCV(nutrients.calories, nutrients.protein, nutrients.fiber);

      onSelect({
        name: product.product_name || 'Unknown Product',
        calories_per_100g: nutrients.calories,
        protein_per_100g: nutrients.protein,
        carbs_per_100g: nutrients.carbs,
        fat_per_100g: nutrients.fat,
        fiber_per_100g: nutrients.fiber,
        ncv_score: ncv,
        brand: product.brands || '',
        store_name: product.stores || '',
      });
      
      onClose();
    } catch (error) {
      alert('Product not found');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Scan Barcode</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Camera className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600">Camera scanning coming soon</p>
            <p className="text-xs text-gray-500 mt-2">For now, enter barcode manually</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter Barcode Number
            </label>
            <input
              type="text"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="e.g., 3017620422003"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
            />
          </div>

          <button
            onClick={handleLookup}
            disabled={loading}
            className="w-full px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 font-semibold"
          >
            {loading ? 'Looking up...' : 'Lookup Product'}
          </button>
        </div>
      </div>
    </div>
  );
}