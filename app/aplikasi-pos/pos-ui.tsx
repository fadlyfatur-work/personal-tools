'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import NextImage from 'next/image'
import { X, MagnifyingGlass, Package } from '@phosphor-icons/react'
import type { Category, PosUser, Product, Role, Settings } from '@/lib/pos/model'
import s from './pos.module.css'

export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    dialog.querySelector<HTMLElement>('input:not([type="file"]), select, textarea')?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow }
  }, [])
  return <dialog ref={ref} className={`${s.dialog} ${wide ? s.wideDialog : ''}`} aria-labelledby="pos-dialog-title" onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className={s.dialogSurface}><header className={s.dialogHeader}><h2 id="pos-dialog-title">{title}</h2><button type="button" className={s.iconButton} onClick={close} aria-label="Tutup dialog"><X size={20} /></button></header>{children}</div>
  </dialog>
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className={s.empty}><Package size={32} aria-hidden="true" /><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>
}

export function Table({ headers, rows, empty = 'Belum ada data untuk ditampilkan.' }: { headers: string[]; rows: { key: string; cells: ReactNode[] }[]; empty?: string }) {
  return rows.length ? <div className={s.tableScroll} role="region" aria-label="Tabel data, geser untuk melihat kolom lainnya" tabIndex={0}><table className={s.table}><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div> : <Empty title={empty} />
}

export function Search({ value, change, placeholder = 'Cari data...', label = 'Cari data' }: { value: string; change: (value: string) => void; placeholder?: string; label?: string }) {
  return <label className={s.search}><MagnifyingGlass size={19} aria-hidden="true" /><input aria-label={label} value={value} onChange={event => change(event.target.value)} placeholder={placeholder} type="search" /></label>
}

export function Status({ children, kind = 'good' }: { children: ReactNode; kind?: 'good' | 'warning' | 'muted' | 'bad' }) {
  return <span className={s.status} data-kind={kind}>{children}</span>
}

function FormActions({ close, label = 'Simpan perubahan' }: { close: () => void; label?: string }) {
  return <footer className={s.formActions}><button type="button" className={s.secondary} onClick={close}>Batal</button><button type="submit" className={s.primary}>{label}</button></footer>
}

export function ProductForm({ product, categories, save, close }: { product?: Product; categories: Category[]; save: (value: Product) => string | void; close: () => void }) {
  const [error, setError] = useState('')
  const [image, setImage] = useState(product?.image || '')
  const [reading, setReading] = useState(false)
  async function selectImage(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Gunakan JPG, PNG, atau WebP maksimal 2 MB.'); return }
    setReading(true)
    let url = ''
    try {
      url = URL.createObjectURL(file)
      const picture = new Image()
      picture.src = url
      await picture.decode()
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 300 / Math.max(picture.width, picture.height))
      canvas.width = Math.max(1, Math.round(picture.width * scale))
      canvas.height = Math.max(1, Math.round(picture.height * scale))
      const context = canvas.getContext('2d')!
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(picture, 0, 0, canvas.width, canvas.height)
      const encoded = canvas.toDataURL('image/jpeg', 0.7)
      if (encoded.length > 200000) throw Error()
      setImage(encoded); setError('')
    } catch { setError('Gambar tidak dapat dibaca. Coba file lain yang lebih kecil.') }
    finally { if (url) URL.revokeObjectURL(url); setReading(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const message = save({ id: product?.id || crypto.randomUUID(), name: String(form.get('name')), sku: String(form.get('sku')), categoryId: String(form.get('categoryId')), price: Number(form.get('price')), stock: Number(form.get('stock')), minStock: Number(form.get('minStock')), active: form.get('active') === 'true', image })
    if (message) setError(message)
  }
  return <form onSubmit={submit}><div className={s.formBody}>
    <p className={s.helper}>Perubahan disimpan di browser ini dan langsung dipakai pada katalog kasir.</p>
    <div className={s.productForm}><div className={s.upload}><div className={s.imagePreview}>{image ? <NextImage src={image} alt="Pratinjau produk" width={300} height={300} unoptimized /> : <><Package size={36} /><span>Gambar produk</span></>}</div><label className={s.secondary}>Pilih gambar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void selectImage(event.target.files?.[0])} /></label>{image && <button className={s.textButton} type="button" onClick={() => setImage('')}>Hapus gambar</button>}<small>JPG, PNG, WebP. Maksimal 2 MB.</small></div>
    <div className={s.fields}>
      <label>Nama produk<input name="name" required maxLength={120} defaultValue={product?.name} autoFocus /></label>
      <label>SKU / barcode<input name="sku" required maxLength={40} defaultValue={product?.sku} /></label>
      <label>Kategori<select name="categoryId" defaultValue={product?.categoryId || categories[0]?.id}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Harga jual (Rp)<input name="price" type="number" min="0" max="1000000000" step="1" required defaultValue={product?.price} /></label>
      <label>Stok tersedia<input name="stock" type="number" min="0" max="1000000000" step="1" required defaultValue={product?.stock ?? 0} /></label>
      <label>Stok minimum<input name="minStock" type="number" min="0" max="1000000000" step="1" required defaultValue={product?.minStock ?? 5} /></label>
      <label>Status<select name="active" defaultValue={String(product?.active ?? true)}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
    </div></div>{reading && <p role="status">Menyiapkan gambar...</p>}{error && <p className={s.error} role="alert">{error}</p>}
    </div><footer className={s.formActions}><button type="button" className={s.secondary} onClick={close}>Batal</button><button type="submit" className={s.primary} disabled={reading}>{product ? 'Simpan produk' : 'Tambah produk'}</button></footer></form>
}

export function CategoryForm({ category, save, close }: { category?: Category; save: (value: Category) => string | void; close: () => void }) {
  const [error, setError] = useState('')
  return <form onSubmit={event => { event.preventDefault(); const message = save({ id: category?.id || crypto.randomUUID(), name: String(new FormData(event.currentTarget).get('name')) }); if (message) setError(message) }}><div className={s.formBody}><div className={s.fields}><label>Nama kategori<input name="name" required maxLength={120} defaultValue={category?.name} autoFocus /></label></div>{error && <p className={s.error} role="alert">{error}</p>}</div><FormActions close={close} label="Simpan kategori" /></form>
}

export function UserForm({ user, allowed, save, close }: { user?: PosUser; allowed: Role[]; save: (value: PosUser) => string | void; close: () => void }) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const message = save({ id: user?.id || crypto.randomUUID(), name: String(data.get('name')), email: String(data.get('email')), role: String(data.get('role')) as Role, active: data.get('active') === 'true' })
    if (message) setError(message)
  }
  return <form onSubmit={submit}><div className={s.formBody}><p className={s.helper}>Pengguna contoh hanya untuk memperagakan pengelolaan peran. Form ini tidak membuat akun login.</p><div className={s.fields}><label>Nama lengkap<input name="name" required maxLength={120} defaultValue={user?.name} autoFocus /></label><label>Email<input type="email" name="email" required maxLength={160} defaultValue={user?.email} /></label><label>Peran<select name="role" defaultValue={user?.role || allowed[0]}>{allowed.map(role => <option key={role}>{role}</option>)}</select></label><label>Status<select name="active" defaultValue={String(user?.active ?? true)}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label></div>{error && <p className={s.error} role="alert">{error}</p>}</div><FormActions close={close} label="Simpan pengguna" /></form>
}

export function SettingsForm({ settings, save }: { settings: Settings; save: (value: Settings) => string | void }) {
  const [message, setMessage] = useState('')
  return <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const error = save({ name: String(data.get('name')), address: String(data.get('address')), phone: String(data.get('phone')) }); setMessage(error || 'Pengaturan toko diperbarui. Struk transaksi lama tetap memakai identitas toko saat transaksi dibuat.') }}><div className={s.fields}><label>Nama toko<input name="name" defaultValue={settings.name} required maxLength={120} /></label><label>Telepon toko<input name="phone" defaultValue={settings.phone} maxLength={60} /></label><label className={s.fullField}>Alamat toko<textarea name="address" defaultValue={settings.address} maxLength={240} rows={3} /></label></div>{message && <p className={s.notice} role="status">{message}</p>}<button className={s.primary} type="submit">Simpan pengaturan toko</button></form>
}
