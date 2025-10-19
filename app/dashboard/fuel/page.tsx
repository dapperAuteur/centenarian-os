/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/dashboard/fuel/page.tsx

'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle } from 'lucide-react';

interface LowStockItem {
  id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
}

export default function FuelPage() {
  const [stats, setStats] = useState({
    ingredientCount: 0,
    protocolCount: 0,
    todayMeals: 0,
    weekCost: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [ingRes, protRes, mealsRes, inventoryRes] = await Promise.all([
      supabase.from('ingredients').select('id', { count: 'exact', head: true }),
      supabase.from('protocols').select('id', { count: 'exact', head: true }),
      supabase
        .from('meal_logs')
        .select('id', { count: 'exact', head: true })
        .eq('date', today),
      supabase
        .from('inventory')
        .select(`
          id,
          quantity,
          unit,
          low_stock_threshold,
          ingredient:ingredients(name)
        `)
    ]);

    // Calculate week cost (simplified - would need protocol join in real impl)
    const { data: weekMeals } = await supabase
      .from('meal_logs')
      .select('protocol_id')
      .gte('date', weekAgo.toISOString().split('T')[0]);

    let weekCost = 0;
    if (weekMeals) {
      const protocolIds = weekMeals
        .filter(m => m.protocol_id)
        .map(m => m.protocol_id);
      
      if (protocolIds.length > 0) {
        const { data: protocols } = await supabase
          .from('protocols')
          .select('total_cost')
          .in('id', protocolIds);
        
        if (protocols) {
          weekCost = protocols.reduce((sum, p) => sum + p.total_cost, 0);
        }
      }
    }

    // Filter low stock items in JavaScript
    const lowStock: LowStockItem[] = (inventoryRes.data || [])
      .filter((item: any) => item.quantity <= item.low_stock_threshold)
      .map((item: any) => ({
        id: item.id,
        ingredient_name: item.ingredient?.name || 'Unknown',
        quantity: item.quantity,
        unit: item.unit,
        low_stock_threshold: item.low_stock_threshold,
      }));

    setStats({
      ingredientCount: ingRes.count || 0,
      protocolCount: protRes.count || 0,
      todayMeals: mealsRes.count || 0,
      weekCost,
    });
    setLowStockItems(lowStock);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const modules = [
    {
      title: 'Ingredients',
      description: 'Manage your ingredient library',
      href: '/dashboard/fuel/ingredients',
      icon: '🥗',
      stat: stats.ingredientCount,
      statLabel: 'ingredients',
    },
    {
      title: 'Protocols',
      description: 'Your saved recipes',
      href: '/dashboard/fuel/protocols',
      icon: '📋',
      stat: stats.protocolCount,
      statLabel: 'recipes',
    },
    {
      title: 'Meals',
      description: 'Log daily nutrition',
      href: '/dashboard/fuel/meals',
      icon: '🍽️',
      stat: stats.todayMeals,
      statLabel: 'today',
    },
    {
      title: 'Meal Prep',
      description: 'Track large cooking batches and servings',
      href: '/dashboard/fuel/meal-prep',
      icon: '🍱',
      stat: lowStockItems.length,
      statLabel: 'active batches',
      alert: lowStockItems.length > 0,
    },
    {
      title: 'Inventory',
      description: 'Track ingredient stock',
      href: '/dashboard/fuel/inventory',// dashboard/fuel/meal-prep
      icon: '📦',
      stat: lowStockItems.length,
      statLabel: 'low stock',
      alert: lowStockItems.length > 0,
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Fuel Module</h1>
        <p className="text-gray-600">Nutrition tracking with NCV framework</p>
      </header>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-8">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-grow">
              <h3 className="text-lg font-bold text-red-900 mb-2">
                {lowStockItems.length} Ingredient{lowStockItems.length > 1 ? 's' : ''} Low on Stock
              </h3>
              <div className="space-y-1 mb-3">
                {lowStockItems.slice(0, 3).map(item => (
                  <p key={item.id} className="text-sm text-red-800">
                    • <strong>{item.ingredient_name}</strong>: {item.quantity.toFixed(1)} {item.unit} 
                    (need {item.low_stock_threshold} {item.unit})
                  </p>
                ))}
                {lowStockItems.length > 3 && (
                  <p className="text-sm text-red-700">
                    ...and {lowStockItems.length - 3} more
                  </p>
                )}
              </div>
              <Link
                href="/dashboard/fuel/inventory"
                className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
              >
                View Inventory →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Overview */}
      <div className="bg-gradient-to-r from-lime-500 to-sky-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Nutrition at a Glance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">{stats.todayMeals}</div>
            <p className="text-sm">Meals logged today</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">${stats.weekCost.toFixed(0)}</div>
            <p className="text-sm">Spent this week</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">{stats.protocolCount}</div>
            <p className="text-sm">Saved protocols</p>
          </div>
        </div>
      </div>

      {/* Module Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105 ${
                module.alert ? 'ring-2 ring-red-400' : ''
              }`}
            >
              {module.alert && (
                <div className="absolute top-2 right-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              )}
              <div className="text-5xl mb-4">{module.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{module.description}</p>
              <div className="pt-4 border-t border-gray-200">
                <div className={`text-2xl font-bold ${
                  module.alert ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {module.stat}
                </div>
                <div className="text-xs text-gray-500">{module.statLabel}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}