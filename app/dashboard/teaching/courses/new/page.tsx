'use client';

// app/dashboard/teaching/courses/new/page.tsx
// Create a new course — multi-field form.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, Save, GitBranch, ArrowRight } from 'lucide-react';

const CATEGORIES = ['Fitness', 'Nutrition', 'Recovery', 'Longevity', 'Mental Health', 'Sleep', 'Mindset', 'Biomechanics', 'Other'];

export default function NewCoursePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    price_type: 'free' as 'free' | 'one_time' | 'subscription',
    price: '',
    navigation_mode: 'linear' as 'linear' | 'cyoa',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleCreate() {
    if (!form.title.trim()) { setError('Course title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/academy/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category || null,
          price_type: form.price_type,
          price: form.price_type !== 'free' ? Number(form.price) : 0,
          navigation_mode: form.navigation_mode,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to create course');
      router.push(`/dashboard/teaching/courses/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/dashboard/teaching" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition">
        <ChevronLeft className="w-4 h-4" /> Teaching Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-white mb-8">New Course</h1>

      <div className="space-y-6 dark-input">
        {/* Title */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Course Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Longevity Movement Fundamentals"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            placeholder="What will students learn? Who is this for?"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 text-sm resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Category</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500 text-sm"
          >
            <option value="">Select a category…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Pricing */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Pricing</label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(['free', 'one_time', 'subscription'] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => set('price_type', pt)}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                  form.price_type === pt
                    ? 'bg-fuchsia-900/40 border-fuchsia-600 text-fuchsia-300'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {pt === 'free' ? 'Free' : pt === 'one_time' ? 'One-time' : 'Subscription'}
              </button>
            ))}
          </div>
          {form.price_type !== 'free' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="0.00"
                className="w-32 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-fuchsia-500 text-sm"
              />
              {form.price_type === 'subscription' && <span className="text-gray-500 text-sm">/ month</span>}
            </div>
          )}
        </div>

        {/* Navigation mode */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Learning Path Style</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => set('navigation_mode', 'linear')}
              className={`p-4 rounded-xl border text-left transition ${
                form.navigation_mode === 'linear'
                  ? 'bg-fuchsia-900/20 border-fuchsia-600'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <ArrowRight className="w-5 h-5 text-fuchsia-400 mb-2" />
              <p className="font-semibold text-white text-sm">Linear</p>
              <p className="text-gray-400 text-xs mt-1">Students follow lessons in order, step by step.</p>
            </button>
            <button
              type="button"
              onClick={() => set('navigation_mode', 'cyoa')}
              className={`p-4 rounded-xl border text-left transition ${
                form.navigation_mode === 'cyoa'
                  ? 'bg-fuchsia-900/20 border-fuchsia-600'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <GitBranch className="w-5 h-5 text-fuchsia-400 mb-2" />
              <p className="font-semibold text-white text-sm">Adventure (CYOA)</p>
              <p className="text-gray-400 text-xs mt-1">AI recommends branching paths after each lesson.</p>
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Creating…' : 'Create Course'}
          </button>
          <Link href="/dashboard/teaching" className="text-gray-500 hover:text-gray-300 text-sm">Cancel</Link>
        </div>
      </div>
    </div>
  );
}
