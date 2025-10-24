// components/focus/DeleteTemplateModal.tsx
'use client';

import Modal from '@/components/ui/Modal';
import { SessionTemplate } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

interface DeleteTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  template: SessionTemplate | null;
  isDeleting: boolean;
}

/**
 * Confirmation dialog for deleting a template
 */
export default function DeleteTemplateModal({
  isOpen,
  onClose,
  onConfirm,
  template,
  isDeleting,
}: DeleteTemplateModalProps) {
  if (!template) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Template?" size="sm">
      <div className="p-6">
        <div className="flex items-start space-x-3 mb-6">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-900 mb-2">
              Are you sure you want to delete the template{' '}
              <span className="font-bold">
                {template.icon} {template.name}
              </span>
              ?
            </p>
            <p className="text-sm text-gray-600">
              This action cannot be undone. You&apos;ll need to recreate the template if you need it
              again.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isDeleting ? 'Deleting...' : 'Delete Template'}
          </button>
        </div>
      </div>
    </Modal>
  );
}