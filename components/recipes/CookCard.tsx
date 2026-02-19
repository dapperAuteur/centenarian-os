// components/recipes/CookCard.tsx
// Profile card for the /recipes/cooks listing page.

import Link from 'next/link';
import Image from 'next/image';
import { ChefHat } from 'lucide-react';
import type { Profile } from '@/lib/types';

interface CookCardProps {
  profile: Profile;
  recipeCount: number;
}

export default function CookCard({ profile, recipeCount }: CookCardProps) {
  const href = `/recipes/cooks/${profile.username}`;

  return (
    <Link href={href} className="group flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="shrink-0">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name || profile.username}
            width={56}
            height={56}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-amber-200 flex items-center justify-center">
            <ChefHat className="w-7 h-7 text-orange-500" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
          {profile.display_name || profile.username}
        </h3>
        <p className="text-sm text-gray-500">@{profile.username}</p>
        {profile.bio && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{profile.bio}</p>
        )}
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <ChefHat className="w-3.5 h-3.5" />
          {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
        </p>
      </div>
    </Link>
  );
}
