The production build generates nine public URLs in `public/sitemap.xml`: the homepage, business portal, support, privacy, terms, and four guides (`/how-it-works`, `/virtual-queue`, `/for-clinics`, `/for-salons`). The shared registry is `src/seo/publicPages.js`.

Run `npm run build` before deploying. This generates a separate HTML document with its own title, description, canonical and social metadata for every public URL. The guides also contain their complete article and navigation in the initial HTML. The five existing interactive pages still render their main content with React.

Vercel uses clean static URLs and explicit rewrites for account routes. Unmatched URLs use the generated `404.html` with an HTTP 404 status. Nginx has corresponding static-file routing, account fallbacks, alias redirects and an error page. Keep these configurations aligned if adding a new private route. API and health proxies remain separate.

Account pages use `noindex`; they are deliberately omitted from the sitemap. They remain crawlable so search engines can read the directive. Authentication still controls access. `/help`, `/customer`, `/coming-soon`, and `/wallet` permanently redirect to their current destinations. The Vercel domain setting redirects serveq.tech to www.serveq.tech. Host canonicalization is owned by that setting; do not add an opposing host redirect in vercel.json. HTTP-to-HTTPS is handled by the hosting platform.

After deployment, verify actual HTTP status codes for the public pages, aliases and a random missing URL. Submit `https://www.serveq.tech/sitemap.xml` in Google Search Console, and inspect the new guide URLs using the live URL test. Request indexing after confirming their rendered content and canonical URLs. Indexing is Google's decision and may take time; a sitemap does not guarantee inclusion. Existing redirect aliases should remain classified as redirected pages rather than being indexed separately.

Validation: `npm run build`, then `node --test tests/seo_routes.test.js`.

The static assets have public CORS headers scoped to `/assets/` only. Entry asset and favicon URLs carry a version query to bypass cached permanent redirects from the former host loop. Do not add CORS headers to private API responses here; the API owns its origin policy. After deploying this fix, both the CSS/JS and favicon requests on www must return 200 without a host redirect.
