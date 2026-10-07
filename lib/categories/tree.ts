// lib/categories/tree.ts
// One category tree (plans/63 E, migration 223): life categories ("life areas") are the top
// level, budget categories sit under them through budget_categories.life_category_id.
//
//   buildCategoryTree   life areas + budget categories -> the tree, with an "unassigned" bucket
//                       for budget categories that have no life area yet (or point at one that
//                       is gone or not the person's).
//   pickerGroups        what the tree picker shows for a search and a mode: 'budget' (choose a
//                       budget category; life areas are headings), 'life' (choose a life area
//                       only, for tasks, trips, workouts...), or 'any' (either).
//   selectionLabel      "Health › Groceries" for a picked value.
//   suggestLifeArea     a life area for a budget category, guessed from its name, for the
//                       Organize screen. Only a suggestion: the person confirms it.
//
// Pure: no imports, so it runs in the browser, in API routes and under node --test.

export interface LifeAreaRow {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
}

export interface BudgetCategoryRow {
  id: string;
  name: string;
  color?: string | null;
  monthly_budget?: number | string | null;
  sort_order?: number | null;
  /** Absent before migration 223. */
  life_category_id?: string | null;
}

export interface TreeLifeArea<B extends BudgetCategoryRow = BudgetCategoryRow> extends LifeAreaRow {
  children: B[];
}

export interface CategoryTree<B extends BudgetCategoryRow = BudgetCategoryRow> {
  lifeAreas: TreeLifeArea<B>[];
  /** Budget categories with no (usable) life area, in display order. */
  unassigned: B[];
  /** budget category id -> its life area (null when unassigned). */
  parentOf: Map<string, TreeLifeArea<B> | null>;
  budgetById: Map<string, B>;
  lifeById: Map<string, TreeLifeArea<B>>;
}

const byOrderThenName = (a: { sort_order?: number | null; name: string }, b: { sort_order?: number | null; name: string }) => {
  const oa = a.sort_order ?? 0;
  const ob = b.sort_order ?? 0;
  if (oa !== ob) return oa - ob;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
};

/**
 * The tree. `lifeAreaOf` overrides where a budget category's life area is read from (the
 * pickers get budget categories from their page, which may not carry life_category_id, and the
 * life area from the tree endpoint). A life area id that is not among `lifeAreas` counts as none.
 */
export function buildCategoryTree<B extends BudgetCategoryRow>(
  lifeAreas: readonly LifeAreaRow[],
  budgetCategories: readonly B[],
  lifeAreaOf: (category: B) => string | null | undefined = (category) => category.life_category_id,
): CategoryTree<B> {
  const areas: TreeLifeArea<B>[] = [...lifeAreas].sort(byOrderThenName).map((area) => ({ ...area, children: [] }));
  const lifeById = new Map(areas.map((area) => [area.id, area]));
  const parentOf = new Map<string, TreeLifeArea<B> | null>();
  const budgetById = new Map<string, B>();
  const unassigned: B[] = [];

  for (const category of [...budgetCategories].sort(byOrderThenName)) {
    budgetById.set(category.id, category);
    const lifeId = lifeAreaOf(category);
    const parent = lifeId ? lifeById.get(lifeId) ?? null : null;
    parentOf.set(category.id, parent);
    if (parent) parent.children.push(category);
    else unassigned.push(category);
  }
  return { lifeAreas: areas, unassigned, parentOf, budgetById, lifeById };
}

// ── The picker ──────────────────────────────────────────────────────────────────

export type PickerMode = 'budget' | 'life' | 'any';

export type TreeSelection = { kind: 'budget'; id: string } | { kind: 'life'; id: string };

export interface PickerOption {
  /** Unique within the list, e.g. 'budget:<id>'. Used as the DOM id suffix too. */
  key: string;
  kind: 'none' | 'budget' | 'life';
  id: string | null;
  label: string;
  /** For screen readers and the closed control: "Health › Groceries". */
  path: string;
  color: string | null;
}

export interface PickerGroup {
  /** 'life:<id>', or 'unassigned' for budget categories without a life area. */
  key: string;
  heading: string;
  color: string | null;
  /** The life area itself, when it can be picked in this mode. */
  self: PickerOption | null;
  options: PickerOption[];
}

export const UNASSIGNED_HEADING = 'No life area';
export const PATH_SEPARATOR = ' › ';

/** Lowercase, accents removed, spaces collapsed: "Café  Food" -> "cafe food". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(text: string, query: string): boolean {
  return query === '' || normalizeForSearch(text).includes(query);
}

const budgetOption = (category: BudgetCategoryRow, parent: LifeAreaRow | null): PickerOption => ({
  key: `budget:${category.id}`,
  kind: 'budget',
  id: category.id,
  label: category.name,
  path: parent ? `${parent.name}${PATH_SEPARATOR}${category.name}` : category.name,
  color: category.color ?? null,
});

const lifeOption = (area: LifeAreaRow): PickerOption => ({
  key: `life:${area.id}`,
  kind: 'life',
  id: area.id,
  label: area.name,
  path: area.name,
  color: area.color ?? null,
});

/**
 * The groups the picker lists for `query`. A life area whose name matches shows all of its
 * budget categories; otherwise only the matching ones show, under their life area's heading.
 * Groups with nothing to show are left out. In 'life' mode there are no budget categories.
 */
export function pickerGroups(
  tree: CategoryTree,
  options: { mode: PickerMode; query?: string; unassignedHeading?: string },
): PickerGroup[] {
  const query = normalizeForSearch(options.query ?? '');
  const { mode } = options;
  const unassignedHeading = options.unassignedHeading ?? UNASSIGNED_HEADING;
  const groups: PickerGroup[] = [];

  for (const area of tree.lifeAreas) {
    const areaMatches = matches(area.name, query);
    const self = mode !== 'budget' && areaMatches ? lifeOption(area) : null;
    const children =
      mode === 'life'
        ? []
        : area.children
            .filter((child) => areaMatches || matches(child.name, query))
            .map((child) => budgetOption(child, area));
    // A heading with nothing under it is only worth showing when the area itself can be picked.
    if (!self && children.length === 0) continue;
    groups.push({ key: `life:${area.id}`, heading: area.name, color: area.color ?? null, self, options: children });
  }

  if (mode !== 'life') {
    const loose = tree.unassigned
      .filter((category) => matches(category.name, query) || matches(unassignedHeading, query))
      .map((category) => budgetOption(category, null));
    if (loose.length > 0) {
      groups.push({ key: 'unassigned', heading: unassignedHeading, color: null, self: null, options: loose });
    }
  }
  return groups;
}

/** Every option in the order the picker shows them (life area first, then its children). */
export function flattenGroups(groups: readonly PickerGroup[]): PickerOption[] {
  return groups.flatMap((group) => (group.self ? [group.self, ...group.options] : group.options));
}

/** True when some budget category or life area is named exactly `query` (ignoring case and accents). */
export function hasExactName(tree: CategoryTree, query: string, mode: PickerMode): boolean {
  const wanted = normalizeForSearch(query);
  if (!wanted) return true;
  if (mode !== 'budget' && tree.lifeAreas.some((area) => normalizeForSearch(area.name) === wanted)) return true;
  if (mode === 'life') return false;
  return [...tree.budgetById.values()].some((category) => normalizeForSearch(category.name) === wanted);
}

/** How a picked value reads: "Health › Groceries", or the life area alone. null when unknown. */
export function selectionLabel(
  tree: CategoryTree,
  selection: TreeSelection | null,
): { label: string; path: string; color: string | null; lifeArea: LifeAreaRow | null } | null {
  if (!selection) return null;
  if (selection.kind === 'life') {
    const area = tree.lifeById.get(selection.id);
    return area ? { label: area.name, path: area.name, color: area.color ?? null, lifeArea: area } : null;
  }
  const category = tree.budgetById.get(selection.id);
  if (!category) return null;
  const parent = tree.parentOf.get(category.id) ?? null;
  return {
    label: category.name,
    path: parent ? `${parent.name}${PATH_SEPARATOR}${category.name}` : category.name,
    color: category.color ?? null,
    lifeArea: parent,
  };
}

// ── Suggestions for the Organize screen ─────────────────────────────────────────

export interface LifeAreaSuggestion {
  lifeAreaId: string;
  lifeAreaName: string;
  /** same_name: the budget category is named like the life area; name_contains: the name
   *  contains the life area's name; keyword: a common word for that area ("rent" -> Home). */
  reason: 'same_name' | 'name_contains' | 'keyword';
}

/**
 * Words in budget category names and the life areas they usually belong to, most likely first.
 * The first area the person actually has (matched by name, see AREA_SYNONYMS) wins. Kept short
 * and plain on purpose: a wrong guess costs one click, since nothing is applied unconfirmed.
 */
const KEYWORDS: readonly [readonly string[], readonly string[]][] = [
  [['grocer', 'supermarket', 'food', 'produce', 'meal'], ['Health', 'Home']],
  [['health', 'medical', 'doctor', 'dental', 'dentist', 'pharmacy', 'prescription', 'clinic', 'hospital', 'therapy', 'vision', 'supplement', 'vitamin', 'wellness'], ['Health']],
  [['gym', 'fitness', 'sport', 'yoga', 'training', 'athletic', 'bike', 'cycling', 'running'], ['Fitness', 'Health']],
  [['rent', 'mortgage', 'utilit', 'electric', 'water', 'gas bill', 'internet', 'phone', 'cable', 'furniture', 'household', 'home', 'house', 'cleaning', 'repair', 'garden', 'hoa', 'laundry'], ['Home']],
  [['travel', 'hotel', 'flight', 'airfare', 'airline', 'vacation', 'lodging', 'airbnb'], ['Travel']],
  [['gas', 'fuel', 'auto', 'car', 'vehicle', 'parking', 'toll', 'transit', 'uber', 'lyft', 'taxi', 'transport', 'commute'], ['Travel', 'Home']],
  [['dining', 'restaurant', 'coffee', 'bar', 'takeout', 'eating out', 'entertain', 'movie', 'concert', 'event', 'gift', 'friend', 'party', 'date'], ['Social', 'Relationships']],
  [['donation', 'charity', 'church', 'tithe', 'family', 'child', 'kids', 'pet'], ['Relationships', 'Social', 'Home']],
  [['book', 'course', 'class', 'tuition', 'school', 'education', 'learning'], ['Learning']],
  [['salary', 'paycheck', 'payroll', 'wage', 'business', 'office', 'software', 'saas', 'client', 'work', 'professional', 'contract', 'freelance', 'union'], ['Career', 'Finance']],
  [['bank', 'fee', 'interest', 'tax', 'saving', 'invest', 'loan', 'debt', 'credit', 'insurance', 'transfer', 'income', 'refund', 'dividend'], ['Finance']],
  [['art', 'music', 'craft', 'hobby', 'photo', 'creative', 'game', 'streaming'], ['Creativity', 'Social', 'Learning']],
];

/** Other names a person's life area may have for the same idea. */
const AREA_SYNONYMS: Record<string, readonly string[]> = {
  Health: ['health', 'wellness', 'wellbeing', 'medical'],
  Home: ['home', 'house', 'household', 'housing'],
  Fitness: ['fitness', 'exercise', 'training', 'sport'],
  Travel: ['travel', 'transport', 'transportation'],
  Social: ['social', 'fun', 'leisure', 'entertainment'],
  Relationships: ['relationships', 'family', 'friends', 'community'],
  Learning: ['learning', 'education', 'growth'],
  Career: ['career', 'work', 'business', 'job'],
  Finance: ['finance', 'money', 'financial'],
  Creativity: ['creativity', 'creative', 'hobbies', 'art'],
};

/** A life area for a budget category named `categoryName`, or null when nothing fits. */
export function suggestLifeArea(categoryName: string, lifeAreas: readonly LifeAreaRow[]): LifeAreaSuggestion | null {
  const name = normalizeForSearch(categoryName);
  if (!name || lifeAreas.length === 0) return null;
  const areas = lifeAreas.map((area) => ({ area, key: normalizeForSearch(area.name) })).filter((a) => a.key);

  const same = areas.find((a) => a.key === name);
  if (same) return { lifeAreaId: same.area.id, lifeAreaName: same.area.name, reason: 'same_name' };

  // Longest life area name first, so "Home Office" beats "Home" inside "Home Office Supplies".
  const contained = [...areas]
    .sort((a, b) => b.key.length - a.key.length)
    .find((a) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(a.key)}`).test(name));
  if (contained) return { lifeAreaId: contained.area.id, lifeAreaName: contained.area.name, reason: 'name_contains' };

  for (const [words, preferred] of KEYWORDS) {
    if (!words.some((word) => hasKeyword(name, word))) continue;
    for (const wanted of preferred) {
      const synonyms = AREA_SYNONYMS[wanted] ?? [normalizeForSearch(wanted)];
      const found = areas.find((a) => synonyms.includes(a.key));
      if (found) return { lifeAreaId: found.area.id, lifeAreaName: found.area.name, reason: 'keyword' };
    }
  }
  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A keyword of 5 letters or more matches the start of a word ("grocer" in "groceries"); a
 * shorter one must be the whole word, or the word plus s/es, so "car" never matches "card"
 * and "bar" never matches "barber".
 */
function hasKeyword(name: string, keyword: string): boolean {
  const word = escapeRegExp(keyword);
  const pattern = keyword.length >= 5 ? `(^|[^a-z0-9])${word}` : `(^|[^a-z0-9])${word}(e?s)?($|[^a-z0-9])`;
  return new RegExp(pattern).test(name);
}
