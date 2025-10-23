// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get(process.env.SUPABASE__SUPABASE_URL)!,
    Deno.env.get(process.env.SUPABASE__SUPABASE_SERVICE_ROLE_KEY)!
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const tables = ['tasks', 'milestones', 'goals', 'roadmaps'];
  let totalDeleted = 0;

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq('status', 'archived')
      .lt('archived_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
    } else {
      totalDeleted += data?.length || 0;
    }
  }

  return new Response(
    JSON.stringify({ deleted: totalDeleted }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});