const gutter = 12
const gap = 14
const padding = 6
const clamp = (value, min, max) => Math.max(min, Math.min(value, max))

export function placeTourGuide(rect, guide, viewport) {
  const { width, height } = viewport
  const maxLeft = width - guide.width - gutter
  const maxTop = height - guide.height - gutter
  const fallback = { left: Math.max(gutter, maxLeft), top: Math.max(gutter, maxTop) }
  if (!rect || rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) {
    return { guide: fallback, spotlight: null }
  }

  const left = Math.max(gutter, rect.left - padding)
  const right = Math.min(width - gutter, rect.right + padding)
  const top = Math.max(gutter, rect.top - padding)
  const bottom = Math.min(height - gutter, rect.bottom + padding)
  if (right <= left || bottom <= top) return { guide: fallback, spotlight: null }

  const spotlight = { left, top, width: right - left, height: bottom - top }
  const sideTop = clamp(top, gutter, maxTop)
  const centeredLeft = clamp((left + right - guide.width) / 2, gutter, maxLeft)
  if (right + gap <= maxLeft) return { spotlight, guide: { left: right + gap, top: sideTop } }
  if (left - gap - guide.width >= gutter) return { spotlight, guide: { left: left - gap - guide.width, top: sideTop } }
  if (bottom + gap <= maxTop) return { spotlight, guide: { left: centeredLeft, top: bottom + gap } }
  if (top - gap - guide.height >= gutter) return { spotlight, guide: { left: centeredLeft, top: top - gap - guide.height } }
  return { guide: fallback, spotlight: null }
}
