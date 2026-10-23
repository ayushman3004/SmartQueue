import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'https://serveq.tech'

// All public, indexable routes on ServeQ
const publicRoutes = [
  { path: '', priority: 1.0, changefreq: 'weekly' },
  { path: '/business', priority: 0.9, changefreq: 'weekly' },
  { path: '/support', priority: 0.7, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.5, changefreq: 'monthly' },
  { path: '/terms', priority: 0.5, changefreq: 'monthly' },
]

const today = new Date().toISOString().split('T')[0]

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes
  .map(
    (route) => `  <url>
    <loc>${BASE_URL}${route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`

const robotsTxt = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /
Allow: /business
Allow: /support
Allow: /privacy
Allow: /terms

# Disallow private user consoles, bookings & administration
Disallow: /admin
Disallow: /admin/
Disallow: /customers
Disallow: /customers/
Disallow: /history
Disallow: /queue/
Disallow: /booking/
Disallow: /profile
Disallow: /subscription
Disallow: /business/onboarding
Disallow: /business/*/manage
Disallow: /login
Disallow: /auth/
Disallow: /api/

# Canonical Sitemap URL for Google Search Console
Sitemap: ${BASE_URL}/sitemap.xml
`

const publicDir = path.resolve(__dirname, '../public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml.trim() + '\n', 'utf-8')
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt.trim() + '\n', 'utf-8')

console.log('✅ Generated public/sitemap.xml and public/robots.txt')
