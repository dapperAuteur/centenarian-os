'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';

interface BlogSaveButtonProps {
  postId: string;
  initialSaved: boolean;
  initialCount: number;
  isAuthenticated: boolean;
}

export default function BlogSaveButton({
  postId,
  initialSaved,
  initialCount,
  isAuthenticated,
}: BlogSaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    setSaved((prev) => !prev);
    setCount((prev) => (saved ? prev - 1 : prev + 1));

    try {
      const res = await fetch(`/api/blog/${postId}/save`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
        setCount(data.save_count);
      } else {
        setSaved((prev) => !prev);
        setCount((prev) => (saved ? prev + 1 : prev - 1));
      }
    } catch {
      setSaved((prev) => !prev);
      setCount((prev) => (saved ? prev + 1 : prev - 1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={isAuthenticated ? (saved ? 'Remove from saved' : 'Save this post') : 'Sign in to save'}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition ${
        saved
          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
      <span>{count}</span>
    </button>
  );
}
