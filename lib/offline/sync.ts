/* eslint-disable @typescript-eslint/no-explicit-any */
// File: lib/offline/sync.ts
// Sync queue for offline operations

import { openDB, DBSchema } from 'idb';

interface SyncQueue extends DBSchema {
  queue: {
    key: string;
    value: {
      id: string;
      operation: 'insert' | 'update' | 'delete';
      table: string;
      data: any;
      timestamp: number;
    };
  };
}

export async function queueOperation(
  operation: 'insert' | 'update' | 'delete',
  table: string,
  data: any
) {
  const db = await openDB<SyncQueue>('centos-sync', 1, {
    upgrade(db) {
      db.createObjectStore('queue', { keyPath: 'id' });
    },
  });

  await db.add('queue', {
    id: crypto.randomUUID(),
    operation,
    table,
    data,
    timestamp: Date.now(),
  });
}

export async function syncQueue() {
  const db = await openDB<SyncQueue>('centos-sync', 1);
  const operations = await db.getAll('queue');

  for (const op of operations) {
    try {
      // Execute operation against Supabase
      await executeOperation(op);
      await db.delete('queue', op.id);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}

async function executeOperation(op: any) {
  // Implementation depends on operation type
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  if (op.operation === 'insert') {
    await supabase.from(op.table).insert(op.data);
  } else if (op.operation === 'update') {
    await supabase.from(op.table).update(op.data).eq('id', op.data.id);
  } else if (op.operation === 'delete') {
    await supabase.from(op.table).delete().eq('id', op.data.id);
  }
}