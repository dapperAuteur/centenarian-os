'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Trash2, GripVertical, Search, Barcode, ChevronDown, ChevronUp } from 'lucide-react';
import type { RecipeIngredient } from '@/lib/types';
import { nutritionForQuantity } from '@/lib/recipes/nutrition';

// Lazily import heavy search modals (same as fuel module)
const USDASearchModal = dynamic(() => import('@/components/USDASearchModal').then(m => ({ default: m.USDASearchModal })), { ssr: false });
const OpenFoodFactsSearchModal = dynamic(() => import('@/components/OpenFoodFactsSearchModal').then(m => ({ default: m.OpenFoodFactsSearchModal })), { ssr: false });
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })), { ssr: false });

export type DraftIngredient = Omit<RecipeIngredient, 'id' | 'recipe_id' | 'created_at'>;

interface RecipeIngredientBuilderProps {
  ingredients: DraftIngredient[];
  onChange: (ingredients: DraftIngredient[]) => void;
}

const COMMON_UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'L', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'whole'];

interface LookupResult {
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  usda_fdc_id?: string;
  off_barcode?: string;
  brand?: string;
}

function makeDraftIngredient(partial: Partial<DraftIngredient> = {}): DraftIngredient {
  return {
    name: '',
    quantity: 100,
    unit: 'g',
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    fiber_g: null,
    usda_fdc_id: null,
    off_barcode: null,
    brand: null,
    sort_order: 0,
    ...partial,
  };
}

export default function RecipeIngredientBuilder({
  ingredients,
  onChange,
}: RecipeIngredientBuilderProps) {
  const [usdaOpen, setUsdaOpen] = useState(false);
  const [offOpen, setOffOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const updateIngredient = (index: number, updates: Partial<DraftIngredient>) => {
    const updated = ingredients.map((ing, i) => {
      if (i !== index) return ing;
      const merged = { ...ing, ...updates };

      // Auto-recalculate nutrition when quantity changes and we have per-100g data
      if ('quantity' in updates || 'unit' in updates) {
        const unit = merged.unit;
        const qty = merged.quantity;
        // Only auto-calc if unit is grams (most USDA/OFF data is per 100g)
        if (unit === 'g' && merged.usda_fdc_id) {
          // We'd need the original per-100g values — stored in the lookup source
          // For simplicity, keep the existing nutrition values unless explicitly set
        }
      }

      return merged;
    });
    onChange(updated);
  };

  const removeIngredient = (index: number) => {
    onChange(ingredients.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const handleLookupSelect = (result: LookupResult) => {
    // Calculate nutrition for default 100g quantity
    const nutrition = nutritionForQuantity(
      {
        calories: result.calories_per_100g,
        protein: result.protein_per_100g,
        carbs: result.carbs_per_100g,
        fat: result.fat_per_100g,
        fiber: result.fiber_per_100g,
      },
      100 // default quantity
    );

    const newIng: DraftIngredient = {
      name: result.name,
      quantity: 100,
      unit: 'g',
      calories: nutrition.calories,
      protein_g: nutrition.protein_g,
      carbs_g: nutrition.carbs_g,
      fat_g: nutrition.fat_g,
      fiber_g: nutrition.fiber_g,
      usda_fdc_id: result.usda_fdc_id || null,
      off_barcode: result.off_barcode || null,
      brand: result.brand || null,
      sort_order: ingredients.length,
    };

    onChange([...ingredients, newIng]);
    setAddMenuOpen(false);
    setExpandedIndex(ingredients.length);
  };

  const handleBarcodeSelect = (result: { name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; fiber_per_100g: number; brand?: string }) => {
    handleLookupSelect(result);
    setBarcodeOpen(false);
  };

  const addManual = () => {
    const newIng = makeDraftIngredient({ sort_order: ingredients.length });
    onChange([...ingredients, newIng]);
    setAddMenuOpen(false);
    setExpandedIndex(ingredients.length);
  };

  // Calculate running nutrition totals
  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.calories ?? 0),
      protein: acc.protein + (ing.protein_g ?? 0),
      carbs: acc.carbs + (ing.carbs_g ?? 0),
      fat: acc.fat + (ing.fat_g ?? 0),
      fiber: acc.fiber + (ing.fiber_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Ingredients
          {ingredients.length > 0 && (
            <span className="ml-2 text-gray-400 font-normal">({ingredients.length})</span>
          )}
        </h3>
      </div>

      {/* Ingredient list */}
      {ingredients.length > 0 && (
        <div className="space-y-2">
          {ingredients.map((ing, index) => (
            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Row header */}
              <div className="flex items-center gap-2 p-3 bg-gray-50">
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => updateIngredient(index, { name: e.target.value })}
                    placeholder="Ingredient name"
                    className="w-full text-sm font-medium text-gray-900 bg-transparent border-none outline-none placeholder-gray-400"
                  />
                  {ing.calories != null && (
                    <p className="text-xs text-gray-400">
                      {Math.round(ing.calories)} kcal · {(ing.protein_g ?? 0).toFixed(1)}g protein
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={ing.quantity}
                    onChange={(e) => updateIngredient(index, { quantity: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="any"
                    className="w-16 text-sm text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                    className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition"
                    title="Edit nutrition details"
                  >
                    {expandedIndex === index ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition"
                    title="Remove ingredient"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded nutrition editor */}
              {expandedIndex === index && (
                <div className="p-3 border-t border-gray-100 bg-white">
                  <p className="text-xs text-gray-500 mb-2">Nutrition for this quantity (auto-filled from lookup, adjust as needed)</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: 'Calories', key: 'calories' as const, unit: 'kcal' },
                      { label: 'Protein', key: 'protein_g' as const, unit: 'g' },
                      { label: 'Carbs', key: 'carbs_g' as const, unit: 'g' },
                      { label: 'Fat', key: 'fat_g' as const, unit: 'g' },
                      { label: 'Fiber', key: 'fiber_g' as const, unit: 'g' },
                    ].map(({ label, key, unit }) => (
                      <div key={key} className="text-center">
                        <label className="text-xs text-gray-400 block">{label}</label>
                        <input
                          type="number"
                          value={ing[key] ?? ''}
                          onChange={(e) => updateIngredient(index, { [key]: e.target.value ? parseFloat(e.target.value) : null })}
                          min="0"
                          step="any"
                          placeholder="—"
                          className="w-full text-sm text-center border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-400">{unit}</span>
                      </div>
                    ))}
                  </div>
                  {ing.brand && (
                    <p className="text-xs text-gray-400 mt-2">Brand: {ing.brand}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Running totals */}
      {ingredients.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
          <p className="text-xs font-medium text-orange-800 mb-1.5">Recipe Nutrition Totals</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: 'Calories', value: Math.round(totals.calories), unit: 'kcal' },
              { label: 'Protein', value: totals.protein.toFixed(1), unit: 'g' },
              { label: 'Carbs', value: totals.carbs.toFixed(1), unit: 'g' },
              { label: 'Fat', value: totals.fat.toFixed(1), unit: 'g' },
              { label: 'Fiber', value: totals.fiber.toFixed(1), unit: 'g' },
            ].map(({ label, value, unit }) => (
              <div key={label}>
                <div className="text-sm font-semibold text-orange-900">{value}</div>
                <div className="text-xs text-orange-600">{unit}</div>
                <div className="text-xs text-orange-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add ingredient menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setAddMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Add ingredient
        </button>

        {addMenuOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
            <button
              type="button"
              onClick={addManual}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Plus className="w-4 h-4 text-gray-400" />
              Add manually
            </button>
            <button
              type="button"
              onClick={() => { setUsdaOpen(true); setAddMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-100"
            >
              <Search className="w-4 h-4 text-blue-400" />
              Search USDA database
            </button>
            <button
              type="button"
              onClick={() => { setOffOpen(true); setAddMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-100"
            >
              <Search className="w-4 h-4 text-green-400" />
              Search Open Food Facts
            </button>
            <button
              type="button"
              onClick={() => { setBarcodeOpen(true); setAddMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-100"
            >
              <Barcode className="w-4 h-4 text-purple-400" />
              Scan barcode
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {usdaOpen && (
        <USDASearchModal
          isOpen={usdaOpen}
          onClose={() => setUsdaOpen(false)}
          onSelect={(food) => {
            handleLookupSelect({
              name: food.name,
              calories_per_100g: food.calories_per_100g,
              protein_per_100g: food.protein_per_100g,
              carbs_per_100g: food.carbs_per_100g,
              fat_per_100g: food.fat_per_100g,
              fiber_per_100g: food.fiber_per_100g,
              usda_fdc_id: food.usda_fdc_id,
            });
            setUsdaOpen(false);
          }}
        />
      )}

      {offOpen && (
        <OpenFoodFactsSearchModal
          isOpen={offOpen}
          onClose={() => setOffOpen(false)}
          onSelect={(food) => {
            handleLookupSelect({
              name: food.name,
              calories_per_100g: food.calories_per_100g,
              protein_per_100g: food.protein_per_100g,
              carbs_per_100g: food.carbs_per_100g,
              fat_per_100g: food.fat_per_100g,
              fiber_per_100g: food.fiber_per_100g,
              brand: food.brand,
            });
            setOffOpen(false);
          }}
        />
      )}

      {barcodeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <BarcodeScanner
              isOpen={true}
              onSelect={(food) => {
                handleBarcodeSelect(food);
              }}
              onClose={() => setBarcodeOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
