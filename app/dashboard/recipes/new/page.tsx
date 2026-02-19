'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import RecipeForm from '@/components/recipes/RecipeForm';
import UsernameSetupModal from '@/components/blog/UsernameSetupModal';
import type { Profile } from '@/lib/types';

export default function NewRecipePage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
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

  if (loading || profileLoading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>;
  }

  if (!user) return null;

  return (
    <>
      <UsernameSetupModal
        isOpen={!profile}
        onComplete={handleProfileCreated}
      />
      {profile && <RecipeForm username={profile.username} />}
    </>
  );
}
