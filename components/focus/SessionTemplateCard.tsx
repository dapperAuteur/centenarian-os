// components/focus/SessionTemplateCard.tsx
'use client';

import { SessionTemplate } from '@/lib/types';
import { Clock, Tag, DollarSign, Edit, Trash2 } from 'lucide-react';
import { getTagColorClasses } from '@/lib/utils/tagUtils';

interface SessionTemplateCardProps {
  template: SessionTemplate;
  onUse: (template: SessionTemplate) => void;
  onEdit: (template: SessionTemplate) => void;
  onDelete: (template: SessionTemplate) => void;
  disabled?: boolean;
}

/**
 * Display card for a session template
 * Shows quick overview with action buttons
 */
export default function SessionTemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
  disabled = false,
}: SessionTemplateCardProps) {
  return (
    <div className="relative group bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-lg transition">
      {/* Icon & Title */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="text-4xl">{template.icon}</div>
          <div>
            <h3 className="font-bold text-gray-900">{template.name}</h3>
            {template.description && (
              <p className="text-xs text-gray-600 line-clamp-1">{template.description}</p>
            )}
          </div>
        </div>

        {/* Action Buttons (visible on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition flex items-center space-x-1">
          <button
            onClick={() => onEdit(template)}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-50"
            title="Edit template"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(template)}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
            title="Delete template"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        {/* Duration */}
        <div className="flex items-center space-x-2 text-sm text-gray-700">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold">{template.duration_minutes} min</span>
          {template.use_pomodoro && <span className="text-xs">🍅 Pomodoro</span>}
        </div>

        {/* Hourly Rate */}
        {template.hourly_rate > 0 && (
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <DollarSign className="w-4 h-4 text-lime-600" />
            <span>${template.hourly_rate}/hr</span>
          </div>
        )}

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex items-start space-x-2">
            <Tag className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag) => {
                const colors = getTagColorClasses(tag);
                return (
                  <span
                    key={tag}
                    className={`inline-block px-2 py-0.5 text-xs rounded-full ${colors.bg} ${colors.text}`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Use Button */}
      <button
        onClick={() => onUse(template)}
        disabled={disabled}
        className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Start Session
      </button>
    </div>
  );
}