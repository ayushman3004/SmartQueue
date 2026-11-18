import fs from 'node:fs'
import { publicPages, canonicalUrl, SITE_URL } from '../src/seo/publicPages.js'

// Do not claim a new modification date just because a build ran.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPages.map(page => `  <url><loc>${canonicalUrl(page.path)}</loc></url>`).join('\n')}
</urlset>
`
fs.writeFileSync(new URL('../public/sitemap.xml', import.meta.url), sitemap)
// Let crawlers read noindex directives on account pages. robots.txt is not access control.
fs.writeFileSync(new URL('../public/robots.txt', import.meta.url), `User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/

Sitemap: ${SITE_URL}/sitemap.xml
`)
console.log(`Generated sitemap for ${publicPages.length} public pages`)
