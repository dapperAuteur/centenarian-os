'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { AtSign, Loader2 } from 'lucide-react';

interface UsernameSetupModalProps {
  isOpen: boolean;
  onComplete: (username: string) => void;
}

const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

/**
 * Modal to set a username before using the blog.
 * Cannot be dismissed — username is required for blog URLs.
 */
export default function UsernameSetupModal({ isOpen, onComplete }: UsernameSetupModalProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = (value: string) => {
    if (!value) return 'Username is required';
    if (!USERNAME_REGEX.test(value))
      return 'Username must be 3–30 characters: lowercase letters, numbers, hyphens, or underscores only';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(username);
    if (err) { setError(err); return; }

    setSaving(true);
    setError('');

    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, display_name: displayName || null, bio: bio || null }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to save username');
      setSaving(false);
      return;
    }

    onComplete(data.username);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Cannot be dismissed — username is required
      title="Set up your blog"
      showCloseButton={false}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Choose a username for your blog URL:{' '}
          <span className="font-mono text-gray-800">
            /blog/{username || 'your-username'}/…
          </span>
        </p>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Username <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <AtSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                setError('');
              }}
              placeholder="your-username"
              maxLength={30}
              required
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-xs text-gray-400">
            3–30 characters · lowercase letters, numbers, hyphens, underscores
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your Name"
            maxLength={60}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio for your blog…"
            maxLength={300}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !username}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : 'Start blogging'}
        </button>
      </form>
    </Modal>
  );
}
