import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { publicPages, guidePages, canonicalUrl, escapeHtml, SITE_URL } from '../src/seo/publicPages.js'
import { routeHtml } from '../src/seo/routeHtml.js'
import { safeReturnTo } from '../src/utils/authRedirect.js'

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const config = JSON.parse(read('vercel.json'))

test('host routing agrees with the production www domain without redirecting static assets', () => {
  assert.equal(SITE_URL, 'https://www.serveq.tech')
  // The Vercel domain setting already sends the apex to www. An opposing
  // repository rule creates a loop, including for CSS, scripts and favicons.
  assert.ok(config.redirects.every(rule => !rule.has?.some(condition => condition.type === 'host')))
  assert.ok(config.redirects.every(rule => rule.destination.startsWith('/') && !rule.destination.startsWith('//')))
  for (const pathname of ['/assets/index.js', '/assets/index.css', '/favicon.svg', '/favicon.ico', '/favicon-32x32.png']) {
    assert.ok(!config.redirects.some(rule => [pathname, '/:path*', '/(.*)'].includes(rule.source)), pathname)
  }
  const cors = config.headers.find(rule => rule.source === '/assets/:path*')
  assert.ok(cors.headers.some(header => header.key === 'Access-Control-Allow-Origin' && header.value === '*'))
  assert.ok(config.headers.filter(rule => rule.headers.some(header => header.key.toLowerCase() === 'access-control-allow-origin')).every(rule => rule.source === '/assets/:path*'), 'wildcard asset CORS must be scoped to assets')
  for (const page of ['LandingPage', 'BusinessPortalPage', 'LoginPage', 'PrivacyPolicyPage', 'TermsPage']) {
    assert.ok(!read(`src/pages/${page}.jsx`).includes("canonical: 'https://serveq.tech"), page)
  }
})

test('Vercel and Nginx enforce matching browser security policies', () => {
  const headers = config.headers.find(rule => rule.source === '/:path*').headers
  const header = key => headers.find(entry => entry.key === key)?.value
  const policy = header('Content-Security-Policy')
  const scriptSource = policy.split('; ').find(value => value.startsWith('script-src '))
  // HTML parsers normalize line endings before hashing inline script content.
  const jsonLd = read('index.html').replace(/\r\n?/g, '\n')
    .match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1]
  assert.ok(scriptSource.includes(`'sha256-${createHash('sha256').update(jsonLd).digest('base64')}'`))
  assert.ok(!/unsafe-inline|unsafe-eval/.test(scriptSource))
  assert.ok(policy.includes("frame-ancestors 'none'"))
  assert.equal(header('X-Frame-Options'), 'DENY')
  assert.equal(header('X-Content-Type-Options'), 'nosniff')
  for (const { key, value } of headers) assert.ok(read('nginx.conf').includes(`add_header ${key} "${value}" always;`))
})

test('entry assets and icons bypass the old permanent-redirect cache', () => {
  const html = routeHtml('<script type="module" src="/assets/index-old.js"></script><link rel="stylesheet" href="/assets/index-old.css">', publicPages[0])
  assert.ok(html.includes('src="/assets/index-old.js?v=host-fix-1"'))
  assert.ok(html.includes('href="/assets/index-old.css?v=host-fix-1"'))
  assert.equal(routeHtml(html, publicPages[0]), html, 'asset query must not be appended twice')
  const icons = [...read('index.html').matchAll(/href="(\/(?:favicon[^"/?]*|apple-touch-icon\.png)(?:\?[^"]*)?)"/g)]
  assert.ok(icons.length >= 8)
  for (const [, href] of icons) {
    const { pathname, searchParams } = new URL(href, SITE_URL)
    assert.match(searchParams.get('v') ?? '', /^[a-z\d-]+$/i, href)
    assert.ok(fs.existsSync(new URL(`../public${pathname}`, import.meta.url)), href)
  }
})

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
  assert.equal(guidePages.length, 3)
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
