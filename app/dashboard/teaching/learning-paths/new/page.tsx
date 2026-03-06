'use client';

// app/dashboard/teaching/learning-paths/new/page.tsx
// Create a new learning path, then redirect to the edit page to add courses.

import { useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, ArrowLeft } from 'lucide-react';

export default function NewLearningPathPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await offlineFetch('/api/academy/paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
    });
    const json = await res.json() as { data?: { id: string }; error?: string };
    if (!res.ok) {
      setError(json.error || 'Failed to create path');
      setSaving(false);
      return;
    }
    router.push(`/dashboard/teaching/learning-paths/${json.data!.id}`);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
      <div>
        <Link
          href="/dashboard/teaching/learning-paths"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Learning Paths
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-7 h-7 text-fuchsia-600" />
          New Learning Path
        </h1>
        <p className="text-gray-500 mt-1">
          Give your path a name and description. You&apos;ll add courses on the next screen.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Path Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Foundations of Health Metrics"
            required
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students achieve by completing this path?"
            rows={4}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="px-5 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create & Add Courses →'}
          </button>
          <Link
            href="/dashboard/teaching/learning-paths"
            className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
