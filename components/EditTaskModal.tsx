'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task } from '@/lib/types';
import { DollarSign, MapPin } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import ActivityLinker from '@/components/ui/ActivityLinker';

interface EditTaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function EditTaskModal({ task, isOpen, onClose, onSave }: EditTaskModalProps) {
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [locationName, setLocationName] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        activity: task.activity,
        description: task.description,
        time: task.time,
        priority: task.priority,
        estimated_cost: task.estimated_cost || 0,
        actual_cost: task.actual_cost || 0,
        revenue: task.revenue || 0,
      });
    }
  }, [task, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('tasks')
      .update(formData)
      .eq('id', task.id);

    if (!error) {
      onSave();
      onClose();
    }
    setSaving(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Task" size="md">
      <div className="p-6 space-y-6">
        {/* Activity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
          <input
            type="text"
            value={formData.activity || ''}
            onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Time & Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={formData.time || ''}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={formData.priority || 1}
              onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) as 1 | 2 | 3 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            >
              <option value={1}>High (1)</option>
              <option value={2}>Medium (2)</option>
              <option value={3}>Low (3)</option>
            </select>
          </div>
        </div>

        {/* Financial Fields */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-lime-600" />
            Financial Tracking
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
              <input
                type="number"
                step="0.01"
                value={formData.estimated_cost || 0}
                onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cost</label>
              <input
                type="number"
                step="0.01"
                value={formData.actual_cost || 0}
                onChange={(e) => setFormData({ ...formData, actual_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue</label>
              <input
                type="number"
                step="0.01"
                value={formData.revenue || 0}
                onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Track money spent (cost) or earned (revenue) related to this task
          </p>
        </div>

        {/* Location */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-sky-600" />
            Location
          </h3>
          <ContactAutocomplete
            value={locationName}
            contactType="location"
            placeholder="Where does this task happen?"
            onChange={(name) => setLocationName(name)}
            inputClassName="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
            showLocations
            onLocationSelect={(locId) => setFormData({ ...formData, location_id: locId })}
          />
        </div>

        {/* Linked Activities */}
        <div className="pt-4 border-t border-gray-200">
          <ActivityLinker entityType="task" entityId={task.id} />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}
