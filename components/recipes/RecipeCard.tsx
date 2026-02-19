// components/recipes/RecipeCard.tsx
// Public-facing card for recipe listing grids.

import Link from 'next/link';
import Image from 'next/image';
import { Clock, Users, Heart, Bookmark } from 'lucide-react';
import type { Recipe, Profile } from '@/lib/types';

interface RecipeCardProps {
  recipe: Pick<
    Recipe,
    'slug' | 'title' | 'description' | 'cover_image_url' | 'published_at' | 'tags' |
    'ncv_score' | 'total_calories' | 'servings' | 'prep_time_minutes' | 'cook_time_minutes' |
    'like_count' | 'save_count'
  >;
  author?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>;
}

const NCV_COLORS = {
  Green: 'bg-green-100 text-green-800',
  Yellow: 'bg-yellow-100 text-yellow-800',
  Red: 'bg-red-100 text-red-800',
};

export default function RecipeCard({ recipe, author }: RecipeCardProps) {
  const authorName = author?.display_name || author?.username || 'Unknown Cook';
  const href = author?.username ? `/recipes/cooks/${author.username}/${recipe.slug}` : '#';
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <article className="group flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {recipe.cover_image_url ? (
        <Link href={href} className="block aspect-video overflow-hidden bg-gray-100">
          <Image
            src={recipe.cover_image_url}
            alt={recipe.title}
            width={640}
            height={360}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
      ) : (
        <Link href={href} className="block aspect-video bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
          <span className="text-4xl">🍽️</span>
        </Link>
      )}

      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Author + NCV badge */}
        <div className="flex items-center justify-between gap-2">
          {author?.username ? (
            <Link
              href={`/recipes/cooks/${author.username}`}
              className="text-xs text-gray-500 hover:text-sky-600 transition-colors truncate"
            >
              {authorName}
            </Link>
          ) : (
            <span className="text-xs text-gray-500 truncate">{authorName}</span>
          )}
          {recipe.ncv_score && (
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${NCV_COLORS[recipe.ncv_score]}`}>
              {recipe.ncv_score}
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={href}>
          <h2 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">
            {recipe.title}
          </h2>
        </Link>

        {recipe.description && (
          <p className="text-sm text-gray-600 line-clamp-2 flex-1">{recipe.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {totalTime} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {recipe.servings} servings
            </span>
          )}
          {recipe.total_calories && (
            <span>{Math.round(recipe.total_calories)} kcal</span>
          )}
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <Link
            href={href}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
          >
            View recipe →
          </Link>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" /> {recipe.like_count}
            </span>
            <span className="flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5" /> {recipe.save_count}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
