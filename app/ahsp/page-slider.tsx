'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import styles from './page-slider.module.css'

type PageSliderProps = {
  page: number
  pages: number
  loading?: boolean
  label: string
  detail?: string
  onPageChange: (page: number) => void
}

const loadDelay = 1500

export default function PageSlider({ page, pages, loading = false, label, detail, onPageChange }: PageSliderProps) {
  const [pendingSelection, setPendingSelection] = useState<{ target: number; fromPage: number; fromPages: number } | null>(null)
  const rail = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<number | null>(null)

  const commitPage = (target: number) => {
    if (loading) return
    const next = Math.max(1, Math.min(pages, target))
    if (next === page) {
      pendingRef.current = null
      setPendingSelection(null)
      return
    }
    pendingRef.current = next
    setPendingSelection({ target: next, fromPage: page, fromPages: pages })
    onPageChange(next)
  }

  const schedulePage = (target: number) => {
    if (loading) return
    const next = Math.max(1, Math.min(pages, target))
    if (timer.current) clearTimeout(timer.current)
    if (next === page) {
      timer.current = null
      pendingRef.current = null
      setPendingSelection(null)
      return
    }
    pendingRef.current = next
    setPendingSelection({ target: next, fromPage: page, fromPages: pages })
    timer.current = setTimeout(() => {
      timer.current = null
      commitPage(next)
    }, loadDelay)
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pendingRef.current = null
  }, [page, pages])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-page]'))
      if (!buttons.length) return
      const center = container.getBoundingClientRect().left + container.clientWidth / 2
      const nearest = buttons.reduce((best, button) => {
        const rect = button.getBoundingClientRect()
        const bestRect = best.getBoundingClientRect()
        return Math.abs(rect.left + rect.width / 2 - center) < Math.abs(bestRect.left + bestRect.width / 2 - center) ? button : best
      }, buttons[0])
      commitPage(Number(nearest.dataset.page))
    }, loadDelay)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: number) => {
    const base = pendingRef.current ?? current
    const target = event.key === 'ArrowRight' ? base + 1
      : event.key === 'ArrowLeft' ? base - 1
        : event.key === 'Home' ? 1
          : event.key === 'End' ? pages
            : null
    if (target === null) return
    event.preventDefault()
    const next = Math.max(1, Math.min(pages, target))
    schedulePage(next)
    rail.current?.querySelector<HTMLButtonElement>(`[data-page="${next}"]`)?.focus()
  }

  const pendingPage = pendingSelection?.fromPage === page && pendingSelection.fromPages === pages ? pendingSelection.target : null
  const selectedPage = pendingPage ?? page

  useEffect(() => {
    const container = rail.current
    const button = container?.querySelector<HTMLButtonElement>(`[data-page="${selectedPage}"]`)
    if (!container || !button) return
    const containerCenter = container.getBoundingClientRect().left + container.clientWidth / 2
    const buttonCenter = button.getBoundingClientRect().left + button.clientWidth / 2
    container.scrollTo({ left: container.scrollLeft + buttonCenter - containerCenter, behavior: 'auto' })
  }, [selectedPage, pages])

  return <nav className={styles.pager} aria-label={label}>
    <div ref={rail} className={styles.rail} role="group" onScroll={handleScroll} aria-label="Geser untuk memilih nomor halaman">
      {Array.from({ length: pages }, (_, index) => {
        const number = index + 1
        return <button
          key={number}
          type="button"
          data-page={number}
          aria-current={selectedPage === number ? 'page' : undefined}
          aria-label={`Halaman ${number}`}
          tabIndex={selectedPage === number ? 0 : -1}
          disabled={loading}
          onClick={() => schedulePage(number)}
          onKeyDown={event => handleKeyDown(event, number)}
        >{number}</button>
      })}
    </div>
    <span className={styles.status} role="status" aria-live="polite">
      {pendingPage !== null ? `Halaman ${pendingPage} dipilih. Menunggu 1,5 detik sebelum memuat.` : `Halaman ${page} dari ${pages}`}
      {detail ? ` · ${detail}` : ''}
    </span>
  </nav>
}
