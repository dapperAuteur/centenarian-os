'use client';

import { useState } from 'react';
import { X, ChefHat, Check, AlertCircle, ExternalLink } from 'lucide-react';
import type { Recipe } from '@/lib/types';

interface AddToFuelModalProps {
  recipe: Pick<Recipe, 'id' | 'title'>;
  isOpen: boolean;
  onClose: () => void;
}

type CloneState = 'idle' | 'loading' | 'success' | 'error';

interface CloneResult {
  protocolId: string;
  matchedCount: number;
  createdCount: number;
}

export default function AddToFuelModal({ recipe, isOpen, onClose }: AddToFuelModalProps) {
  const [state, setState] = useState<CloneState>('idle');
  const [result, setResult] = useState<CloneResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAdd = async () => {
    setState('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/recipes/${recipe.id}/clone`, { method: 'POST' });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add recipe to Fuel module');
      }

      const data: CloneResult = await res.json();
      setResult(data);
      setState('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  };

  const handleClose = () => {
    setState('idle');
    setResult(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-900">Add to My Fuel</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {state === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This will create a new <strong>Protocol</strong> in your Fuel module from{' '}
                <strong>&ldquo;{recipe.title}&rdquo;</strong>.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
                <p className="font-medium">What happens:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  <li>A new Protocol is created in your library</li>
                  <li>Recipe ingredients are matched to your existing ingredients</li>
                  <li>Unmatched ingredients are added to your library automatically</li>
                  <li>Nutrition totals are carried over from the recipe</li>
                </ul>
              </div>
              <button
                onClick={handleAdd}
                className="w-full py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
              >
                Add to My Protocols
              </button>
            </div>
          )}

          {state === 'loading' && (
            <div className="py-8 flex flex-col items-center gap-3 text-gray-500">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Creating protocol and matching ingredients…</p>
            </div>
          )}

          {state === 'success' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="w-5 h-5" />
                <span className="font-medium">Protocol created successfully!</span>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 space-y-1">
                <p><strong>{result.matchedCount}</strong> ingredient{result.matchedCount !== 1 ? 's' : ''} matched from your library</p>
                {result.createdCount > 0 && (
                  <p><strong>{result.createdCount}</strong> new ingredient{result.createdCount !== 1 ? 's' : ''} added to your library</p>
                )}
              </div>
              <a
                href="/dashboard/fuel/protocols"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
              >
                <ExternalLink className="w-4 h-4" />
                View My Protocols
              </a>
              <button
                onClick={handleClose}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Close
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Something went wrong</span>
              </div>
              <p className="text-sm text-red-600">{errorMsg}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
                >
                  Try again
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
