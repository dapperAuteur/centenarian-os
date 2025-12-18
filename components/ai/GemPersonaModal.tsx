// File: components/ai/GemPersonaModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GemPersona } from '@/lib/types';
import { X } from 'lucide-react';

interface GemPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  gem: GemPersona | null; // If null, we are creating a new Gem
}

export function GemPersonaModal({ isOpen, onClose, gem }: GemPersonaModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Populate form when 'gem' prop changes (for editing)
  useEffect(() => {
    if (gem) {
      setName(gem.name);
      setDescription(gem.description || '');
      setSystemPrompt(gem.system_prompt);
    } else {
      // Reset for creating new
      setName('');
      setDescription('');
      setSystemPrompt('You are a helpful assistant.');
    }
  }, [gem, isOpen]); // Rerun when modal is opened

  if (!isOpen) {
    return null;
  }

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
    };

    if (gem) {
      // Update existing Gem
      const { error: updateError } = await supabase
        .from('gem_personas')
        .update(gemData)
        .eq('id', gem.id);
      
      if (updateError) {
        setError(updateError.message);
      } else {
        onClose(); // Success
      }
    } else {
      // Create new Gem
      const { error: insertError } = await supabase
        .from('gem_personas')
        .insert(gemData);

      if (insertError) {
        setError(insertError.message);
      } else {
        onClose(); // Success
      }
    }

    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
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
              className="form-input" // Using your global class from globals.css
              placeholder="e.g., Language Mastery Coach"
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
              placeholder="A demanding coach for learning new languages."
            />
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
              rows={15}
              placeholder="You are a helpful assistant..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This is the core instruction for the AI. Be descriptive. 
              Remember to include `[START_FLASHCARDS]`...`[END_FLASHCARDS]` if you want this Gem to create flashcards.
            </p>
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
