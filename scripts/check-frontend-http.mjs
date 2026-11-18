import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { publicPages, canonicalUrl } from '../src/seo/publicPages.js';

export async function checkFrontend(baseUrl, fetchImpl = fetch) {
  const base = new URL(baseUrl);
  const request = path => fetchImpl(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  let home;
  for (const page of publicPages) {
    const res = await request(page.path);
    assert.equal(res.status, 200, `${page.path}: expected 200 without redirect`);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const html = await res.text();
    assert.ok(html.includes(`rel="canonical" href="${canonicalUrl(page.path)}"`), `${page.path}: incorrect canonical`);
    if (page.path === '/') home = html;
  }
  const assets = [...home.matchAll(/(?:src|href)="(\/(?:assets\/|favicon|apple-touch-icon)[^"]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => /\.css(?:\?|$)/.test(asset)), 'No stylesheet found');
  assert.ok(assets.some(asset => /\.js(?:\?|$)/.test(asset)), 'No script found');
  for (const asset of new Set(assets)) {
    const res = await request(asset);
    assert.equal(res.status, 200, `${asset}: asset redirects or cannot load`);
    const type = res.headers.get('content-type') || '';
    if (/\.css(?:\?|$)/.test(asset)) assert.match(type, /text\/css/, `${asset}: CSS MIME type`);
    else if (/\.js(?:\?|$)/.test(asset)) assert.match(type, /(?:text|application)\/javascript/, `${asset}: JS MIME type`);
    else assert.match(type, /image\//, `${asset}: favicon MIME type`);
    if (asset.startsWith('/assets/')) assert.equal(res.headers.get('access-control-allow-origin'), '*', `${asset}: public asset CORS`);
    await res.arrayBuffer();
  }
  for (const path of ['/login', '/customers', '/booking', '/queue', '/profile', '/admin']) {
    const res = await request(path);
    assert.equal(res.status, 200, `${path}: private route fallback`);
    assert.ok((await res.text()).includes('content="noindex, follow"'), `${path}: private indexing`);
  }
  for (const [from, to] of [['/help', '/support'], ['/customer', '/customers'], ['/wallet', '/profile'], ['/coming-soon', '/']]) {
    const res = await request(`${from}?ci=1`);
    assert.ok([301, 308].includes(res.status), `${from}: expected permanent redirect`);
    assert.equal(new URL(res.headers.get('location'), base).href, new URL(`${to}?ci=1`, base).href, `${from}: redirect lost path or query`);
    await res.arrayBuffer();
  }
  const missing = await request('/__ci_page_that_does_not_exist');
  assert.equal(missing.status, 404, 'Unknown routes must return HTTP 404');
  assert.ok((await missing.text()).includes('content="noindex, follow"'));
  return { pages: publicPages.length, assets: new Set(assets).size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkFrontend(process.argv[2] || 'http://127.0.0.1:8080');
  console.log(`Frontend HTTP checks passed: ${result.pages} public pages, ${result.assets} assets, private routes, redirects and real 404.`);
}
