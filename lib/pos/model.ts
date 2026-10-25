import { z } from 'zod'

export const STORAGE_KEY = 'personal-tools-pos-v1'
export const roles = ['Kasir', 'Supervisor', 'Staff Gudang', 'Admin', 'Owner', 'Super Admin'] as const
export type Role = typeof roles[number]
const amount = z.number().int().min(0).max(1_000_000_000)
const totalAmount = z.number().int().min(0).max(1_000_000_000_000)
const id = z.string().min(1).max(100)
const name = z.string().trim().min(1).max(120)
const timestamp = z.string().max(40).refine(value => Number.isFinite(Date.parse(value)))
const categorySchema = z.object({ id, name })
const productSchema = z.object({ id, name, sku: z.string().trim().min(1).max(40), categoryId: id, price: amount, stock: amount, minStock: amount, active: z.boolean(), image: z.string().max(200_000).regex(/^$|^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).optional() })
const settingsSchema = z.object({ name, address: z.string().max(240), phone: z.string().max(60) })
const saleItemSchema = z.object({ productId: id, name, sku: z.string().max(40), qty: z.number().int().min(1).max(1_000_000_000), price: amount })
const saleSchema = z.object({ id, key: id, invoice: z.string().max(80), createdAt: timestamp, cashier: name, shiftId: id, items: z.array(saleItemSchema).min(1).max(500), total: totalAmount, received: totalAmount, change: totalAmount, store: settingsSchema })
const shiftSchema = z.object({ id, cashier: name, openedAt: timestamp, openingCash: totalAmount, closedAt: timestamp.optional(), countedCash: totalAmount.optional() })
const movementSchema = z.object({ id, productId: id, name, before: amount, after: amount, reason: z.string().min(1).max(200), createdAt: timestamp })
const countSchema = z.object({ id, productId: id, productName: name, expected: amount, counted: amount, status: z.enum(['pending', 'approved', 'rejected']), by: name, createdAt: timestamp })
const userSchema = z.object({ id, name, email: z.email().max(160), role: z.enum(roles), active: z.boolean() })
const activitySchema = z.object({ id, message: z.string().max(300), createdAt: timestamp })
export const stateSchema = z.object({ version: z.literal(1), revision: z.number().int().min(0), categories: z.array(categorySchema).min(1).max(100), products: z.array(productSchema).max(500), sales: z.array(saleSchema).max(1000), shifts: z.array(shiftSchema).max(100), movements: z.array(movementSchema).max(500), counts: z.array(countSchema).max(100), users: z.array(userSchema).max(100), settings: settingsSchema, activity: z.array(activitySchema).max(250) })
export type PosState = z.infer<typeof stateSchema>
export type Product = z.infer<typeof productSchema>
export type Category = z.infer<typeof categorySchema>
export type Sale = z.infer<typeof saleSchema>
export type Shift = z.infer<typeof shiftSchema>
export type PosUser = z.infer<typeof userSchema>
export type Settings = z.infer<typeof settingsSchema>
export type CartLine = { productId: string; qty: number }
export const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
export const dateKey = (value: string | Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
export const dateTime = (value: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export const latestSales = (sales: Sale[]) => [...sales].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
const uid = () => crypto.randomUUID()

function changed(state: PosState, message: string, now: string): PosState {
  return { ...state, revision: state.revision + 1, activity: [{ id: uid(), message, createdAt: now }, ...state.activity].slice(0, 250) }
}

export function createDemoState(now = new Date().toISOString()): PosState {
  const categories = [{ id: 'minuman', name: 'Minuman' }, { id: 'makanan', name: 'Makanan' }, { id: 'rumah', name: 'Kebutuhan Rumah' }]
  const products: Product[] = [
    { id: 'air', sku: 'AIR-001', name: 'Air Mineral', price: 5000, stock: 23, minStock: 10, categoryId: 'minuman', active: true },
    { id: 'kopi', sku: 'KOPI-001', name: 'Kopi Susu', price: 18000, stock: 18, minStock: 8, categoryId: 'minuman', active: true },
    { id: 'roti', sku: 'ROTI-001', name: 'Roti Cokelat', price: 12000, stock: 9, minStock: 10, categoryId: 'makanan', active: true },
    { id: 'teh', sku: 'TEH-001', name: 'Teh Melati', price: 6000, stock: 32, minStock: 8, categoryId: 'minuman', active: true },
    { id: 'biskuit', sku: 'BISK-001', name: 'Biskuit Kelapa', price: 8500, stock: 15, minStock: 6, categoryId: 'makanan', active: true },
    { id: 'mie', sku: 'MIE-001', name: 'Mi Instan Goreng', price: 3500, stock: 41, minStock: 12, categoryId: 'makanan', active: true },
    { id: 'gula', sku: 'GULA-001', name: 'Gula Pasir 1 kg', price: 17000, stock: 0, minStock: 6, categoryId: 'rumah', active: true },
    { id: 'sabun', sku: 'SAB-001', name: 'Sabun Cuci Piring', price: 14000, stock: 11, minStock: 5, categoryId: 'rumah', active: true },
  ]
  const settings = { name: 'TOKO SINAR JAYA', address: '[Alamat toko, kota]', phone: '[Nomor telepon toko]' }
  const sales: Sale[] = Array.from({ length: 9 }, (_, index) => {
    const createdAt = new Date(new Date(now).getTime() - (index + 1) * 86_400_000).toISOString()
    const product = products[index % 6]
    const qty = index % 3 + 1
    const total = qty * product.price
    return { id: `sale-example-${index}`, key: `example-${index}`, invoice: `POS/${dateKey(createdAt).replaceAll('-', '')}/${String(index + 1).padStart(4, '0')}`, createdAt, cashier: index % 2 ? 'Raka Putra' : 'Dewi Sartika', shiftId: 'history', items: [{ productId: product.id, name: product.name, sku: product.sku, qty, price: product.price }], total, received: Math.ceil(total / 10000) * 10000, change: Math.ceil(total / 10000) * 10000 - total, store: { ...settings } }
  })
  return { version: 1, revision: 0, categories, products, settings, sales, movements: [], counts: [], shifts: [{ id: 'shift-active', cashier: 'Dewi Sartika', openedAt: now, openingCash: 500000 }], users: [
    { id: 'u-dewi', name: 'Dewi Sartika', email: 'dewi@example.com', role: 'Kasir', active: true },
    { id: 'u-raka', name: 'Raka Putra', email: 'raka@example.com', role: 'Kasir', active: true },
    { id: 'u-nadia', name: 'Nadia Yusuf', email: 'nadia@example.com', role: 'Supervisor', active: true },
    { id: 'u-bima', name: 'Bima Pratama', email: 'bima@example.com', role: 'Staff Gudang', active: true },
    { id: 'u-admin', name: 'Admin Utama', email: 'admin@example.com', role: 'Admin', active: true },
  ], activity: [{ id: 'initial', message: 'Data contoh dibuat di browser ini.', createdAt: now }] }
}

export function parseStoredState(raw: string): PosState {
  try {
    if (raw.length > 8_000_000) throw Error()
    const state = stateSchema.parse(JSON.parse(raw))
    for (const collection of [state.products, state.categories, state.sales, state.shifts, state.users, state.movements, state.counts]) {
      if (new Set(collection.map(value => value.id)).size !== collection.length) throw Error()
    }
    if (state.products.some(product => !state.categories.some(category => category.id === product.categoryId))) throw Error()
    if (new Set(state.products.map(product => product.sku.toUpperCase())).size !== state.products.length) throw Error()
    if (new Set(state.sales.map(sale => sale.key)).size !== state.sales.length) throw Error()
    if (state.shifts.filter(shift => !shift.closedAt).length > 1) throw Error()
    if (state.sales.some(sale => sale.items.reduce((sum, item) => sum + item.qty * item.price, 0) !== sale.total || sale.received - sale.total !== sale.change)) throw Error()
    return state
  } catch { throw Error('Data POS di browser tidak dapat dibaca. Gunakan Reset demo untuk memulai kembali; data lama tidak ditimpa otomatis.') }
}

export function cartItems(state: PosState, cart: CartLine[]) {
  if (!cart.length) throw Error('Keranjang masih kosong.')
  const quantities = new Map<string, number>()
  for (const line of cart) {
    if (!Number.isSafeInteger(line.qty) || line.qty <= 0) throw Error('Periksa jumlah barang di keranjang.')
    quantities.set(line.productId, (quantities.get(line.productId) || 0) + line.qty)
  }
  return [...quantities].map(([productId, qty]) => {
    const product = state.products.find(value => value.id === productId)
    if (!product) throw Error('Produk tidak tersedia. Hapus dari keranjang dan pilih kembali.')
    if (!product.active) throw Error(`${product.name} tidak aktif. Hapus dari keranjang.`)
    if (qty > product.stock) throw Error(`Stok ${product.name} hanya ${product.stock}. Kurangi jumlah barang.`)
    return { productId, name: product.name, sku: product.sku, qty, price: product.price }
  })
}

export function checkout(state: PosState, input: { key: string; cart: CartLine[]; received: number; cashier: string; now: string }): { state: PosState; sale: Sale } {
  const existing = state.sales.find(sale => sale.key === input.key)
  if (existing) return { state, sale: existing }
  if (state.sales.length >= 1000) throw Error('Batas demo 1.000 transaksi tercapai. Ekspor laporan lalu reset demo.')
  const shift = state.shifts.find(value => !value.closedAt)
  if (!shift) throw Error('Buka shift kasir sebelum membuat transaksi.')
  const items = cartItems(state, input.cart)
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0)
  if (!Number.isSafeInteger(input.received) || input.received < 0 || input.received > 1_000_000_000_000 || !Number.isSafeInteger(total) || total > 1_000_000_000_000) throw Error('Periksa nominal pembayaran; gunakan angka rupiah yang valid.')
  if (input.received < total) throw Error('Uang diterima masih kurang dari total pembayaran.')
  if (!input.key || input.key.length > 100 || !input.cashier.trim()) throw Error('Identitas transaksi tidak valid. Buka ulang pembayaran.')
  const sequence = state.sales.filter(sale => dateKey(sale.createdAt) === dateKey(input.now)).length + 1
  const sale: Sale = { id: uid(), key: input.key, invoice: `POS/${dateKey(input.now).replaceAll('-', '')}/${String(sequence).padStart(4, '0')}`, createdAt: input.now, cashier: input.cashier, shiftId: shift.id, items, total, received: input.received, change: input.received - total, store: { ...state.settings } }
  const products = state.products.map(product => ({ ...product, stock: product.stock - (items.find(item => item.productId === product.id)?.qty || 0) }))
  const movements = items.map(item => { const before = state.products.find(product => product.id === item.productId)!.stock; return { id: uid(), productId: item.productId, name: item.name, before, after: before - item.qty, reason: `Penjualan ${sale.invoice}`, createdAt: input.now } })
  return { sale, state: changed({ ...state, products, sales: [...state.sales, sale], movements: [...movements, ...state.movements].slice(0, 500) }, `Transaksi ${sale.invoice} selesai (simulasi).`, input.now) }
}

export function saveProduct(state: PosState, input: Product, now: string, baseline?: Product): PosState {
  if (baseline && JSON.stringify(state.products.find(product => product.id === baseline.id)) !== JSON.stringify(baseline)) throw Error('Produk berubah sejak form dibuka. Tutup form lalu buka kembali agar stok dan harga terbaru tidak tertimpa.')
  if (!Number.isSafeInteger(input.price) || input.price < 0 || input.price > 1_000_000_000) throw Error('Harga harus berupa rupiah bulat antara 0 dan 1 miliar.')
  if (!Number.isSafeInteger(input.stock) || input.stock < 0 || input.stock > 1_000_000_000 || !Number.isSafeInteger(input.minStock) || input.minStock < 0) throw Error('Stok dan stok minimum harus berupa bilangan bulat nonnegatif.')
  const result = productSchema.safeParse({ ...input, name: input.name.trim(), sku: input.sku.trim().toUpperCase() })
  if (!result.success) throw Error('Lengkapi nama, SKU, kategori, dan angka produk dengan benar.')
  const product = result.data
  if (!state.categories.some(category => category.id === product.categoryId)) throw Error('Kategori tidak tersedia.')
  if (state.products.some(value => value.id !== product.id && value.sku.toUpperCase() === product.sku)) throw Error('SKU sudah digunakan produk lain.')
  const previous = state.products.find(value => value.id === product.id)
  if (!previous && state.products.length >= 500) throw Error('Batas demo 500 produk tercapai.')
  const movements = previous && previous.stock !== product.stock ? [{ id: uid(), productId: product.id, name: product.name, before: previous.stock, after: product.stock, reason: 'Penyesuaian dari master produk', createdAt: now }, ...state.movements].slice(0, 500) : state.movements
  return changed({ ...state, products: previous ? state.products.map(value => value.id === product.id ? product : value) : [...state.products, product], movements }, `${previous ? 'Mengubah' : 'Menambah'} produk ${product.name}.`, now)
}

export function deleteProduct(state: PosState, productId: string, now: string): PosState {
  return changed({ ...state, products: state.products.filter(product => product.id !== productId) }, 'Menghapus produk dari katalog; struk lama tetap tersedia.', now)
}

export function saveCategory(state: PosState, input: Category, now: string): PosState {
  const result = categorySchema.safeParse({ ...input, name: input.name.trim() })
  if (!result.success) throw Error('Nama kategori wajib diisi, maksimal 120 karakter.')
  const category = result.data
  if (state.categories.some(value => value.id !== category.id && value.name.toLowerCase() === category.name.toLowerCase())) throw Error('Nama kategori sudah digunakan.')
  const exists = state.categories.some(value => value.id === category.id)
  if (!exists && state.categories.length >= 100) throw Error('Batas demo 100 kategori tercapai.')
  return changed({ ...state, categories: exists ? state.categories.map(value => value.id === category.id ? category : value) : [...state.categories, category] }, `Menyimpan kategori ${category.name}.`, now)
}

export function deleteCategory(state: PosState, categoryId: string, now: string): PosState {
  if (state.products.some(product => product.categoryId === categoryId)) throw Error('Kategori masih digunakan produk. Pindahkan produk ke kategori lain terlebih dahulu.')
  if (state.categories.length <= 1) throw Error('Sediakan setidaknya satu kategori.')
  return changed({ ...state, categories: state.categories.filter(value => value.id !== categoryId) }, 'Menghapus kategori.', now)
}

export function saveUser(state: PosState, input: PosUser, now: string): PosState {
  const result = userSchema.safeParse({ ...input, name: input.name.trim(), email: input.email.trim().toLowerCase() })
  if (!result.success) throw Error('Lengkapi nama dan email yang valid serta peran pengguna.')
  if (state.users.some(user => user.id !== input.id && user.email.toLowerCase() === result.data.email)) throw Error('Email sudah digunakan pengguna lain.')
  const exists = state.users.some(user => user.id === input.id)
  if (!exists && state.users.length >= 100) throw Error('Batas demo 100 pengguna tercapai.')
  return changed({ ...state, users: exists ? state.users.map(user => user.id === input.id ? result.data : user) : [...state.users, result.data] }, `Menyimpan pengguna contoh ${result.data.name}.`, now)
}

export function deleteUser(state: PosState, userId: string, now: string) {
  return changed({ ...state, users: state.users.filter(user => user.id !== userId) }, 'Menghapus pengguna contoh.', now)
}

export function saveSettings(state: PosState, input: Settings, now: string) {
  const result = settingsSchema.safeParse({ name: input.name.trim(), address: input.address.trim(), phone: input.phone.trim() })
  if (!result.success) throw Error('Nama toko wajib diisi. Periksa panjang alamat dan nomor telepon.')
  return changed({ ...state, settings: result.data }, 'Mengubah pengaturan toko untuk transaksi berikutnya.', now)
}

export function shiftExpected(state: PosState, shift: Shift) {
  return shift.openingCash + state.sales.filter(sale => sale.shiftId === shift.id).reduce((sum, sale) => sum + sale.total, 0)
}

export function closeShift(state: PosState, shiftId: string, countedCash: number, now: string): PosState {
  if (!totalAmount.safeParse(countedCash).success) throw Error('Uang terhitung harus berupa nominal rupiah valid.')
  const shift = state.shifts.find(value => value.id === shiftId)
  if (!shift || shift.closedAt) throw Error('Shift sudah ditutup atau tidak tersedia.')
  return changed({ ...state, shifts: state.shifts.map(value => value.id === shiftId ? { ...value, countedCash, closedAt: now } : value) }, `Menutup shift ${shift.cashier}. Selisih ${money(countedCash - shiftExpected(state, shift))}.`, now)
}

export function openShift(state: PosState, cashier: string, openingCash: number, now: string): PosState {
  if (state.shifts.some(value => !value.closedAt)) throw Error('Tutup shift aktif sebelum membuka shift baru.')
  if (!totalAmount.safeParse(openingCash).success || !cashier.trim()) throw Error('Isi nama kasir dan modal awal yang valid.')
  return changed({ ...state, shifts: [...state.shifts.slice(-99), { id: uid(), cashier: cashier.trim(), openedAt: now, openingCash }] }, `Membuka shift ${cashier.trim()}.`, now)
}

export function requestCount(state: PosState, productId: string, counted: number, by: string, now: string): PosState {
  const product = state.products.find(value => value.id === productId)
  if (!product || !amount.safeParse(counted).success) throw Error('Pilih produk dan jumlah fisik yang valid.')
  if (state.counts.filter(count => count.status === 'pending').length >= 100) throw Error('Selesaikan persetujuan opname yang masih menunggu.')
  const count = { id: uid(), productId, productName: product.name, expected: product.stock, counted, by, status: 'pending' as const, createdAt: now }
  const pending = state.counts.filter(value => value.status === 'pending')
  const resolved = state.counts.filter(value => value.status !== 'pending')
  return changed({ ...state, counts: [count, ...pending, ...resolved].slice(0, 100) }, `Mengajukan opname ${product.name}: ${counted} item.`, now)
}

export function resolveCount(state: PosState, countId: string, approved: boolean, now: string): PosState {
  const count = state.counts.find(value => value.id === countId)
  if (!count || count.status !== 'pending') throw Error('Opname sudah diproses atau tidak tersedia.')
  const product = state.products.find(value => value.id === count.productId)
  if (approved && (!product || product.stock !== count.expected)) throw Error('Stok berubah sejak opname dibuat. Tolak pengajuan ini lalu hitung ulang.')
  const movements = approved && product ? [{ id: uid(), productId: product.id, name: product.name, before: product.stock, after: count.counted, reason: 'Persetujuan stock opname', createdAt: now }, ...state.movements].slice(0, 500) : state.movements
  return changed({ ...state, products: approved ? state.products.map(value => value.id === count.productId ? { ...value, stock: count.counted } : value) : state.products, counts: state.counts.map(value => value.id === countId ? { ...value, status: approved ? 'approved' : 'rejected' } : value), movements }, `${approved ? 'Menyetujui' : 'Menolak'} opname ${count.productName}.`, now)
}
