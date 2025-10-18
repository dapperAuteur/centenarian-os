// File: app/dashboard/fuel/page.tsx
// Fuel module dashboard

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function FuelPage() {
  const [stats, setStats] = useState({
    ingredientCount: 0,
    protocolCount: 0,
    todayMealCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [ingredientsRes, protocolsRes, mealsRes] = await Promise.all([
      supabase.from('ingredients').select('id', { count: 'exact', head: true }),
      supabase.from('protocols').select('id', { count: 'exact', head: true }),
      supabase.from('meal_logs').select('id', { count: 'exact', head: true }).eq('date', today)
    ]);

    setStats({
      ingredientCount: ingredientsRes.count || 0,
      protocolCount: protocolsRes.count || 0,
      todayMealCount: mealsRes.count || 0,
    });
    setLoading(false);
  };

  const modules = [
    {
      title: 'Ingredients',
      description: 'Manage your curated ingredient library with NCV scoring',
      href: '/dashboard/fuel/ingredients',
      icon: '🥗',
      count: stats.ingredientCount,
      countLabel: 'ingredients',
    },
    {
      title: 'Protocols',
      description: 'Build and save meal templates (recipes)',
      href: '/dashboard/fuel/protocols',
      icon: '🍽️',
      count: stats.protocolCount,
      countLabel: 'protocols',
    },
    {
      title: 'Meal Logging',
      description: 'Track daily meals and nutrition',
      href: '/dashboard/fuel/meals',
      icon: '📊',
      count: stats.todayMealCount,
      countLabel: 'meals today',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">The Fuel</h1>
        <p className="text-gray-600">Track nutrition with the NCV framework</p>
      </header>

      {/* NCV Framework Explainer */}
      <div className="bg-gradient-to-r from-lime-500 to-sky-500 rounded-2xl shadow-xl p-8 mb-8 text-white">
        <h2 className="text-2xl font-bold mb-4">NCV Framework</h2>
        <p className="mb-4">Nutritional Color Value - A simple system to classify foods:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-xl font-bold mb-1">🟢 Green</div>
            <p className="text-sm">Nutrient-dense, low-calorie foods (vegetables, lean proteins)</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-xl font-bold mb-1">🟡 Yellow</div>
            <p className="text-sm">Moderate foods (grains, dairy, some fruits)</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
            <div className="text-xl font-bold mb-1">🔴 Red</div>
            <p className="text-sm">Calorie-dense foods (oils, nuts, processed foods)</p>
          </div>
        </div>
      </div>

      {/* Module Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105"
            >
              <div className="text-5xl mb-4">{module.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{module.description}</p>
              <div className="pt-4 border-t border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{module.count}</div>
                <div className="text-xs text-gray-500">{module.countLabel}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/fuel/ingredients"
            className="px-4 py-3 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition text-center font-medium"
          >
            Add Ingredient
          </Link>
          <Link
            href="/dashboard/fuel/protocols"
            className="px-4 py-3 bg-lime-100 text-lime-700 rounded-lg hover:bg-lime-200 transition text-center font-medium"
          >
            Create Protocol
          </Link>
          <Link
            href="/dashboard/fuel/meals"
            className="px-4 py-3 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition text-center font-medium"
          >
            Log Meal
          </Link>
        </div>
      </div>
    </div>
  );
}