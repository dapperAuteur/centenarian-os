// tests/unit/fake-supabase-plus.ts
// FakeDb (fake-supabase.ts) plus the query features "Find similar" and bulk
// edit use, kept in its own file so fake-supabase.ts stays as it is:
//
//   - select(columns, { count: 'exact' }) answers `count` (rows matched before range);
//   - order() by several columns, in the order given;
//   - or() terms that PostgREST accepts: eq, neq, is.null and ilike, with values in
//     double quotes (\" and \\ escaped inside), and columns cast with ::text;
//   - like patterns as PostgREST reads them: * means %, then \ escapes the next character.
//
// Not a test file itself (the test glob is *.test.ts).

import { FakeDb, FakeQuery, type FakeResult, type Row } from './fake-supabase.ts';

/** A LIKE / ILIKE pattern as a RegExp, after PostgREST's * -> % rewrite. */
export function likeToRegExp(pattern: string): RegExp {
  const rewritten = pattern.replace(/\*/g, '%');
  let source = '';
  for (let i = 0; i < rewritten.length; i++) {
    const char = rewritten[i];
    if (char === '\\' && i + 1 < rewritten.length) source += rewritten[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (char === '%') source += '.*';
    else if (char === '_') source += '.';
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'is');
}

/** Splits an or() body into terms at commas outside double quotes. */
function splitTerms(filters: string): string[] {
  const terms: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < filters.length; i++) {
    const char = filters[i];
    if (quoted && char === '\\' && i + 1 < filters.length) {
      current += char + filters[++i];
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (char === ',' && !quoted) {
      terms.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (quoted) throw new Error(`fake: unbalanced quotes in or(${filters})`);
  terms.push(current);
  return terms;
}

/** A filter value: a quoted value loses its quotes and escapes; a bare one may not hold reserved characters. */
function readValue(raw: string): string {
  if (raw.startsWith('"')) {
    if (!raw.endsWith('"') || raw.length < 2) throw new Error(`fake: bad quoted value ${raw}`);
    return raw.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  if (/[,()"]/.test(raw)) throw new Error(`fake: PostgREST would reject the unquoted value ${raw}`);
  return raw;
}

function cell(row: Row, column: string): unknown {
  const [name, cast] = column.split('::');
  const value = row[name];
  if (cast === 'text') return value === null || value === undefined ? null : String(value);
  return value;
}

export class FakeQueryPlus extends FakeQuery {
  countExact = false;
  orders: { column: string; ascending: boolean }[] = [];

  override select(columns?: string, options?: { count?: string }): this {
    super.select(columns);
    if (options?.count === 'exact') this.countExact = true;
    return this;
  }

  override order(column: string, options: { ascending?: boolean } = {}): this {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  override ilike(column: string, pattern: string): this {
    const re = likeToRegExp(pattern);
    return this.where(column, (v) => typeof v === 'string' && re.test(v));
  }

  override or(filters: string): this {
    const tests = splitTerms(filters).map((term) => {
      const first = term.indexOf('.');
      const second = term.indexOf('.', first + 1);
      if (first < 0 || second < 0) throw new Error(`fake: or(${term}) is not a column.op.value term`);
      const column = term.slice(0, first);
      const op = term.slice(first + 1, second);
      const value = readValue(term.slice(second + 1));
      this.usedColumns.push(column.split('::')[0]);
      if (op === 'is' && value === 'null') return (row: Row) => cell(row, column) == null;
      if (op === 'eq') return (row: Row) => cell(row, column) != null && String(cell(row, column)) === value;
      if (op === 'neq') return (row: Row) => cell(row, column) != null && String(cell(row, column)) !== value;
      if (op === 'ilike') {
        const re = likeToRegExp(value);
        return (row: Row) => {
          const v = cell(row, column);
          return typeof v === 'string' && re.test(v);
        };
      }
      throw new Error(`fake: or(${term}) is not supported`);
    });
    this.filters.push((row) => tests.some((test) => test(row)));
    return this;
  }

  override run(): FakeResult & { count?: number | null } {
    if (this.op !== 'select') {
      // Writes ignore order; the base class handles them. maybeSingle() after
      // a write's select() answers one row (or null), like PostgREST.
      const result = super.run();
      if (this.one && Array.isArray(result.data)) return { ...result, data: result.data[0] ?? null };
      return result;
    }
    this.db.beforeRun?.(this.table, this.op);
    const schema = this.schemaError();
    if (schema) return this.fail(0, schema);
    const table = this.db.tables[this.table] ?? [];
    let found = table.filter((row) => this.filters.every((filter) => filter(row)));
    const total = found.length;
    if (this.orders.length > 0) {
      found = [...found].sort((a, b) => {
        for (const { column, ascending } of this.orders) {
          const x = String(a[column] ?? '');
          const y = String(b[column] ?? '');
          if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
    }
    const start = this.from ?? 0;
    const asked = this.to !== null ? this.to - start + 1 : this.max ?? this.db.maxRows;
    found = found.slice(start, start + Math.min(asked, this.db.maxRows));
    this.db.calls.push({ table: this.table, op: 'select', rows: found.length, failed: false });
    const data = found.map((row) => this.project(row));
    return { data: this.one ? data[0] ?? null : data, error: null, ...(this.countExact ? { count: total } : {}) };
  }
}

export class FakeDbPlus extends FakeDb {
  override from(table: string): FakeQueryPlus {
    return new FakeQueryPlus(this, table);
  }
}
