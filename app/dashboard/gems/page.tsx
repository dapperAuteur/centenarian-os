// File: app/dashboard/gems/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GemPersona } from '@/lib/types'; // Import from our main types file
import { Plus, Edit, Trash2, BrainCircuit } from 'lucide-react';
import { GemPersonaModal } from '@/components/ai/GemPersonaModal'; // We will create this

export default function GemsPage() {
  const [gems, setGems] = useState<GemPersona[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    loadGems(); // Refresh the list after modal closes
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
      loadGems(); // Refresh the list
    }
  };

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

      {gems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">
            <BrainCircuit className="w-16 h-16 mx-auto text-sky-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No AI Gems Yet</h2>
          <p className="text-gray-600 mb-6">
            Create your first &quot;Gem&quot; to start a new AI-powered chat experience.
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
                  <h2 className="text-2xl font-bold text-gray-900">{gem.name}</h2>
                  <p className="text-gray-600 mt-1">{gem.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
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

      {/* Create/Edit Modal */}
      <GemPersonaModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        gem={editingGem}
      />
    </div>
  );
}
