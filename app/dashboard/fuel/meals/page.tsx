// File: app/dashboard/fuel/meals/page.tsx

'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MealLog, Protocol, MealType } from '@/lib/types';
import { Plus } from 'lucide-react';

export default function MealLoggingPage() {
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [protocolId, setProtocolId] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [notes, setNotes] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const today = new Date();
    setDate(today.toISOString().split('T')[0]);
    setTime(today.toTimeString().slice(0, 5));
    loadData();
  }, []);

  const loadData = async () => {
    const [mealsRes, protocolsRes] = await Promise.all([
      supabase
        .from('meal_logs')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(20),
      supabase
        .from('protocols')
        .select('*')
        .order('name')
    ]);

    if (mealsRes.data) setMealLogs(mealsRes.data);
    if (protocolsRes.data) setProtocols(protocolsRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const mealData = {
      user_id: user.id,
      date,
      time,
      protocol_id: protocolId || null,
      meal_type: mealType,
      notes: notes || null,
    };

    const { error } = await supabase
      .from('meal_logs')
      .insert([mealData]);

    if (!error) {
      setNotes('');
      loadData();
    }
  };

  const groupedMeals = useMemo(() => {
    const grouped: Record<string, MealLog[]> = {};
    mealLogs.forEach(meal => {
      if (!grouped[meal.date]) grouped[meal.date] = [];
      grouped[meal.date].push(meal);
    });
    return grouped;
  }, [mealLogs]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Meal Logging</h1>
        <p className="text-gray-600">Track daily nutrition with your protocols</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Log Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Log New Meal</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Protocol</label>
                <select
                  value={protocolId}
                  onChange={(e) => setProtocolId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Select a protocol...</option>
                  {protocols.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
              >
                <Plus className="w-5 h-5 mr-2" />
                Log Meal
              </button>
            </form>
          </div>
        </div>

        {/* Meal History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Meals</h2>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
              </div>
            ) : mealLogs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🍽️</div>
                <p className="text-gray-500">No meals logged yet</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedMeals).map(([dateStr, meals]) => (
                  <div key={dateStr}>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </h3>
                    <div className="space-y-2">
                      {meals.map(meal => {
                        const protocol = protocols.find(p => p.id === meal.protocol_id);
                        return (
                          <div key={meal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-grow">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{meal.time}</span>
                                <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded-full">
                                  {meal.meal_type}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">
                                {protocol?.name || 'Unknown Protocol'}
                              </p>
                              {meal.notes && (
                                <p className="text-xs text-gray-500 mt-1">{meal.notes}</p>
                              )}
                            </div>
                            {protocol && (
                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-900">
                                  {protocol.total_calories.toFixed(0)} cal
                                </div>
                                <div className="text-xs text-gray-500">
                                  ${protocol.total_cost.toFixed(2)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}