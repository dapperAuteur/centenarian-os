import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import PostForm from '@/components/blog/PostForm';
import type { BlogPost, Profile } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch post and profile in parallel
  const [postResult, profileResult] = await Promise.all([
    supabase.from('blog_posts').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);

  if (!postResult.data) notFound();
  if (!profileResult.data) redirect('/dashboard/blog'); // Profile not set up yet

  const post = postResult.data as BlogPost;
  const profile = profileResult.data as Profile;

  return <PostForm post={post} username={profile.username} />;
}
