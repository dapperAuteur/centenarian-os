// components/focus/TemplateManagerModal.tsx
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { SessionTemplate } from '@/lib/types';
import { Plus, Search } from 'lucide-react';
import SessionTemplateCard from './SessionTemplateCard';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: SessionTemplate[];
  onUse: (template: SessionTemplate) => void;
  onCreate: () => void;
  onEdit: (template: SessionTemplate) => void;
  onDelete: (template: SessionTemplate) => void;
}

/**
 * Browse and manage all session templates
 */
export default function TemplateManagerModal({
  isOpen,
  onClose,
  templates,
  onUse,
  onCreate,
  onEdit,
  onDelete,
}: TemplateManagerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Session Templates" size="xl">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-800"
            />
          </div>
          <button
            onClick={onCreate}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Template
          </button>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-600 mb-4">
              {searchQuery ? 'No templates found' : 'No templates yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={onCreate}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
              >
                Create Your First Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
            {filteredTemplates.map((template) => (
              <SessionTemplateCard
                key={template.id}
                template={template}
                onUse={(t) => {
                  onUse(t);
                  onClose();
                }}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}