/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/dashboard/fuel/page.tsx

'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useServingsThreshold } from '@/lib/hooks/useServingsThreshold';
import { AlertTriangle } from 'lucide-react';

interface LowStockItem {
  id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
}

interface LowServingsBatch {
  id: string;
  protocol_name: string;
  servings_remaining: number;
  date_made: string;
}

export default function FuelPage() {
  const [stats, setStats] = useState({
    ingredientCount: 0,
    protocolCount: 0,
    todayMeals: 0,
    weekCost: 0,
    activeBatches: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [lowServingsBatches, setLowServingsBatches] = useState<LowServingsBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const { threshold } = useServingsThreshold();
  const supabase = createClient();

  const loadStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [ingRes, protRes, mealsRes, inventoryRes, batchesRes] = await Promise.all([
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
        `),
      supabase
        .from('meal_prep_batches')
        .select(`
          id,
          servings_remaining,
          date_made,
          date_finished,
          protocol:protocols(name)
        `)
        .is('date_finished', null)
    ]);

    // Calculate week cost
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

    // Filter low stock ingredients
    const lowStock: LowStockItem[] = (inventoryRes.data || [])
      .filter((item: any) => item.quantity <= item.low_stock_threshold)
      .map((item: any) => ({
        id: item.id,
        ingredient_name: item.ingredient?.name || 'Unknown',
        quantity: item.quantity,
        unit: item.unit,
        low_stock_threshold: item.low_stock_threshold,
      }));

    // Filter low servings batches
    const lowBatches: LowServingsBatch[] = (batchesRes.data || [])
      .filter((batch: any) => batch.servings_remaining < threshold)
      .map((batch: any) => ({
        id: batch.id,
        protocol_name: batch.protocol?.name || 'Unknown',
        servings_remaining: batch.servings_remaining,
        date_made: batch.date_made,
      }));

    setStats({
      ingredientCount: ingRes.count || 0,
      protocolCount: protRes.count || 0,
      todayMeals: mealsRes.count || 0,
      weekCost,
      activeBatches: batchesRes.data?.length || 0,
    });
    setLowStockItems(lowStock);
    setLowServingsBatches(lowBatches);
    setLoading(false);
  }, [supabase, threshold]);

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
      title: 'Recipes (Protocols)',
      description: 'Your saved recipes',
      href: '/dashboard/fuel/protocols',
      icon: '📋',
      stat: stats.protocolCount,
      statLabel: 'recipes',
    },
    {
      title: 'Meal Prep',
      description: 'Track large cooking batches',
      href: '/dashboard/fuel/meal-prep',
      icon: '🍱',
      stat: stats.activeBatches,
      statLabel: 'active batches',
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
      title: 'Inventory',
      description: 'Track ingredient stock',
      href: '/dashboard/fuel/inventory',
      icon: '📦',
      stat: lowStockItems.length,
      statLabel: 'low stock',
      alert: lowStockItems.length > 0,
    },
    {
      title: 'Recipe Ideas',
      description: 'AI suggestions from inventory',
      href: '/roadmap',
      icon: '💡',
      stat: 0,
      statLabel: 'coming soon',
      comingSoon: true,
    },
  ];

  const hasAlerts = lowStockItems.length > 0 || lowServingsBatches.length > 0;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Fuel Module</h1>
        <p className="text-gray-600">Nutrition tracking with NCV framework</p>
      </header>

      {/* Combined Alert Banner */}
      {hasAlerts && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-8">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-grow">
              <h3 className="text-lg font-bold text-red-900 mb-2">
                Inventory Alerts
              </h3>

              {/* Low Stock Ingredients */}
              {lowStockItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">
                    {lowStockItems.length} Raw Ingredient{lowStockItems.length > 1 ? 's' : ''} Low
                  </h4>
                  <div className="space-y-1 mb-2">
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
                    className="inline-block px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition"
                  >
                    View Inventory
                  </Link>
                </div>
              )}

              {/* Low Servings Batches */}
              {lowServingsBatches.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-800 mb-1">
                    {lowServingsBatches.length} Prepared Meal{lowServingsBatches.length > 1 ? 's' : ''} Low ({`<${threshold} servings`})
                  </h4>
                  <div className="space-y-1 mb-2">
                    {lowServingsBatches.slice(0, 3).map(batch => (
                      <p key={batch.id} className="text-sm text-red-800">
                        • <strong>{batch.protocol_name}</strong>: {batch.servings_remaining.toFixed(1)} servings left
                      </p>
                    ))}
                    {lowServingsBatches.length > 3 && (
                      <p className="text-sm text-red-700">
                        ...and {lowServingsBatches.length - 3} more
                      </p>
                    )}
                  </div>
                  <Link
                    href="/dashboard/fuel/meal-prep"
                    className="inline-block px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition"
                  >
                    View Meal Prep
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overview */}
      <div className="bg-gradient-to-r from-lime-500 to-sky-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Nutrition at a Glance</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">{stats.todayMeals}</div>
            <p className="text-sm">Meals logged today</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">${stats.weekCost.toFixed(0)}</div>
            <p className="text-sm">Spent this week</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-3xl font-bold">{stats.activeBatches}</div>
            <p className="text-sm">Active meal preps</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105 relative ${
                module.alert ? 'ring-2 ring-red-400' : ''
              } ${module.comingSoon ? 'opacity-75' : ''}`}
            >
              {module.alert && (
                <div className="absolute top-2 right-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              )}
              {module.comingSoon && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">
                  SOON
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