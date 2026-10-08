// tests/unit/fake-fitness-db.ts
// FakeDb (fake-supabase.ts) plus the Postgres and PostgREST behaviour the
// fitness imports depend on, kept in its own file so fake-supabase.ts stays as
// it is:
//
//   - unique keys per table, with NULLs distinct (as Postgres treats them):
//       user_health_metrics (user_id, logged_date, source)   migration 080
//       inbody_scans        (user_id, measured_at)           migration 145
//       trips               (user_id, external_id)           migration 224
//       workout_logs        (user_id, external_id)           migration 224
//     A key whose columns are listed in `missingColumns` does not exist yet.
//   - insert: a clash -> 23505, and the whole statement fails.
//   - upsert: onConflict must name one of those keys, else 42P10 (what the
//     wearable syncs hit after 080 dropped (user_id, logged_date)); two rows of
//     one request with the same key -> 21000 unless ignoreDuplicates; columns
//     are the union of every row's keys and a row missing one sends NULL
//     (postgrest-js defaultToNull), which overwrites the stored value; with
//     ignoreDuplicates a clash is skipped and only inserted rows come back.
//
// Not a test file itself (the test glob is *.test.ts).

import { FakeDb, FakeQuery, type FakeResult, type Row } from './fake-supabase.ts';

export const UNIQUE_KEYS: Record<string, string[][]> = {
  user_health_metrics: [['user_id', 'logged_date', 'source']],
  inbody_scans: [['user_id', 'measured_at']],
  trips: [['user_id', 'external_id']],
  workout_logs: [['user_id', 'external_id']],
};

export class FakeFitnessQuery extends FakeQuery {
  keys(): string[][] {
    const missing = this.db.missingColumns[this.table] ?? [];
    return (UNIQUE_KEYS[this.table] ?? []).filter((key) => !key.some((column) => missing.includes(column)));
  }

  /** The row's value for a key, or null when any part is NULL (never clashes). */
  keyValue(row: Row, key: string[]): string | null {
    if (key.some((column) => row[column] === null || row[column] === undefined)) return null;
    return key.map((column) => String(row[column])).join('|');
  }

  clash(rows: Row[], candidate: Row, except?: Row): boolean {
    return this.keys().some((key) => {
      const value = this.keyValue(candidate, key);
      return value !== null && rows.some((row) => row !== except && this.keyValue(row, key) === value);
    });
  }

  override run(): FakeResult {
    if (this.op !== 'insert' && this.op !== 'upsert') return super.run();
    this.db.beforeRun?.(this.table, this.op);
    const schema = this.schemaError();
    if (schema) return this.fail(this.payload.length, schema);
    const table = (this.db.tables[this.table] ??= []);

    if (this.op === 'insert') {
      const fresh: Row[] = [];
      for (const sent of this.payload) {
        const refused = this.db.rejectInsert?.(this.table, sent);
        if (refused) return this.fail(this.payload.length, refused);
        if (this.clash([...table, ...fresh], sent)) {
          return this.fail(this.payload.length, { code: '23505', message: `duplicate key value violates unique constraint on ${this.table}` });
        }
        fresh.push(this.db.withDefaults(this.table, sent));
      }
      table.push(...fresh);
      this.db.calls.push({ table: this.table, op: 'insert', rows: fresh.length, failed: false });
      return { data: this.returning ? fresh.map((row) => this.project(row)) : null, error: null };
    }

    // upsert
    const key = this.keys().find((candidate) => candidate.join(',') === this.conflictColumns.join(','));
    if (!key) {
      return this.fail(this.payload.length, {
        code: '42P10',
        message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
      });
    }
    const columns = [...new Set(this.payload.flatMap((row) => Object.keys(row)))];
    const full = this.payload.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
    if (!this.ignoreDuplicates) {
      const seen = new Set<string>();
      for (const row of full) {
        const value = this.keyValue(row, key);
        if (value === null) continue;
        if (seen.has(value)) {
          return this.fail(this.payload.length, {
            code: '21000',
            message: 'ON CONFLICT DO UPDATE command cannot affect row a second time',
          });
        }
        seen.add(value);
      }
    }
    for (const row of full) {
      const refused = this.db.rejectInsert?.(this.table, row);
      if (refused) return this.fail(this.payload.length, refused);
    }
    const returned: Row[] = [];
    let written = 0;
    for (const row of full) {
      const value = this.keyValue(row, key);
      const existing = value === null ? undefined : table.find((stored) => this.keyValue(stored, key) === value);
      if (existing) {
        if (this.ignoreDuplicates) continue;
        Object.assign(existing, row, { updated_at: this.db.timestamp() });
        returned.push(existing);
      } else {
        const stored = this.db.withDefaults(this.table, row);
        table.push(stored);
        returned.push(stored);
      }
      written += 1;
    }
    this.db.calls.push({ table: this.table, op: 'upsert', rows: written, failed: false });
    return { data: this.returning ? returned.map((row) => this.project(row)) : null, error: null };
  }
}

export class FakeFitnessDb extends FakeDb {
  override from(table: string): FakeFitnessQuery {
    return new FakeFitnessQuery(this, table);
  }
}
