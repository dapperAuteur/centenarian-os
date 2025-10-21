-- File: scripts/check-task-chain.sql
-- Run this in Supabase SQL Editor

-- Show all tasks with their ownership chain
SELECT 
  t.id AS task_id,
  t.date,
  t.activity,
  t.milestone_id,
  m.title AS milestone_title,
  m.goal_id,
  g.title AS goal_title,
  g.roadmap_id,
  r.title AS roadmap_title,
  r.user_id,
  -- Check if user_id matches current user
  CASE 
    WHEN r.user_id = auth.uid() THEN '✅ YOURS'
    ELSE '❌ NOT YOURS'
  END AS ownership
FROM tasks t
LEFT JOIN milestones m ON t.milestone_id = m.id
LEFT JOIN goals g ON m.goal_id = g.id
LEFT JOIN roadmaps r ON g.roadmap_id = r.id
ORDER BY t.date DESC
LIMIT 20;

-- Show broken chains (tasks with missing parents)
SELECT 
  'Orphaned Tasks' AS issue,
  COUNT(*) AS count
FROM tasks t
LEFT JOIN milestones m ON t.milestone_id = m.id
WHERE m.id IS NULL

UNION ALL

SELECT 
  'Orphaned Milestones' AS issue,
  COUNT(*) AS count
FROM milestones m
LEFT JOIN goals g ON m.goal_id = g.id
WHERE g.id IS NULL

UNION ALL

SELECT 
  'Orphaned Goals' AS issue,
  COUNT(*) AS count
FROM goals g
LEFT JOIN roadmaps r ON g.roadmap_id = r.id
WHERE r.id IS NULL;