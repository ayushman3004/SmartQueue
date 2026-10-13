import { useEffect } from 'react'

/**
 * Lightweight, zero-dependency SEO hook for updating page metadata,
 * Open Graph tags, canonical links, and search indexing directives.
 */
export function useSeo({
  title,
  description,
  robots = 'index, follow',
  canonical,
  ogImage = '/logo.png',
  ogType = 'website',
}) {
  useEffect(() => {
    // 1. Update Document Title
    const brand = 'serveQ'
    const fullTitle = title ? `${title} | ${brand}` : 'serveQ — Smart Queue & Virtual Waiting'
    document.title = fullTitle

    // 2. Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content =
      description ||
      'serveQ provides real-time virtual queue management for salons, clinics, and service venues. Join lines virtually and eliminate waiting rooms.'

    // 3. Update Robots Directive
    let metaRobots = document.querySelector('meta[name="robots"]')
    if (!metaRobots) {
      metaRobots = document.createElement('meta')
      metaRobots.name = 'robots'
      document.head.appendChild(metaRobots)
    }
    metaRobots.content = robots

    // 4. Update Open Graph Tags
    const setOgTag = (property, content) => {
      if (!content) return
      let tag = document.querySelector(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.appendChild(tag)
      }
      tag.content = content
    }

    setOgTag('og:title', fullTitle)
    setOgTag('og:description', metaDesc.content)
    setOgTag('og:type', ogType)
    setOgTag('og:image', ogImage)

    // 5. Update Canonical Link
    if (canonical) {
      let linkCanonical = document.querySelector('link[rel="canonical"]')
      if (!linkCanonical) {
        linkCanonical = document.createElement('link')
        linkCanonical.rel = 'canonical'
        document.head.appendChild(linkCanonical)
      }
      linkCanonical.href = canonical
    }
  }, [title, description, robots, canonical, ogImage, ogType])
}
