import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { publicPages, guidePages, canonicalUrl, escapeHtml } from '../src/seo/publicPages.js'
import { routeHtml } from '../src/seo/routeHtml.js'
import { safeReturnTo } from '../src/utils/authRedirect.js'

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const config = JSON.parse(read('vercel.json'))

test('every public page has a distinct canonical and belongs to the sitemap', () => {
  const sitemap = read('public/sitemap.xml')
  assert.equal(new Set(publicPages.map(page => page.path)).size, publicPages.length)
  assert.equal((sitemap.match(/<loc>/g) || []).length, publicPages.length)
  for (const page of publicPages) {
    assert.ok(sitemap.includes(`<loc>${canonicalUrl(page.path)}</loc>`))
    assert.ok(!config.redirects.some(rule => rule.source === page.path))
  }
  assert.ok(!sitemap.includes('/login'))
  assert.ok(!sitemap.includes('<lastmod>'), 'build dates are not content modification dates')
})

test('generated public HTML has correct initial metadata and crawlable guide content', () => {
  for (const page of publicPages) {
    const html = routeHtml(read('index.html'), page)
    assert.ok(html.includes(`<link rel="canonical" href="${canonicalUrl(page.path)}"`), page.path)
    assert.ok(html.includes(`<title>${escapeHtml(page.title)} | serveQ</title>`), page.path)
    assert.ok(html.includes('content="index, follow"'), page.path)
    assert.ok(html.includes(`property="og:url" content="${canonicalUrl(page.path)}"`), page.path)
    assert.ok(html.includes(escapeHtml(page.description)), page.path)
    if (page.sections) {
      for (const [heading, text] of page.sections) {
        assert.ok(html.includes(escapeHtml(heading)))
        assert.ok(html.includes(escapeHtml(text)))
      }
      assert.ok(html.includes('href="/business"'))
    }
  }
  assert.equal(guidePages.length, 4)
})

test('private and missing pages do not use the homepage index directive', () => {
  const privateHtml = routeHtml(read('index.html'), { path: '/profile', title: 'Your account', description: 'Sign in.' }, false)
  const missingHtml = routeHtml(read('index.html'), { path: '/404', title: 'Page not found', description: 'Page not found.' }, false)
  assert.ok(privateHtml.includes('content="noindex, follow"'))
  assert.ok(!privateHtml.includes('rel="canonical"'))
  assert.ok(missingHtml.includes('content="noindex, follow"'))
  assert.ok(!config.rewrites.some(rule => ['/(.*)', '/:path*'].includes(rule.source)), 'no catch-all success response')
  assert.ok(config.cleanUrls)
  assert.equal(config.trailingSlash, false)
  assert.ok(config.rewrites.filter(rule => !rule.destination.startsWith('https:')).every(rule => rule.destination === '/app'), 'cleanUrls rewrite destinations omit .html')
  for (const source of ['/help', '/customer', '/coming-soon', '/wallet']) {
    const rule = config.redirects.find(rule => rule.source === source)
    assert.equal(rule.permanent, true)
    assert.ok(!config.redirects.some(other => other.source === rule.destination), 'no alias redirect chains')
  }
  assert.ok(read('nginx.conf').includes('error_page 404 /404.html;'))
  assert.ok(!read('public/robots.txt').includes('Disallow: /login'), 'crawlers must see noindex')
})

test('login return targets retain deep links and reject external targets or loops', () => {
  assert.equal(safeReturnTo('/booking/123?date=2026-11-20#slots'), '/booking/123?date=2026-11-20#slots')
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/login?returnTo=/login', '/auth/callback', '/login/', null, '/\n/example.com']) {
    assert.equal(safeReturnTo(value), '/customers')
  }
  assert.equal(safeReturnTo(null, '/admin'), '/admin')
})
