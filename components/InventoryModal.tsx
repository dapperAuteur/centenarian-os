// File: components/InventoryModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Inventory, Ingredient } from '@/lib/types';
import { X } from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItem: (Inventory & { ingredient?: Ingredient }) | null;
  ingredients: Ingredient[];
}

export function InventoryModal({ 
  isOpen, 
  onClose, 
  inventoryItem, 
  ingredients 
}: InventoryModalProps) {
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('g');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (inventoryItem) {
      setIngredientId(inventoryItem.ingredient_id);
      setQuantity(inventoryItem.quantity.toString());
      setUnit(inventoryItem.unit);
      setLowStockThreshold(inventoryItem.low_stock_threshold.toString());
    } else {
      setIngredientId('');
      setQuantity('');
      setUnit('g');
      setLowStockThreshold('');
    }
  }, [inventoryItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Auto-set unit from ingredient if not editing
    let finalUnit = unit;
    if (!inventoryItem && ingredientId) {
      const ingredient = ingredients.find(i => i.id === ingredientId);
      if (ingredient) {
        finalUnit = ingredient.unit;
      }
    }

    const data = {
      user_id: user.id,
      ingredient_id: ingredientId,
      quantity: parseFloat(quantity),
      unit: finalUnit,
      low_stock_threshold: parseFloat(lowStockThreshold),
      last_restocked: new Date().toISOString(),
    };

    if (inventoryItem) {
      await supabase
        .from('inventory')
        .update(data)
        .eq('id', inventoryItem.id);
    } else {
      await supabase
        .from('inventory')
        .insert([data]);
    }

    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {inventoryItem ? 'Edit' : 'Add'} Inventory Item
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ingredient *
            </label>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              required
              disabled={!!inventoryItem}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 disabled:bg-gray-100 form-input"
            >
              <option value="">Select ingredient...</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
            {inventoryItem && (
              <p className="text-xs text-gray-500 mt-1">
                Cannot change ingredient for existing inventory
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Quantity *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit *
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
            >
              <option value="g">Grams (g)</option>
              <option value="ml">Milliliters (ml)</option>
              <option value="oz">Ounces (oz)</option>
              <option value="lb">Pounds (lb)</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="cup">Cups</option>
              <option value="tbsp">Tablespoons</option>
              <option value="tsp">Teaspoons</option>
              <option value="whole">Whole unit</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Low Stock Threshold *
            </label>
            <input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              required
              step="0.01"
              min="0"
              placeholder="Alert when stock falls below this"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              You&apos;ll be alerted when quantity drops below this threshold
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Saving...' : inventoryItem ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}