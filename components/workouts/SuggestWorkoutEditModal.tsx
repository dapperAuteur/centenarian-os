'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
}

export default function SuggestWorkoutEditModal({ isOpen, onClose, templateId, templateName }: Props) {
  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedDescription, setSuggestedDescription] = useState('');
  const [suggestedChanges, setSuggestedChanges] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setSuggestedName('');
    setSuggestedDescription('');
    setSuggestedChanges('');
    setSubmitting(false);
    setSubmitted(false);
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestedChanges.trim()) {
      setError('Please describe what should change.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await offlineFetch(`/api/workouts/${templateId}/suggest-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggested_name: suggestedName || null,
          suggested_description: suggestedDescription || null,
          suggested_changes: suggestedChanges,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Suggest Edit: ${templateName}`} size="md">
      {submitted ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-lime-500" aria-hidden="true" />
          <p className="text-lg font-semibold text-gray-900">Suggestion submitted!</p>
          <p className="text-sm text-gray-600">Thanks — your suggestion will be reviewed and applied if approved.</p>
          <button
            onClick={handleClose}
            className="mt-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <p className="text-xs text-gray-500">
            Suggest changes to <span className="font-semibold text-gray-700">{templateName}</span>. An admin will review and apply approved suggestions.
          </p>

          <div>
            <label htmlFor="swe-name" className="block text-xs font-medium text-gray-700 mb-1">
              Suggested name <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="swe-name"
              value={suggestedName}
              onChange={(e) => setSuggestedName(e.target.value)}
              placeholder={templateName}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="swe-desc" className="block text-xs font-medium text-gray-700 mb-1">
              Suggested description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="swe-desc"
              value={suggestedDescription}
              onChange={(e) => setSuggestedDescription(e.target.value)}
              placeholder="e.g. Better for beginners, emphasizes core stability"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="swe-changes" className="block text-xs font-medium text-gray-700 mb-1">
              What should change? <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <textarea
              id="swe-changes"
              value={suggestedChanges}
              onChange={(e) => setSuggestedChanges(e.target.value)}
              placeholder="Describe the exercise changes, reps, sets, order, or any other improvements..."
              rows={4}
              required
              aria-required="true"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-sky-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Suggestion'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
