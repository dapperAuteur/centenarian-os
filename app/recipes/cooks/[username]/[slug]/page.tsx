// app/recipes/cooks/[username]/[slug]/page.tsx
// Single recipe page with three-path flow:
//   1. Recipe accessible → render full recipe
//   2. Recipe truly doesn't exist → Next.js notFound() → 404
//   3. Recipe exists but restricted → unavailable page with cook's other recipes

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { Lock, Clock, Users, ChefHat } from 'lucide-react';
import TiptapRenderer from '@/components/blog/TiptapRenderer';
import RecipeShareBar from '@/components/recipes/RecipeShareBar';
import RecipeLikeButton from '@/components/recipes/RecipeLikeButton';
import RecipeSaveButton from '@/components/recipes/RecipeSaveButton';
import RecipeNutritionPanel from '@/components/recipes/RecipeNutritionPanel';
import RecipeMediaGallery from '@/components/recipes/RecipeMediaGallery';
import { buildRecipeShareUrls } from '@/lib/recipes/share';
import AddToFuelButton from './AddToFuelButton';
import type { Recipe, RecipeIngredient, RecipeMedia, Profile } from '@/lib/types';

type Props = { params: Promise<{ username: string; slug: string }> };

export default async function PublicRecipePage({ params }: Props) {
  const { username, slug } = await params;
  const supabase = await createClient();

  // Look up profile by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (!profile) notFound();

  const p = profile as Profile;

  // Check if current user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // Fetch the recipe — RLS handles visibility based on auth state
  const { data: recipe } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(*),
      recipe_media(*)
    `)
    .eq('user_id', p.id)
    .eq('slug', slug)
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .maybeSingle();

  // ── Path 1: Recipe is accessible ────────────────────────────────────────
  if (recipe) {
    const r = recipe as Recipe;
    const ingredients = ((recipe as { recipe_ingredients?: RecipeIngredient[] }).recipe_ingredients || [])
      .sort((a, b) => a.sort_order - b.sort_order);
    const media = ((recipe as { recipe_media?: RecipeMedia[] }).recipe_media || [])
      .sort((a, b) => a.sort_order - b.sort_order);

    const { recipeUrl, email, linkedin } = buildRecipeShareUrls(r, p.username);

    // Check like/save state for authenticated user
    let isLiked = false;
    let isSaved = false;
    if (user) {
      const [likeRow, saveRow] = await Promise.all([
        supabase.from('recipe_likes').select('user_id').eq('user_id', user.id).eq('recipe_id', r.id).maybeSingle(),
        supabase.from('recipe_saves').select('user_id').eq('user_id', user.id).eq('recipe_id', r.id).maybeSingle(),
      ]);
      isLiked = !!likeRow.data;
      isSaved = !!saveRow.data;
    }

    // Log view event (fire and forget)
    supabase.rpc('log_recipe_event', {
      p_recipe_id: r.id,
      p_event_type: 'view',
      p_user_id: user?.id || null,
    }).then(({ error }) => {
      if (error) console.warn('[recipes] view event failed:', error.message);
    });

    const totalTime = (r.prep_time_minutes || 0) + (r.cook_time_minutes || 0);

    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Cover image */}
        {r.cover_image_url && (
          <div className="mb-8 rounded-2xl overflow-hidden aspect-video">
            <Image
              src={r.cover_image_url}
              alt={r.title}
              width={1200}
              height={630}
              className="w-full h-full object-cover"
              priority
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 leading-tight">{r.title}</h1>

          {r.description && (
            <p className="text-lg text-gray-600 mb-4">{r.description}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <Link
              href={`/recipes/cooks/${p.username}`}
              className="flex items-center gap-2 hover:text-orange-600 transition"
            >
              <ChefHat className="w-4 h-4" />
              {p.display_name || p.username}
            </Link>
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {totalTime} min
                {r.prep_time_minutes && r.cook_time_minutes && (
                  <span className="text-gray-400">({r.prep_time_minutes} prep + {r.cook_time_minutes} cook)</span>
                )}
              </span>
            )}
            {r.servings && (
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {r.servings} servings
              </span>
            )}
            {r.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/recipes?tag=${encodeURIComponent(tag)}`}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-orange-100 hover:text-orange-700 transition"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Nutrition panel */}
        <div className="mb-6">
          <RecipeNutritionPanel recipe={r} />
        </div>

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Ingredients</h2>
            <ul className="space-y-2">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex items-baseline gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="font-medium text-gray-800 shrink-0">
                    {ing.quantity} {ing.unit}
                  </span>
                  <span className="text-gray-700">{ing.name}</span>
                  {ing.brand && (
                    <span className="text-xs text-gray-400">({ing.brand})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Instructions */}
        {(r.content as { content?: unknown[] })?.content?.length ? (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h2>
            <article className="prose prose-gray max-w-none">
              <TiptapRenderer content={r.content} />
            </article>
          </section>
        ) : null}

        {/* Media gallery */}
        {media.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Photos &amp; Videos</h2>
            <RecipeMediaGallery media={media} />
          </section>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 py-6 border-t border-b border-gray-200 mb-6">
          <RecipeLikeButton
            recipeId={r.id}
            initialLiked={isLiked}
            initialCount={r.like_count}
            isAuthenticated={isAuthenticated}
          />
          <RecipeSaveButton
            recipeId={r.id}
            initialSaved={isSaved}
            initialCount={r.save_count}
            isAuthenticated={isAuthenticated}
          />
          {isAuthenticated && (
            <AddToFuelButton recipe={{ id: r.id, title: r.title }} />
          )}
        </div>

        {/* Share bar */}
        <div className="mb-8">
          <RecipeShareBar
            recipeUrl={recipeUrl}
            recipeTitle={r.title}
            recipeId={r.id}
            emailUrl={email}
            linkedinUrl={linkedin}
          />
        </div>

        {/* Back to cook's recipes */}
        <Link
          href={`/recipes/cooks/${p.username}`}
          className="text-sm text-orange-600 hover:underline"
        >
          ← More recipes by {p.display_name || p.username}
        </Link>
      </main>
    );
  }

  // ── Path 2 & 3: Recipe not accessible — check if it exists ──────────────
  const { data: recipeId } = await supabase.rpc('get_recipe_id_by_slug', {
    p_user_id: p.id,
    p_slug: slug,
  });

  // Recipe truly doesn't exist → 404
  if (!recipeId) notFound();

  // Recipe exists but is restricted → log blocked_visit + show unavailable page
  const reqHeaders = await headers();
  const referrer = reqHeaders.get('referer') || reqHeaders.get('referrer') || null;
  const country = reqHeaders.get('cf-ipcountry') || reqHeaders.get('x-vercel-ip-country') || null;

  await supabase
    .rpc('log_recipe_event', {
      p_recipe_id: recipeId as string,
      p_event_type: 'blocked_visit',
      p_referrer: referrer,
      p_country: country,
    })
    .then(({ error }) => {
      if (error) console.warn('[recipes] blocked_visit log failed:', error.message);
    });

  // Fetch cook's other public recipes for the "you might like" section
  const { data: otherRecipes } = await supabase
    .from('recipes')
    .select('slug, title, published_at, description')
    .eq('user_id', p.id)
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .order('published_at', { ascending: false })
    .limit(5);

  return (
    <main className="max-w-3xl mx-auto px-4 py-16">
      {/* Unavailable notice */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
          <Lock className="w-6 h-6 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          This recipe is unavailable
        </h1>
        <p className="text-gray-500 max-w-sm mx-auto">
          This recipe is a draft or not yet published.{' '}
          <Link href="/login" className="text-orange-600 hover:underline">
            Sign in
          </Link>{' '}
          if you&apos;re the author.
        </p>
      </div>

      {/* Other recipes by this cook */}
      <div className="border-t border-gray-100 pt-10">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
          More recipes by {p.display_name || p.username}
        </h2>

        {otherRecipes && otherRecipes.length > 0 ? (
          <ul className="space-y-4">
            {otherRecipes.map((or) => (
              <li key={or.slug}>
                <Link
                  href={`/recipes/cooks/${p.username}/${or.slug}`}
                  className="group block p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition"
                >
                  <p className="font-medium text-gray-900 group-hover:text-orange-700">
                    {or.title}
                  </p>
                  {or.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{or.description}</p>
                  )}
                  {or.published_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(or.published_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">No public recipes yet.</p>
        )}

        <div className="mt-6">
          <Link
            href={`/recipes/cooks/${p.username}`}
            className="text-sm text-orange-600 hover:underline"
          >
            ← View all recipes by {p.display_name || p.username}
          </Link>
        </div>
      </div>
    </main>
  );
}
