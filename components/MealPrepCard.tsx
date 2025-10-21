// File: components/MealPrepCard.tsx

import { MealPrepBatch, Protocol } from '@/lib/types';
import { Edit2, Trash2, MinusCircle } from 'lucide-react';
import { useState } from 'react';

interface MealPrepCardProps {
  batch: MealPrepBatch & { protocol?: Protocol };
  onEdit: (batch: MealPrepBatch) => void;
  onDelete: (id: string) => void;
  onServeEaten: (batch: MealPrepBatch, servings: number) => void;
}

export function MealPrepCard({ batch, onEdit, onDelete, onServeEaten }: MealPrepCardProps) {
  const [servingsToEat, setServingsToEat] = useState(1);
  const isFinished = !!batch.date_finished;
  const daysOld = Math.floor(
    (new Date().getTime() - new Date(batch.date_made).getTime()) / (1000 * 60 * 60 * 24)
  );

  const percentRemaining = (batch.servings_remaining / batch.servings_made) * 100;

  return (
    <div className={`bg-white rounded-xl shadow-md border-l-4 p-4 hover:shadow-lg transition ${
      isFinished ? 'border-gray-400 opacity-70' : 'border-lime-500'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-grow">
          <h3 className="text-lg font-bold text-gray-900">
            {batch.protocol?.name || 'Unknown Protocol'}
          </h3>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mt-1 ${
            isFinished 
              ? 'bg-gray-100 text-gray-600'
              : daysOld > 4 
                ? 'bg-red-100 text-red-700' 
                : daysOld > 2
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-lime-100 text-lime-700'
          }`}>
            {isFinished ? 'Finished' : `${daysOld} days old`}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(batch)}
            className="text-gray-400 hover:text-sky-600 transition"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(batch.id)}
            className="text-gray-400 hover:text-red-600 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Servings Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Servings Remaining</span>
          <span className="font-semibold text-gray-900">
            {batch.servings_remaining.toFixed(1)} / {batch.servings_made.toFixed(1)}
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              percentRemaining > 50 ? 'bg-lime-500' :
              percentRemaining > 25 ? 'bg-amber-500' :
              'bg-red-500'
            }`}
            style={{ width: `${percentRemaining}%` }}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="space-y-1 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-gray-500">Made:</span>
          <span className="text-gray-900">{new Date(batch.date_made).toLocaleDateString()}</span>
        </div>
        {batch.date_finished && (
          <div className="flex justify-between">
            <span className="text-gray-500">Finished:</span>
            <span className="text-gray-900">{new Date(batch.date_finished).toLocaleDateString()}</span>
          </div>
        )}
        {batch.storage_location && (
          <div className="flex justify-between">
            <span className="text-gray-500">Location:</span>
            <span className="text-gray-900">{batch.storage_location}</span>
          </div>
        )}
      </div>

      {/* Log Serving Eaten */}
      {!isFinished && batch.servings_remaining > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">Log servings eaten</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.5"
              min="0.5"
              max={batch.servings_remaining}
              value={servingsToEat}
              onChange={(e) => setServingsToEat(parseFloat(e.target.value))}
              className="flex-grow px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 form-input"
            />
            <button
              onClick={() => onServeEaten(batch, servingsToEat)}
              className="flex items-center px-3 py-1 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 transition"
            >
              <MinusCircle className="w-4 h-4 mr-1" />
              Ate
            </button>
          </div>
        </div>
      )}

      {batch.notes && (
        <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200">
          {batch.notes}
        </p>
      )}
    </div>
  );
}