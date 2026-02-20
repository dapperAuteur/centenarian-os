'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/recipes/slug';
import { calculateRecipeNutrition } from '@/lib/recipes/nutrition';
import RecipeVisibilitySelector from './RecipeVisibilitySelector';
import RecipeCloudinaryUploader from './RecipeCloudinaryUploader';
import RecipeIngredientBuilder, { type DraftIngredient } from './RecipeIngredientBuilder';
import { Save, Loader2, ExternalLink, RefreshCw, Plus, Trash2, Link2, Download } from 'lucide-react';
import type { Recipe, RecipeMedia, RecipeVisibility } from '@/lib/types';

const TiptapEditor = dynamic(() => import('@/components/blog/TiptapEditor'), { ssr: false });

interface RecipeFormProps {
  recipe?: Recipe & { recipe_ingredients?: DraftIngredient[]; recipe_media?: RecipeMedia[] };
  username: string;
}

export default function RecipeForm({ recipe, username }: RecipeFormProps) {
  const router = useRouter();
  const isEditing = !!recipe;
  const supabase = createClient();

  const [title, setTitle] = useState(recipe?.title || '');
  const [slug, setSlug] = useState(recipe?.slug || '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState(recipe?.description || '');
  const [content, setContent] = useState<object>(recipe?.content || {});
  const [tags, setTags] = useState<string[]>(recipe?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<RecipeVisibility>(recipe?.visibility || 'draft');
  const [scheduledAt, setScheduledAt] = useState<string | null>(recipe?.scheduled_at || null);
  const [coverImageUrl, setCoverImageUrl] = useState(recipe?.cover_image_url || '');
  const [coverImagePublicId, setCoverImagePublicId] = useState(recipe?.cover_image_public_id || '');
  const [servings, setServings] = useState<string>(recipe?.servings?.toString() || '');
  const [prepTime, setPrepTime] = useState<string>(recipe?.prep_time_minutes?.toString() || '');
  const [cookTime, setCookTime] = useState<string>(recipe?.cook_time_minutes?.toString() || '');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(recipe?.recipe_ingredients || []);
  const [media, setMedia] = useState<RecipeMedia[]>(recipe?.recipe_media || []);

  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? '');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-generate slug from title
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

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError('');
    setImportSuccess(false);
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.servings) setServings(String(data.servings));
      if (data.prepTime) setPrepTime(String(data.prepTime));
      if (data.cookTime) setCookTime(String(data.cookTime));
      if (data.ingredients?.length) setIngredients(data.ingredients);
      if (data.sourceUrl) setSourceUrl(data.sourceUrl);

      setImportSuccess(true);
      setImportUrl('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed. Try a different URL.');
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async (overrideVisibility?: RecipeVisibility) => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (visibility === 'scheduled' && !scheduledAt) {
      setError('Please set a publish date for scheduled recipes');
      return;
    }

    setSaving(true);
    setError('');

    // Calculate nutrition from ingredients
    const nutrition = ingredients.length > 0 ? calculateRecipeNutrition(ingredients) : null;

    const payload = {
      title: title.trim(),
      slug: slug.trim() || generateSlug(title),
      description: description.trim() || null,
      content,
      cover_image_url: coverImageUrl || null,
      cover_image_public_id: coverImagePublicId || null,
      visibility: overrideVisibility || visibility,
      scheduled_at: scheduledAt,
      tags,
      servings: servings ? parseInt(servings) : null,
      prep_time_minutes: prepTime ? parseInt(prepTime) : null,
      cook_time_minutes: cookTime ? parseInt(cookTime) : null,
      source_url: sourceUrl.trim() || null,
      ...(nutrition ? {
        total_calories: nutrition.total_calories,
        total_protein_g: nutrition.total_protein_g,
        total_carbs_g: nutrition.total_carbs_g,
        total_fat_g: nutrition.total_fat_g,
        total_fiber_g: nutrition.total_fiber_g,
        ncv_score: nutrition.ncv_score,
      } : {}),
    };

    const url = isEditing ? `/api/recipes/${recipe.id}` : '/api/recipes';
    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to save recipe');
      setSaving(false);
      return;
    }

    const recipeId = isEditing ? recipe.id : data.id;

    // Sync recipe_ingredients: delete all and re-insert
    if (isEditing) {
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    }

    if (ingredients.length > 0) {
      await supabase.from('recipe_ingredients').insert(
        ingredients.map((ing, index) => ({
          recipe_id: recipeId,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          calories: ing.calories,
          protein_g: ing.protein_g,
          carbs_g: ing.carbs_g,
          fat_g: ing.fat_g,
          fiber_g: ing.fiber_g,
          usda_fdc_id: ing.usda_fdc_id,
          off_barcode: ing.off_barcode,
          brand: ing.brand,
          sort_order: index,
        }))
      );
    }

    setLastSaved(new Date());
    setSaving(false);

    if (!isEditing) {
      router.push(`/dashboard/recipes/${recipeId}/edit`);
    }
  };

  const handleAddMedia = async (url: string, publicId: string, resourceType: 'image' | 'video') => {
    if (!isEditing) return; // Media uploads only available after initial save

    const { data } = await supabase
      .from('recipe_media')
      .insert([{
        recipe_id: recipe?.id,
        url,
        public_id: publicId,
        resource_type: resourceType,
        sort_order: media.length,
      }])
      .select()
      .single();

    if (data) {
      setMedia((prev) => [...prev, data as RecipeMedia]);
    }
  };

  const handleRemoveMedia = async (mediaItem: RecipeMedia) => {
    await supabase.from('recipe_media').delete().eq('id', mediaItem.id);
    setMedia((prev) => prev.filter((m) => m.id !== mediaItem.id));

    // Delete from Cloudinary via API
    await fetch(`/api/recipes/${recipe?.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // no-op patch to trigger Cloudinary cleanup handled separately
    });
  };

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/recipes/cooks/${username}/${slug}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit recipe' : 'New recipe'}
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
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition"
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

      {!isEditing && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Save the recipe first to upload additional media (images and videos).
        </div>
      )}

      {/* Import from URL — only shown for new recipes */}
      {!isEditing && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Import from a recipe URL
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://example.com/my-favorite-recipe"
              className="flex-1 px-3 py-2 border border-orange-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-60 transition"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Import
            </button>
          </div>
          {importError && <p className="text-sm text-red-600 mt-2">{importError}</p>}
          {importSuccess && (
            <p className="text-sm text-green-700 font-medium mt-2">
              Recipe imported! Review and edit the fields below before saving.
            </p>
          )}
          <p className="text-xs text-orange-600 mt-2">
            Works with sites that use structured recipe data (most major food blogs).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recipe title"
              className="w-full px-0 py-2 text-3xl font-bold text-gray-900 border-0 border-b-2 border-gray-200 focus:border-orange-500 focus:outline-none bg-transparent placeholder-gray-300"
            />
          </div>

          {/* Ingredients */}
          <RecipeIngredientBuilder ingredients={ingredients} onChange={setIngredients} />

          {/* Instructions (Tiptap) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Instructions</label>
            <TiptapEditor
              content={isEditing ? (recipe.content as object) : null}
              onChange={setContent}
              placeholder="Write step-by-step instructions…"
            />
          </div>

          {/* Media gallery (only when editing) */}
          {isEditing && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Photos &amp; Videos
              </label>
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {media.map((item) => (
                    <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden group bg-gray-100">
                      {item.resource_type === 'image' ? (
                        <Image
                          src={item.url}
                          alt={item.caption || 'Recipe media'}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(item)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <RecipeCloudinaryUploader
                  mediaType="image"
                  onUploadSuccess={(result) => handleAddMedia(result.url, result.publicId, 'image')}
                />
                <RecipeCloudinaryUploader
                  mediaType="video"
                  onUploadSuccess={(result) => handleAddMedia(result.url, result.publicId, 'video')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Visibility */}
          <RecipeVisibilitySelector
            value={visibility}
            onChange={setVisibility}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
          />

          {/* Public URL preview */}
          {(visibility === 'public' || visibility === 'scheduled') && slug && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-1">
              <p className="text-xs font-medium text-gray-600">Recipe URL</p>
              <p className="text-xs text-gray-500 break-all font-mono">{publicUrl}</p>
              {isEditing && visibility === 'public' && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View recipe
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
                placeholder="recipe-url-slug"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
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

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description shown in recipe listings…"
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right">{description.length}/500</p>
          </div>

          {/* Recipe metadata */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Recipe details</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Servings</label>
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  min="1"
                  placeholder="4"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prep (min)</label>
                <input
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  min="0"
                  placeholder="15"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cook (min)</label>
                <input
                  type="number"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  min="0"
                  placeholder="30"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
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
              <RecipeCloudinaryUploader
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-orange-400 hover:text-orange-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Source URL */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Link2 className="w-3.5 h-3.5 text-gray-400" />
              Source URL
              <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://original-recipe-site.com/recipe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-400">Cite the original source. Shown on the public recipe page.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
