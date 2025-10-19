// File: app/dashboard/fuel/inventory/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Inventory, Ingredient } from '@/lib/types';
import { AlertTriangle, Plus, Package } from 'lucide-react';
import { InventoryModal } from '@/components/InventoryModal';

interface InventoryWithIngredient extends Inventory {
  ingredient?: Ingredient;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryWithIngredient[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryWithIngredient | null>(null);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [invRes, ingRes] = await Promise.all([
      supabase
        .from('inventory')
        .select(`
          *,
          ingredient:ingredients (*)
        `)
        .order('updated_at', { ascending: false }),
      supabase
        .from('ingredients')
        .select('*')
        .order('name')
    ]);

    if (invRes.data) setInventory(invRes.data);
    if (ingRes.data) setIngredients(ingRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (item: InventoryWithIngredient) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleRestock = async (id: string, newQuantity: number) => {
    await supabase
      .from('inventory')
      .update({
        quantity: newQuantity,
        last_restocked: new Date().toISOString()
      })
      .eq('id', id);
    
    loadData();
  };

  const lowStockItems = inventory.filter(
    item => item.quantity <= item.low_stock_threshold
  );

  const inStockItems = inventory.filter(
    item => item.quantity > item.low_stock_threshold
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600">Track ingredient stock levels</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setModalOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add to Inventory
        </button>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-3xl font-bold text-gray-900">{inventory.length}</p>
            </div>
            <Package className="w-12 h-12 text-sky-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Stock</p>
              <p className="text-3xl font-bold text-lime-600">{inStockItems.length}</p>
            </div>
            <Package className="w-12 h-12 text-lime-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-3xl font-bold text-red-600">{lowStockItems.length}</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      ) : inventory.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No inventory yet
          </h2>
          <p className="text-gray-600 mb-6">
            Add ingredients to track stock levels
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
          >
            Add First Item
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Low Stock Section */}
          {lowStockItems.length > 0 && (
            <div>
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
                <h2 className="text-2xl font-bold text-gray-900">
                  Low Stock ({lowStockItems.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockItems.map((item) => (
                  <InventoryCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onRestock={handleRestock}
                    isLowStock={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* In Stock Section */}
          {inStockItems.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                In Stock ({inStockItems.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inStockItems.map((item) => (
                  <InventoryCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onRestock={handleRestock}
                    isLowStock={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <InventoryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
          loadData();
        }}
        inventoryItem={editingItem}
        ingredients={ingredients}
      />
    </div>
  );
}

// Inventory Card Component
interface InventoryCardProps {
  item: InventoryWithIngredient;
  onEdit: (item: InventoryWithIngredient) => void;
  onRestock: (id: string, quantity: number) => void;
  isLowStock: boolean;
}

function InventoryCard({ item, onEdit, onRestock, isLowStock }: InventoryCardProps) {
  const [restockQuantity, setRestockQuantity] = useState('');

  const handleQuickRestock = () => {
    const qty = parseFloat(restockQuantity);
    if (!isNaN(qty) && qty > 0) {
      onRestock(item.id, item.quantity + qty);
      setRestockQuantity('');
    }
  };

  const stockPercentage = (item.quantity / item.low_stock_threshold) * 100;
  const barColor = isLowStock ? 'bg-red-500' : 'bg-lime-500';

  return (
    <div className={`bg-white rounded-xl shadow-md p-4 ${
      isLowStock ? 'border-2 border-red-300' : 'border border-gray-200'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-900">{item.ingredient?.name}</h3>
          <p className="text-sm text-gray-500">
            {item.quantity.toFixed(1)} {item.unit}
          </p>
        </div>
        <button
          onClick={() => onEdit(item)}
          className="text-gray-400 hover:text-gray-600"
        >
          Edit
        </button>
      </div>

      {/* Stock Level Bar */}
      <div className="mb-3">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${Math.min(stockPercentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Threshold: {item.low_stock_threshold} {item.unit}
        </p>
      </div>

      {/* Quick Restock */}
      <div className="flex space-x-2">
        <input
          type="number"
          value={restockQuantity}
          onChange={(e) => setRestockQuantity(e.target.value)}
          placeholder="Add qty"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500"
        />
        <button
          onClick={handleQuickRestock}
          disabled={!restockQuantity}
          className="px-3 py-1 text-sm bg-sky-600 text-white rounded hover:bg-sky-700 disabled:bg-gray-300 transition"
        >
          +
        </button>
      </div>

      {item.last_restocked && (
        <p className="text-xs text-gray-400 mt-2">
          Last restocked: {new Date(item.last_restocked).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}