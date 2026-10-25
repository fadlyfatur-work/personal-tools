import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { webcrypto } from 'node:crypto'
const load = createRequire(import.meta.url)

const path = 'lib/pos/model.ts'
assert.ok(fs.existsSync(path), 'Model POS lokal belum tersedia')
const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const context = { exports: {}, require: load, console, Date, Error, crypto: webcrypto }
vm.runInNewContext(compiled, context)
const pos = context.exports
const now = '2026-10-25T07:30:00.000Z'
const seed = pos.createDemoState(now)
const original = JSON.stringify(seed)
const item = seed.products.find(product => product.sku === 'AIR-001')
const cart = [{ productId: item.id, qty: 2 }]
const saleInput = { key: 'test-payment', cart, received: 15000, cashier: 'Dewi Sartika', now }
const paid = pos.checkout(seed, saleInput)
assert.equal(paid.sale.total, 10000)
assert.equal(paid.sale.change, 5000)
assert.equal(paid.state.products.find(product => product.id === item.id).stock, item.stock - 2)
assert.equal(paid.state.sales.length, seed.sales.length + 1)
assert.equal(pos.latestSales(paid.state.sales)[0].id, paid.sale.id)
assert.equal(pos.latestSales(paid.state.sales)[1].id, seed.sales[0].id, 'History must be sorted by timestamp, not insertion order')
assert.equal(JSON.stringify(seed), original, 'Checkout must not mutate the caller snapshot')
assert.equal(pos.checkout(paid.state, saleInput).state.sales.length, paid.state.sales.length, 'Retry must not create another sale')
assert.throws(() => pos.checkout(seed, { ...saleInput, received: 9999 }), /kurang/)
assert.throws(() => pos.checkout(seed, { ...saleInput, cart: [] }), /kosong/)
assert.throws(() => pos.checkout(seed, { ...saleInput, cart: [{ productId: item.id, qty: item.stock + 1 }], received: 99999999 }), /Stok/)
assert.throws(() => pos.checkout(seed, { ...saleInput, cart: [{ productId: item.id, qty: -1 }] }), /jumlah/)
assert.throws(() => pos.checkout(seed, { ...saleInput, cart: [{ productId: item.id, qty: 0.5 }] }), /jumlah/)
assert.throws(() => pos.checkout(seed, { ...saleInput, cart: [{ productId: item.id, qty: 1 }, { productId: item.id, qty: item.stock }], received: 99999999 }), /Stok/)
assert.throws(() => pos.checkout(seed, { ...saleInput, received: Infinity }), /nominal/)
assert.throws(() => pos.checkout(seed, { ...saleInput, cart: [{ productId: 'missing', qty: 1 }] }), /tersedia/)
const inactive = { ...seed, products: seed.products.map(product => product.id === item.id ? { ...product, active: false } : product) }
assert.throws(() => pos.checkout(inactive, saleInput), /aktif/)
const edited = pos.saveProduct(seed, { ...item, name: 'Nama baru', price: 7000 }, now)
assert.equal(edited.categories[0].name, seed.categories[0].name)
assert.throws(() => pos.saveProduct(paid.state, { ...item, name: 'Nama dari form lama' }, now, item), /berubah/, 'A stale form must not restore sold stock')
assert.throws(() => pos.saveProduct(seed, { ...item, price: -1 }, now), /Harga/)
assert.throws(() => pos.saveProduct(seed, { ...item, stock: NaN }, now), /Stok/)
assert.throws(() => pos.saveProduct(seed, { ...item, id: 'duplicate' }, now), /SKU/)
assert.throws(() => pos.saveProduct(seed, { ...item, categoryId: 'missing' }, now), /Kategori/)
const paidThenEdited = pos.saveProduct(paid.state, { ...paid.state.products.find(product => product.id === item.id), name: 'Diubah', price: 8000 }, now)
assert.equal(paidThenEdited.sales.at(-1).items[0].name, 'Air Mineral')
assert.equal(paidThenEdited.sales.at(-1).items[0].price, 5000)
assert.ok(pos.parseStoredState(JSON.stringify(paidThenEdited)).sales.length > 0)
assert.throws(() => pos.parseStoredState('{broken'), /Data/)
assert.throws(() => pos.parseStoredState(JSON.stringify({ version: 999 })), /Data/)
assert.throws(() => pos.parseStoredState(JSON.stringify({ ...seed, products: [{ ...item, stock: -3 }] })), /Data/)
assert.throws(() => pos.deleteCategory(seed, item.categoryId, now), /digunakan/)
const categoryState = pos.saveCategory(seed, { id: 'cat-test', name: 'Kategori uji' }, now)
assert.equal(categoryState.products.length, seed.products.length)
assert.equal(categoryState.categories.length, seed.categories.length + 1)
const shift = seed.shifts.find(value => !value.closedAt)
const closed = pos.closeShift(paid.state, shift.id, 510000, now)
assert.equal(closed.shifts.find(value => value.id === shift.id).countedCash, 510000)
assert.throws(() => pos.checkout(closed, { ...saleInput, key: 'after-close' }), /shift/)
const reopened = pos.openShift(closed, 'Dewi Sartika', 200000, now)
assert.ok(reopened.shifts.some(value => !value.closedAt))
const pending = Array.from({ length: 99 }, (_, index) => ({ id: `pending-${index}`, productId: item.id, productName: item.name, expected: item.stock, counted: item.stock, status: 'pending', by: 'Gudang', createdAt: now }))
const countState = { ...seed, counts: [{ ...pending[0], id: 'resolved', status: 'rejected' }, ...pending] }
const nextCount = pos.requestCount(countState, item.id, 23, 'Gudang', now)
assert.equal(nextCount.counts.filter(value => value.status === 'pending').length, 100, 'Pending counts must never be trimmed as history')
console.log('POS: checkout, stock, idempotency, validation, snapshots, categories, persistence and shifts passed')

assert.ok(fs.existsSync('lib/pos/store.ts'), 'Penyimpanan browser POS belum tersedia')
function createStore(raw, blocked = false, writer = true) {
  const storage = new Map(raw ? [[pos.STORAGE_KEY, raw]] : [])
  const browser = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { if (blocked) throw Error('Quota'); storage.set(key, value) } },
    addEventListener() {}, removeEventListener() {},
    navigator: { locks: { request: (_key, _options, callback) => { callback(writer ? { name: pos.STORAGE_KEY } : null); return Promise.resolve() } } },
  }
  const storeContext = { exports: {}, console, Date, Error, window: browser, navigator: browser.navigator, localStorage: browser.localStorage,
    require: name => name === './model' ? pos : name === 'react' ? { useSyncExternalStore: (subscribe, get) => { subscribe(() => {}); return get() } } : load(name),
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/pos/store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, storeContext)
  return { store: storeContext.exports, storage }
}
const local = createStore(JSON.stringify(seed))
local.store.usePosStore()
local.store.updatePos(current => pos.saveCategory(current, { id: 'persistent-category', name: 'Persisten' }, now))
const reloaded = createStore(local.storage.get(pos.STORAGE_KEY))
assert.ok(reloaded.store.usePosStore().state.categories.some(category => category.id === 'persistent-category'))
const broken = createStore('{not-json')
assert.match(broken.store.usePosStore().error, /tidak dapat dibaca/)
broken.store.updatePos(current => pos.saveCategory(current, { id: 'memory', name: 'Memori' }, now))
assert.equal(broken.storage.get(pos.STORAGE_KEY), '{not-json', 'Corrupt storage must not be overwritten without reset')
const denied = createStore(JSON.stringify(seed), true)
denied.store.usePosStore()
denied.store.updatePos(current => pos.saveCategory(current, { id: 'temporary', name: 'Sementara' }, now))
assert.match(denied.store.usePosStore().error, /Penyimpanan/)
assert.ok(denied.store.usePosStore().state.categories.some(category => category.id === 'temporary'))
const otherTabState = pos.saveProduct(seed, { ...item, stock: 0 }, now)
local.storage.set(pos.STORAGE_KEY, JSON.stringify(otherTabState))
assert.throws(() => local.store.updatePos(current => pos.checkout(current, saleInput).state), /Stok/)
const follower = createStore(JSON.stringify(seed), false, false)
assert.equal(follower.store.usePosStore().readOnly, true)
assert.throws(() => follower.store.updatePos(current => pos.checkout(current, saleInput).state), /tab lain/)
console.log('POS: browser reload, corrupt data, quota failure and latest-tab stock passed')

assert.ok(fs.existsSync('lib/pos/pdf.ts'), 'Ekspor struk PDF browser belum tersedia')
async function checkPdf() {
  const pdfContext = { exports: {}, console, Error, Date, require: name => name === './model' ? pos : load(name) }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/pos/pdf.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, pdfContext)
  const fonts = { regular: fs.readFileSync('public/fonts/pos/Inconsolata-Regular.ttf').toString('base64'), bold: fs.readFileSync('public/fonts/pos/Inconsolata-Bold.ttf').toString('base64') }
  const receipt = await pdfContext.exports.createReceiptPdf(paid.sale, fonts)
  assert.equal(receipt.getNumberOfPages(), 1)
  assert.ok(Math.abs(receipt.internal.pageSize.getWidth() / (72 / 25.4) - 80) < 0.01)
  assert.equal(receipt.getFont().fontName, 'Receipt')
  fs.mkdirSync('.next/pos-checks', { recursive: true })
  fs.writeFileSync('.next/pos-checks/receipt.pdf', Buffer.from(receipt.output('arraybuffer')))
  const longSale = { ...paid.sale, items: Array.from({ length: 150 }, (_, index) => ({ ...paid.sale.items[0], productId: `long-${index}`, name: 'Produk dengan nama panjang untuk memeriksa pembungkusan teks pada struk thermal' })) }
  const longReceipt = await pdfContext.exports.createReceiptPdf(longSale, fonts)
  assert.ok(longReceipt.getNumberOfPages() > 1, 'Long receipts must paginate instead of clipping')
  const shortNames = { ...paid.sale, items: Array.from({ length: 85 }, (_, index) => ({ ...paid.sale.items[0], productId: `short-${index}`, name: `Barang ${index}` })) }
  const shortLastPage = await pdfContext.exports.createReceiptPdf(shortNames, fonts)
  for (let page = 1; page <= shortLastPage.getNumberOfPages(); page++) {
    shortLastPage.setPage(page)
    assert.ok(Math.abs(shortLastPage.internal.pageSize.getWidth() / (72 / 25.4) - 80) < 0.01, 'Every continuation page must stay 80 mm wide')
  }
  fs.writeFileSync('.next/pos-checks/receipt-long.pdf', Buffer.from(longReceipt.output('arraybuffer')))
  const report = await pdfContext.exports.createReportPdf(seed.settings, paid.state.sales, '2026-10-01', '2026-10-25', fonts)
  assert.ok(report.getNumberOfPages() >= 1)
  fs.writeFileSync('.next/pos-checks/report.pdf', Buffer.from(report.output('arraybuffer')))
  console.log('POS: receipt 80 mm, embedded fonts, long receipt pagination and report PDF passed')
}
checkPdf().catch(error => { console.error(error); process.exitCode = 1 })
