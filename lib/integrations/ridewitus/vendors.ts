// lib/integrations/ridewitus/vendors.ts
// The read-only vendor list RideWitUS picks from (RideWitUS PRD §5.11, §6.9;
// owner answer Q14: vendors are picked from CentenarianOS only, never created
// by RideWitUS).
//
// WHAT IS A VENDOR
//   user_contacts rows with contact_type = 'vendor' (migration 056), with
//   company_name (150), phone (105), website (152), home city/state/country
//   (150), and sub-locations in contact_locations (064). Category is the name
//   of the contact's default budget category, when it is the user's own.
//   Recent prices come from item_prices.vendor_contact_id (093).
//
// WHAT IS NEVER RETURNED
//   Another user's rows: every query is filtered by the resolved user_id, and
//   locations, categories and prices are read only for the vendor ids that
//   query returned (categories and prices are filtered by user_id again).
//   Coordinates: contact_locations.lat/lng are not selected (PRD §6.9).
//   Email and notes: RideWitUS has no use for them.
//
// user_contacts has no updated_at column, so none is returned (the PRD's shape
// lists one); created_at is. item_prices has no currency column, so each
// response says currency: null until CentenarianOS stores one.
//
// Pure apart from the injected client, with no '@/' imports, so node --test
// loads it (tests/unit/ridewitus-vendors.test.ts).

export interface VendorDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface VendorLocation {
  id: string;
  label: string;
  address: string | null;
  is_default: boolean;
}

export interface VendorPrice {
  item_name: string;
  price: number;
  unit: string | null;
  unit_price: number | null;
  recorded_date: string;
  source: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  company_name: string | null;
  category: string | null;
  website: string | null;
  phone: string | null;
  /** "City, State, Country" from the contact's home_* fields; null when none is stored. */
  city: string | null;
  locations: VendorLocation[];
  created_at: string | null;
  /** Newest first. Present only when prices were asked for. */
  recent_prices?: VendorPrice[];
}

export class VendorLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorLookupError';
  }
}

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export const DEFAULT_PRICE_DAYS = 180;
export const PRICES_PER_VENDOR = 10;
const MAX_PRICE_ROWS = 1000;
const MAX_QUERY_LENGTH = 100;

const VENDOR_SELECT =
  'id, user_id, name, company_name, website, phone, home_city, home_state, home_country, default_category_id, created_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Row = Record<string, unknown>;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function isVendorId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** limit: 1..MAX_LIMIT, default DEFAULT_LIMIT. */
export function parseLimit(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/** offset: a non-negative integer, default 0. */
export function parseOffset(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** since: 'YYYY-MM-DD' (or an ISO timestamp, cut to its date); default `days` before today. */
export function parseSince(value: string | null, today: Date, days = DEFAULT_PRICE_DAYS): string {
  const date = value?.slice(0, 10);
  if (date && DATE_RE.test(date) && !Number.isNaN(Date.parse(date))) return date;
  const d = new Date(today.getTime() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** The search text, trimmed and bounded, with LIKE wildcards escaped. null when blank. */
export function likePattern(q: string | null): string | null {
  const trimmed = q?.trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return null;
  return `%${trimmed.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function cityOf(row: Row): string | null {
  const parts = [text(row.home_city), text(row.home_state), text(row.home_country)].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

async function loadLocations(db: VendorDb, ids: string[]): Promise<Map<string, VendorLocation[]>> {
  const out = new Map<string, VendorLocation[]>();
  if (!ids.length) return out;
  const { data, error } = await db
    .from('contact_locations')
    .select('id, contact_id, label, address, is_default, sort_order')
    .in('contact_id', ids)
    .order('sort_order', { ascending: true });
  if (error) throw new VendorLookupError('Could not read vendor locations.');
  for (const row of (data ?? []) as Row[]) {
    const contactId = String(row.contact_id);
    if (!ids.includes(contactId)) continue;
    const list = out.get(contactId) ?? [];
    list.push({
      id: String(row.id),
      label: text(row.label) ?? '',
      address: text(row.address),
      is_default: row.is_default === true,
    });
    out.set(contactId, list);
  }
  return out;
}

async function loadCategoryNames(db: VendorDb, userId: string, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await db.from('budget_categories').select('id, name, user_id').eq('user_id', userId).in('id', ids);
  if (error) throw new VendorLookupError('Could not read vendor categories.');
  for (const row of (data ?? []) as Row[]) {
    // Checked again from the row: a category saved on a contact before the
    // reference checks existed could belong to someone else.
    if (row.user_id === userId && text(row.name)) out.set(String(row.id), text(row.name)!);
  }
  return out;
}

/** Recent prices per vendor id, newest first, at most `perVendor` each. */
export async function loadPrices(
  db: VendorDb,
  userId: string,
  vendorIds: string[],
  since: string,
  perVendor = PRICES_PER_VENDOR,
): Promise<Map<string, VendorPrice[]>> {
  const out = new Map<string, VendorPrice[]>();
  if (!vendorIds.length) return out;
  const { data, error } = await db
    .from('item_prices')
    .select('id, user_id, vendor_contact_id, item_name, price, unit, unit_price, recorded_date, source')
    .eq('user_id', userId)
    .in('vendor_contact_id', vendorIds)
    .gte('recorded_date', since)
    .order('recorded_date', { ascending: false })
    .limit(MAX_PRICE_ROWS);
  if (error) throw new VendorLookupError('Could not read item prices.');
  for (const row of (data ?? []) as Row[]) {
    if (row.user_id !== userId) continue;
    const vendorId = String(row.vendor_contact_id);
    const list = out.get(vendorId) ?? [];
    if (list.length >= perVendor) continue;
    const price = num(row.price);
    if (price === null || typeof row.recorded_date !== 'string') continue;
    list.push({
      item_name: text(row.item_name) ?? '',
      price,
      unit: text(row.unit),
      unit_price: num(row.unit_price),
      recorded_date: row.recorded_date,
      source: text(row.source),
    });
    out.set(vendorId, list);
  }
  return out;
}

async function shape(
  db: VendorDb,
  userId: string,
  rows: Row[],
  prices: { since: string } | null,
): Promise<Vendor[]> {
  const ids = rows.map((r) => String(r.id));
  const categoryIds = [...new Set(rows.map((r) => r.default_category_id).filter(isVendorId))];
  const [locations, categories, priceMap] = await Promise.all([
    loadLocations(db, ids),
    loadCategoryNames(db, userId, categoryIds),
    prices ? loadPrices(db, userId, ids, prices.since) : Promise.resolve(null),
  ]);
  return rows.map((row) => {
    const id = String(row.id);
    const vendor: Vendor = {
      id,
      name: text(row.name) ?? '',
      company_name: text(row.company_name),
      category: isVendorId(row.default_category_id) ? categories.get(row.default_category_id) ?? null : null,
      website: text(row.website),
      phone: text(row.phone),
      city: cityOf(row),
      locations: locations.get(id) ?? [],
      created_at: text(row.created_at),
    };
    if (priceMap) vendor.recent_prices = priceMap.get(id) ?? [];
    return vendor;
  });
}

export interface ListVendorsOptions {
  q?: string | null;
  limit?: number;
  offset?: number;
  /** Include recent prices recorded on or after this date. Omit for no prices. */
  pricesSince?: string | null;
}

export interface VendorPage {
  vendors: Vendor[];
  /** Pass as `offset` for the next page; null on the last page. */
  next_offset: number | null;
}

/** One page of the user's vendors, by name. */
export async function listVendors(db: VendorDb, userId: string, options: ListVendorsOptions = {}): Promise<VendorPage> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);
  let query = db.from('user_contacts').select(VENDOR_SELECT).eq('user_id', userId).eq('contact_type', 'vendor');
  const pattern = likePattern(options.q ?? null);
  if (pattern) query = query.ilike('name', pattern);
  // One extra row says whether there is a next page.
  const { data, error } = await query.order('name', { ascending: true }).range(offset, offset + limit);
  if (error) throw new VendorLookupError('Could not read vendors.');
  // Checked again from the row, so a filter that was not applied can never admit another user's vendor.
  const rows = ((data ?? []) as Row[]).filter((r) => r.user_id === userId);
  const page = rows.slice(0, limit);
  const vendors = await shape(db, userId, page, options.pricesSince ? { since: options.pricesSince } : null);
  return { vendors, next_offset: rows.length > limit ? offset + limit : null };
}

/** One vendor of the user's, or null (not a vendor, not theirs, or no such id: all the same). */
export async function getVendor(
  db: VendorDb,
  userId: string,
  vendorId: string,
  pricesSince: string | null = null,
): Promise<Vendor | null> {
  if (!isVendorId(vendorId)) return null;
  const { data, error } = await db
    .from('user_contacts')
    .select(VENDOR_SELECT)
    .eq('user_id', userId)
    .eq('contact_type', 'vendor')
    .eq('id', vendorId)
    .maybeSingle();
  if (error) throw new VendorLookupError('Could not read the vendor.');
  if (!data || (data as Row).user_id !== userId) return null;
  const [vendor] = await shape(db, userId, [data as Row], pricesSince ? { since: pricesSince } : null);
  return vendor ?? null;
}

/**
 * Where a person creates a vendor in CentenarianOS (RideWitUS links there, PRD
 * Q14). `origin` is the origin the request reached, so the link points at the
 * CentenarianOS deployment RideWitUS is actually talking to.
 */
export function createVendorUrl(origin: string, name?: string | null): string {
  const url = new URL('/dashboard/contacts/new', origin);
  url.searchParams.set('type', 'vendor');
  const trimmed = name?.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed) url.searchParams.set('name', trimmed);
  return url.toString();
}
