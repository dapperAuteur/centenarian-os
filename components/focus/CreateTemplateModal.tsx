// components/focus/CreateTemplateModal.tsx
'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { SessionTemplate, CreateTemplateInput } from '@/lib/types';
import { Clock, Tag as TagIcon, DollarSign, FileText, Smile } from 'lucide-react';
import TagSelector from '@/components/ui/TagSelector';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: CreateTemplateInput) => Promise<void>;
  editTemplate?: SessionTemplate | null;
  initialData?: {
    durationMinutes?: number;
    hourlyRate?: number;
    notesTemplate?: string;
    usePomodoro?: boolean;
  };
}

const EMOJI_PRESETS = [
  '⚡', '💼', '📚', '🎨', '💻', '🔬', '✍️', '🎯', 
  '🏋️', '☕', '📞', '📧', '🎓', '🔨', '🎵', '🍅'
];

/**
 * Create or edit a session template
 */
export default function CreateTemplateModal({
  isOpen,
  onClose,
  onSave,
  editTemplate = null,
  initialData,
}: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [tags, setTags] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [notesTemplate, setNotesTemplate] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [usePomodoro, setUsePomodoro] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when editing
  useEffect(() => {
    if (editTemplate && isOpen) {
      setName(editTemplate.name);
      setDescription(editTemplate.description || '');
      setDurationMinutes(editTemplate.duration_minutes);
      setTags(editTemplate.tags || []);
      setHourlyRate(editTemplate.hourly_rate);
      setNotesTemplate(editTemplate.notes_template || '');
      setIcon(editTemplate.icon);
      setUsePomodoro(editTemplate.use_pomodoro);
    } else if (initialData && isOpen) {
      // ✅ Pre-fill from session data
      setName('');
      setDescription('');
      setDurationMinutes(initialData.durationMinutes || 25);
      setTags([]);
      setHourlyRate(initialData.hourlyRate || 0);
      setNotesTemplate(initialData.notesTemplate || '');
      setIcon('⚡');
      setUsePomodoro(initialData.usePomodoro || false);
    } else if (isOpen && !editTemplate) {
      // Reset for new template
      setName('');
      setDescription('');
      setDurationMinutes(25);
      setTags([]);
      setHourlyRate(0);
      setNotesTemplate('');
      setIcon('⚡');
      setUsePomodoro(false);
    }
  }, [editTemplate, initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (durationMinutes < 1 || durationMinutes > 480) {
      alert('Duration must be between 1 and 480 minutes');
      return;
    }

    try {
      setIsSaving(true);

      const input: CreateTemplateInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        duration_minutes: durationMinutes,
        tags: tags.length > 0 ? tags : undefined,
        hourly_rate: hourlyRate,
        notes_template: notesTemplate.trim() || undefined,
        icon,
        use_pomodoro: usePomodoro,
      };

      await onSave(input);
      handleClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setDurationMinutes(25);
    setTags([]);
    setHourlyRate(0);
    setNotesTemplate('');
    setIcon('⚡');
    setUsePomodoro(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editTemplate ? 'Edit Template' : 'Create Template'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6">
        {/* Icon Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Smile className="inline w-4 h-4 mr-1" />
            Icon
          </label>
          <div className="flex items-center space-x-2">
            <div className="text-5xl p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
              {icon}
            </div>
            <div className="flex-1 grid grid-cols-8 gap-2">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`text-2xl p-2 rounded-lg border-2 transition ${
                    icon === emoji
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Deep Work, Client Calls, Writing"
            maxLength={50}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this template"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
          />
        </div>

        {/* Duration & Mode */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="inline w-4 h-4 mr-1" />
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
              min="1"
              max="480"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DollarSign className="inline w-4 h-4 mr-1" />
              Hourly Rate (optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              min="0"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
            />
          </div>
        </div>

        {/* Pomodoro Mode */}
        <div className="mb-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={usePomodoro}
              onChange={(e) => setUsePomodoro(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500 form-input"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">🍅 Use Pomodoro Mode</p>
              <p className="text-xs text-gray-600">
                Start session with automatic work/break cycles
              </p>
            </div>
          </label>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <TagIcon className="inline w-4 h-4 mr-1" />
            Tags (optional)
          </label>
          <TagSelector selectedTags={tags} onChange={setTags} />
        </div>

        {/* Notes Template */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <FileText className="inline w-4 h-4 mr-1" />
            Notes Template (optional)
          </label>
          <textarea
            value={notesTemplate}
            onChange={(e) => setNotesTemplate(e.target.value)}
            rows={3}
            placeholder="Pre-fill session notes with this text..."
            maxLength={500}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
          />
          <p className="text-xs text-gray-500 mt-1">
            This text will be pre-filled when starting a session from this template
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !name.trim() || durationMinutes < 1}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSaving ? 'Saving...' : editTemplate ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}