'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Loader2, Trash2 } from 'lucide-react';

interface DeleteRecipeModalProps {
  isOpen: boolean;
  recipeId: string | null;
  recipeTitle: string;
  onClose: () => void;
  onDeleted: (deletedId: string) => void;
}

export default function DeleteRecipeModal({
  isOpen,
  recipeId,
  recipeTitle,
  onClose,
  onDeleted,
}: DeleteRecipeModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!recipeId) return;
    setDeleting(true);
    setError('');

    const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to delete recipe');
      setDeleting(false);
      return;
    }

    onDeleted(recipeId);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete recipe" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">&ldquo;{recipeTitle}&rdquo;</span>?
          This will also delete all associated images and videos. This action cannot be undone.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
