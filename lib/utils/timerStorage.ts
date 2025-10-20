// lib/utils/timerStorage.ts
/**
 * Manages persistent timer state in localStorage
 * Ensures timer continues across page reloads, tab switches, and offline periods
 */

export interface TimerState {
  sessionId: string;
  taskId: string | null;
  startTime: string; // ISO timestamp
  pausedAt: string | null;
  totalPausedSeconds: number;
  notes: string;
  hourlyRate: number;
}

const STORAGE_KEY = 'centos_active_timer';

export const timerStorage = {
  /**
   * Save current timer state
   */
  save(state: TimerState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  },

  /**
   * Load active timer state
   */
  load(): TimerState | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load timer state:', error);
      return null;
    }
  },

  /**
   * Clear timer state (when session ends)
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear timer state:', error);
    }
  },

  /**
   * Calculate elapsed seconds from stored state
   */
  getElapsedSeconds(state: TimerState): number {
    const startMs = new Date(state.startTime).getTime();
    const nowMs = Date.now();
    
    if (state.pausedAt) {
      // If paused, use pausedAt timestamp
      const pausedMs = new Date(state.pausedAt).getTime();
      return Math.floor((pausedMs - startMs) / 1000) - state.totalPausedSeconds;
    }
    
    // If running, calculate from now
    return Math.floor((nowMs - startMs) / 1000) - state.totalPausedSeconds;
  },

  /**
   * Update pause state
   */
  updatePauseState(pausedAt: string | null, additionalPausedSeconds: number = 0): void {
    const state = this.load();
    if (!state) return;

    state.pausedAt = pausedAt;
    if (additionalPausedSeconds > 0) {
      state.totalPausedSeconds += additionalPausedSeconds;
    }
    
    this.save(state);
  },

  /**
   * Update notes without affecting timer
   */
  updateNotes(notes: string): void {
    const state = this.load();
    if (!state) return;
    
    state.notes = notes;
    this.save(state);
  }
};