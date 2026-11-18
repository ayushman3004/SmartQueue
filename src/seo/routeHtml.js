import { canonicalUrl, escapeHtml, renderGuide } from './publicPages.js'

export function routeHtml(html, page, indexable = true) {
  const url = canonicalUrl(page.path)
  const title = `${page.title} | serveQ`
  const replacements = {
    'description': page.description,
    'robots': indexable ? 'index, follow' : 'noindex, follow',
    'og:url': url, 'og:title': title, 'og:description': page.description,
    'twitter:title': title, 'twitter:description': page.description,
  }
  let result = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${escapeHtml(url)}" />`)
  for (const [name, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`(<meta (?:name|property)="${name}"\\s+content=")[^"]*("\\s*\\/?>)`)
    result = result.replace(pattern, (_, before, after) => `${before}${escapeHtml(value)}${after}`)
  }
  if (page.sections) result = result.replace('<div id="root"></div>', () => `<div id="root">${renderGuide(page)}</div>`)
  if (!indexable) result = result.replace(/<link rel="canonical"[^>]*\/>/, '')
  return result
}

