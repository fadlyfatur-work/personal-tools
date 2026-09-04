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

export default function QuillEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
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
    if (initRef.current) q.root.innerHTML = initRef.current
    q.on('text-change', () => cbRef.current(q.root.innerHTML))
    quillRef.current = q
    return () => {
      q.off('text-change')
      quillRef.current = null
      holder.innerHTML = ''
    }
  }, [placeholder])

  useEffect(() => {
    const q = quillRef.current
    if (q && q.root.innerHTML !== value && !q.root.contains(document.activeElement)) {
      q.root.innerHTML = value || ''
    }
  }, [value])

  return (
    <>
      <style>{`.quill-compact .ql-toolbar.ql-snow{border:1px solid #dadce0;border-bottom:1px solid #eef0f2;border-radius:8px 8px 0 0;padding:5px 6px;background:#fff}.quill-compact .ql-container.ql-snow{border:1px solid #dadce0;border-top:0;border-radius:0 0 8px 8px;font-family:inherit;font-size:14px;color:#202124}.quill-compact .ql-editor{min-height:76px;padding:10px 12px;line-height:1.6}.quill-compact .ql-editor.ql-blank::before{color:#9aa0a6;font-style:normal}.quill-compact:focus-within .ql-toolbar.ql-snow{border-color:#1a73e8}.quill-compact:focus-within .ql-container.ql-snow{border-color:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,.12)}`}</style>
      <div className="quill-compact">
        <div ref={holderRef} />
      </div>
    </>
  )
}
