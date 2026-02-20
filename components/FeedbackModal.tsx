'use client';

// components/FeedbackModal.tsx
// Modal for users to submit feedback, bug reports, and feature suggestions.

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { CheckCircle, Bug, Lightbulb, MessageSquare } from 'lucide-react';

type Category = 'bug' | 'feature' | 'general';

const CATEGORIES: { value: Category; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: Bug, description: 'Something is broken' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, description: 'Suggest an improvement' },
  { value: 'general', label: 'General', icon: MessageSquare, description: 'Other feedback' },
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState<Category>('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setMessage('');
      setCategory('general');
      setSubmitted(false);
      setError(null);
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Share Feedback" size="sm">
      <div className="p-6">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900">Thank you!</h3>
            <p className="text-sm text-gray-500">Your feedback has been received. We review every submission.</p>
            <button
              onClick={handleClose}
              className="mt-2 px-5 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category selection */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">What kind of feedback is this?</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-colors ${
                      category === value
                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-xs text-gray-400 hidden sm:block">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                Your message
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={
                  category === 'bug'
                    ? 'Describe what happened and how to reproduce it…'
                    : category === 'feature'
                    ? 'Describe the feature you\'d like to see…'
                    : 'Share your thoughts…'
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/2000</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="px-5 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition-colors disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
