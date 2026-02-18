'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  parseFrontmatter,
  markdownToTiptapJSON,
  extractTitle,
  extractTags,
  stripTitleFromBody,
} from '@/lib/blog/markdown-to-tiptap';
import { generateSlug } from '@/lib/blog/slug';
import PostVisibilitySelector from './PostVisibilitySelector';
import TiptapRenderer from './TiptapRenderer';
import { FileText, Eye, EyeOff, Upload, Loader2, AlertCircle } from 'lucide-react';
import type { PostVisibility } from '@/lib/types';

// Lazy-load the editor so it only mounts when user switches to "Edit" tab
const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });

type Step = 'paste' | 'preview' | 'edit';

export default function MarkdownImporter() {
  const router = useRouter();

  // Step 1 — paste
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState('');

  // Step 2/3 — parsed fields
  const [step, setStep] = useState<Step>('paste');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState<object>({});
  const [visibility, setVisibility] = useState<PostVisibility>('draft');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Step 3 — saving
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleParse = () => {
    setParseError('');
    try {
      const { frontmatter, body } = parseFrontmatter(raw.trim());
      const extractedTitle = extractTitle(frontmatter, body);
      const bodyWithoutTitle = extractedTitle ? stripTitleFromBody(body) : body;
      const tiptapJSON = markdownToTiptapJSON(bodyWithoutTitle);
      const extractedTags = extractTags(frontmatter);

      setTitle(extractedTitle || 'Untitled post');
      setTags(extractedTags);
      setContent(tiptapJSON);
      setStep('preview');
    } catch (err) {
      setParseError(
        err instanceof Error
          ? `Parse error: ${err.message}`
          : 'Failed to parse markdown. Check the content and try again.'
      );
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase();
      if (!tags.includes(t)) setTags([...tags, t]);
      setTagInput('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');

    const res = await fetch('/api/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        slug: generateSlug(title),
        content,
        tags,
        visibility,
        scheduled_at: scheduledAt,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSaveError(data.error || 'Failed to save post');
      setSaving(false);
      return;
    }

    router.push(`/dashboard/blog/${data.id}/edit`);
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['paste', 'preview', 'edit'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s
                  ? 'bg-sky-600 text-white'
                  : i < ['paste', 'preview', 'edit'].indexOf(step)
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </span>
            <span className={step === s ? 'text-gray-900 font-medium' : 'text-gray-400'}>
              {s === 'paste' ? 'Paste markdown' : s === 'preview' ? 'Preview & metadata' : 'Fine-tune in editor'}
            </span>
            {i < 2 && <span className="text-gray-300 mx-1">›</span>}
          </div>
        ))}
      </div>

      {/* ── Step 1: Paste markdown ── */}
      {step === 'paste' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Paste your markdown content
            </label>
            <p className="text-xs text-gray-500">
              Frontmatter (<code className="bg-gray-100 px-1 rounded">---</code> block) is
              automatically parsed for title, tags, and date. The first{' '}
              <code className="bg-gray-100 px-1 rounded"># Heading</code> is used as the title if
              no frontmatter title is found.
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={`---\ntitle: My Post Title\ntags: health, longevity\n---\n\n# My Post Title\n\nYour markdown content here...`}
              rows={18}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y"
            />
          </div>

          {parseError && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {parseError}
            </div>
          )}

          <button
            type="button"
            onClick={handleParse}
            disabled={!raw.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-40 transition"
          >
            <FileText className="w-4 h-4" />
            Parse &amp; preview
          </button>
        </div>
      )}

      {/* ── Step 2: Preview + metadata ── */}
      {step === 'preview' && (
        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag, press Enter"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-xs"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="text-sky-400 hover:text-sky-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Visibility */}
          <PostVisibilitySelector
            value={visibility}
            onChange={setVisibility}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
          />

          {/* Rendered preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Content preview</label>
              <button
                type="button"
                onClick={() => setStep('edit')}
                className="flex items-center gap-1 text-xs text-sky-600 hover:underline"
              >
                <Eye className="w-3.5 h-3.5" />
                Open in editor to fine-tune
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl p-5 max-h-96 overflow-y-auto bg-white">
              <TiptapRenderer content={content} />
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('paste')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep('edit')}
              className="flex items-center gap-2 px-4 py-2 border border-sky-300 text-sky-700 rounded-lg text-sm hover:bg-sky-50 transition"
            >
              <EyeOff className="w-4 h-4" />
              Edit in Tiptap
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition ml-auto"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save post'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Full Tiptap editor ── */}
      {step === 'edit' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <TiptapEditor
            content={content}
            onChange={setContent}
            placeholder="Edit your imported content…"
          />

          {saveError && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('preview')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              ← Back to preview
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition ml-auto"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
