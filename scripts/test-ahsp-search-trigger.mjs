import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const core = { exports: {} }
vm.runInNewContext(compile('lib/ahsp.ts'), core)
let stateIndex = 0, effectIndex = 0
const states = [], effects = [], jobs = [], requests = []
const clipboardWrites = []
let clipboardFailure = false
let catalogueFailure = false
const sampleItem = { id: 'job-1', code: '1.22.(7a)', name: 'Rambu Petunjuk', field: 'SMKK', division: 'Komponen 7', unit: 'Buah', ahsp_type: 'Informatif', regulation: 'SE 47/2026', sipasti_status: 'both', analysis_status: 'extracted', source_id: null, page_from: 43, page_to: 43, components: [], output_quantity: 1, overhead_min: 0, overhead_max: 0 }
const sampleLegacyVersion = { ...sampleItem, id: 'job-legacy', code: '', unit: 'bh', regulation: 'PERMEN 08/2023', ahsp_type: 'Normatif', analysis_status: 'unavailable', sipasti_status: 'sipasti_only', page_from: null, page_to: null }
sampleItem.versions = [{ ...sampleItem }, sampleLegacyVersion]
const sampleSources = [{ id: '10899', title: 'SMKK SE 47/2026', annex: 'Lampiran V', url: 'https://example.test/se47' }, { id: 'permen08-2023', title: 'Permen 8/2023', annex: 'Pedoman dasar', url: 'https://example.test/permen08' }]
let sampleReferenceTarget = null, sampleReferenceReady = false
const react = {
  useState(initial) {
    const index = stateIndex++
    if (!(index in states)) states[index] = initial
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
  },
  useRef(initial) { return react.useState({ current: initial })[0] },
  useEffect(callback, deps) {
    const index = effectIndex++, previous = effects[index]
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      previous?.cleanup?.()
      effects[index] = { deps, cleanup: callback() }
    }
  },
}
const jsx = (type, props) => ({ type, props })
const dummy = { default: () => null }
const imports = {
  react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': dummy,
  '@phosphor-icons/react': { Check: () => null, Copy: () => null, WarningCircle: () => null },
  '@/lib/ahsp': core.exports,
  './catalog.module.css': { default: new Proxy({}, { get: (_, key) => key }) },
  './manual-analysis': dummy, './source-pages': dummy, './search-summary': dummy, './initial-preloader': { default: function InitialPreloader() {} },
}
const catalogModule = { exports: {} }
vm.runInNewContext(compile('app/ahsp/catalog.tsx'), {
  exports: catalogModule.exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] },
  AbortController, URLSearchParams, console, requestAnimationFrame: () => 0,
  navigator: { clipboard: { writeText: async value => { if (clipboardFailure) throw new Error('Clipboard permission denied'); clipboardWrites.push(value) } } },
  document: { body: { style: { overflow: '' } } },
  setTimeout: (callback, delay) => { const job = { callback, delay, canceled: false }; jobs.push(job); return job },
  clearTimeout: job => { job.canceled = true },
  fetch: async url => {
    requests.push(new URL(url, 'http://localhost').searchParams)
    if (catalogueFailure) return { ok: false, json: async () => ({ error: 'Katalog gagal dimuat untuk uji.' }) }
    const legacy = new URL(url, 'http://localhost').searchParams.get('id') === 'job-legacy'
    return { ok: true, json: async () => ({ item: legacy ? sampleLegacyVersion : sampleItem, reference_target: legacy ? null : sampleReferenceTarget, reference_ready: legacy ? false : sampleReferenceReady, items: [sampleItem], total: 42, search_stats: { input_count: 0 }, options: { total: 6129, version_total: 11541, sources: sampleSources, fields: ['SMKK', 'Umum'], field_counts: [{ field: 'SMKK', count: 149 }, { field: 'Umum', count: 249 }], divisions: [], units: ['Buah'] } }) }
  },
})
const render = () => { stateIndex = 0; effectIndex = 0; return catalogModule.exports.default() }
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value?.props ? [value, ...nodes(value.props.children)] : []
const text = value => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const find = (tree, predicate) => { const node = nodes(tree).find(predicate); assert.ok(node, 'Expected control is rendered'); return node }
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node).trim() === label)
const field = (tree, label) => find(find(tree, node => node.type === 'label' && text(node).trim().startsWith(label)), node => node.type === 'select')
const drain = async () => { for (const job of jobs.splice(0)) if (!job.canceled) await job.callback() }
let tree = render()
assert.equal(find(tree, node => node.props.className === 'container').props.inert, true)
assert.equal(find(tree, node => node.type?.name === 'InitialPreloader').props.pending, true)
await drain(); tree = render()
const initialPreloader = find(tree, node => node.type?.name === 'InitialPreloader')
assert.equal(initialPreloader.props.pending, false, 'The first request completion releases the overlay, without waiting for later searches')
initialPreloader.props.onExit(false); tree = render()
assert.equal(find(tree, node => node.props.className === 'container').props.inert, false)
assert.equal(requests.length, 1)
const jobName = find(tree, node => node.props.className === 'name')
assert.equal(jobName.props.children[0].props.children, 'Rambu Petunjuk')
assert.equal(jobName.props.children[1].props.children, 'Verfied', 'The reconciliation tag appears directly below the work item name')
assert.ok(nodes(find(tree, node => node.type === 'form')).includes(button(tree, 'SMKK (149)')), 'Field buttons and database counts are in the main search form')
button(tree, 'SMKK (149)').props.onClick(); tree = render()
await drain(); tree = render()
assert.equal(requests.length, 2)
assert.equal(nodes(tree).some(node => node.type?.name === 'InitialPreloader'), false, 'Later filter requests never restore the full-page preloader')
assert.equal(requests.at(-1).get('field'), 'SMKK', 'Primary field selection applies immediately')
assert.equal(button(tree, 'SMKK (149)').props['aria-pressed'], true)
assert.equal(nodes(tree).filter(node => node.type === 'button' && text(node).trim().startsWith('Cari')).length, 0, 'No search button outside the collapsed advanced panel')
assert.ok(text(find(tree, node => node.type === 'legend' && text(node).includes('Kecocokan Data'))).includes('Kecocokan Data'))
assert.equal(find(tree, node => node.props['aria-label'] === 'Tentang Kecocokan Data').props.popoverTarget, 'ahsp-match-info')
assert.equal(find(tree, node => node.props.id === 'ahsp-match-info').props.popover, 'auto')
assert.ok(nodes(find(tree, node => node.type === 'form')).includes(button(tree, 'Verfied')), 'Immediate matching filters are available with advanced search closed')
button(tree, 'Pencarian lanjutan').props.onClick(); tree = render()
assert.ok(nodes(find(tree, node => node.props.id === 'ahsp-advanced')).includes(button(tree, 'Cari')), 'The search button belongs to the advanced section')
const searchInputRow = find(tree, node => node.props.className === 'searchInputRow')
assert.ok(nodes(searchInputRow).includes(button(tree, 'Cari')), 'Search action is grouped with the multiple-item input')
assert.ok(nodes(searchInputRow).some(node => node.type === 'textarea'))
find(tree, node => node.type === 'textarea').props.onChange({ target: { value: 'Rambu petunjuk\nPeralatan P3K' } }); tree = render()
assert.equal(nodes(find(tree, node => node.props.id === 'ahsp-advanced')).some(node => node.type === 'label' && text(node).trim().startsWith('Bidang')), false, 'Field selection is not duplicated inside advanced search')
field(tree, 'Satuan').props.onChange({ target: { value: 'Buah' } }); tree = render()
field(tree, 'Regulasi').props.onChange({ target: { value: 'SE 47/2026' } }); tree = render()
button(tree, 'Exact-match').props.onClick(); tree = render()
await drain(); tree = render()
assert.equal(requests.length, 2, 'Typing advanced terms and changing filters/mode do not search')
button(tree, 'Hanya ada di Database').props.onClick(); tree = render()
assert.equal(button(tree, 'Hanya ada di Database').props['aria-pressed'], true)
for (const label of Object.values(core.exports.sipastiLabels)) assert.equal(button(tree, label).props.disabled, true, 'Matching filters are disabled until the request finishes')
assert.ok(nodes(button(tree, 'Hanya ada di Database')).some(node => node.props.className === 'spinner'))
button(tree, 'Verfied').props.onClick(); tree = render()
assert.equal(button(tree, 'Hanya ada di Database').props['aria-pressed'], true, 'A competing matching action cannot replace the pending request')
await drain(); tree = render()
assert.equal(requests.length, 3, 'Matching filters request data without Cari')
assert.equal(requests.at(-1).get('sipasti'), 'database_only')
assert.equal(requests.at(-1).get('q'), '', 'Matching does not submit pending advanced terms')
assert.equal(requests.at(-1).get('unit'), '', 'Matching does not submit pending advanced units')
assert.equal(requests.at(-1).get('match'), 'like', 'Matching preserves the applied method')
for (const label of Object.values(core.exports.sipastiLabels)) assert.equal(button(tree, label).props.disabled, false)
button(tree, 'Hanya ada di Database').props.onClick(); tree = render()
assert.equal(button(tree, 'Hanya ada di Database').props['aria-pressed'], false, 'Clicking the active filter clears it')
await drain(); tree = render()
assert.equal(requests.at(-1).get('sipasti'), '')
button(tree, 'Hanya ada di Database').props.onClick(); tree = render()
await drain(); tree = render()
assert.equal(requests.length, 5)
button(tree, 'Cari 2 istilah').props.onClick(); tree = render()
assert.equal(jobs.find(job => !job.canceled).delay, 0, 'Manual advanced submit has no debounce')
await drain(); tree = render()
assert.equal(requests.length, 6)
assert.equal(requests.at(-1).get('q'), 'Rambu petunjuk\nPeralatan P3K')
assert.equal(requests.at(-1).get('scope'), 'all')
assert.equal(requests.at(-1).get('field'), 'SMKK')
assert.equal(requests.at(-1).get('match'), 'exact')
assert.equal(requests.at(-1).get('sipasti'), 'database_only', 'Advanced submission preserves the immediate matching filter')
button(tree, 'Ubah pencarian').props.onClick(); tree = render()
find(tree, node => node.type === 'textarea').props.onChange({ target: { value: 'Istilah baru belum diterapkan' } }); tree = render()
button(tree, 'Verfied').props.onClick(); tree = render(); await drain(); tree = render()
assert.equal(requests.at(-1).get('sipasti'), 'both')
assert.equal(requests.at(-1).get('q'), 'Rambu petunjuk\nPeralatan P3K', 'Immediate matching keeps the submitted advanced query, not the draft')
assert.equal(requests.at(-1).get('unit'), 'Buah')
assert.equal(requests.at(-1).get('match'), 'exact')
button(tree, 'Berikutnya').props.onClick(); tree = render()
await drain(); tree = render()
assert.equal(requests.length, 8)
assert.equal(requests.at(-1).get('page'), '2')
assert.equal(requests.at(-1).get('q'), 'Rambu petunjuk\nPeralatan P3K', 'Pagination uses the submitted search, never unsaved draft terms')
button(tree, 'Umum (249)').props.onClick(); tree = render()
await drain(); tree = render()
assert.equal(requests.length, 9)
assert.equal(requests.at(-1).get('field'), 'Umum')
assert.equal(requests.at(-1).get('page'), '1')
assert.equal(requests.at(-1).get('q'), 'Rambu petunjuk\nPeralatan P3K', 'Primary field buttons do not submit pending advanced terms')
find(tree, node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'R' } }); tree = render()
assert.equal(jobs.find(job => !job.canceled).delay, 200)
find(tree, node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'Rambu' } }); tree = render()
assert.equal(requests.length, 9, 'Single search waits for its debounce')
await drain(); tree = render()
assert.equal(requests.length, 10, 'Rapid single-search edits cause one request')
assert.equal(requests.at(-1).get('q'), 'Rambu')
assert.equal(requests.at(-1).get('scope'), 'jobs')
assert.equal(requests.at(-1).get('field'), 'Umum', 'Single search preserves the selected primary field')
assert.equal(requests.at(-1).get('unit'), '', 'Single search does not apply advanced unit filters')
assert.equal(requests.at(-1).get('match'), 'like')
assert.equal(requests.at(-1).get('sipasti'), 'both', 'Single search preserves the immediately applied matching filter')
assert.equal(button(tree, 'Verfied').props['aria-pressed'], true)
find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); tree = render()
await drain(); tree = render()
assert.equal(requests.length, 11)
assert.equal(requests.at(-1).get('q'), 'Rambu', 'Submitting a single search does not restore old advanced terms, even while the advanced panel is visible')
assert.equal(requests.at(-1).get('scope'), 'jobs')
button(tree, 'Pencarian lanjutan').props.onClick(); tree = render()
button(tree, 'Gabungan frasa').props.onClick(); tree = render()
assert.equal(button(tree, 'Gabungan frasa').props['aria-pressed'], true)
assert.ok(find(tree, node => node.type === 'textarea').props.placeholder.includes('"Alat Berat"'))
const requestsBeforePhrases = requests.length
find(tree, node => node.type === 'textarea').props.onChange({ target: { value: '"Excavator" "EXCAVATOR"' } }); tree = render()
button(tree, 'Cari').props.onClick(); tree = render(); await drain(); tree = render()
assert.equal(requests.length, requestsBeforePhrases, 'Fewer than two distinct phrases keeps the draft open without a request')
assert.equal(find(tree, node => node.type === 'textarea').props['aria-invalid'], true)
assert.ok(text(find(tree, node => node.props.id === 'ahsp-search-validation')).includes('minimal 2 frasa'))
find(tree, node => node.type === 'textarea').props.onChange({ target: { value: '"Mobilisasi dan Demobilisasi" "Alat Berat" "Excavator"' } }); tree = render()
assert.equal(find(tree, node => node.type === 'textarea').props['aria-invalid'], false)
assert.ok(text(find(tree, node => node.props.id === 'ahsp-match-help')).includes('minimal 2 frasa'))
button(tree, 'Cari 3 frasa').props.onClick(); tree = render(); await drain(); tree = render()
assert.equal(requests.at(-1).get('match'), 'phrases')
assert.equal(requests.at(-1).get('scope'), 'jobs')
assert.equal(requests.at(-1).get('mode'), 'multiple')
button(tree, 'Berikutnya').props.onClick(); tree = render(); await drain(); tree = render()
assert.equal(requests.at(-1).get('page'), '2')
assert.equal(requests.at(-1).get('match'), 'phrases')
button(tree, 'Reset pencarian').props.onClick(); tree = render(); await drain(); tree = render()
assert.equal(requests.at(-1).get('match'), 'like')
const dialog = find(tree, node => node.type === 'dialog').props.ref
dialog.current = { open: false, showModal() { this.open = true }, close() { this.open = false } }
assert.ok(nodes(tree).some(node => node.type === 'summary' && text(node) === 'Versi dan sumber lainnya (1)'))
assert.equal(nodes(find(tree, node => node.props.className === 'itemList')).filter(node => node.props.className === 'item').length, 1, 'Versions remain inside one primary work row')
const alternateVersion = find(tree, node => node.props['aria-label'] === 'Buka versi PERMEN 08/2023 tanpa kode SMKK bh: Rambu Petunjuk')
alternateVersion.props.onClick(); tree = render()
await new Promise(resolve => setImmediate(resolve)); tree = render()
assert.equal(requests.at(-1).get('id'), 'job-legacy')
assert.ok(text(find(tree, node => node.props.className === 'modalHeader')).includes('PERMEN 08/2023 / Satuan bh'))
assert.ok(text(find(tree, node => node.props.className === 'analysisInfo')).includes('Analisis belum tersedia'))
button(tree, 'Cara hitung dan lampiran').props.onClick(); tree = render()
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.source.id, 'permen08-2023')
button(tree, 'Tutup').props.onClick(); tree = render()
assert.equal(nodes(tree).some(node => node.type === 'button' && nodes(node.props.children).some(child => child.type === 'button')), false, 'Copy controls are never nested inside the modal button')
await find(tree, node => node.props['aria-label'] === 'Salin kode 1.22.(7a)').props.onClick(); tree = render()
assert.equal(clipboardWrites.at(-1), '1.22.(7a)')
assert.equal(dialog.current.open, false, 'Copying a code does not open the modal')
const firstToastTimer = jobs.findLast(job => job.delay === 3000 && !job.canceled)
assert.ok(firstToastTimer, 'Copy feedback is scheduled to disappear after 3000ms')
assert.ok(text(find(tree, node => node.props.className === 'copyToastRegion')).includes('Kode 1.22.(7a) tersalin.'))
await find(tree, node => node.props['aria-label'] === 'Salin kode 1.22.(7a)').props.onClick(); tree = render()
assert.equal(firstToastTimer.canceled, true, 'Repeated copying cancels the old expiry, even for the same message')
assert.ok(jobs.findLast(job => job.delay === 3000 && !job.canceled))
await find(tree, node => node.props['aria-label'] === 'Salin nama Rambu Petunjuk').props.onClick(); tree = render()
assert.equal(clipboardWrites.at(-1), 'Rambu Petunjuk')
assert.equal(dialog.current.open, false, 'Copying a name does not open the modal')
await find(tree, node => node.props['aria-label'] === 'Salin data 1.22.(7a): Rambu Petunjuk').props.onClick(); tree = render()
assert.equal(clipboardWrites.at(-1).split('\t').length, 9, 'The existing row icon still copies the complete row')
await jobs.findLast(job => job.delay === 3000 && !job.canceled).callback(); tree = render()
assert.equal(text(find(tree, node => node.props.className === 'copyToastRegion')), '', 'Toast disappears at expiry')
assert.equal(find(tree, node => node.props['aria-label'] === 'Salin data 1.22.(7a): Rambu Petunjuk').props.children.type, imports['@phosphor-icons/react'].Copy, 'Copied checkmark resets with the toast')
clipboardFailure = true
await find(tree, node => node.props['aria-label'] === 'Salin kode 1.22.(7a)').props.onClick(); tree = render()
assert.equal(find(tree, node => node.props.className === 'copyToast').props['data-error'], true)
await jobs.findLast(job => job.delay === 3000 && !job.canceled).callback(); tree = render()
assert.equal(text(find(tree, node => node.props.className === 'copyToastRegion')), '')
clipboardFailure = false
find(tree, node => node.props['aria-label'] === 'Buka analisis 1.22.(7a): Rambu Petunjuk').props.onClick(); tree = render()
assert.equal(dialog.current.open, true, 'The separate row action still opens the modal')
await new Promise(resolve => setImmediate(resolve)); tree = render()
button(tree, 'Cara hitung dan lampiran').props.onClick(); tree = render()
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.source.id, '10899')
button(tree, 'Tutup').props.onClick(); tree = render()
sampleItem.regulation = 'PERMEN 08/2023'
find(tree, node => node.props['aria-label'] === 'Buka analisis 1.22.(7a): Rambu Petunjuk').props.onClick(); tree = render()
await new Promise(resolve => setImmediate(resolve)); tree = render()
button(tree, 'Cara hitung dan lampiran').props.onClick(); tree = render()
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.source.id, 'permen08-2023', 'Unmapped Permen SMKK refers to Permen, never the SE 2026 appendix')
button(tree, 'Tutup').props.onClick(); tree = render()
sampleItem.regulation = 'SE 47/2026'
sampleItem.analysis_reference = { target_code: 'U.test', target_regulation: 'PERMEN 08/2023', target_item_id: 'reference-item', status: 'verified', source_id: '10899', source_page: 159, citation: 'Lihat Permen 8/2023 U.test', notes: [] }
sampleReferenceTarget = { ...sampleItem, id: 'reference-item', code: 'U.test', regulation: 'PERMEN 08/2023', field: 'Umum', page_from: 141, page_to: 141, analysis_reference: null, components: [{ id: 'target-component', group: 'bahan', name: 'Kawat duri acuan', unit: 'm', code: '', coefficient: 20.4457, expression: '' }] }
sampleReferenceReady = true
find(tree, node => node.props['aria-label'] === 'Buka analisis 1.22.(7a): Rambu Petunjuk').props.onClick(); tree = render()
await new Promise(resolve => setImmediate(resolve)); tree = render()
assert.ok(text(find(tree, node => node.props.className === 'referencePanel')).includes('Komponen dan kalkulator menggunakan'))
assert.ok(text(find(tree, node => node.props.className === 'components')).includes('Kawat duri acuan'), 'The component list uses the target item, not the source mirror')
button(tree, 'Lihat rujukan dalam SE').props.onClick(); tree = render()
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.item.code, sampleItem.code)
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.item.page_from, 159)
button(tree, 'Lampiran analisis Permen').props.onClick(); tree = render()
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.item.code, 'U.test')
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.item.page_from, 141)
button(tree, 'Tutup').props.onClick(); tree = render()
sampleReferenceReady = false
sampleItem.analysis_reference.status = 'review'
find(tree, node => node.props['aria-label'] === 'Buka analisis 1.22.(7a): Rambu Petunjuk').props.onClick(); tree = render()
await new Promise(resolve => setImmediate(resolve)); tree = render()
assert.ok(text(find(tree, node => node.props.className === 'referencePanel')).includes('Kalkulator belum memakai acuan ini'))
assert.ok(text(find(tree, node => node.props.className === 'analysisInfo')).includes('Analisis perlu ditinjau'))
button(tree, 'Tutup').props.onClick(); tree = render()
sampleItem.regulation = 'SE 182/2025'
sampleItem.analysis_reference = null
sampleItem.analysis_status = 'unavailable'
sampleReferenceTarget = null
sampleReferenceReady = false
field(tree, 'Regulasi').props.onChange({ target: { value: 'SE 182/2025' } }); tree = render(); await drain(); tree = render()
assert.equal(requests.at(-1).get('regulation'), 'SE 182/2025')
assert.ok(nodes(field(tree, 'Regulasi')).some(node => node.type === 'option' && node.props.value === 'SE 182/2025' && text(node).includes('(arsip)')))
assert.ok(text(find(tree, node => node.props.className === 'state')).includes('Digantikan oleh SE 47/2026'))
find(tree, node => node.props['aria-label'] === 'Buka analisis 1.22.(7a): Rambu Petunjuk').props.onClick(); tree = render()
await new Promise(resolve => setImmediate(resolve)); tree = render()
assert.ok(text(find(tree, node => node.props.className === 'modalHeader')).includes('Digantikan oleh SE 47/2026. Data ini merupakan arsip regulasi.'))
assert.ok(text(find(tree, node => node.props.className === 'analysisInfo')).includes('Analisis belum tersedia'))
button(tree, 'Cara hitung dan lampiran').props.onClick(); tree = render()
assert.equal(find(tree, node => node.type?.name === 'SourceReference').props.source, undefined, 'An archived master item cannot fall back to a latest-edition PDF')
button(tree, 'Tutup').props.onClick(); tree = render()
sampleItem.regulation = 'SE 47/2026'
sampleItem.analysis_status = 'extracted'
for (const effect of effects) effect?.cleanup?.()
states.length = 0; effects.length = 0; jobs.length = 0; requests.length = 0
catalogueFailure = true
tree = render(); await drain(); tree = render()
const failurePreloader = find(tree, node => node.type?.name === 'InitialPreloader')
assert.equal(failurePreloader.props.pending, false, 'A failed first request also exits the preloader')
failurePreloader.props.onExit(false); tree = render()
assert.ok(text(find(tree, node => node.props.role === 'alert')).includes('Katalog gagal dimuat'))
catalogueFailure = false
button(tree, 'Coba lagi').props.onClick(); tree = render(); await drain(); tree = render()
assert.equal(nodes(tree).some(node => node.type?.name === 'InitialPreloader'), false, 'Retry uses the catalogue loading state without covering the page again')
for (const effect of effects) effect?.cleanup?.()
console.log('AHSP checks passed: immediate matching, disabled concurrent filters, applied/draft query isolation, persistent status, grouped advanced action, single debounce, independent copy/modal actions, toast expiry/reset, and error feedback.')
