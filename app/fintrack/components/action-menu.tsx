'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { DotsThreeVertical } from '@phosphor-icons/react'

export function ActionMenu({ label, children }: { label: string; children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null)
  function close(restore = false) {
    if (!root.current) return
    root.current.open = false
    if (restore) root.current.querySelector('summary')?.focus()
  }
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  return <details ref={root} className="ft-action-menu" onKeyDown={event => {
    const items = Array.from(root.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'))
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') { event.preventDefault(); close(true) }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      root.current!.open = true
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : (index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length)
      items[next]?.focus()
    }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
    <summary aria-label={label} aria-haspopup="menu"><DotsThreeVertical size={19} weight="bold" /></summary>
    <div role="menu" aria-label={label} onClick={event => { if ((event.target as HTMLElement).closest('button:not(:disabled)')) close(true) }}>{children}</div>
  </details>
}
