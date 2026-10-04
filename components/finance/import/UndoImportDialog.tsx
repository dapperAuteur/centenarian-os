'use client';

// components/finance/import/UndoImportDialog.tsx
// Asks before undoing an import, and says exactly what undoing does.

import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { ErrorNotice, dangerButton, secondaryButton } from './shared';

interface UndoImportDialogProps {
  /** A description of the import being undone ("statement.csv, Oct 4, 2026"), or null when closed. */
  target: string | null;
  busy: boolean;
  error: string | null;
  online: boolean;
  onConfirm: () => void;
  /**
   * Also called for Escape and a click outside. Modal keeps the function it
   * was opened with, so this must decide for itself (from a ref, not from
   * props) whether closing is allowed while a request is running.
   */
  onCancel: () => void;
}

export default function UndoImportDialog({ target, busy, error, online, onConfirm, onCancel }: UndoImportDialogProps) {
  return (
    <Modal
      isOpen={target !== null}
      onClose={onCancel}
      title="Undo this import?"
      size="sm"
      showCloseButton={!busy}
    >
      <div className="space-y-4 p-6">
        <p className="text-sm text-gray-800">
          You are about to undo: <span className="font-medium text-gray-900">{target}</span>
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
          <li>Transactions this import added are deleted.</li>
          <li>Any of those you edited afterwards are kept, and you are shown which ones.</li>
          <li>Entries you made yourself that it linked stay where they are; only the link is removed.</li>
        </ul>

        {error && (
          <ErrorNotice>
            <p>{error}</p>
          </ErrorNotice>
        )}
        {!online && (
          <p role="status" className="text-sm font-medium text-gray-900">
            You are offline. Reconnect to undo this import.
          </p>
        )}
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Undoing the import...
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className={secondaryButton}>
            Keep the import
          </button>
          <button type="button" onClick={onConfirm} disabled={busy || !online} className={dangerButton}>
            Undo the import
          </button>
        </div>
      </div>
    </Modal>
  );
}
