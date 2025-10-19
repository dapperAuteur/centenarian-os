/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Ingredient, NCVScore } from '@/lib/types';
import { X } from 'lucide-react';
import { USDASearchModal } from './USDASearchModal';

interface IngredientModalProps {
  ingredient: Ingredient | null;
  isOpen: boolean;
  onClose: () => void;
}

export function IngredientModal({ ingredient, isOpen, onClose }: IngredientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    ncv_score: 'Yellow' as NCVScore,
    calories_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
    fiber_per_100g: 0,
    cost_per_unit: 0,
    unit: 'g',
    notes: '',
    brand: '',
    store_name: '',
    store_website: '',
    vendor_notes: '',
    usda_fdc_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [usdaModalOpen, setUsdaModalOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && ingredient) {
      setFormData({
        name: ingredient.name,
        ncv_score: ingredient.ncv_score,
        calories_per_100g: ingredient.calories_per_100g,
        protein_per_100g: ingredient.protein_per_100g,
        carbs_per_100g: ingredient.carbs_per_100g,
        fat_per_100g: ingredient.fat_per_100g,
        fiber_per_100g: ingredient.fiber_per_100g,
        cost_per_unit: ingredient.cost_per_unit,
        unit: ingredient.unit,
        notes: ingredient.notes || '',
        brand: ingredient.brand || '',
        store_name: ingredient.store_name || '',
        store_website: ingredient.store_website || '',
        vendor_notes: ingredient.vendor_notes || '',
        usda_fdc_id: ingredient.usda_fdc_id || '',
      });
    } else if (isOpen) {
      setFormData({
        name: '',
        ncv_score: 'Yellow',
        calories_per_100g: 0,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 0,
        fiber_per_100g: 0,
        cost_per_unit: 0,
        unit: 'g',
        notes: '',
        brand: '',
        store_name: '',
        store_website: '',
        vendor_notes: '',
        usda_fdc_id: '',
      });
    }
  }, [ingredient, isOpen]);

  const handleUSDASelect = (data: any) => {
    setFormData({
      ...formData,
      ...data,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (ingredient) {
      await supabase
        .from('ingredients')
        .update(formData)
        .eq('id', ingredient.id);
    } else {
      await supabase
        .from('ingredients')
        .insert([{ ...formData, user_id: user.id }]);
    }

    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {ingredient ? 'Edit Ingredient' : 'Add Ingredient'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {!ingredient && (
              <button
                type="button"
                onClick={() => setUsdaModalOpen(true)}
                className="w-full px-4 py-3 bg-lime-600 text-white rounded-lg hover:bg-lime-700 font-semibold"
              >
                Import from USDA Database
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NCV Score</label>
                <select
                  value={formData.ncv_score}
                  onChange={(e) => setFormData({ ...formData, ncv_score: e.target.value as NCVScore })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                >
                  <option value="Green">Green</option>
                  <option value="Yellow">Yellow</option>
                  <option value="Red">Red</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">USDA FDC ID</label>
                <input
                  type="text"
                  value={formData.usda_fdc_id}
                  onChange={(e) => setFormData({ ...formData, usda_fdc_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calories (per 100g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.calories_per_100g}
                  onChange={(e) => setFormData({ ...formData, calories_per_100g: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Protein (per 100g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.protein_per_100g}
                  onChange={(e) => setFormData({ ...formData, protein_per_100g: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.carbs_per_100g}
                  onChange={(e) => setFormData({ ...formData, carbs_per_100g: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.fat_per_100g}
                  onChange={(e) => setFormData({ ...formData, fat_per_100g: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fiber (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.fiber_per_100g}
                  onChange={(e) => setFormData({ ...formData, fiber_per_100g: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost_per_unit}
                  onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Info (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                    <input
                      type="text"
                      value={formData.store_name}
                      onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store Website</label>
                    <input
                      type="url"
                      value={formData.store_website}
                      onChange={(e) => setFormData({ ...formData, store_website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Notes</label>
                  <textarea
                    value={formData.vendor_notes}
                    onChange={(e) => setFormData({ ...formData, vendor_notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : ingredient ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      <USDASearchModal
        isOpen={usdaModalOpen}
        onClose={() => setUsdaModalOpen(false)}
        onSelect={handleUSDASelect}
      />
    </>
  );
}