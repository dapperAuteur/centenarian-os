'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { generateSlug } from '@/lib/blog/slug';
import PostVisibilitySelector from './PostVisibilitySelector';
import CloudinaryUploader from './CloudinaryUploader';
import { Save, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import type { BlogPost, PostVisibility } from '@/lib/types';

// Dynamically import the Tiptap editor to avoid SSR issues
const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });

interface PostFormProps {
  post?: BlogPost;
  username: string;
}

export default function PostForm({ post, username }: PostFormProps) {
  const router = useRouter();
  const isEditing = !!post;

  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [content, setContent] = useState<object>(post?.content || {});
  const [tags, setTags] = useState<string[]>(post?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>(post?.visibility || 'draft');
  const [scheduledAt, setScheduledAt] = useState<string | null>(post?.scheduled_at || null);
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url || '');
  const [coverImagePublicId, setCoverImagePublicId] = useState(post?.cover_image_public_id || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-generate slug from title (unless user has manually edited it)
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(generateSlug(title));
    }
  }, [title, slugManuallyEdited]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag) && tags.length < 10) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async (overrideVisibility?: PostVisibility) => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (visibility === 'scheduled' && !scheduledAt) {
      setError('Please set a publish date for scheduled posts');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      title: title.trim(),
      slug: slug.trim() || generateSlug(title),
      excerpt: excerpt.trim() || null,
      content,
      cover_image_url: coverImageUrl || null,
      cover_image_public_id: coverImagePublicId || null,
      visibility: overrideVisibility || visibility,
      scheduled_at: scheduledAt,
      tags,
    };

    const url = isEditing ? `/api/blog/${post.id}` : '/api/blog';
    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to save post');
      setSaving(false);
      return;
    }

    setLastSaved(new Date());
    setSaving(false);

    if (!isEditing) {
      // Redirect to edit page after creation
      router.push(`/dashboard/blog/${data.id}/edit`);
    }
  };

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/blog/${username}/${slug}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit post' : 'New post'}
        </h1>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-gray-400">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isEditing ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              className="w-full px-0 py-2 text-3xl font-bold text-gray-900 border-0 border-b-2 border-gray-200 focus:border-sky-500 focus:outline-none bg-transparent placeholder-gray-300"
            />
          </div>

          {/* Tiptap WYSIWYG editor */}
          <TiptapEditor
            content={isEditing ? (post.content as object) : null}
            onChange={setContent}
            placeholder="Start writing your post…"
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Visibility */}
          <PostVisibilitySelector
            value={visibility}
            onChange={setVisibility}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
          />

          {/* Public URL preview */}
          {(visibility === 'public' || visibility === 'scheduled' || visibility === 'authenticated_only') && slug && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-1">
              <p className="text-xs font-medium text-gray-600">Post URL</p>
              <p className="text-xs text-gray-500 break-all font-mono">{publicUrl}</p>
              {isEditing && visibility === 'public' && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View post
                </a>
              )}
            </div>
          )}

          {/* Slug */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">URL slug</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                  setSlugManuallyEdited(true);
                }}
                placeholder="post-url-slug"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => {
                  setSlug(generateSlug(title));
                  setSlugManuallyEdited(false);
                }}
                title="Re-generate from title"
                className="p-1.5 text-gray-400 hover:text-gray-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Excerpt */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Brief summary shown in post listings…"
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right">{excerpt.length}/500</p>
          </div>

          {/* Cover image */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Cover image</label>
            {coverImageUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImageUrl} alt="Cover" className="w-full aspect-video object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => { setCoverImageUrl(''); setCoverImagePublicId(''); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove cover image
                </button>
              </div>
            ) : (
              <CloudinaryUploader
                mediaType="image"
                onUploadSuccess={(result) => {
                  setCoverImageUrl(result.url);
                  setCoverImagePublicId(result.publicId);
                }}
              />
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type tag, press Enter or comma"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-sky-400 hover:text-sky-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
