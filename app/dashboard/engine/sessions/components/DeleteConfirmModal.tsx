// app/dashboard/engine/sessions/components/DeleteConfirmModal.tsx
'use client';

import Modal from '@/components/ui/Modal';
import { AlertTriangle } from 'lucide-react';
import { formatDuration, formatDate, formatTime24 } from '@/lib/utils/sessionValidation';
import { FocusSession } from '@/lib/types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  session: FocusSession | null;
  isDeleting: boolean;
}

/**
 * Confirmation modal for deleting focus sessions
 * Shows session details to prevent accidental deletion
 */
export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  session,
  isDeleting,
}: DeleteConfirmModalProps) {
  if (!session) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Session?" size="sm">
      <div className="p-6">
        <div className="flex items-start space-x-3 mb-6">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-700 mb-4">
              This action cannot be undone. The session will be permanently deleted from your records.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium text-gray-900">
                  {formatDate(session.start_time)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium text-gray-900">
                  {formatTime24(session.start_time)}
                  {session.end_time && <> - {formatTime24(session.end_time)}</>}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-gray-900">
                  {formatDuration(session.duration || 0, true)}
                </span>
              </div>
              {session.revenue && session.revenue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Revenue:</span>
                  <span className="font-medium text-lime-600">
                    ${session.revenue.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
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
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isDeleting ? 'Deleting...' : 'Delete Session'}
          </button>
        </div>
      </div>
    </Modal>
  );
}