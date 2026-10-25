'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Barcode, ChartBar, CheckCircle, Clock, Database, Gear, List, Minus, Package, Plus, Question, Receipt, ShoppingCart, Storefront, Trash, Users } from '@phosphor-icons/react'
import { cartItems, checkout, money, roles, type CartLine, type PosState, type Role, type Sale } from '@/lib/pos/model'
import { activatePosTab, resetPos, updatePos, usePosStore } from '@/lib/pos/store'
import { setPosTheme, usePosTheme, type PosTheme } from '@/lib/pos/theme'
import { email } from '../components/portfolio/data'
import { ManagementView, ReceiptView } from './pos-views'
import { Empty, Modal } from './pos-ui'
import { pageNames, rolePages, subtitles, type Page } from './navigation'
import s from './pos.module.css'

const navIcons: Partial<Record<Page, ReactNode>> = { pos: <ShoppingCart />, dashboard: <ChartBar />, products: <Package />, categories: <List />, transactions: <Receipt />, shift: <Clock />, users: <Users />, inventory: <Database />, settings: <Gear /> }
const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2)

export function PosApp() {
  const { state, ready, error: storageError, persisted, readOnly } = usePosStore()
  const { preference: theme, error: themeError } = usePosTheme()
  const [role, setRole] = useState<Role>('Kasir')
  const [page, setPage] = useState<Page>('pos')
  const [drawer, setDrawer] = useState(false)
  const [dialog, setDialog] = useState<'help' | 'reset' | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [message, setMessage] = useState('')
  function navigate(next: Page) { setPage(next); setDrawer(false); setMessage('') }
  function switchRole(next: Role) { setRole(next); navigate(rolePages[next][0]) }
  return <div className={s.workspace} data-theme={theme}>
    <a href="#pos-main" className={s.skipLink}>Lewati ke konten POS</a>
    <header className={s.topbar}>
      <button className={s.iconButton} onClick={() => setDrawer(true)} aria-label="Buka menu POS"><List size={24} /></button>
      <Link href="/aplikasi-pos" className={s.brand} aria-label="Project POS"><span className={s.brandMark}>P</span><span><strong>Project POS</strong><small>Point of Sale</small></span></Link>
      <div className={s.storeLabel}><Storefront size={20} /><span><small>Outlet contoh</small><strong>{state?.settings.name || 'TOKO SINAR JAYA'}</strong></span></div>
      <div className={s.topActions}><Link href="/menu" className={s.menuLink}><ArrowLeft size={16} /> Menu aplikasi</Link><button className={s.iconButton} onClick={() => setDialog('help')} aria-label="Panduan demo POS"><Question size={21} /></button><label className={`${s.roleSwitch} ${s.themeSwitch}`}><small>Tema</small><select aria-label="Tema tampilan" value={theme} onChange={event => setPosTheme(event.target.value as PosTheme)}><option value="system">Sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select></label><label className={s.roleSwitch}><small>Mode tampilan</small><select aria-label="Mode tampilan" value={role} onChange={event => switchRole(event.target.value as Role)}>{roles.map(value => <option key={value}>{value}</option>)}</select></label></div>
    </header>
    <div className={s.demoBar}><div><strong>Mode demo</strong><span>{ready && !persisted ? 'Mode sementara: penyimpanan browser tidak tersedia. Pembayaran disimulasikan.' : 'Data contoh tersimpan di browser ini. Seluruh pembayaran disimulasikan.'}</span></div><div><button disabled={readOnly} onClick={() => setDialog('reset')}>Reset demo</button><a href={`mailto:${email}?subject=Penerapan%20aplikasi%20POS`}>Hubungi untuk penerapan<ArrowRight size={15} /></a></div></div>
    {drawer && <Modal title={`Menu ${role}`} close={() => setDrawer(false)}><nav className={s.drawerNav} aria-label="Menu POS">{rolePages[role].map(key => <button key={key} className={page === key ? s.activeNav : ''} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}>{navIcons[key] || <Receipt />}<span>{pageNames[key]}</span>{page === key && <ArrowRight />}</button>)}</nav><p className={s.drawerNote}>Peran dapat diganti untuk menjelajahi fitur. Semua data hanya berada di perangkat ini.</p><Link className={s.drawerBack} href="/menu"><ArrowLeft size={18} /> Kembali ke menu aplikasi</Link></Modal>}
    <main id="pos-main" className={s.main}>
      <header className={s.heading}><div><p className={s.breadcrumb}>Beranda / {pageNames[page]}</p><h1>{pageNames[page]}</h1><p>{subtitles[page]}</p></div><button className={s.secondary} onClick={() => setDialog('help')}><Question size={18} /> Panduan halaman</button></header>
      {storageError && <div className={s.error} role="alert">{storageError}</div>}
      {themeError && <p className={s.warning} role="status">{themeError}</p>}
      {ready && readOnly && <div className={s.warning}><span>Mode baca: penyuntingan dilakukan dari satu tab pada satu waktu.</span><button onClick={activatePosTab}>Aktifkan tab ini</button></div>}
      {message && <p className={s.notice} role="status">{message}</p>}
      <fieldset disabled={readOnly} className={s.appFields}>{!ready || !state ? <div className={s.loading} role="status">Menyiapkan data POS di browser...</div> : page === 'pos' ? <Cashier state={state} cart={cart} setCart={setCart} openShift={() => navigate('shift')} /> : <ManagementView key={page} page={page} role={role} state={state} navigate={navigate} persisted={persisted} />}</fieldset>
    </main>
    <footer className={s.pageFooter}><span>Project POS · Showcase frontend</span><Link href="/">Portofolio Fadly</Link></footer>
    {dialog === 'help' && <Modal title={`Panduan ${pageNames[page]}`} close={() => setDialog(null)}><div className={s.formBody}><p>{page === 'pos' ? 'Cari nama atau SKU, pilih produk, lalu periksa jumlah di keranjang. Klik Bayar sekarang, isi uang diterima, dan selesaikan pembayaran simulasi. Struk bisa diunduh sebagai PDF.' : subtitles[page]}</p>{page === 'pos' && <p className={s.helper}>F2: fokus pencarian. F8: buka pembayaran. Escape: tutup dialog. Pencarian SKU dapat digunakan dengan pemindai yang mengetik seperti keyboard.</p>}<p>Ubah mode tampilan di kanan atas untuk membuka dashboard, produk, stok, shift, laporan, dan pengaturan toko. Data bertahan setelah refresh; gunakan Reset demo untuk mengembalikan contoh awal.</p><p className={s.helper}>Pemilihan peran memperagakan tampilan, bukan login atau pembatasan keamanan. Integrasi pembayaran dan perangkat dibahas saat penerapan.</p></div><footer className={s.formActions}><button className={s.primary} onClick={() => setDialog(null)}>Mengerti</button></footer></Modal>}
    {dialog === 'reset' && <Modal title="Kembalikan data contoh?" close={() => setDialog(null)}><div className={s.formBody}><p>Produk, transaksi, shift, pengguna, gambar, dan pengaturan POS di browser ini akan diganti dengan data contoh awal. Unduh laporan yang ingin disimpan sebelum melanjutkan.</p></div><footer className={s.formActions}><button className={s.secondary} onClick={() => setDialog(null)}>Batal</button><button className={s.danger} onClick={() => { resetPos(); setCart([]); setDialog(null); setMessage('Data contoh dikembalikan.'); navigate('pos'); setRole('Kasir') }}>Ya, reset demo</button></footer></Modal>}
  </div>
}

function Cashier({ state, cart, setCart, openShift }: { state: PosState; cart: CartLine[]; setCart: (value: CartLine[] | ((value: CartLine[]) => CartLine[])) => void; openShift: () => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [error, setError] = useState('')
  const [payment, setPayment] = useState<{ key: string; received: string } | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [sale, setSale] = useState<Sale | null>(null)
  const [scan, setScan] = useState(false)
  const [scanError, setScanError] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const payButton = useRef<HTMLButtonElement>(null)
  const paying = useRef(false)
  const currentShift = state.shifts.find(value => !value.closedAt)
  const items = cart.map(line => ({ ...line, product: state.products.find(value => value.id === line.productId) }))
  const total = items.reduce((sum, line) => sum + (line.product?.price || 0) * line.qty, 0)
  const count = cart.reduce((sum, line) => sum + line.qty, 0)
  const products = state.products.filter(product => product.active && (category === 'all' || product.categoryId === category) && `${product.name} ${product.sku}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')))
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (document.querySelector('dialog[open]')) return
      if (event.key === 'F2') { event.preventDefault(); search.current?.focus() }
      if (event.key === 'F8') { event.preventDefault(); payButton.current?.click() }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  function add(productId: string, delta = 1) {
    if (delta < 0) { setCart(previous => previous.map(line => line.productId === productId ? { ...line, qty: line.qty + delta } : line).filter(line => line.qty > 0)); setError(''); return }
    const product = state.products.find(value => value.id === productId)
    const existing = cart.find(line => line.productId === productId)?.qty || 0
    if (!product || !product.active) { setError('Produk tidak tersedia untuk penjualan.'); return }
    if (existing + delta > product.stock) { setError(`Stok ${product.name} hanya ${product.stock}. Kurangi jumlah atau pilih produk lain.`); return }
    setCart(previous => existing + delta <= 0 ? previous.filter(line => line.productId !== productId) : previous.some(line => line.productId === productId) ? previous.map(line => line.productId === productId ? { ...line, qty: line.qty + delta } : line) : [...previous, { productId, qty: delta }])
    setError('')
  }
  function startPayment() {
    try { cartItems(state, cart); if (!currentShift) throw Error('Buka shift kasir terlebih dahulu.'); setPaymentError(''); setPayment({ key: crypto.randomUUID(), received: String(total) }); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Periksa keranjang sebelum membayar.') }
  }
  function completePayment() {
    if (!payment || paying.current) return
    paying.current = true
    try {
      let completed: Sale | undefined
      updatePos(current => { const result = checkout(current, { key: payment.key, cart, received: Number(payment.received), cashier: current.shifts.find(shift => !shift.closedAt)?.cashier || 'Kasir', now: new Date().toISOString() }); completed = result.sale; return result.state })
      setCart([]); setPayment(null); setSale(completed!); setError(''); setPaymentError('')
    } catch (cause) { setPaymentError(cause instanceof Error ? cause.message : 'Transaksi belum selesai. Periksa input dan coba kembali.') }
    finally { paying.current = false }
  }
  if (sale) return <section className={`${s.panel} ${s.success}`}><CheckCircle size={52} weight="fill" aria-hidden="true" /><p className={s.eyebrow}>TRANSAKSI SIMULASI SELESAI</p><h2>Pembayaran berhasil</h2><p>Transaksi <strong>{sale.invoice}</strong> ditambahkan ke riwayat lokal.</p><ReceiptView sale={sale} /><button className={s.primary} onClick={() => { setSale(null); setQuery('') }}><Plus size={19} /> Transaksi baru</button></section>
  return <>
    <ol className={s.steps} aria-label="Tahapan transaksi">{['Pilih produk', 'Periksa keranjang', 'Pembayaran'].map((label, index) => { const active = payment ? 2 : cart.length ? 1 : 0; return <li key={label} data-state={index < active ? 'done' : index === active ? 'current' : 'next'} aria-current={index === active ? 'step' : undefined}><span>{index < active ? <CheckCircle size={18} /> : index + 1}</span><div><small>Langkah {index + 1}</small><strong>{label}</strong></div></li> })}</ol>
    {!currentShift && <div className={s.warning}><span>Shift kasir sudah ditutup. Buka shift untuk melanjutkan transaksi.</span><button onClick={openShift}>Buka shift kasir</button></div>}
    {error && <p className={s.error} role="alert">{error}</p>}
    <div className={s.posGrid}>
      <section className={`${s.panel} ${s.catalog}`} aria-label="Katalog produk"><div className={s.catalogTools}><label className={s.search}><span className={s.srOnly}>Cari nama produk atau SKU</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input ref={search} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama produk atau SKU" /><kbd>F2</kbd></label><button className={s.scanButton} onClick={() => { setScanError(''); setScan(true) }}><Barcode size={21} /> Scan SKU</button></div>
      <div className={s.categories} aria-label="Filter kategori"><button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Semua</button>{state.categories.map(value => <button key={value.id} aria-pressed={category === value.id} onClick={() => setCategory(value.id)}>{value.name}</button>)}</div>
      {products.length ? <div className={s.products}>{products.map((product, index) => <button className={s.product} key={product.id} disabled={product.stock === 0} onClick={() => add(product.id)} aria-label={`${product.name}, ${money(product.price)}, stok ${product.stock}`}><div className={s.productVisual} data-color={index % 4}>{product.image ? <Image src={product.image} alt="" fill unoptimized sizes="240px" /> : <span>{initials(product.name)}</span>}<small data-empty={product.stock === 0}>{product.stock ? `Stok ${product.stock}` : 'Stok habis'}</small></div><div className={s.productText}><small>{product.sku}</small><strong>{product.name}</strong><b>{money(product.price)}</b><span className={s.productAdd} aria-hidden="true"><Plus size={16} /></span></div></button>)}</div> : <Empty title="Produk tidak ditemukan" action={<button className={s.secondary} onClick={() => { setQuery(''); setCategory('all') }}>Hapus pencarian dan filter</button>}>{query ? `Tidak ada produk yang cocok dengan “${query}”.` : 'Kategori ini belum memiliki produk aktif.'}</Empty>}
      </section>
      <aside id="pos-cart" className={`${s.panel} ${s.cart}`} aria-label="Keranjang belanja"><header className={s.cartHeader}><div><small>PESANAN SAAT INI</small><h2>Keranjang <span>{count}</span></h2></div>{!!cart.length && <button className={s.textButton} onClick={() => { setCart([]); setError('') }}>Kosongkan</button>}</header>
        {!cart.length ? <Empty title="Keranjang masih kosong">Pilih produk untuk memulai transaksi.</Empty> : <ul className={s.cartItems}>{items.map(line => <li key={line.productId}><span className={s.itemInitial}>{initials(line.product?.name || 'Produk dihapus')}</span><div><strong>{line.product?.name || 'Produk dihapus'}</strong><small>{line.product?.sku} · {money(line.product?.price || 0)}</small><div className={s.quantity}><button onClick={() => add(line.productId, -1)} aria-label={`Kurangi ${line.product?.name}`}><Minus size={15} /></button><span>{line.qty}</span><button onClick={() => add(line.productId)} aria-label={`Tambah ${line.product?.name}`}><Plus size={15} /></button></div></div><div className={s.itemAmount}><button className={s.iconButton} onClick={() => { setCart(current => current.filter(value => value.productId !== line.productId)); setError('') }} aria-label={`Hapus ${line.product?.name || 'produk'}`}><Trash size={17} /></button><strong>{money((line.product?.price || 0) * line.qty)}</strong></div></li>)}</ul>}
        <footer className={s.cartFooter}><p className={s.cartTip}><Question size={17} /> Periksa jumlah produk sebelum melanjutkan.</p><div><span>Subtotal</span><strong>{money(total)}</strong></div><div><span>Diskon</span><strong>{money(0)}</strong></div><div className={s.cartTotal}><span>Total pembayaran</span><strong>{money(total)}</strong></div><button ref={payButton} className={s.primary} disabled={!cart.length || !currentShift} onClick={startPayment}><span>Bayar sekarang</span><span>{!!cart.length && money(total)} <ArrowRight size={18} /></span></button><small><kbd>F8</kbd> untuk pembayaran</small></footer>
      </aside>
    </div>
    {!!cart.length && <a className={s.mobileCartLink} href="#pos-cart"><span>Keranjang ({count})</span><span>{money(total)} <ArrowRight size={18} /></span></a>}
    {scan && <Modal title="Cari dengan SKU / barcode" close={() => setScan(false)}><form onSubmit={event => { event.preventDefault(); const sku = String(new FormData(event.currentTarget).get('sku')).trim().toUpperCase(); const product = state.products.find(value => value.active && value.sku.toUpperCase() === sku); if (!product) { setScanError('SKU tidak ditemukan. Periksa kode produk.'); return } if (product.stock <= (cart.find(line => line.productId === product.id)?.qty || 0)) { setScanError('Stok produk tidak cukup untuk ditambahkan.'); return } add(product.id); setScan(false) }}><div className={s.formBody}><p>Ketik kode produk atau gunakan pemindai yang memasukkan kode seperti keyboard.</p><label className={s.field}>SKU produk<input name="sku" required maxLength={40} autoFocus placeholder={state.products[0]?.sku || 'SKU produk'} /></label>{scanError && <p className={s.error} role="alert">{scanError}</p>}</div><footer className={s.formActions}><button className={s.secondary} type="button" onClick={() => setScan(false)}>Batal</button><button className={s.primary} type="submit">Tambahkan ke keranjang</button></footer></form></Modal>}
    {payment && <Modal title="Selesaikan pembayaran" close={() => { setPayment(null); setPaymentError('') }}><form onSubmit={event => { event.preventDefault(); completePayment() }}><div className={s.formBody}><p className={s.helper}>Pembayaran tunai simulasi. Tidak ada uang yang ditagihkan.</p><div className={s.amountDue}><span>Total pembayaran</span><strong>{money(total)}</strong></div><label className={s.field}>Uang diterima (Rp)<input inputMode="numeric" type="number" min={total} max="1000000000000" step="1" value={payment.received} onChange={event => setPayment({ ...payment, received: event.target.value })} required autoFocus /></label><div className={s.quickAmounts}>{[total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000].filter((value, index, all) => all.indexOf(value) === index).map(value => <button type="button" className={s.secondary} key={value} onClick={() => setPayment({ ...payment, received: String(value) })}>{value === total ? 'Uang pas' : money(value)}</button>)}</div><div className={s.change}><span>Kembalian</span><strong>{money(Math.max(0, Number(payment.received) - total))}</strong></div>{paymentError && <p className={s.error} role="alert">{paymentError}</p>}</div><footer className={s.formActions}><button type="button" className={s.secondary} onClick={() => setPayment(null)}>Kembali</button><button className={s.primary} type="submit" disabled={payment.received === '' || Number(payment.received) < total}>Selesaikan pembayaran</button></footer></form></Modal>}
  </>
}
