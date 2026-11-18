import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { publicPages, canonicalUrl } from '../src/seo/publicPages.js';

const dist = new URL('../dist/', import.meta.url);
const read = name => readFileSync(new URL(name, dist), 'utf8');
for (const page of publicPages) {
  const name = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
  const html = read(name);
  assert.ok(html.includes(`rel="canonical" href="${canonicalUrl(page.path)}"`), `${name}: incorrect canonical`);
  assert.ok(html.includes('content="index, follow"'), `${name}: not indexable`);
  const entries = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)(?:\?[^\"]*)?"/g)];
  assert.ok(entries.some(([, asset]) => asset.endsWith('.js')), `${name}: missing script`);
  assert.ok(entries.some(([, asset]) => asset.endsWith('.css')), `${name}: missing CSS`);
  for (const [, asset] of entries) assert.ok(existsSync(new URL(`.${asset}`, dist)), `${name}: missing ${asset}`);
  for (const [, icon] of html.matchAll(/href="(\/(?:favicon[^"?]*|apple-touch-icon\.png))(?:\?[^\"]*)?"/g)) {
    assert.ok(existsSync(new URL(`.${icon}`, dist)), `${name}: missing ${icon}`);
  }
}
for (const name of ['app.html', '404.html']) assert.ok(read(name).includes('content="noindex, follow"'), `${name}: missing noindex`);
assert.equal((read('sitemap.xml').match(/<loc>/g) || []).length, publicPages.length);
for (const page of publicPages) assert.ok(read('sitemap.xml').includes(`<loc>${canonicalUrl(page.path)}</loc>`));
assert.ok(read('robots.txt').includes(`${canonicalUrl('/')}/sitemap.xml`));
console.log(`Production build verified: ${publicPages.length} public pages, assets, favicons, sitemap and private/404 metadata.`);
