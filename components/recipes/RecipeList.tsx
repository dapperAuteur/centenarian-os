'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DeleteRecipeModal from './DeleteRecipeModal';
import { PenLine, Trash2, Eye, Clock, Globe, FileText, Heart, Bookmark, Search } from 'lucide-react';
import type { Recipe, RecipeVisibility } from '@/lib/types';

interface RecipeListProps {
  userId: string;
  username: string;
}

const VISIBILITY_META: Record<RecipeVisibility, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: 'Draft', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-gray-500 bg-gray-100' },
  public: { label: 'Public', icon: <Globe className="w-3.5 h-3.5" />, color: 'text-green-700 bg-green-50' },
  scheduled: { label: 'Scheduled', icon: <Clock className="w-3.5 h-3.5" />, color: 'text-sky-700 bg-sky-50' },
};

const VISIBILITY_FILTERS: { value: RecipeVisibility | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'public', label: 'Public' },
  { value: 'scheduled', label: 'Scheduled' },
];

function formatDate(iso: string | null) {
  if (!iso) return 'Not published';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RecipeList({ userId, username }: RecipeListProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<RecipeVisibility | ''>('');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'title'>('created_at');
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setRecipes(data || []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = recipes;
    if (visibilityFilter) {
      result = result.filter((r) => r.visibility === visibilityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.tags && r.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }
    if (sortBy === 'updated_at') {
      result = [...result].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    } else if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [recipes, visibilityFilter, search, sortBy]);

  const handleDeleted = (deletedId: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== deletedId));
  };

  if (loading) {
    return <div className="py-10 text-center text-gray-400 text-sm">Loading recipes…</div>;
  }

  if (!recipes.length) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-gray-500">You haven&apos;t created any recipes yet.</p>
        <Link
          href="/dashboard/recipes/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
        >
          <PenLine className="w-4 h-4" />
          Create your first recipe
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, description, or tag..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {VISIBILITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setVisibilityFilter(f.value)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition ${
                  visibilityFilter === f.value
                    ? 'bg-orange-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="ml-auto border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600"
          >
            <option value="created_at">Newest</option>
            <option value="updated_at">Recently edited</option>
            <option value="title">Title A–Z</option>
          </select>
          <span className="text-xs text-gray-400">{filtered.length} recipe{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">
          No recipes match your filters.
        </div>
      ) : filtered.map((recipe) => {
        const meta = VISIBILITY_META[recipe.visibility];
        return (
          <div
            key={recipe.id}
            className="flex items-start justify-between gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                  {meta.icon}
                  {meta.label}
                </span>
                {recipe.scheduled_at && recipe.visibility === 'scheduled' && (
                  <span className="text-xs text-gray-400">
                    {formatDate(recipe.scheduled_at)}
                  </span>
                )}
              </div>

              <h3 className="font-medium text-gray-900 truncate">{recipe.title}</h3>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span>{formatDate(recipe.published_at || recipe.created_at)}</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {recipe.view_count}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> {recipe.like_count}
                </span>
                <span className="flex items-center gap-1">
                  <Bookmark className="w-3 h-3" /> {recipe.save_count}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {recipe.visibility === 'public' && (
                <Link
                  href={`/recipes/cooks/${username}/${recipe.slug}`}
                  target="_blank"
                  className="p-1.5 text-gray-400 hover:text-orange-600 transition"
                  title="View public recipe"
                >
                  <Eye className="w-4 h-4" />
                </Link>
              )}
              <Link
                href={`/dashboard/recipes/${recipe.id}/edit`}
                className="p-1.5 text-gray-400 hover:text-gray-700 transition"
                title="Edit recipe"
              >
                <PenLine className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setDeleteTarget({ id: recipe.id, title: recipe.title })}
                className="p-1.5 text-gray-400 hover:text-red-500 transition"
                title="Delete recipe"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      <DeleteRecipeModal
        isOpen={!!deleteTarget}
        recipeId={deleteTarget?.id || null}
        recipeTitle={deleteTarget?.title || ''}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
