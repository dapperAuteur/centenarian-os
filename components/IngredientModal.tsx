/* eslint-disable @typescript-eslint/no-explicit-any */
// File: components/IngredientModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Ingredient, NCVScore } from '@/lib/types';
import { X } from 'lucide-react';

interface IngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient?: Ingredient | null;
}

const UNITS = ['g', 'ml', 'oz', 'lb', 'kg', 'cup', 'tbsp', 'tsp', 'whole'];

export function IngredientModal({ isOpen, onClose, ingredient }: IngredientModalProps) {
  const [name, setName] = useState('');
  const [ncvScore, setNcvScore] = useState<NCVScore>('Green');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [cost, setCost] = useState('');
  const [unit, setUnit] = useState('g');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (ingredient) {
      setName(ingredient.name);
      setNcvScore(ingredient.ncv_score);
      setCalories(ingredient.calories_per_100g.toString());
      setProtein(ingredient.protein_per_100g.toString());
      setCarbs(ingredient.carbs_per_100g.toString());
      setFat(ingredient.fat_per_100g.toString());
      setFiber(ingredient.fiber_per_100g.toString());
      setCost(ingredient.cost_per_unit.toString());
      setUnit(ingredient.unit);
      setNotes(ingredient.notes || '');
    } else {
      resetForm();
    }
  }, [ingredient, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ingredientData = {
        name,
        ncv_score: ncvScore,
        calories_per_100g: parseFloat(calories),
        protein_per_100g: parseFloat(protein),
        carbs_per_100g: parseFloat(carbs),
        fat_per_100g: parseFloat(fat),
        fiber_per_100g: parseFloat(fiber) || 0,
        cost_per_unit: parseFloat(cost),
        unit,
        notes: notes || null,
        user_id: user.id,
      };

      if (ingredient) {
        const { error } = await supabase
          .from('ingredients')
          .update(ingredientData)
          .eq('id', ingredient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ingredients')
          .insert([ingredientData]);
        if (error) throw error;
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setNcvScore('Green');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setFiber('');
    setCost('');
    setUnit('g');
    setNotes('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {ingredient ? 'Edit Ingredient' : 'Add Ingredient'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Wild-Caught Salmon"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">NCV Score *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Green', 'Yellow', 'Red'] as NCVScore[]).map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setNcvScore(score)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    ncvScore === score
                      ? score === 'Green' ? 'bg-lime-600 text-white' :
                        score === 'Yellow' ? 'bg-amber-600 text-white' :
                        'bg-red-600 text-white'
                      : score === 'Green' ? 'bg-lime-100 text-lime-700 hover:bg-lime-200' :
                        score === 'Yellow' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                        'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Calories (per 100g) *
              </label>
              <input
                type="number"
                step="0.1"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protein (g per 100g) *
              </label>
              <input
                type="number"
                step="0.1"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Carbs (g per 100g) *
              </label>
              <input
                type="number"
                step="0.1"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fat (g per 100g) *
              </label>
              <input
                type="number"
                step="0.1"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fiber (g per 100g)
            </label>
            <input
              type="number"
              step="0.1"
              value={fiber}
              onChange={(e) => setFiber(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost *</label>
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
                placeholder="3.99"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (personal observations)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g., Buy from Trader Joe's, pairs well with avocado..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition"
            >
              {loading ? 'Saving...' : ingredient ? 'Update' : 'Add Ingredient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}