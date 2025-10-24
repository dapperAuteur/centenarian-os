/* eslint-disable @typescript-eslint/no-unused-vars */
// components/focus/TemplateQuickAccess.tsx
'use client';

import { SessionTemplate } from '@/lib/types';
import { Settings, Plus } from 'lucide-react';
import SessionTemplateCard from './SessionTemplateCard';

interface TemplateQuickAccessProps {
  templates: SessionTemplate[];
  onUse: (template: SessionTemplate) => void;
  onManage: () => void;
  onEdit: (template: SessionTemplate) => void;
  onDelete: (template: SessionTemplate) => void;
  maxVisible?: number;
}

/**
 * Quick access to favorite/recent templates
 * Shows top templates with manage button
 */
export default function TemplateQuickAccess({
  templates,
  onUse,
  onManage,
  onEdit,
  onDelete,
  maxVisible = 4,
}: TemplateQuickAccessProps) {
  const visibleTemplates = templates.slice(0, maxVisible);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Quick Templates</h3>
        <button
          onClick={onManage}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Manage All
        </button>
      </div>

      {templates.length === 0 ? (
        <button
          onClick={onManage}
          className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition text-center"
        >
          <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">Create Your First Template</p>
          <p className="text-xs text-gray-500 mt-1">
            Save time with pre-configured sessions
          </p>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleTemplates.map((template) => (
            <SessionTemplateCard
              key={template.id}
              template={template}
              onUse={onUse}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {templates.length > maxVisible && (
        <button
          onClick={onManage}
          className="w-full mt-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium hover:bg-indigo-50 rounded-lg transition"
        >
          View All {templates.length} Templates →
        </button>
      )}
    </div>
  );
}