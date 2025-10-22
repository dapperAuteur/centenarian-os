// app/dashboard/engine/sessions/components/ForceStopModal.tsx
'use client';

import Modal from '@/components/ui/Modal';
import { AlertTriangle, Clock } from 'lucide-react';
import { formatDate, formatTime24 } from '@/lib/utils/sessionValidation';
import { FocusSession } from '@/lib/types';

interface ForceStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  session: FocusSession | null;
  isStopping: boolean;
}

/**
 * Confirmation modal for force-stopping stuck running sessions
 * Calculates elapsed time and warns user
 */
export default function ForceStopModal({
  isOpen,
  onClose,
  onConfirm,
  session,
  isStopping,
}: ForceStopModalProps) {
  if (!session) return null;

  // Calculate how long session has been running
  const startTime = new Date(session.start_time).getTime();
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - startTime) / 1000);
  const elapsedHours = Math.floor(elapsedSeconds / 3600);
  const elapsedMinutes = Math.floor((elapsedSeconds % 3600) / 60);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Force Stop Session?" size="sm">
      <div className="p-6">
        <div className="flex items-start space-x-3 mb-6">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-700 mb-2">
              This session is still running. Force stopping will:
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-4">
              <li>Set end time to now</li>
              <li>Calculate duration and revenue</li>
              <li>Allow you to edit or delete it</li>
            </ul>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center space-x-2 text-amber-800 font-semibold text-sm mb-2">
                <Clock className="w-4 h-4" />
                <span>Session has been running for:</span>
              </div>
              <div className="text-2xl font-bold text-amber-900">
                {elapsedHours}h {elapsedMinutes}m
              </div>
              <div className="text-xs text-amber-700 mt-2">
                Started: {formatDate(session.start_time)} at {formatTime24(session.start_time)}
              </div>
            </div>

            {elapsedHours > 12 && (
              <div className="mt-3 text-xs text-amber-700">
                ⚠️ This session has been running for over 12 hours. Please verify this is correct before stopping.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isStopping}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isStopping}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isStopping ? 'Stopping...' : 'Force Stop'}
          </button>
        </div>
      </div>
    </Modal>
  );
}