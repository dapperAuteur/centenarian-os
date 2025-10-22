// lib/utils/sessionValidation.ts

/**
 * Session validation and calculation utilities
 * Ensures data integrity for focus session CRUD operations
 */

export interface SessionFormData {
  start_time: string; // ISO string
  end_time: string; // ISO string
  task_id: string | null;
  hourly_rate: number;
  notes: string;
  duration?: number; // Optional for manual override
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Calculate duration in seconds between two timestamps
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.floor((end - start) / 1000);
}

/**
 * Calculate revenue based on duration and hourly rate
 */
export function calculateRevenue(durationSeconds: number, hourlyRate: number): number {
  return (durationSeconds / 3600) * hourlyRate;
}

/**
 * Convert UTC datetime to local datetime-local format
 */
export function toLocalDatetime(utcDatetime: string): string {
  const date = new Date(utcDatetime);
  // Format: YYYY-MM-DDTHH:mm
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert local datetime-local format to UTC ISO string
 */
export function toUTC(localDatetime: string): string {
  return new Date(localDatetime).toISOString();
}

/**
 * Format duration seconds to readable string (HH:MM:SS or Xh Ym)
 */
export function formatDuration(seconds: number, short: boolean = false): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (short) {
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Check if two sessions overlap
 */
export function sessionsOverlap(
  session1Start: string,
  session1End: string,
  session2Start: string,
  session2End: string
): boolean {
  const s1Start = new Date(session1Start).getTime();
  const s1End = new Date(session1End).getTime();
  const s2Start = new Date(session2Start).getTime();
  const s2End = new Date(session2End).getTime();
  
  return (s1Start < s2End && s1End > s2Start);
}

/**
 * Validate session data
 */
export function validateSession(
  data: SessionFormData,
  existingSessions?: Array<{ start_time: string; end_time: string; id: string }>,
  currentSessionId?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Parse dates
  const startDate = new Date(data.start_time);
  const endDate = new Date(data.end_time);
  const now = new Date();
  
  // Validation checks
  if (isNaN(startDate.getTime())) {
    errors.push('Invalid start time');
  }
  
  if (isNaN(endDate.getTime())) {
    errors.push('Invalid end time');
  }
  
  if (endDate <= startDate) {
    errors.push('End time must be after start time');
  }
  
  if (startDate > now) {
    errors.push('Cannot create sessions in the future');
  }
  
  // Calculate duration
  const calculatedDuration = calculateDuration(data.start_time, data.end_time);
  
  // If manual duration override, check if it matches
  if (data.duration !== undefined) {
    const difference = Math.abs(calculatedDuration - data.duration);
    if (difference > 5) {
      warnings.push(
        `Duration mismatch: Time range suggests ${formatDuration(calculatedDuration, true)}, ` +
        `but duration is set to ${formatDuration(data.duration, true)}`
      );
    }
  }
  
  // Warn if over 12 hours
  if (calculatedDuration > 43200) {
    warnings.push(
      `Session is over 12 hours (${formatDuration(calculatedDuration, true)}). ` +
      `Please verify this is correct.`
    );
  }
  
  // Check for overlapping sessions
  if (existingSessions && existingSessions.length > 0) {
    const overlapping = existingSessions.filter(session => {
      // Skip current session when editing
      if (currentSessionId && session.id === currentSessionId) {
        return false;
      }
      
      return sessionsOverlap(
        data.start_time,
        data.end_time,
        session.start_time,
        session.end_time
      );
    });
    
    if (overlapping.length > 0) {
      warnings.push(
        `This session overlaps with ${overlapping.length} existing session(s). ` +
        `Confirm this is intentional.`
      );
    }
  }
  
  // Validate hourly rate
  if (data.hourly_rate < 0) {
    errors.push('Hourly rate cannot be negative');
  }
  
  if (data.hourly_rate > 10000) {
    warnings.push('Hourly rate seems unusually high. Please verify.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format time for display (24-hour format)
 */
export function formatTime24(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}