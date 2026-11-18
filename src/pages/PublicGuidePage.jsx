import { useSeo } from '../utils/useSeo'
import { canonicalUrl, renderGuide } from '../seo/publicPages'

export default function PublicGuidePage({ page }) {
  useSeo({ title: page.title, description: page.description, canonical: canonicalUrl(page.path) })
  return <div dangerouslySetInnerHTML={{ __html: renderGuide(page) }} />
}
