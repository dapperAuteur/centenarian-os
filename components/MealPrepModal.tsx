/* eslint-disable @typescript-eslint/no-explicit-any */
// File: components/MealPrepModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MealPrepBatch, Protocol } from '@/lib/types';
import { X } from 'lucide-react';

interface MealPrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch?: MealPrepBatch | null;
  protocols: Protocol[];
}

export function MealPrepModal({ isOpen, onClose, batch, protocols }: MealPrepModalProps) {
  const [protocolId, setProtocolId] = useState('');
  const [dateMade, setDateMade] = useState('');
  const [dateFinished, setDateFinished] = useState('');
  const [servingsMade, setServingsMade] = useState('');
  const [servingsRemaining, setServingsRemaining] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setProtocolId(protocols[0]?.id || '');
    setDateMade(today);
    setDateFinished('');
    setServingsMade('');
    setServingsRemaining('');
    setStorageLocation('');
    setNotes('');
    setError('');
  };
    if (batch && isOpen) {
      setProtocolId(batch.protocol_id);
      setDateMade(batch.date_made);
      setDateFinished(batch.date_finished || '');
      setServingsMade(batch.servings_made.toString());
      setServingsRemaining(batch.servings_remaining.toString());
      setStorageLocation(batch.storage_location || '');
      setNotes(batch.notes || '');
    } else if (isOpen) {
      resetForm();
    }
  }, [batch, isOpen, protocols]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const batchData = {
        protocol_id: protocolId,
        date_made: dateMade,
        date_finished: dateFinished || null,
        servings_made: parseFloat(servingsMade),
        servings_remaining: parseFloat(servingsRemaining),
        storage_location: storageLocation || null,
        notes: notes || null,
        user_id: user.id,
      };

      if (batch) {
        const { error } = await supabase
          .from('meal_prep_batches')
          .update(batchData)
          .eq('id', batch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('meal_prep_batches')
          .insert([batchData]);
        if (error) throw error;
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleServingsMadeChange = (value: string) => {
    setServingsMade(value);
    // Auto-set remaining to made if empty
    if (!servingsRemaining && value) {
      setServingsRemaining(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {batch ? 'Edit Batch' : 'New Meal Prep Batch'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Protocol *</label>
            <select
              value={protocolId}
              onChange={(e) => setProtocolId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select a protocol...</option>
              {protocols.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Made *</label>
              <input
                type="date"
                value={dateMade}
                onChange={(e) => setDateMade(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Finished</label>
              <input
                type="date"
                value={dateFinished}
                onChange={(e) => setDateFinished(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servings Made *</label>
              <input
                type="number"
                step="0.5"
                value={servingsMade}
                onChange={(e) => handleServingsMadeChange(e.target.value)}
                required
                placeholder="8"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servings Remaining *</label>
              <input
                type="number"
                step="0.5"
                value={servingsRemaining}
                onChange={(e) => setServingsRemaining(e.target.value)}
                required
                placeholder="8"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
            <input
              type="text"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="e.g., Fridge - Top Shelf, Freezer"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Extra notes about this batch..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition"
            >
              {loading ? 'Saving...' : batch ? 'Update Batch' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}