'use client'
import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

const TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['clean'],
]

export default function QuillEditor({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const holderRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const cbRef = useRef(onChange)
  useEffect(() => {
    cbRef.current = onChange
  })
  const initRef = useRef(value)

  useEffect(() => {
    const holder = holderRef.current
    if (!holder || quillRef.current) return
    const q = new Quill(holder, {
      theme: 'snow',
      placeholder,
      modules: { toolbar: TOOLBAR },
    })
    q.root.id = id
    q.root.setAttribute('role', 'textbox')
    q.root.setAttribute('aria-label', label)
    q.root.setAttribute('aria-multiline', 'true')
    const toolbar = holder.previousElementSibling
    const labels: Record<string, string> = { bold: 'Tebal', italic: 'Miring', underline: 'Garis bawah', clean: 'Hapus format' }
    toolbar?.querySelectorAll('button').forEach(button => {
      const format = button.className.replace('ql-', '')
      button.setAttribute('aria-label', labels[format] || (format === 'list' ? (button.value === 'ordered' ? 'Daftar bernomor' : 'Daftar berpoin') : button.value === '+1' ? 'Tambah inden' : 'Kurangi inden'))
      button.type = 'button'
    })
    if (initRef.current) q.root.innerHTML = initRef.current
    q.on('text-change', () => cbRef.current(q.root.innerHTML))
    quillRef.current = q
    return () => {
      q.off('text-change')
      quillRef.current = null
      toolbar?.remove()
      holder.innerHTML = ''
    }
  }, [id, label, placeholder])

  useEffect(() => {
    const q = quillRef.current
    if (q && q.root.innerHTML !== value && !q.root.contains(document.activeElement)) {
      q.root.innerHTML = value || ''
    }
  }, [value])

  return (
      <div className="quill-compact">
        <div ref={holderRef} />
      </div>
  )
}
