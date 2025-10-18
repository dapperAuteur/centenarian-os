/* eslint-disable @typescript-eslint/no-explicit-any */
// File: lib/hooks/useTasks.ts
// Real-time task fetching with date range

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/lib/types';

export function useTasks(startDate: string, endDate: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date')
          .order('time');

        if (error) throw error;
        
        setTasks(data || []);
      } catch (err: any) {
        console.error('Error fetching tasks:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

    // Real-time subscription
    const channel = supabase
  .channel('tasks-changes')
  .on<Task>(  // Add generic type here
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
    },
    (payload) => {  // Remove explicit type annotation here
      if (payload.eventType === 'INSERT') {
        const newTask = payload.new;
        if (newTask.date >= startDate && newTask.date <= endDate) {
          setTasks((prev) => [...prev, newTask]);
        }
      } else if (payload.eventType === 'UPDATE') {
        setTasks((prev) =>
          prev.map((task) => task.id === payload.new.id ? payload.new : task)
        );
      } else if (payload.eventType === 'DELETE') {
        setTasks((prev) => prev.filter((task) => task.id !== payload.old.id));
      }
    }
  )
  .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startDate, endDate, supabase]);

  const toggleComplete = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          completed: !completed,
          completed_at: !completed ? new Date().toISOString() : null
        })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error toggling task:', err);
      setError(err.message);
    }
  };

  return { tasks, loading, error, toggleComplete };
}