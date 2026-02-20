'use client';

// components/PurchaseModal.tsx
// Inline authentication modal for unauthenticated users on the pricing page.
// After successful sign-in/sign-up, calls onAuthSuccess so the caller can
// proceed directly to Stripe checkout without a page redirect.

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';

type Tab = 'signin' | 'signup';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export default function PurchaseModal({ isOpen, onClose, onAuthSuccess }: PurchaseModalProps) {
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function reset() {
    setEmail('');
    setPassword('');
    setError(null);
    setSubmitting(false);
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 200);
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (tab === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      handleClose();
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Sign in to continue" size="sm">
      <div className="p-6">
        {/* Tab switcher */}
        <div className="flex border border-gray-200 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => switchTab('signin')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === 'signin' ? 'bg-fuchsia-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchTab('signup')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === 'signup' ? 'bg-fuchsia-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={tab === 'signup' ? 6 : 1}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
            />
            {tab === 'signup' && (
              <p className="text-xs text-gray-400 mt-1">Minimum 6 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition-colors disabled:opacity-60 mt-2"
          >
            {submitting
              ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
              : (tab === 'signin' ? 'Sign In & Continue' : 'Create Account & Continue')}
          </button>

          {tab === 'signup' && (
            <p className="text-xs text-center text-gray-500 pt-1">
              By signing up you agree to our Terms of Service.
            </p>
          )}
        </form>
      </div>
    </Modal>
  );
}
