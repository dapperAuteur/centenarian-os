// File: components/ai/GemPersonaModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GemPersona } from '@/lib/types';
import { X } from 'lucide-react';

const DATA_SOURCE_OPTIONS = [
  { key: 'health', label: 'Health Metrics' },
  { key: 'finance', label: 'Finance & Transactions' },
  { key: 'travel', label: 'Travel & Vehicles' },
  { key: 'workouts', label: 'Workouts' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'planner', label: 'Planner (Goals/Tasks)' },
  { key: 'academy', label: 'Academy Progress' },
  { key: 'daily_logs', label: 'Daily Logs' },
  { key: 'focus', label: 'Focus Sessions' },
  { key: 'meals', label: 'Meal Logs' },
  { key: 'correlations', label: 'Correlations' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'language', label: 'Language' },
  { value: 'business', label: 'Business' },
  { value: 'creative', label: 'Creative' },
  { value: 'meta', label: 'Meta' },
] as const;

interface GemPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  gem: GemPersona | null;
}

export function GemPersonaModal({ isOpen, onClose, gem }: GemPersonaModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [category, setCategory] = useState('general');
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [canTakeActions, setCanTakeActions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (gem) {
      setName(gem.name);
      setDescription(gem.description || '');
      setSystemPrompt(gem.system_prompt);
      setCategory(gem.category || 'general');
      setDataSources(gem.data_sources || []);
      setCanTakeActions(gem.can_take_actions || false);
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('You are a helpful assistant.');
      setCategory('general');
      setDataSources([]);
      setCanTakeActions(false);
    }
  }, [gem, isOpen]);

  if (!isOpen) return null;

  const toggleDataSource = (key: string) => {
    setDataSources((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in to do this.');
      setIsSaving(false);
      return;
    }

    const gemData = {
      user_id: user.id,
      name,
      description: description || null,
      system_prompt: systemPrompt,
      category,
      data_sources: dataSources,
      can_take_actions: canTakeActions,
    };

    if (gem) {
      const { error: updateError } = await supabase
        .from('gem_personas')
        .update(gemData)
        .eq('id', gem.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        onClose();
      }
    } else {
      const { error: insertError } = await supabase
        .from('gem_personas')
        .insert(gemData);

      if (insertError) {
        setError(insertError.message);
      } else {
        onClose();
      }
    }

    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {gem ? 'Edit Gem Persona' : 'Create New Gem Persona'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="e.g., Health Coach"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              placeholder="What does this gem do?"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-1">
              System Prompt
            </label>
            <textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="form-input font-mono"
              rows={12}
              placeholder="You are a helpful assistant..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              A base directive enforcing direct, critical-partner communication is automatically prepended.
              Include `[START_FLASHCARDS]`...`[END_FLASHCARDS]` instructions for flashcard generation.
            </p>
          </div>

          {/* Data Sources */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Sources
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Select which app data this gem can access during conversations.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DATA_SOURCE_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    dataSources.includes(opt.key)
                      ? 'border-sky-500 bg-sky-50 text-sky-800'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={dataSources.includes(opt.key)}
                    onChange={() => toggleDataSource(opt.key)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                      dataSources.includes(opt.key)
                        ? 'border-sky-500 bg-sky-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {dataSources.includes(opt.key) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  canTakeActions ? 'bg-sky-500' : 'bg-gray-300'
                }`}
                onClick={() => setCanTakeActions(!canTakeActions)}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    canTakeActions ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Allow actions</span>
                <p className="text-xs text-gray-500">
                  Let this gem create records (recipes, workouts, transactions, tasks, gems)
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end items-center p-6 border-t bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition mr-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : (gem ? 'Save Changes' : 'Create Gem')}
          </button>
        </div>
      </div>
    </div>
  );
}
