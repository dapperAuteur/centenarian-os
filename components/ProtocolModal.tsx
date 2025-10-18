/* eslint-disable @typescript-eslint/no-explicit-any */
// File: components/ProtocolModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Ingredient, ProtocolWithIngredients, NCVScore } from '@/lib/types';
import { X, Plus, Trash2 } from 'lucide-react';

interface ProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
  protocol?: ProtocolWithIngredients | null;
}

interface IngredientEntry {
  ingredient_id: string;
  quantity: number;
  unit: string;
}

export function ProtocolModal({ isOpen, onClose, protocol }: ProtocolModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<IngredientEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadIngredients();
    }
  }, [isOpen]);

  useEffect(() => {
    if (protocol && isOpen) {
      setName(protocol.name);
      setDescription(protocol.description || '');
      
      const entries: IngredientEntry[] = protocol.protocol_ingredients?.map(pi => ({
        ingredient_id: pi.ingredient_id,
        quantity: pi.quantity,
        unit: pi.unit,
      })) || [];
      setSelectedIngredients(entries);
    } else if (isOpen) {
      resetForm();
    }
  }, [protocol, isOpen]);

  const loadIngredients = async () => {
    const { data } = await supabase
      .from('ingredients')
      .select('*')
      .order('name');
    
    if (data) setIngredients(data);
  };

  const addIngredient = () => {
    if (ingredients.length > 0) {
      setSelectedIngredients([
        ...selectedIngredients,
        { ingredient_id: ingredients[0].id, quantity: 100, unit: 'g' }
      ]);
    }
  };

  const removeIngredient = (index: number) => {
    setSelectedIngredients(selectedIngredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof IngredientEntry, value: any) => {
    const updated = [...selectedIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedIngredients(updated);
  };

  const calculateTotals = () => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCost = 0;
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    selectedIngredients.forEach(entry => {
      const ingredient = ingredients.find(i => i.id === entry.ingredient_id);
      if (!ingredient) return;

      // Convert quantity to 100g equivalent
      const multiplier = entry.quantity / 100;
      
      totalCalories += ingredient.calories_per_100g * multiplier;
      totalProtein += ingredient.protein_per_100g * multiplier;
      totalCost += ingredient.cost_per_unit * (entry.quantity / 100); // Approximate

      if (ingredient.ncv_score === 'Green') greenCount++;
      else if (ingredient.ncv_score === 'Yellow') yellowCount++;
      else redCount++;
    });

    // Determine overall NCV score (simplified logic)
    let ncvScore: NCVScore = 'Green';
    if (redCount > greenCount) ncvScore = 'Red';
    else if (yellowCount > greenCount) ncvScore = 'Yellow';

    return { totalCalories, totalProtein, totalCost, ncvScore };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (selectedIngredients.length === 0) {
        throw new Error('Add at least one ingredient');
      }

      const { totalCalories, totalProtein, totalCost, ncvScore } = calculateTotals();

      const protocolData = {
        name,
        description: description || null,
        ncv_score: ncvScore,
        total_cost: totalCost,
        total_calories: totalCalories,
        total_protein: totalProtein,
        user_id: user.id,
      };

      let protocolId: string;

      if (protocol) {
        const { error } = await supabase
          .from('protocols')
          .update(protocolData)
          .eq('id', protocol.id);
        if (error) throw error;
        
        // Delete old ingredients
        await supabase
          .from('protocol_ingredients')
          .delete()
          .eq('protocol_id', protocol.id);
        
        protocolId = protocol.id;
      } else {
        const { data, error } = await supabase
          .from('protocols')
          .insert([protocolData])
          .select()
          .single();
        if (error) throw error;
        protocolId = data.id;
      }

      // Insert new ingredients
      const protocolIngredients = selectedIngredients.map(entry => ({
        protocol_id: protocolId,
        ...entry,
      }));

      const { error: ingredientsError } = await supabase
        .from('protocol_ingredients')
        .insert(protocolIngredients);
      
      if (ingredientsError) throw ingredientsError;

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedIngredients([]);
    setError('');
  };

  const { totalCalories, totalProtein, totalCost, ncvScore } = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {protocol ? 'Edit Protocol' : 'Create Protocol'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Protocol Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Tuna Ceviche"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this meal..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">Ingredients *</label>
              <button
                type="button"
                onClick={addIngredient}
                className="flex items-center px-3 py-1 text-sm bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Ingredient
              </button>
            </div>

            {selectedIngredients.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                No ingredients added yet. Click &quot;Add Ingredient&quot; to start.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedIngredients.map((entry, index) => (
                  <div key={index} className="flex gap-2 items-center bg-gray-50 p-3 rounded-lg">
                    <select
                      value={entry.ingredient_id}
                      onChange={(e) => updateIngredient(index, 'ingredient_id', e.target.value)}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm"
                    >
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      value={entry.quantity}
                      onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value))}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm form-input"
                    />
                    <select
                      value={entry.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="oz">oz</option>
                      <option value="cup">cup</option>
                      <option value="tbsp">tbsp</option>
                      <option value="whole">whole</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals Preview */}
          {selectedIngredients.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Protocol Totals</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">NCV Score</div>
                  <div className={`text-lg font-bold ${
                    ncvScore === 'Green' ? 'text-lime-700' :
                    ncvScore === 'Yellow' ? 'text-amber-700' :
                    'text-red-700'
                  }`}>
                    {ncvScore}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Calories</div>
                  <div className="text-lg font-bold text-gray-900">{totalCalories.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Protein</div>
                  <div className="text-lg font-bold text-gray-900">{totalProtein.toFixed(1)}g</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Cost</div>
                  <div className="text-lg font-bold text-gray-900">${totalCost.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

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
              {loading ? 'Saving...' : protocol ? 'Update Protocol' : 'Create Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}