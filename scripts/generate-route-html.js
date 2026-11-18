import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicPages } from '../src/seo/publicPages.js'

import { routeHtml } from '../src/seo/routeHtml.js'

const dist = new URL('../dist/', import.meta.url)
const template = fs.readFileSync(new URL('index.html', dist), 'utf8')


for (const page of publicPages) {
  const filename = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`
  fs.writeFileSync(path.join(fileURLToPath(dist), filename), routeHtml(template, page))
}
// Private routes get a neutral, non-indexable shell rather than homepage metadata.
fs.writeFileSync(new URL('app.html', dist), routeHtml(template, { path: '/', title: 'Your account', description: 'Sign in to manage your serveQ account.' }, false))
fs.writeFileSync(new URL('404.html', dist), routeHtml(template, { path: '/404', title: 'Page not found', description: 'This serveQ page could not be found.' }, false))
console.log('Generated public route HTML, private app shell, and 404 page')
