'use client'

import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { sheetCloseState } from '@/lib/fintrackUx'

export function TransactionSheet({ children, onClose }: { children: (close: (force?: boolean) => void) => ReactNode; onClose: () => void }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const discardButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLElement>(null)
  const motion = useRef({ y: 0, velocity: 0, frame: 0, closing: false, reduced: false })
  const drag = useRef<{ id: number; origin: number; last: number; time: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const previousFocus = useRef<HTMLElement | null>(null)
  const finish = useRef(onClose)
  useEffect(() => { finish.current = onClose }, [onClose])
  useEffect(() => { if (confirmDiscard) discardButton.current?.focus() }, [confirmDiscard])

  function requestClose(force = false) {
    const state = sheetCloseState(Boolean(panel.current?.querySelector('form[data-dirty="true"]')), Boolean(panel.current?.querySelector('form[data-updating="true"]')), force)
    if (state === 'wait') { settle(false); return }
    if (state === 'confirm') { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; settle(false); setConfirmDiscard(true); return }
    settle(true)
  }

  function paint() {
    const { y, reduced } = motion.current
    if (panel.current) panel.current.style.transform = reduced ? 'none' : `translateY(${y}px)`
    dialog.current?.style.setProperty('--sheet-dim', String(Math.max(0, 1 - y / Math.max(panel.current?.offsetHeight || 1, 1))))
  }

  function settle(closing: boolean) {
    const state = motion.current
    cancelAnimationFrame(state.frame)
    state.closing = closing
    if (state.reduced) {
      state.y = 0
      state.velocity = 0
      paint()
      if (closing) finish.current()
      return
    }
    const target = closing ? (panel.current?.offsetHeight || 760) + 32 : 0
    let previous = performance.now()
    function tick(now: number) {
      const dt = Math.min((now - previous) / 1000, .032)
      previous = now
      // Exact critically damped spring step keeps interruption continuous at any frame rate.
      const offset = state.y - target
      const spring = 22
      const impulse = state.velocity + spring * offset
      const decay = Math.exp(-spring * dt)
      state.y = target + (offset + impulse * dt) * decay
      state.velocity = (state.velocity - spring * impulse * dt) * decay
      paint()
      if (Math.abs(state.y - target) < .5 && Math.abs(state.velocity) < 5) {
        state.y = target
        paint()
        if (closing) finish.current()
      } else state.frame = requestAnimationFrame(tick)
    }
    state.frame = requestAnimationFrame(tick)
  }

  useEffect(() => {
    const element = dialog.current!
    const state = motion.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    motion.current.reduced = preference.matches
    document.body.style.overflow = 'hidden'
    element.showModal()
    motion.current.y = preference.matches ? 0 : 48
    paint()
    settle(false)
    function change() {
      motion.current.reduced = preference.matches
      if (preference.matches) settle(motion.current.closing)
    }
    preference.addEventListener('change', change)
    return () => {
      cancelAnimationFrame(state.frame)
      preference.removeEventListener('change', change)
      element.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus()
    }
    // The sheet owns one mount/unmount cycle; callbacks are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    cancelAnimationFrame(motion.current.frame)
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, origin: event.clientY - motion.current.y, last: event.clientY, time: event.timeStamp, moved: false }
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drag.current
    if (!gesture || gesture.id !== event.pointerId) return
    const distance = event.clientY - gesture.origin
    if (!gesture.moved && Math.abs(event.clientY - gesture.last) < 8) return
    gesture.moved = true
    suppressClick.current = true
    motion.current.velocity = (event.clientY - gesture.last) / Math.max(event.timeStamp - gesture.time, 1) * 1000
    motion.current.y = distance < 0 ? distance * .15 : distance
    gesture.last = event.clientY
    gesture.time = event.timeStamp
    paint()
  }
  function end(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const gesture = drag.current
    if (!gesture || gesture.id !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (event.timeStamp - gesture.time > 100 || cancelled) motion.current.velocity = 0
    const threshold = Math.min(160, (panel.current?.offsetHeight || 600) * .3)
    if (!cancelled && gesture.moved && motion.current.y + motion.current.velocity * .15 > threshold) requestClose()
    else settle(false)
  }

  return <dialog ref={dialog} className="ft-modal-layer" aria-labelledby="transaction-modal-title"
    onCancel={event => { event.preventDefault(); if (confirmDiscard) setConfirmDiscard(false); else requestClose() }}
    onClick={event => { if (event.target === event.currentTarget) requestClose() }}>
    <section ref={panel} className="ft-modal ft-protected-sheet">
      <button type="button" className="ft-sheet-handle" aria-label="Tutup panel transaksi" onPointerDown={start} onPointerMove={move} onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => { if (drag.current) end(event, true) }} onClick={event => { if (event.detail === 0 || !suppressClick.current) requestClose() }}><span /></button>
      {/* The render prop only passes close to event handlers; it never invokes it during render. */}
      <div inert={confirmDiscard}>{children(requestClose)}</div>
      {confirmDiscard && <div className="ft-discard-confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll('button'); const next = event.shiftKey ? buttons[0] : buttons[1]; if (document.activeElement === next) { event.preventDefault(); (event.shiftKey ? buttons[1] : buttons[0]).focus() } } }}><h2 id="discard-title">Buang perubahan?</h2><p>Isian belum disimpan.</p><button ref={discardButton} type="button" className="ft-button ft-button-primary" onClick={() => { setConfirmDiscard(false); requestAnimationFrame(() => previousFocus.current?.focus()) }}>Lanjutkan mengisi</button><button type="button" className="ft-button ft-button-secondary" onClick={() => requestClose(true)}>Buang perubahan</button></div>}
    </section>
  </dialog>
}


