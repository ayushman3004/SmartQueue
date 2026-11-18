import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFrontend } from '../scripts/check-frontend-http.mjs';
import { publicPages, canonicalUrl } from '../src/seo/publicPages.js';

function fixture(change = () => null) {
  return async (url) => {
    const altered = change(url);
    if (altered) return altered;
    const page = publicPages.find(page => page.path === url.pathname);
    if (page) return new Response(`<link rel="canonical" href="${canonicalUrl(page.path)}"><link href="/assets/index.css?v=test"><script src="/assets/index.js?v=test"></script><link href="/favicon.svg?v=test">`, { headers: { 'content-type': 'text/html' } });
    const aliases = { '/help': '/support', '/customer': '/customers', '/wallet': '/profile', '/coming-soon': '/' };
    if (aliases[url.pathname]) return new Response(null, { status: 301, headers: { location: `${aliases[url.pathname]}${url.search}` } });
    if (url.pathname.startsWith('/assets/')) return new Response('asset', { headers: { 'content-type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript', 'access-control-allow-origin': '*' } });
    if (url.pathname === '/favicon.svg') return new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
    return new Response('<meta name="robots" content="noindex, follow">', { status: url.pathname.startsWith('/__ci_') ? 404 : 200 });
  };
}

test('frontend smoke check covers public pages, entry assets, icons, private routes and redirects', async () => {
  assert.deepEqual(await checkFrontend('http://localhost:8080', fixture()), { pages: publicPages.length, assets: 3 });
});

test('frontend smoke check rejects asset redirects, incorrect MIME types and missing CORS', async () => {
  for (const response of [new Response(null, { status: 308, headers: { location: 'https://serveq.tech/assets/index.css' } }), new Response('<html/>', { headers: { 'content-type': 'text/html' } }), new Response('css', { headers: { 'content-type': 'text/css' } })]) {
    await assert.rejects(checkFrontend('http://localhost:8080', fixture(url => url.pathname.endsWith('.css') ? response : null)));
  }
});

test('frontend smoke check rejects soft 404s and redirect query loss', async () => {
  await assert.rejects(checkFrontend('http://localhost:8080', fixture(url => url.pathname.startsWith('/__ci_') ? new Response('Not found') : null)), /HTTP 404/);
  await assert.rejects(checkFrontend('http://localhost:8080', fixture(url => url.pathname === '/help' ? new Response(null, { status: 301, headers: { location: '/support' } }) : null)), /redirect lost/);
});

test('frontend smoke check catches the Nginx mapped-port regression while allowing relative redirects', async () => {
  await checkFrontend('http://localhost:8080', fixture());
  await assert.rejects(checkFrontend('http://localhost:8080', fixture(url => url.pathname === '/help'
    ? new Response(null, { status: 301, headers: { location: 'http://localhost/support?ci=1' } }) : null)), /redirect lost/);
});
