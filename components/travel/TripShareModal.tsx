'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Trash2, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

const SECTION_KEYS = [
  'transport', 'booking', 'accommodation', 'pickupReturn',
  'budget', 'notes', 'packing', 'loyalty', 'stats',
] as const;

type SectionKey = typeof SECTION_KEYS[number];

const SECTION_LABELS: Record<SectionKey, string> = {
  transport: 'Transport Details',
  booking: 'Booking Details',
  accommodation: 'Accommodation',
  pickupReturn: 'Pickup / Return',
  budget: 'Budget & Costs',
  notes: 'Notes',
  packing: 'Packing List',
  loyalty: 'Loyalty Info',
  stats: 'Distance & Stats',
};

function allTrue(): Record<SectionKey, boolean> {
  return Object.fromEntries(SECTION_KEYS.map((k) => [k, true])) as Record<SectionKey, boolean>;
}

interface TripShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'trip' | 'route';
  entityId: string;
  includedSections?: { [key: string]: boolean } | null;
}

interface Share {
  id: string;
  share_token: string | null;
  is_public: boolean;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function TripShareModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  includedSections,
}: TripShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>(allTrue);
  const [showSections, setShowSections] = useState(false);

  const paramKey = entityType === 'route' ? 'route_id' : 'trip_id';

  // Sync sections from prop when modal opens
  useEffect(() => {
    if (isOpen) {
      if (includedSections) {
        const merged = allTrue();
        for (const k of SECTION_KEYS) {
          if (k in includedSections) merged[k] = !!includedSections[k];
        }
        setSections(merged);
      } else {
        setSections(allTrue());
      }
    }
  }, [isOpen, includedSections]);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/travel/shares?${paramKey}=${entityId}`);
      if (res.ok) {
        const data = await res.json();
        setShares(Array.isArray(data) ? data : data.shares || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [paramKey, entityId]);

  useEffect(() => {
    if (isOpen && entityId) {
      fetchShares();
      setError('');
      setExpiresAt('');
    }
  }, [isOpen, entityId, fetchShares]);

  // Every share is a link: anyone who has it can open the read-only itinerary.
  // Nothing is emailed and a link is not tied to a person, so there is no
  // recipient field — the owner copies the link and sends it themselves.
  const createShare = async () => {
    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        entity_type: entityType,
        entity_id: entityId,
      };
      if (expiresAt) body.expires_at = expiresAt;
      body.included_sections = sections;

      const res = await offlineFetch('/api/travel/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.error || 'Failed to create share link.');
        return;
      }

      setExpiresAt('');
      await fetchShares();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const revokeShare = async (shareId: string) => {
    try {
      const res = await offlineFetch(`/api/travel/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      if (res.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } catch {
      // silently fail
    }
  };

  const copyLink = async (token: string, shareId: string) => {
    const url = `${window.location.origin}/shared/trip/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatExpiry = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Trip" size="md">
      <div className="p-6 space-y-6">
        {/* Expiration date (optional) */}
        <div>
          <label htmlFor="share-expires" className="block text-sm font-medium text-gray-700 mb-1">
            Expiration date <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <input
            id="share-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="min-h-11 w-full sm:w-auto rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          />
        </div>

        {/* Included sections */}
        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setShowSections((v) => !v)}
            className="min-h-11 w-full flex items-center justify-between text-sm font-medium text-gray-700 px-2 rounded-lg hover:bg-gray-50 transition"
            aria-expanded={showSections}
            aria-label="Toggle included sections"
          >
            <span>Included Sections</span>
            {showSections
              ? <ChevronUp className="w-4 h-4 text-gray-400" aria-hidden="true" />
              : <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />}
          </button>

          {showSections && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-2">
              {SECTION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 min-h-11 px-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={() => setSections((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>{SECTION_LABELS[key]}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Create share link */}
        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={createShare}
            disabled={submitting}
            className="min-h-11 w-full sm:w-auto px-4 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
          >
            <Link2 className="w-4 h-4" aria-hidden="true" />
            <span>Create share link</span>
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Anyone with the link can view this itinerary without signing in. Nothing is emailed:
            copy the link below and send it yourself.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Active shares list */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Shares</h3>

          {loading ? (
            <p className="text-sm text-gray-400" aria-label="Loading...">Loading shares...</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-gray-400">No active shares yet.</p>
          ) : (
            <ul role="list" className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {share.is_public ? 'Share link' : 'Shared with a user (no link)'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {share.expires_at
                        ? `Expires ${formatExpiry(share.expires_at)}`
                        : 'No expiration'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {share.is_public && share.share_token && (
                      <button
                        type="button"
                        onClick={() => copyLink(share.share_token as string, share.id)}
                        className="min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                        aria-label={copiedId === share.id ? 'Link copied' : 'Copy share link'}
                      >
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        {copiedId === share.id && (
                          <span className="text-xs text-sky-600 ml-1">Copied!</span>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => revokeShare(share.id)}
                      className="min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      aria-label="Revoke share link"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
