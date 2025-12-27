// lib/utils/timerPersistence.ts

import { createClient } from '@/lib/supabase/client';

/**
 * Save current timer state to database
 * Called when screen goes to sleep or tab becomes inactive
 */
export async function saveTimerState(sessionId: string): Promise<void> {
  const supabase = createClient();
  
  try {
    const { error } = await supabase
      .from('focus_sessions')
      .update({
        // Store last update time for calculating elapsed time later
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[Timer Persistence] Failed to save timer state:', error);
    }
  } catch (err) {
    console.error('[Timer Persistence] Unexpected error saving state:', err);
  }
}

/**
 * Resume timer from database state
 * Calculates elapsed time since session started
 */
export async function resumeTimer(sessionId: string): Promise<number> {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('start_time')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      console.error('[Timer Persistence] Failed to resume timer:', error);
      return 0;
    }

    // Calculate elapsed seconds since session started
    const startTime = new Date(data.start_time).getTime();
    const now = Date.now();
    const elapsedMs = now - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    return elapsedSeconds;
  } catch (err) {
    console.error('[Timer Persistence] Unexpected error resuming timer:', err);
    return 0;
  }
}

/**
 * Setup visibility change listener
 * Saves state when tab becomes hidden, resumes when visible
 */
export function setupVisibilityListener(
  sessionId: string,
  onResume: (elapsedSeconds: number) => void
): () => void {
  const handleVisibilityChange = async () => {
    if (document.hidden) {
      // Tab/window hidden - save state
      await saveTimerState(sessionId);
    } else {
      // Tab/window visible - resume timer
      const elapsed = await resumeTimer(sessionId);
      onResume(elapsed);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
