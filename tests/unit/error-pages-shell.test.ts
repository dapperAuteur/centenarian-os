// Error pages keep the app shell (witus docs/shared-ui-ux-dx.md): the root layout renders no
// header, so the 404 page and the root error boundary must render SiteHeader and SiteFooter, and
// global-error must carry its own home and sign-in links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf-8');

for (const file of ['app/not-found.tsx', 'app/error.tsx']) {
  test(`${file} renders the header, the footer, one h1 and a home link`, () => {
    const src = read(file);
    assert.match(src, /<SiteHeader \/>/);
    assert.match(src, /<SiteFooter \/>/);
    assert.equal(src.match(/<h1/g)?.length, 1);
    assert.match(src, /href="\/"/);
  });
}

test('global-error carries its own home and sign-in links', () => {
  const src = read('app/global-error.tsx');
  assert.match(src, /href="\/"/);
  assert.match(src, /href="\/login"/);
});
