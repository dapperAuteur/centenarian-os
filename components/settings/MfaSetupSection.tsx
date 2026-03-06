'use client';

// components/settings/MfaSetupSection.tsx
// MFA enrollment/management card for the settings page.
// MFA is optional by default, mandatory for users with health or financial data.

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield, ShieldCheck, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';

type MfaState = 'loading' | 'disabled' | 'enrolling' | 'enabled';

export default function MfaSetupSection() {
  const [state, setState] = useState<MfaState>('loading');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const supabase = createClient();

  const loadFactors = useCallback(async () => {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find((f) => f.status === 'verified');
    if (verified) {
      setFactorId(verified.id);
      setState('enabled');
      return;
    }
    // Clean up any unverified factors
    const unverified = factors?.totp?.filter((f) => (f.status as string) !== 'verified') ?? [];
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    setState('disabled');
  }, [supabase]);

  useEffect(() => {
    async function init() {
      // Check if user has sensitive data (makes MFA mandatory)
      try {
        const res = await fetch('/api/auth/mfa-status');
        if (res.ok) {
          const data = await res.json();
          setMfaRequired(data.mfaRequired);
        }
      } catch {}
      await loadFactors();
    }
    init();
  }, [loadFactors]);

  async function handleEnroll() {
    setError('');
    setLoading(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'CentenarianOS',
      });
      if (enrollError) throw enrollError;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setState('enrolling');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start MFA setup');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError('');
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;
      setCode('');
      setQrCode('');
      setSecret('');
      setState('enabled');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code, please try again');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!factorId) return;
    setError('');
    setLoading(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;
      setFactorId(null);
      setConfirmDisable(false);
      setState('disabled');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelEnroll() {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setFactorId(null);
    setCode('');
    setQrCode('');
    setSecret('');
    setError('');
    setState('disabled');
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-fuchsia-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6">
      <div className="flex items-center gap-2 mb-1">
        {state === 'enabled' ? (
          <ShieldCheck className="w-5 h-5 text-lime-600" />
        ) : (
          <Shield className="w-5 h-5 text-gray-400" />
        )}
        <h2 className="text-base font-semibold text-gray-800">Two-Factor Authentication</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Add an extra layer of security to your account using an authenticator app.
        {mfaRequired && state !== 'enabled' && (
          <span className="block mt-1 text-amber-600 font-medium">
            MFA is required because your account contains health or financial data.
          </span>
        )}
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {/* ── Disabled state ── */}
      {state === 'disabled' && (
        <div>
          {mfaRequired && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                You must enable two-factor authentication to continue using health metrics and financial features.
              </p>
            </div>
          )}
          <button
            onClick={handleEnroll}
            disabled={loading}
            className="px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Enable MFA
          </button>
        </div>
      )}

      {/* ── Enrolling state ── */}
      {state === 'enrolling' && (
        <div className="space-y-5">
          <div className="flex flex-col items-center">
            <p className="text-sm text-gray-600 mb-3">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 rounded-lg border border-gray-200 bg-white p-2" />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Or enter this secret manually
            </p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <code className="text-sm font-mono text-gray-700 flex-1 break-all select-all">
                {secret}
              </code>
              <button
                onClick={copySecret}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition shrink-0"
                title="Copy secret"
              >
                {copied ? <Check className="w-4 h-4 text-lime-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <form onSubmit={handleVerifyEnrollment} className="space-y-4">
            <div>
              <label htmlFor="mfa-setup-code" className="block text-sm font-medium text-gray-700 mb-1">
                Enter the 6-digit code from your app
              </label>
              <input
                id="mfa-setup-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent form-input text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify &amp; Activate
              </button>
              <button
                type="button"
                onClick={handleCancelEnroll}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Enabled state ── */}
      {state === 'enabled' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-100 text-lime-700 text-sm font-medium">
              <ShieldCheck className="w-4 h-4" />
              MFA Active
            </span>
          </div>

          {confirmDisable ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-red-700">
                Are you sure you want to disable two-factor authentication?
                {mfaRequired && ' Your account has sensitive data — you will be required to re-enable it.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDisable}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Yes, disable MFA
                </button>
                <button
                  onClick={() => setConfirmDisable(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  Keep enabled
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDisable(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition"
            >
              Disable MFA
            </button>
          )}
        </div>
      )}
    </div>
  );
}
