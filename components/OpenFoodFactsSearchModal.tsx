/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { searchOpenFoodFacts, extractOFFNutrients, calculateNCV } from '@/lib/openfoodfacts-api';

interface OpenFoodFactsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ingredientData: {
    name: string;
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
    fiber_per_100g: number;
    ncv_score: 'Green' | 'Yellow' | 'Red';
    brand?: string;
    store_name?: string;
  }) => void;
}

export function OpenFoodFactsSearchModal({ isOpen, onClose, onSelect }: OpenFoodFactsSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const data = await searchOpenFoodFacts(query);
      setResults(data.products || []);
    } catch (error) {
      console.error('Open Food Facts search failed:', error);
      alert('Search failed. Please try again.');
    }
    setLoading(false);
  };

  const handleSelect = (product: any) => {
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
      brand: product.brands || '',  // Changed: ensure string, not undefined
      store_name: product.stores || '',  // Changed: ensure string, not undefined
    });
    
  onClose();
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Search Open Food Facts</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search products..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Search
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {loading ? 'Searching...' : 'Search for products to import'}
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((product) => {
                const nutrients = extractOFFNutrients(product);
                const ncv = calculateNCV(nutrients.calories, nutrients.protein, nutrients.fiber);
                
                return (
                  <button
                    key={product.code}
                    onClick={() => handleSelect(product)}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 transition text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{product.product_name}</h3>
                        {product.brands && (
                          <p className="text-xs text-gray-500 mt-1">Brand: {product.brands}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          ncv === 'Green' ? 'bg-lime-100 text-lime-700' :
                          ncv === 'Yellow' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {ncv}
                        </span>
                        <div className="text-sm text-gray-600 mt-1">
                          {nutrients.calories.toFixed(0)} cal
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}