'use client';

import { useEffect, useState, useCallback } from 'react';
import { ListChecks, Plus, Download, Upload, Search, Loader2, Copy, Trash2, Pencil } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ExerciseFormModal from '@/components/exercises/ExerciseFormModal';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_categories: Category | null;
  primary_muscles: string[] | null;
  media_url: string | null;
  use_count: number;
  is_active: boolean;
}

export default function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editExercise, setEditExercise] = useState<Exercise | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [exRes, catRes] = await Promise.all([
      offlineFetch('/api/exercises?sort=name&dir=asc'),
      offlineFetch('/api/exercises/categories'),
    ]);
    const exData = await exRes.json();
    const catData = await catRes.json();
    setExercises(exData.exercises || []);
    setCategories(catData.categories || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = exercises.filter((ex) => {
    if (categoryFilter !== 'all' && ex.category_id !== categoryFilter) return false;
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDuplicate = async (id: string) => {
    await offlineFetch(`/api/exercises/${id}/duplicate`, { method: 'POST' });
    load();
  };

  const handleDelete = async (id: string) => {
    await offlineFetch(`/api/exercises/${id}`, { method: 'DELETE' });
    load();
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await offlineFetch('/api/exercises/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    setNewCatName('');
    const catRes = await offlineFetch('/api/exercises/categories');
    const catData = await catRes.json();
    setCategories(catData.categories || []);
  };

  const handleDeleteCategory = async (id: string) => {
    const res = await offlineFetch(`/api/exercises/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (categoryFilter === id) setCategoryFilter('all');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ListChecks className="w-7 h-7 text-fuchsia-600 shrink-0" />
            Exercise Library
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} across {categories.length} categories
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setEditExercise(null); setShowForm(true); }}
            className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Exercise
          </button>
          <Link href="/dashboard/data/import/exercises"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Import
          </Link>
          <a href="/api/exercises/export" download
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export
          </a>
        </div>
      </header>

      {/* Category filter + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap flex-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              categoryFilter === 'all'
                ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                categoryFilter === c.id
                  ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {c.name}
            </button>
          ))}
          <button
            onClick={() => setShowCatManager(!showCatManager)}
            className="px-2 py-1.5 rounded-lg text-xs text-gray-500 border border-dashed border-gray-300 hover:border-gray-400"
          >
            + Manage
          </button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Search exercises..."
          />
        </div>
      </div>

      {/* Category manager */}
      {showCatManager && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Manage Categories</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                {c.name}
                <button onClick={() => handleDeleteCategory(c.id)}
                  className="text-gray-400 hover:text-red-500" title="Delete category">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm flex-1"
              placeholder="New category name" onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
            <button onClick={handleAddCategory}
              className="px-3 py-1.5 bg-fuchsia-600 text-white rounded text-sm font-medium hover:bg-fuchsia-700">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Exercise grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {search || categoryFilter !== 'all' ? 'No exercises match your filters.' : 'No exercises yet. Create your first one!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ex) => (
            <div key={ex.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition group">
              <Link href={`/dashboard/exercises/${ex.id}`} className="block">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-fuchsia-700 transition">
                    {ex.name}
                  </h3>
                  {ex.exercise_categories && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0 ml-2">
                      {ex.exercise_categories.name}
                    </span>
                  )}
                </div>
                {ex.primary_muscles && ex.primary_muscles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {ex.primary_muscles.slice(0, 4).map((m) => (
                      <span key={m} className="text-[10px] px-1.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 rounded">
                        {m}
                      </span>
                    ))}
                    {ex.primary_muscles.length > 4 && (
                      <span className="text-[10px] text-gray-400">+{ex.primary_muscles.length - 4}</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500">Used {ex.use_count} time{ex.use_count !== 1 ? 's' : ''}</p>
              </Link>
              <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-100">
                <button onClick={() => { setEditExercise(ex); setShowForm(true); }}
                  className="p-1.5 rounded text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDuplicate(ex.id)}
                  className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="Duplicate">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(ex.id)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ExerciseFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditExercise(null); }}
        onSaved={load}
        initial={editExercise ? { ...editExercise, exercise_equipment: [] } : undefined}
        categories={categories}
      />
    </div>
  );
}
