'use client'

import { useEffect } from 'react'

export function ScrollReveal() {
  useEffect(() => {
    const root = document.getElementById('main')
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!root || preference.matches || !('IntersectionObserver' in window) || !('animate' in Element.prototype)) return

    const elements = root.querySelectorAll<HTMLElement>('[data-scroll-reveal]')
    const animations = new Map<HTMLElement, Animation>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const element = entry.target as HTMLElement
        observer.unobserve(element)
        if (!element.hasAttribute('data-reveal-pending')) continue
        const style = getComputedStyle(element)
        const from = { opacity: style.opacity, transform: style.transform, filter: style.filter }
        element.removeAttribute('data-reveal-pending')
        const animation = element.animate([
          from,
          { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        ], {
          duration: 760,
          delay: Number(element.dataset.revealDelay || 0),
          easing: 'cubic-bezier(.16, 1, .3, 1)',
          fill: 'both',
        })
        animations.set(element, animation)
        void animation.finished.then(() => {
          if (animations.get(element) !== animation) return
          animations.delete(element)
          animation.cancel()
        }).catch(() => {})
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 })

    function show(element: HTMLElement) {
      observer.unobserve(element)
      element.removeAttribute('data-reveal-pending')
      animations.get(element)?.cancel()
      animations.delete(element)
    }

    function showFocused(event: FocusEvent) {
      if (!(event.target instanceof Node)) return
      for (const element of elements) {
        if (element.contains(event.target)) show(element)
      }
    }

    function clear() {
      observer.disconnect()
      elements.forEach(show)
    }

    // Measure before setting styles to avoid repeated layout work during hydration.
    const offscreen = Array.from(elements).filter(element =>
      element.getBoundingClientRect().top >= window.innerHeight && !element.matches(':focus-within'))
    for (const element of offscreen) {
      element.setAttribute('data-reveal-pending', '')
      observer.observe(element)
    }

    root.addEventListener('focusin', showFocused)
    preference.addEventListener('change', clear)
    return () => {
      clear()
      root.removeEventListener('focusin', showFocused)
      preference.removeEventListener('change', clear)
    }
  }, [])

  return null
}
