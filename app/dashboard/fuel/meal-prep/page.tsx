/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/dashboard/fuel/meal-prep/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MealPrepBatch, Protocol } from '@/lib/types';
import { Plus } from 'lucide-react';
import { MealPrepModal } from '@/components/MealPrepModal';
import { MealPrepCard } from '@/components/MealPrepCard';

export default function MealPrepPage() {
  const [batches, setBatches] = useState<(MealPrepBatch & { protocol?: Protocol })[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<MealPrepBatch | null>(null);
  const [filter, setFilter] = useState<'active' | 'finished' | 'all'>('active');
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [batchesRes, protocolsRes] = await Promise.all([
      supabase
        .from('meal_prep_batches')
        .select(`
          *,
          protocol:protocols (*)
        `)
        .order('date_made', { ascending: false }),
      supabase
        .from('protocols')
        .select('*')
        .order('name')
    ]);

    if (batchesRes.data) setBatches(batchesRes.data);
    if (protocolsRes.data) setProtocols(protocolsRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (batch: MealPrepBatch) => {
    setEditingBatch(batch);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this batch?')) return;
    await supabase.from('meal_prep_batches').delete().eq('id', id);
    loadData();
  };

  const handleServeEaten = async (batch: MealPrepBatch, servingsEaten: number) => {
    const newRemaining = Math.max(0, batch.servings_remaining - servingsEaten);
    const updates: any = { servings_remaining: newRemaining };
    
    if (newRemaining === 0 && !batch.date_finished) {
      updates.date_finished = new Date().toISOString().split('T')[0];
    }

    await supabase
      .from('meal_prep_batches')
      .update(updates)
      .eq('id', batch.id);
    
    loadData();
  };

  const filteredBatches = batches.filter(b => {
    if (filter === 'active') return !b.date_finished;
    if (filter === 'finished') return !!b.date_finished;
    return true;
  });

  const activeBatchCount = batches.filter(b => !b.date_finished).length;
  const totalServingsRemaining = batches
    .filter(b => !b.date_finished)
    .reduce((sum, b) => sum + b.servings_remaining, 0);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Meal Prep Batches</h1>
          <p className="text-gray-600">Track large cooking sessions and servings</p>
        </div>
        <button
          onClick={() => {
            setEditingBatch(null);
            setModalOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Batch
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-lime-50 border-2 border-lime-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-lime-700">{activeBatchCount}</div>
          <div className="text-sm text-lime-600">Active Batches</div>
        </div>
        <div className="bg-sky-50 border-2 border-sky-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-sky-700">{totalServingsRemaining.toFixed(1)}</div>
          <div className="text-sm text-sky-600">Servings Available</div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('active')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'active'
                ? 'bg-lime-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('finished')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'finished'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Finished
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-sky-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Batches */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🍱</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No batches</h2>
          <p className="text-gray-600 mb-6">
            {filter === 'active' 
              ? 'No active meal prep batches. Start cooking!'
              : 'No finished batches to show.'
            }
          </p>
          {filter === 'active' && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
            >
              Create First Batch
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBatches.map((batch) => (
            <MealPrepCard
              key={batch.id}
              batch={batch}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onServeEaten={handleServeEaten}
            />
          ))}
        </div>
      )}

      <MealPrepModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBatch(null);
          loadData();
        }}
        batch={editingBatch}
        protocols={protocols}
      />
    </div>
  );
}