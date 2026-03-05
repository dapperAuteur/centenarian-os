// lib/logging.ts
// Structured server-side logging — fire-and-forget inserts to app_logs table.
// Usage: logInfo({ source: 'webhook', module: 'stripe', message: 'Checkout completed' })

import { createClient } from '@supabase/supabase-js';

type LogLevel = 'info' | 'warn' | 'error';

interface LogOptions {
  level?: LogLevel;
  source: string;
  module?: string;
  message: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}

let _db: ReturnType<typeof createClient> | null = null;
function getDb() {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _db;
}

export function appLog(opts: LogOptions): void {
  const { level = 'info', source, module, message, metadata = {}, userId } = opts;
  getDb()
    .from('app_logs')
    .insert({
      level,
      source,
      module: module ?? null,
      message,
      metadata,
      user_id: userId ?? null,
    } as never)
    .then(({ error }) => {
      if (error) console.error('[appLog] insert failed:', error.message);
    });
}

export const logInfo = (opts: Omit<LogOptions, 'level'>) => appLog({ ...opts, level: 'info' });
export const logWarn = (opts: Omit<LogOptions, 'level'>) => appLog({ ...opts, level: 'warn' });
export const logError = (opts: Omit<LogOptions, 'level'>) => appLog({ ...opts, level: 'error' });
