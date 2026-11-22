import { useEffect } from 'react'

export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    const root = document.documentElement
    const update = () => {
      const height = viewport?.height ?? window.innerHeight
      root.style.setProperty('--visual-viewport-height', `${height}px`)
      root.style.setProperty('--visual-viewport-top', `${viewport?.offsetTop || 0}px`)
      root.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - height - (viewport?.offsetTop || 0))}px`)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      for (const name of ['--visual-viewport-height', '--visual-viewport-top', '--keyboard-inset']) root.style.removeProperty(name)
    }
  }, [])
}
