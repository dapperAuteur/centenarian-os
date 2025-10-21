// File: scripts/debug-check-data.ts
// Run: npx ts-node scripts/debug-check-data.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDatabase() {
  console.log('🔍 Checking database...\n');

  // 1. Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('❌ Not authenticated:', authError);
    return;
  }
  console.log('✅ Authenticated as:', user.email);
  console.log('   User ID:', user.id, '\n');

  // 2. Check roadmaps
  const { data: roadmaps, error: roadmapError } = await supabase
    .from('roadmaps')
    .select('*');
  
  console.log('📋 Roadmaps:', roadmaps?.length || 0);
  if (roadmapError) console.error('   Error:', roadmapError.message);
  if (roadmaps?.length) {
    roadmaps.forEach(r => console.log(`   - ${r.title} (${r.id})`));
  }
  console.log('');

  // 3. Check goals
  const { data: goals, error: goalError } = await supabase
    .from('goals')
    .select('*');
  
  console.log('🎯 Goals:', goals?.length || 0);
  if (goalError) console.error('   Error:', goalError.message);
  if (goals?.length) {
    goals.forEach(g => console.log(`   - ${g.title} (roadmap: ${g.roadmap_id})`));
  }
  console.log('');

  // 4. Check milestones
  const { data: milestones, error: milestoneError } = await supabase
    .from('milestones')
    .select('*');
  
  console.log('🏁 Milestones:', milestones?.length || 0);
  if (milestoneError) console.error('   Error:', milestoneError.message);
  if (milestones?.length) {
    milestones.forEach(m => console.log(`   - ${m.title} (goal: ${m.goal_id})`));
  }
  console.log('');

  // 5. Check tasks
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('*');
  
  console.log('✅ Tasks:', tasks?.length || 0);
  if (taskError) console.error('   Error:', taskError.message);
  if (tasks?.length) {
    tasks.forEach(t => console.log(`   - [${t.date}] ${t.activity} (milestone: ${t.milestone_id})`));
  }
  console.log('');

  // 6. Check today's tasks specifically
  const today = new Date().toISOString().split('T')[0];
  const { data: todayTasks, error: todayError } = await supabase
    .from('tasks')
    .select('*')
    .eq('date', today);
  
  console.log(`📅 Today's tasks (${today}):`, todayTasks?.length || 0);
  if (todayError) console.error('   Error:', todayError.message);
  if (todayTasks?.length) {
    todayTasks.forEach(t => console.log(`   - ${t.time} ${t.activity}`));
  }

  // 7. Test RLS - check what the policy sees
  console.log('\n🔒 Testing RLS...');
  const { data: rlsTest, error: rlsError } = await supabase
    .rpc('auth.uid'); // This will show current user from RLS perspective
  
  if (rlsError) {
    console.log('   RLS function not available, but auth.uid() should return:', user.id);
  }
}

debugDatabase().catch(console.error);