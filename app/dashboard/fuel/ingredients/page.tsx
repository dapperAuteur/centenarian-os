// File: app/dashboard/fuel/ingredients/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Ingredient, NCVScore } from '@/lib/types';
import { Plus, Search } from 'lucide-react';
import { IngredientModal } from '@/components/IngredientModal';
import { IngredientCard } from '@/components/IngredientCard';

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNCV, setFilterNCV] = useState<NCVScore | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadIngredients();
  }, []);

  useEffect(() => {
    filterIngredients();
  }, [ingredients, searchTerm, filterNCV]);

  const loadIngredients = async () => {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name');

    if (data) setIngredients(data);
    setLoading(false);
  };

  const filterIngredients = () => {
    let filtered = ingredients;

    if (searchTerm) {
      filtered = filtered.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterNCV !== 'all') {
      filtered = filtered.filter(i => i.ncv_score === filterNCV);
    }

    setFilteredIngredients(filtered);
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ingredient?')) return;
    
    await supabase.from('ingredients').delete().eq('id', id);
    loadIngredients();
  };

  const ncvCounts = {
    Green: ingredients.filter(i => i.ncv_score === 'Green').length,
    Yellow: ingredients.filter(i => i.ncv_score === 'Yellow').length,
    Red: ingredients.filter(i => i.ncv_score === 'Red').length,
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Ingredient Library</h1>
          <p className="text-gray-600">Manage your curated nutrition database</p>
        </div>
        <button
          onClick={() => {
            setEditingIngredient(null);
            setModalOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Ingredient
        </button>
      </header>

      {/* NCV Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-lime-50 border-2 border-lime-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-lime-700">{ncvCounts.Green}</div>
          <div className="text-sm text-lime-600">Green (Nutrient-Dense)</div>
        </div>
        <div className="bg-amber-50 border-2 border-amber-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-amber-700">{ncvCounts.Yellow}</div>
          <div className="text-sm text-amber-600">Yellow (Moderate)</div>
        </div>
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-red-700">{ncvCounts.Red}</div>
          <div className="text-sm text-red-600">Red (Calorie-Dense)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search ingredients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterNCV('all')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                filterNCV === 'all'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterNCV('Green')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                filterNCV === 'Green'
                  ? 'bg-lime-600 text-white'
                  : 'bg-lime-100 text-lime-700 hover:bg-lime-200'
              }`}
            >
              Green
            </button>
            <button
              onClick={() => setFilterNCV('Yellow')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                filterNCV === 'Yellow'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              Yellow
            </button>
            <button
              onClick={() => setFilterNCV('Red')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                filterNCV === 'Red'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              Red
            </button>
          </div>
        </div>
      </div>

      {/* Ingredients Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      ) : filteredIngredients.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🥗</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {searchTerm || filterNCV !== 'all' ? 'No matching ingredients' : 'No ingredients yet'}
          </h2>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterNCV !== 'all' 
              ? 'Try adjusting your filters'
              : 'Add your first ingredient to start tracking nutrition'
            }
          </p>
          {!searchTerm && filterNCV === 'all' && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
            >
              Add First Ingredient
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIngredients.map((ingredient) => (
            <IngredientCard
              key={ingredient.id}
              ingredient={ingredient}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <IngredientModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingIngredient(null);
          loadIngredients();
        }}
        ingredient={editingIngredient}
      />
    </div>
  );
}