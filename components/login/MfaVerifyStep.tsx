'use client';

// components/login/MfaVerifyStep.tsx
// TOTP verification step shown during login when MFA is enabled.

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield, Loader2 } from 'lucide-react';

interface MfaVerifyStepProps {
  onVerified: () => void;
  onCancel: () => void;
}

export default function MfaVerifyStep({ onVerified, onCancel }: MfaVerifyStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (!totp) {
        setError('No MFA factor found. Please contact support.');
        setInitializing(false);
        return;
      }
      setFactorId(totp.id);
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (challengeError) {
        setError(challengeError.message);
        setInitializing(false);
        return;
      }
      setChallengeId(challenge.id);
      setInitializing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setError('');
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      if (verifyError) throw verifyError;
      onVerified();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      setError(msg);
      setCode('');
      inputRef.current?.focus();
      // Get a fresh challenge for retry
      const { data: newChallenge } = await supabase.auth.mfa.challenge({ factorId });
      if (newChallenge) setChallengeId(newChallenge.id);
    } finally {
      setLoading(false);
    }
  }

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
        <p className="text-sm text-gray-500">Preparing verification...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
          <Shield className="w-6 h-6 text-sky-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Two-factor authentication</h2>
        <p className="text-sm text-gray-500">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-1">
            Authentication code
          </label>
          <input
            ref={inputRef}
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoFocus
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input text-center text-2xl tracking-widest font-mono"
            placeholder="000000"
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Cancel and sign out
        </button>
      </form>
    </div>
  );
}
