/* eslint-disable @typescript-eslint/no-unused-vars */
// File: app/dashboard/fuel/protocols/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Protocol, ProtocolWithIngredients } from '@/lib/types';
import { Plus, Search } from 'lucide-react';
import { ProtocolModal } from '@/components/ProtocolModal';
import { ProtocolCard } from '@/components/ProtocolCard';

export default function ProtocolsPage() {
  const [protocols, setProtocols] = useState<ProtocolWithIngredients[]>([]);
  const [filteredProtocols, setFilteredProtocols] = useState<ProtocolWithIngredients[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<ProtocolWithIngredients | null>(null);
  const supabase = createClient();


  const loadProtocols = async () => {
    const { data, error } = await supabase
      .from('protocols')
      .select(`
        *,
        protocol_ingredients (
          *,
          ingredient:ingredients (*)
        )
      `)
      .order('name');

    if (data) setProtocols(data);
    setLoading(false);
  };

  const filterProtocols = () => {
    if (!searchTerm) {
      setFilteredProtocols(protocols);
      return;
    }

    const filtered = protocols.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProtocols(filtered);
  };
  
  useEffect(() => {
    loadProtocols();
  }, [loadProtocols]);

  useEffect(() => {
    filterProtocols();
  }, [filterProtocols, protocols, searchTerm]);

  

  

  const handleEdit = (protocol: ProtocolWithIngredients) => {
    setEditingProtocol(protocol);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this protocol?')) return;

    await supabase.from('protocols').delete().eq('id', id);
    loadProtocols();
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Protocols (Recipes)</h1>
          <p className="text-gray-600">Your curated meal templates</p>
        </div>
        <button
          onClick={() => {
            setEditingProtocol(null);
            setModalOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Protocol
        </button>
      </header>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search protocols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
          />
        </div>
      </div>

      {/* Protocols Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
        </div>
      ) : filteredProtocols.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🍽️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {searchTerm ? 'No matching protocols' : 'No protocols yet'}
          </h2>
          <p className="text-gray-600 mb-6">
            {searchTerm
              ? 'Try adjusting your search'
              : 'Create your first meal protocol to streamline nutrition tracking'
            }
          </p>
          {!searchTerm && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
            >
              Create First Protocol
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProtocols.map((protocol) => (
            <ProtocolCard
              key={protocol.id}
              protocol={protocol}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ProtocolModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProtocol(null);
          loadProtocols();
        }}
        protocol={editingProtocol}
      />
    </div>
  );
}