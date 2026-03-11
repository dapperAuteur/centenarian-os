import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: items, error } = await supabase
    .from('media_items')
    .select('media_type, status, rating, is_favorite')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = items || [];

  // Counts by media_type
  const byType: Record<string, number> = {};
  for (const item of all) {
    byType[item.media_type] = (byType[item.media_type] || 0) + 1;
  }

  // Counts by status
  const byStatus: Record<string, number> = {};
  for (const item of all) {
    const s = item.status || 'backlog';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  // Average rating (only rated items)
  const rated = all.filter((i) => i.rating != null);
  const averageRating = rated.length > 0
    ? Math.round((rated.reduce((sum, i) => sum + i.rating, 0) / rated.length) * 10) / 10
    : null;

  // Favorites count
  const favoritesCount = all.filter((i) => i.is_favorite).length;

  return NextResponse.json({
    total: all.length,
    by_type: byType,
    by_status: byStatus,
    average_rating: averageRating,
    favorites_count: favoritesCount,
  });
}
