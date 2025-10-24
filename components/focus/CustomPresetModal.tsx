// components/focus/CustomPresetModal.tsx
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Plus, Trash2 } from 'lucide-react';

interface CustomPreset {
  id: string;
  name: string;
  duration: number;
  description: string;
}

interface CustomPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: CustomPreset[];
  onSave: (presets: CustomPreset[]) => void;
}

/**
 * Manage custom focus duration presets
 * Users can create their own quick-start buttons
 */
export default function CustomPresetModal({
  isOpen,
  onClose,
  presets,
  onSave,
}: CustomPresetModalProps) {
  const [localPresets, setLocalPresets] = useState<CustomPreset[]>(presets);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) {
      alert('Please enter a preset name');
      return;
    }

    if (newDuration < 1 || newDuration > 240) {
      alert('Duration must be between 1 and 240 minutes');
      return;
    }

    const newPreset: CustomPreset = {
      id: `custom-${Date.now()}`,
      name: newName,
      duration: newDuration,
      description: newDescription,
    };

    setLocalPresets([...localPresets, newPreset]);
    setNewName('');
    setNewDuration(30);
    setNewDescription('');
  };

  const handleRemove = (id: string) => {
    setLocalPresets(localPresets.filter((p) => p.id !== id));
  };

  const handleSave = () => {
    onSave(localPresets);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Custom Presets" size="md">
      <div className="p-6">
        {/* Add New Preset */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Preset</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Morning Focus"
                maxLength={20}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(parseInt(e.target.value) || 0)}
                min="1"
                max="240"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description"
                maxLength={50}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              />
            </div>

            <button
              onClick={handleAdd}
              className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Preset
            </button>
          </div>
        </div>

        {/* Existing Presets */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Custom Presets</h3>
          {localPresets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No custom presets yet</p>
          ) : (
            <div className="space-y-2">
              {localPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">{preset.name}</p>
                    <p className="text-xs text-gray-600">
                      {preset.duration} min
                      {preset.description && ` • ${preset.description}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(preset.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            Save Presets
          </button>
        </div>
      </div>
    </Modal>
  );
}