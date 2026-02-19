import slugify from 'slugify';

/**
 * Generates a URL-safe slug from a recipe title.
 * e.g. "Chicken Tikka Masala!" → "chicken-tikka-masala"
 */
export function generateSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Appends a numeric suffix to a slug to make it unique within the recipes table.
 *
 * @param base - The base slug to start from
 * @param exists - Async function that returns true if the slug is already taken
 */
export async function makeUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await exists(base))) return base;

  let counter = 2;
  while (counter < 100) {
    const candidate = `${base}-${counter}`;
    if (!(await exists(candidate))) return candidate;
    counter++;
  }

  return `${base}-${Date.now()}`;
}
