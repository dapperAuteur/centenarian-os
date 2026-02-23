'use client';

// app/dashboard/fuel/recipe-ideas/page.tsx
// AI-generated recipe suggestions from current inventory

import { useState } from 'react';
import { Sparkles, Loader2, Clock, Users, ChefHat, Save, Check, AlertCircle } from 'lucide-react';

interface RecipeIdea {
  name: string;
  description: string;
  ingredients_used: string[];
  extra_ingredients: string[];
  instructions: string[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  nutritional_highlight: string;
  tags: string[];
}

export default function RecipeIdeasPage() {
  const [recipes, setRecipes] = useState<RecipeIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSavedIds(new Set());
    try {
      const res = await fetch('/api/ai/recipe-ideas', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      if (data.message && (!data.recipes || data.recipes.length === 0)) {
        setError(data.message);
        setRecipes([]);
      } else {
        setRecipes(data.recipes || []);
      }
      setHasGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const saveAsDraft = async (recipe: RecipeIdea, index: number) => {
    setSavingId(index);
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: recipe.name,
          description: recipe.description,
          content: {
            instructions: recipe.instructions,
            nutritional_highlight: recipe.nutritional_highlight,
          },
          tags: recipe.tags,
          prep_time_minutes: recipe.prep_time_minutes,
          cook_time_minutes: recipe.cook_time_minutes,
          servings: recipe.servings,
          visibility: 'draft',
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSavedIds((prev) => new Set(prev).add(index));
    } catch {
      // silently fail — user can retry
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
            <ChefHat className="w-7 h-7 sm:w-8 sm:h-8 text-lime-600 shrink-0" />
            Recipe Ideas
          </h1>
          <p className="text-gray-600 text-sm mt-1">AI-suggested recipes from your current inventory</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-lime-600 text-white rounded-xl font-medium text-sm hover:bg-lime-700 transition disabled:opacity-50 min-h-11 shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {hasGenerated ? 'Regenerate' : 'Generate Ideas'}
            </>
          )}
        </button>
      </header>

      {/* Error */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}

      {/* Recipe Cards */}
      {recipes.length > 0 && (
        <div className="space-y-6">
          {recipes.map((recipe, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Card Header */}
              <div className="p-4 sm:p-6 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">{recipe.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{recipe.description}</p>
                  </div>
                  <button
                    onClick={() => saveAsDraft(recipe, i)}
                    disabled={savedIds.has(i) || savingId === i}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition shrink-0 min-h-10 ${
                      savedIds.has(i)
                        ? 'bg-lime-100 text-lime-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {savingId === i ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : savedIds.has(i) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savedIds.has(i) ? 'Saved' : 'Save Draft'}
                  </button>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Prep {recipe.prep_time_minutes}m
                    {recipe.cook_time_minutes > 0 && ` + Cook ${recipe.cook_time_minutes}m`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {recipe.servings} servings
                  </span>
                </div>

                {/* Tags */}
                {recipe.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-lime-50 text-lime-700 text-xs rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Ingredients */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">From Your Inventory</h3>
                  <ul className="space-y-1">
                    {recipe.ingredients_used?.map((ing) => (
                      <li key={ing} className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-500 shrink-0" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                  {recipe.extra_ingredients?.length > 0 && (
                    <>
                      <h3 className="text-sm font-bold text-gray-900 mt-4 mb-2">You May Need</h3>
                      <ul className="space-y-1">
                        {recipe.extra_ingredients.map((ing) => (
                          <li key={ing} className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Instructions</h3>
                  <ol className="space-y-2">
                    {recipe.instructions?.map((step, j) => (
                      <li key={j} className="text-sm text-gray-700 flex gap-2">
                        <span className="font-bold text-lime-600 shrink-0">{j + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Nutrition Highlight */}
              {recipe.nutritional_highlight && (
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="bg-lime-50 rounded-lg p-3">
                    <p className="text-sm text-lime-800">
                      <span className="font-semibold">Nutrition:</span> {recipe.nutritional_highlight}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && recipes.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-8 sm:p-12 text-center">
          <ChefHat className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {hasGenerated ? 'No recipes generated' : 'Ready to cook?'}
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {hasGenerated
              ? 'Add more ingredients to your inventory and try again.'
              : 'Click "Generate Ideas" to get AI-powered recipe suggestions based on ingredients currently in your inventory.'}
          </p>
        </div>
      )}
    </div>
  );
}
