'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import RecipeList from '@/components/recipes/RecipeList';
import UsernameSetupModal from '@/components/blog/UsernameSetupModal';
import { PenLine, BarChart2, List, Eye } from 'lucide-react';
import type { Profile } from '@/lib/types';

type Tab = 'recipes' | 'analytics';

export default function RecipeDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('recipes');
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setProfileLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleProfileCreated = (username: string) => {
    setProfile((prev) => ({ ...(prev || {} as Profile), username }));
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  };

  if (authLoading || profileLoading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>;
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Username setup gate — same modal used by blog */}
      <UsernameSetupModal
        isOpen={!profile}
        onComplete={handleProfileCreated}
      />

      {profile && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Your cook page:{' '}
                <a
                  href={`/recipes/cooks/${profile.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:underline"
                >
                  /recipes/cooks/{profile.username}
                </a>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/recipes/cooks/${profile.username}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                <Eye className="w-4 h-4" />
                View public page
              </Link>
              <Link
                href="/dashboard/recipes/new"
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
              >
                <PenLine className="w-4 h-4" />
                New recipe
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {([
              { id: 'recipes' as Tab, label: 'My Recipes', icon: <List className="w-4 h-4" /> },
              { id: 'analytics' as Tab, label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'recipes' && (
            <RecipeList userId={user.id} username={profile.username} />
          )}
          {activeTab === 'analytics' && (
            <RecipeAnalyticsPlaceholder />
          )}
        </>
      )}
    </div>
  );
}

function RecipeAnalyticsPlaceholder() {
  return (
    <div className="py-16 text-center text-gray-400 space-y-2">
      <BarChart2 className="w-10 h-10 mx-auto text-gray-300" />
      <p className="text-sm">Recipe analytics coming soon.</p>
    </div>
  );
}
