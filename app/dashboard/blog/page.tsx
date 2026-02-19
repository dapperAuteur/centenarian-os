'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import BlogPostList from '@/components/blog/BlogPostList';
import BlogAnalytics from '@/components/blog/BlogAnalytics';
import LikedSavedPosts from '@/components/blog/LikedSavedPosts';
import UsernameSetupModal from '@/components/blog/UsernameSetupModal';
import { PenLine, BarChart2, List, FileDown, Heart, Bookmark } from 'lucide-react';
import { isAdmin } from '@/lib/blog/admin';
import type { Profile } from '@/lib/types';

type Tab = 'posts' | 'analytics' | 'liked' | 'saved';

export default function BlogDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
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
    // Reload full profile
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
      {/* Username setup gate */}
      <UsernameSetupModal
        isOpen={!profile}
        onComplete={handleProfileCreated}
      />

      {profile && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Your blog:{' '}
                <a
                  href={`/blog/${profile.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  /blog/{profile.username}
                </a>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin(user.email) && (
                <Link
                  href="/dashboard/blog/import"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  <FileDown className="w-4 h-4" />
                  Import
                </Link>
              )}
              <Link
                href="/dashboard/blog/new"
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
              >
                <PenLine className="w-4 h-4" />
                New post
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {([
              { id: 'posts' as Tab, label: 'Posts', icon: <List className="w-4 h-4" /> },
              { id: 'analytics' as Tab, label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
              { id: 'liked' as Tab, label: 'Liked', icon: <Heart className="w-4 h-4" /> },
              { id: 'saved' as Tab, label: 'Saved', icon: <Bookmark className="w-4 h-4" /> },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'posts' && (
            <BlogPostList userId={user.id} username={profile.username} />
          )}
          {activeTab === 'analytics' && (
            <BlogAnalytics userId={user.id} />
          )}
          {activeTab === 'liked' && (
            <LikedSavedPosts userId={user.id} mode="liked" />
          )}
          {activeTab === 'saved' && (
            <LikedSavedPosts userId={user.id} mode="saved" />
          )}
        </>
      )}
    </div>
  );
}
