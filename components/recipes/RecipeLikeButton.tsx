'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';

interface RecipeLikeButtonProps {
  recipeId: string;
  initialLiked: boolean;
  initialCount: number;
  isAuthenticated: boolean;
}

export default function RecipeLikeButton({
  recipeId,
  initialLiked,
  initialCount,
  isAuthenticated,
}: RecipeLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    // Optimistic update
    setLiked((prev) => !prev);
    setCount((prev) => (liked ? prev - 1 : prev + 1));

    try {
      const res = await fetch(`/api/recipes/${recipeId}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setCount(data.like_count);
      } else {
        // Revert on error
        setLiked((prev) => !prev);
        setCount((prev) => (liked ? prev + 1 : prev - 1));
      }
    } catch {
      setLiked((prev) => !prev);
      setCount((prev) => (liked ? prev + 1 : prev - 1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={isAuthenticated ? (liked ? 'Unlike this recipe' : 'Like this recipe') : 'Sign in to like'}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition ${
        liked
          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
      <span>{count}</span>
    </button>
  );
}
