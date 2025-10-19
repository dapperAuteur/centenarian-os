// File: app/dashboard/fuel/meals/page.tsx

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  const [isRestaurant, setIsRestaurant] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantCity, setRestaurantCity] = useState('');
  const [restaurantState, setRestaurantState] = useState('');
  const [restaurantCountry, setRestaurantCountry] = useState('USA');
  const [restaurantWebsite, setRestaurantWebsite] = useState('');
  const supabase = createClient();

  const loadData = useCallback(async () => {
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
  }, [supabase]);
  
  useEffect(() => {
    const today = new Date();
    setDate(today.toISOString().split('T')[0]);
    setTime(today.toTimeString().slice(0, 5));
    loadData();
  }, [loadData]);

  /**
   * Auto-decrement inventory when a protocol-based meal is logged
   */
  const decrementInventory = async (protocolId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all ingredients in this protocol
    const { data: protocolIngredients } = await supabase
      .from('protocol_ingredients')
      .select('ingredient_id, quantity, unit')
      .eq('protocol_id', protocolId);

    if (!protocolIngredients) return;

    // For each ingredient, decrement inventory
    for (const pi of protocolIngredients) {
      // Check if inventory exists for this ingredient
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .eq('ingredient_id', pi.ingredient_id)
        .single();

      if (existingInventory) {
        // Decrement existing inventory
        const newQuantity = existingInventory.quantity - pi.quantity;
        
        await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', existingInventory.id);
      } else {
        // Create inventory with negative quantity (indicates needed purchase)
        await supabase
          .from('inventory')
          .insert([{
            user_id: user.id,
            ingredient_id: pi.ingredient_id,
            quantity: -pi.quantity, // Negative = you need to buy this much
            unit: pi.unit,
            low_stock_threshold: 0,
            last_restocked: new Date().toISOString()
          }]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const mealData = {
      user_id: user.id,
      date,
      time,
      protocol_id: isRestaurant ? null : (protocolId || null),
      meal_type: mealType,
      notes: notes || null,
      is_restaurant_meal: isRestaurant,
      restaurant_name: isRestaurant ? restaurantName : null,
      restaurant_address: isRestaurant ? restaurantAddress : null,
      restaurant_city: isRestaurant ? restaurantCity : null,
      restaurant_state: isRestaurant ? restaurantState : null,
      restaurant_country: isRestaurant ? restaurantCountry : null,
      restaurant_website: isRestaurant ? restaurantWebsite : null,
    };

    const { error } = await supabase
      .from('meal_logs')
      .insert([mealData]);

    if (!error) {
      // Auto-decrement inventory if protocol was used
      if (!isRestaurant && protocolId) {
        await decrementInventory(protocolId);
      }

      setNotes('');
      setRestaurantName('');
      setRestaurantAddress('');
      setRestaurantCity('');
      setRestaurantState('');
      setRestaurantWebsite('');
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

              {/* Restaurant Toggle */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isRestaurant"
                  checked={isRestaurant}
                  onChange={(e) => setIsRestaurant(e.target.checked)}
                  className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                />
                <label htmlFor="isRestaurant" className="ml-2 text-sm font-medium text-gray-700">
                  Restaurant/Eating Out
                </label>
              </div>

              {/* Protocol (if not restaurant) */}
              {!isRestaurant && (
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
                  <p className="text-xs text-lime-600 mt-1 font-medium">
                    ✓ Inventory will auto-update
                  </p>
                </div>
              )}

              {/* Restaurant Fields */}
              {isRestaurant && (
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name *</label>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      required={isRestaurant}
                      placeholder="e.g., Chipotle"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={restaurantAddress}
                      onChange={(e) => setRestaurantAddress(e.target.value)}
                      placeholder="123 Main St"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={restaurantCity}
                        onChange={(e) => setRestaurantCity(e.target.value)}
                        placeholder="San Francisco"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        value={restaurantState}
                        onChange={(e) => setRestaurantState(e.target.value)}
                        placeholder="CA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={restaurantCountry}
                      onChange={(e) => setRestaurantCountry(e.target.value)}
                      placeholder="USA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={restaurantWebsite}
                      onChange={(e) => setRestaurantWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              )}

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
                                {meal.is_restaurant_meal && (
                                  <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                    🍴 Restaurant
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-1">
                                {meal.is_restaurant_meal 
                                  ? meal.restaurant_name 
                                  : (protocol?.name || 'Unknown Protocol')
                                }
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