import slugify from 'slugify';

/**
 * Generates a URL-safe slug from a title.
 * e.g. "Hello World! 2024" → "hello-world-2024"
 */
export function generateSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,   // removes non-alphanumeric characters
    trim: true,
  });
}

/**
 * Appends a numeric suffix to a slug to make it unique.
 * Uses a provided checker function to test whether a slug already exists.
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

  // Fallback: append timestamp to guarantee uniqueness
  return `${base}-${Date.now()}`;
}
