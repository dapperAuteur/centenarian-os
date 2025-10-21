'use client';

import { useState } from 'react';
import { X, AlertTriangle, Archive } from 'lucide-react';

interface ArchiveModalProps {
  type: 'roadmap' | 'goal' | 'milestone';
  item: { id: string; title: string };
  childrenCount: number;
  moveOptions: Array<{ id: string; title: string }>;
  onArchive: (cascade: boolean, newParentId?: string) => Promise<void>;
  onClose: () => void;
}

export function ArchiveModal({ 
  type, 
  item, 
  childrenCount, 
  moveOptions, 
  onArchive, 
  onClose 
}: ArchiveModalProps) {
  const [mode, setMode] = useState<'move' | 'cascade'>('move');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [loading, setLoading] = useState(false);

  const childTypeMap = {
    roadmap: 'goals',
    goal: 'milestones',
    milestone: 'tasks'
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onArchive(mode === 'cascade', mode === 'move' ? selectedParentId : undefined);
      onClose();
    } catch (error) {
      console.error('Archive failed:', error);
      alert('Archive failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-amber-50 border-b border-amber-200 p-6 flex items-start">
          <AlertTriangle className="w-6 h-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-grow">
            <h2 className="text-xl font-bold text-gray-900">Archive {type}?</h2>
            <p className="text-sm text-gray-600 mt-1">{item.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {childrenCount > 0 && moveOptions.length > 0 ? (
            <>
              <p className="text-sm text-gray-700">
                This {type} contains <strong>{childrenCount} {childTypeMap[type]}</strong>.
              </p>

              {/* Move Option */}
              <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <input
                  type="radio"
                  name="archiveMode"
                  checked={mode === 'move'}
                  onChange={() => setMode('move')}
                  className="mt-1"
                />
                <div className="ml-3 flex-grow">
                  <div className="font-semibold text-gray-900">Move {childTypeMap[type]} first</div>
                  <p className="text-sm text-gray-600 mt-1">
                    Reassign to another {type}, then archive
                  </p>
                  {mode === 'move' && (
                    <select
                      value={selectedParentId}
                      onChange={(e) => setSelectedParentId(e.target.value)}
                      className="mt-3 w-full px-3 py-2 border rounded-lg"
                      required
                    >
                      <option value="">Select destination...</option>
                      {moveOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              {/* Cascade Option */}
              <label className="flex items-start p-4 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-50 transition">
                <input
                  type="radio"
                  name="archiveMode"
                  checked={mode === 'cascade'}
                  onChange={() => setMode('cascade')}
                  className="mt-1"
                />
                <div className="ml-3">
                  <div className="font-semibold text-red-900">Archive everything</div>
                  <p className="text-sm text-red-700 mt-1">
                    Archive this {type} and all {childTypeMap[type]}
                  </p>
                </div>
              </label>
            </>
          ) : (
            <p className="text-sm text-gray-700">
              This {type} will be archived. You can restore it later.
            </p>
          )}

          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
            ℹ️ Archived items auto-delete after 30 days. You can manually delete anytime.
          </div>
        </div>

        <div className="bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (mode === 'move' && !selectedParentId)}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Archiving...' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}