// File: app/dashboard/gems/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GemPersona } from '@/lib/types';
import { Plus, Edit, Trash2, BrainCircuit, Download, Database, Zap } from 'lucide-react';
import { GemPersonaModal } from '@/components/ai/GemPersonaModal';
import { STARTER_GEMS, StarterGem } from '@/lib/gemini/starter-gems';

const CATEGORY_COLORS: Record<string, string> = {
  coaching: 'bg-green-100 text-green-800',
  language: 'bg-purple-100 text-purple-800',
  business: 'bg-blue-100 text-blue-800',
  creative: 'bg-orange-100 text-orange-800',
  meta: 'bg-pink-100 text-pink-800',
  general: 'bg-gray-100 text-gray-700',
};

export default function GemsPage() {
  const [gems, setGems] = useState<GemPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingStarter, setInstallingStarter] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGem, setEditingGem] = useState<GemPersona | null>(null);

  const supabase = createClient();

  const loadGems = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('gem_personas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Gem Personas:', error);
    } else if (data) {
      setGems(data);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadGems();
  }, [loadGems]);

  const handleOpenCreateModal = () => {
    setEditingGem(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (gem: GemPersona) => {
    setEditingGem(gem);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingGem(null);
    setIsModalOpen(false);
    loadGems();
  };

  const handleDelete = async (gemId: string) => {
    if (!confirm('Are you sure you want to delete this Gem? This action cannot be undone.')) {
      return;
    }

    const { error } = await supabase
      .from('gem_personas')
      .delete()
      .eq('id', gemId);

    if (error) {
      console.error('Error deleting Gem:', error);
      alert('Could not delete the Gem.');
    } else {
      loadGems();
    }
  };

  const handleInstallStarter = async (starter: StarterGem) => {
    setInstallingStarter(starter.name);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setInstallingStarter(null);
      return;
    }

    const { error } = await supabase.from('gem_personas').insert({
      user_id: user.id,
      name: starter.name,
      description: starter.description,
      system_prompt: starter.system_prompt,
      category: starter.category,
      data_sources: starter.data_sources,
      can_take_actions: starter.can_take_actions,
      is_starter: true,
    });

    if (error) {
      console.error('Error installing starter gem:', error);
      alert('Could not install the gem.');
    } else {
      loadGems();
    }

    setInstallingStarter(null);
  };

  // Filter out starters that are already installed
  const installedNames = new Set(gems.map((g) => g.name));
  const availableStarters = STARTER_GEMS.filter((s) => !installedNames.has(s.name));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">AI Gem Manager</h1>
          <p className="text-gray-600">Create and manage your AI personas</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Gem
          </button>
        </div>
      </header>

      {/* Starter Gems */}
      {availableStarters.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Starter Gems</h2>
          <p className="text-sm text-gray-500 mb-4">
            Pre-built gems with data access and action capabilities. Install to get started.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableStarters.map((starter) => (
              <div
                key={starter.name}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{starter.name}</h3>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                        CATEGORY_COLORS[starter.category] || CATEGORY_COLORS.general
                      }`}
                    >
                      {starter.category}
                    </span>
                  </div>
                  <button
                    onClick={() => handleInstallStarter(starter)}
                    disabled={installingStarter === starter.name}
                    className="px-3 py-1.5 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition disabled:opacity-50 shrink-0"
                  >
                    {installingStarter === starter.name ? (
                      '...'
                    ) : (
                      <span className="flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />
                        Install
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-3 flex-grow">
                  {starter.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {starter.data_sources.map((src) => (
                    <span
                      key={src}
                      className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                    >
                      {src}
                    </span>
                  ))}
                  {starter.can_take_actions && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-0.5">
                      <Zap className="w-3 h-3" />
                      actions
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Custom Gems */}
      {gems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <BrainCircuit className="w-16 h-16 mx-auto text-sky-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No AI Gems Yet</h2>
          <p className="text-gray-600 mb-6">
            Create your first &quot;Gem&quot; or install a starter above to begin.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
          >
            Create Your First Gem
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {gems.map((gem) => (
            <div key={gem.id} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-gray-900">{gem.name}</h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        CATEGORY_COLORS[gem.category] || CATEGORY_COLORS.general
                      }`}
                    >
                      {gem.category}
                    </span>
                    {gem.can_take_actions && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                        <Zap className="w-3 h-3" />
                        actions
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-1">{gem.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => handleOpenEditModal(gem)}
                    className="p-2 hover:bg-gray-100 rounded transition"
                    title="Edit Gem"
                  >
                    <Edit className="w-5 h-5 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(gem.id)}
                    className="p-2 hover:bg-gray-100 rounded transition"
                    title="Delete Gem"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Data sources */}
              {gem.data_sources?.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Database className="w-4 h-4 text-gray-400" />
                  {gem.data_sources.map((src) => (
                    <span
                      key={src}
                      className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">System Prompt (Snippet)</h4>
                <p className="text-sm text-gray-700 font-mono bg-gray-50 p-3 rounded-md max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {gem.system_prompt.substring(0, 400)}
                  {gem.system_prompt.length > 400 ? '...' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <GemPersonaModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        gem={editingGem}
      />
    </div>
  );
}
