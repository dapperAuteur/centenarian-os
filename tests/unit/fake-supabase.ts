// tests/unit/fake-supabase.ts
// An in-memory stand-in for the Supabase client, for unit tests that must not
// touch a real database. It implements only the query-builder calls the
// statement import makes, and just enough of Postgres to test against:
//
//   - the partial unique index on financial_transactions
//     (user_id, account_id, external_id) -> error code 23505;
//   - a multi-row insert is all-or-nothing, like one INSERT statement;
//   - created_at / updated_at defaults, and updated_at moving on every update
//     of a financial_transactions row (the table's trigger);
//   - a server-side row cap per request (PostgREST's max-rows);
//   - tables and columns that "don't exist yet", answering with the error
//     codes PostgREST and Postgres use before a migration is applied.
//
// Not a test file itself (the test glob is *.test.ts).

export type Row = Record<string, unknown>;

export interface FakeError {
  code: string;
  message: string;
}

export interface FakeResult {
  data: unknown;
  error: FakeError | null;
  /** select(columns, { count: 'exact' }): every matching row, before range/limit. */
  count?: number | null;
}

export interface FakeCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  /** Rows sent (insert) or matched (the others). */
  rows: number;
  failed: boolean;
}

type Filter = (row: Row) => boolean;

/** Column defaults the real tables have (migration 203), for rows that leave the column out. */
const COLUMN_DEFAULTS: Record<string, Row> = {
  import_batches: {
    source: 'csv_import',
    row_count: 0,
    inserted_count: 0,
    linked_count: 0,
    duplicate_count: 0,
    invalid_count: 0,
    status: 'committed',
    undone_at: null,
  },
};

/** "id, name, rel(a, b)" -> ['id', 'name'] (embedded relations are ignored). */
function plainColumns(columns: string | undefined): string[] | null {
  if (!columns || columns.trim() === '*') return null;
  const names: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of `${columns},`) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      const name = current.trim();
      if (name && !name.includes('(')) names.push(name);
      current = '';
    } else {
      current += char;
    }
  }
  return names;
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  /** Tables that answer "not in the schema cache". */
  missingTables: string[] = [];
  /** table -> columns that answer "does not exist". */
  missingColumns: Record<string, string[]> = {};
  /** The most rows one request returns. */
  maxRows = 1000;
  /** The clock used for created_at / updated_at, in ms. */
  now = Date.parse('2026-10-03T12:00:00.000Z');
  /** Every request made, in order. */
  calls: FakeCall[] = [];
  /** Return an error to refuse one row of an insert (the whole statement then fails). */
  rejectInsert: ((table: string, row: Row) => FakeError | null) | null = null;
  /** Runs just before a request executes, e.g. to change data "mid-flight". */
  beforeRun: ((table: string, op: FakeCall['op']) => void) | null = null;
  nextId = 1;

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  /** Adds rows directly, filling id and timestamps like an insert would. */
  seed(table: string, rows: Row[]): Row[] {
    const stored = rows.map((row) => this.withDefaults(table, row));
    (this.tables[table] ??= []).push(...stored);
    return stored;
  }

  rows(table: string): Row[] {
    return this.tables[table] ?? [];
  }

  tick(ms: number): void {
    this.now += ms;
  }

  timestamp(): string {
    return new Date(this.now).toISOString();
  }

  newId(): string {
    const n = String(this.nextId++).padStart(12, '0');
    return `00000000-0000-4000-8000-${n}`;
  }

  withDefaults(table: string, row: Row): Row {
    const stamp = this.timestamp();
    // cash_counts.counted_at defaults to NOW() (migration 213).
    const clock = table === 'cash_counts' ? { counted_at: stamp } : {};
    return { id: this.newId(), created_at: stamp, updated_at: stamp, ...clock, ...(COLUMN_DEFAULTS[table] ?? {}), ...row };
  }

  /** Requests that changed data. */
  writes(): FakeCall[] {
    return this.calls.filter((call) => call.op !== 'select');
  }
}

export class FakeQuery implements PromiseLike<FakeResult> {
  db: FakeDb;
  table: string;
  op: FakeCall['op'] = 'select';
  filters: Filter[] = [];
  usedColumns: string[] = [];
  payload: Row[] = [];
  values: Row = {};
  conflictColumns: string[] = [];
  ignoreDuplicates = false;
  columns: string | undefined;
  returning = false;
  orderColumn: string | null = null;
  ascending = true;
  from: number | null = null;
  to: number | null = null;
  max: number | null = null;
  one = false;

  constructor(db: FakeDb, table: string) {
    this.db = db;
    this.table = table;
  }

  /** Set by select(columns, { count: 'exact', head? }). */
  counting = false;
  headOnly = false;

  select(columns?: string, options: { count?: string; head?: boolean } = {}): this {
    if (this.op !== 'select') this.returning = true;
    this.columns = columns;
    this.counting = options.count === 'exact';
    this.headOnly = options.head === true;
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  /** Insert, or on a clash of `onConflict` columns update the row (or skip it with ignoreDuplicates). */
  upsert(rows: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}): this {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictColumns = (options.onConflict ?? 'id').split(',').map((c) => c.trim());
    this.ignoreDuplicates = options.ignoreDuplicates === true;
    return this;
  }

  update(values: Row): this {
    this.op = 'update';
    this.values = values;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  where(column: string, test: (value: unknown) => boolean): this {
    this.usedColumns.push(column);
    this.filters.push((row) => test(row[column]));
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.where(column, (v) => v === value);
  }

  neq(column: string, value: unknown): this {
    return this.where(column, (v) => v !== value);
  }

  in(column: string, values: unknown[]): this {
    return this.where(column, (v) => values.includes(v));
  }

  is(column: string, value: null): this {
    return this.where(column, (v) => (value === null ? v == null : v === value));
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator !== 'is' || value !== null) throw new Error(`fake: not(${operator}) is not supported`);
    return this.where(column, (v) => v != null);
  }

  gt(column: string, value: string | number): this {
    return this.where(column, (v) => (v as string | number) > value);
  }

  /**
   * PostgREST's or(): comma-separated `column.op.value` terms, any of which
   * may match. Supports eq, neq and is.null, which is what the app sends.
   */
  or(filters: string): this {
    const terms = filters.split(',').map((term) => {
      const [column, op, ...rest] = term.split('.');
      const value = rest.join('.');
      this.usedColumns.push(column);
      if (op === 'is' && value === 'null') return (row: Row) => row[column] == null;
      if (op === 'eq') return (row: Row) => row[column] != null && String(row[column]) === value;
      if (op === 'neq') return (row: Row) => row[column] != null && String(row[column]) !== value;
      throw new Error(`fake: or(${term}) is not supported`);
    });
    this.filters.push((row) => terms.some((test) => test(row)));
    return this;
  }

  /** Case-insensitive LIKE: % and _ are wildcards, a backslash escapes the next character. */
  ilike(column: string, pattern: string): this {
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (char === '\\' && i + 1 < pattern.length) source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      else if (char === '%') source += '.*';
      else if (char === '_') source += '.';
      else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const re = new RegExp(`^${source}$`, 'is');
    return this.where(column, (v) => typeof v === 'string' && re.test(v));
  }

  gte(column: string, value: string | number): this {
    return this.where(column, (v) => (v as string | number) >= value);
  }

  lte(column: string, value: string | number): this {
    return this.where(column, (v) => (v as string | number) <= value);
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderColumn = column;
    this.ascending = options.ascending !== false;
    return this;
  }

  range(from: number, to: number): this {
    this.from = from;
    this.to = to;
    return this;
  }

  limit(count: number): this {
    this.max = count;
    return this;
  }

  maybeSingle(): this {
    this.one = true;
    return this;
  }

  then<A = FakeResult, B = never>(
    onfulfilled?: ((value: FakeResult) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }

  fail(rows: number, error: FakeError): FakeResult {
    this.db.calls.push({ table: this.table, op: this.op, rows, failed: true });
    return { data: null, error };
  }

  /** The "this table or column is not there yet" answer, if the request touches one. */
  schemaError(): FakeError | null {
    if (this.db.missingTables.includes(this.table)) {
      return { code: 'PGRST205', message: `Could not find the table 'public.${this.table}' in the schema cache` };
    }
    const missing = this.db.missingColumns[this.table] ?? [];
    const written = [...this.payload.flatMap((row) => Object.keys(row)), ...Object.keys(this.values)];
    const writtenMissing = written.find((column) => missing.includes(column));
    if (writtenMissing) {
      return {
        code: 'PGRST204',
        message: `Could not find the '${writtenMissing}' column of '${this.table}' in the schema cache`,
      };
    }
    const read = [...this.usedColumns, ...(plainColumns(this.columns) ?? [])];
    const readMissing = read.find((column) => missing.includes(column));
    if (readMissing) {
      return { code: '42703', message: `column ${this.table}.${readMissing} does not exist` };
    }
    return null;
  }

  /** The unique index on (user_id, account_id, external_id), partial on both being set. */
  uniqueKey(row: Row): string | null {
    if (this.table !== 'financial_transactions') return null;
    if (row.external_id == null || row.account_id == null) return null;
    return `${row.user_id}|${row.account_id}|${row.external_id}`;
  }

  uniqueViolation(): FakeError {
    return {
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_ft_account_external_id"',
    };
  }

  project(row: Row): Row {
    const names = plainColumns(this.columns);
    if (!names) return { ...row };
    return Object.fromEntries(names.map((name) => [name, row[name] ?? null]));
  }

  run(): FakeResult {
    this.db.beforeRun?.(this.table, this.op);
    const schema = this.schemaError();
    if (schema) return this.fail(this.payload.length, schema);

    const table = (this.db.tables[this.table] ??= []);
    const matches = (row: Row) => this.filters.every((filter) => filter(row));

    if (this.op === 'insert') {
      const taken = new Set(table.map((row) => this.uniqueKey(row)).filter((key) => key !== null));
      const fresh: Row[] = [];
      for (const sent of this.payload) {
        const refused = this.db.rejectInsert?.(this.table, sent);
        if (refused) return this.fail(this.payload.length, refused);
        const key = this.uniqueKey(sent);
        if (key !== null) {
          if (taken.has(key)) return this.fail(this.payload.length, this.uniqueViolation());
          taken.add(key);
        }
        fresh.push(this.db.withDefaults(this.table, sent));
      }
      table.push(...fresh);
      this.db.calls.push({ table: this.table, op: 'insert', rows: fresh.length, failed: false });
      return { data: this.returning ? fresh.map((row) => this.project(row)) : null, error: null };
    }

    if (this.op === 'upsert') {
      const keyOf = (row: Row) => this.conflictColumns.map((c) => String(row[c])).join('|');
      let written = 0;
      for (const sent of this.payload) {
        const existing = table.find((row) => keyOf(row) === keyOf(sent));
        if (existing) {
          if (this.ignoreDuplicates) continue;
          Object.assign(existing, sent, { updated_at: this.db.timestamp() });
        } else {
          table.push(this.db.withDefaults(this.table, sent));
        }
        written += 1;
      }
      this.db.calls.push({ table: this.table, op: 'upsert', rows: written, failed: false });
      return { data: null, error: null };
    }

    if (this.op === 'update') {
      const targets = table.filter(matches);
      for (const target of targets) {
        const next = { ...target, ...this.values };
        const key = this.uniqueKey(next);
        if (key !== null && table.some((row) => row !== target && this.uniqueKey(row) === key)) {
          return this.fail(targets.length, this.uniqueViolation());
        }
      }
      for (const target of targets) {
        Object.assign(target, this.values);
        if (this.table === 'financial_transactions') target.updated_at = this.db.timestamp();
      }
      this.db.calls.push({ table: this.table, op: 'update', rows: targets.length, failed: false });
      return { data: this.returning ? targets.map((row) => this.project(row)) : null, error: null };
    }

    if (this.op === 'delete') {
      const removed = table.filter(matches);
      this.db.tables[this.table] = table.filter((row) => !removed.includes(row));
      this.db.calls.push({ table: this.table, op: 'delete', rows: removed.length, failed: false });
      return { data: this.returning ? removed.map((row) => this.project(row)) : null, error: null };
    }

    let found = table.filter(matches);
    if (this.orderColumn) {
      const column = this.orderColumn;
      const direction = this.ascending ? 1 : -1;
      found = [...found].sort((a, b) => {
        const x = String(a[column] ?? '');
        const y = String(b[column] ?? '');
        return x < y ? -direction : x > y ? direction : 0;
      });
    }
    const total = found.length;
    const start = this.from ?? 0;
    const asked = this.to !== null ? this.to - start + 1 : this.max ?? this.db.maxRows;
    found = found.slice(start, start + Math.min(asked, this.db.maxRows));
    this.db.calls.push({ table: this.table, op: 'select', rows: found.length, failed: false });
    const data = found.map((row) => this.project(row));
    const count = this.counting ? total : null;
    if (this.headOnly) return { data: null, error: null, count };
    return { data: this.one ? data[0] ?? null : data, error: null, count };
  }
}
