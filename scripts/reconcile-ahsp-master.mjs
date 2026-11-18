import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'

export const textKey = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase()
export const codeKey = value => textKey(value).replace(/\s/gu, '')
export const unitKey = value => {
  const key = textKey(value).replace(/[.\s]/gu, '')
  return ({ bh: 'buah', m1: 'm', "m'": 'm', 'm’': 'm', meter: 'm', meterpanjang: 'm', meterkubik: 'm3', meterpersegi: 'm2', kilogram: 'kg' })[key] ?? key
}
const expression = value => /^0(?:[.,]0+)?$/.test(String(value ?? '').trim()) ? '' : String(value ?? '').trim()
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const catalogFingerprint = item => fingerprint(item)
const groups = { material: 'bahan', peralatan: 'alat', tenaga_kerja: 'tenaga' }
const regulations = ['SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025']
const metadata = ['item_code', 'item_name', 'item_unit', 'item_job_field', 'item_regulation', 'item_job_type', 'overheat_and_profit_percentage', 'is_smkk', 'is_umum', 'is_not_component']
const componentFields = ['component_name', 'component_unit', 'component_code', 'component_ref_code', 'component_master_code', 'component_master_name', 'component_coefficient', 'component_formula_coefficient', 'component_order', 'component_description']
const omitGenerated = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['id', 'source_id', 'source_ref_id'].includes(key)))
const componentContent = c => ({ ...omitGenerated(c), variables: c.variables.map(omitGenerated) })
const analysisContent = job => job.components.map(componentContent).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
const indexBy = (values, key) => {
  const result = new Map()
  for (const value of values) { const k = key(value); if (!result.has(k)) result.set(k, []); result.get(k).push(value) }
  return result
}

export function groupMaster(rows) {
  const jobs = new Map()
  for (const [index, raw] of rows.entries()) {
    if (!raw.item_id || !raw.item_name || !raw.item_job_field) throw new Error(`Identitas pekerjaan tidak lengkap pada baris ${index + 1}`)
    let job = jobs.get(raw.item_id)
    if (!job) {
      const regs = [...new Set(String(raw.item_regulation ?? '').split(',').map(r => r.trim().replace(/^PERMEN\s+0?8\/2023$/i, 'PERMEN 08/2023')))]
      job = { source_id: raw.item_id, code: raw.item_code ?? '', name: raw.item_name, unit: raw.item_unit ?? '', field: raw.item_job_field, division: raw.item_division === '-' ? '' : raw.item_division ?? '', regulations: regs, job_type: raw.item_job_type ?? '', overhead: raw.overheat_and_profit_percentage ?? null, rows: [], raw, components: new Map() }
      jobs.set(raw.item_id, job)
    } else if (metadata.some(key => JSON.stringify(job.raw[key]) !== JSON.stringify(raw[key]))) throw new Error(`Konflik metadata pekerjaan pada baris ${index + 1}`)
    job.rows.push(index + 1)
    if (!raw.component_id) {
      if (raw.component_type !== 'tanpa_komponen') throw new Error(`Komponen tanpa ID pengelompokan pada baris ${index + 1}`)
      continue
    }
    if (!groups[raw.component_type]) throw new Error(`Jenis komponen tidak dikenal pada baris ${index + 1}`)
    const key = `${raw.component_type}:${raw.component_id}`
    let component = job.components.get(key)
    if (!component) {
      const coefficient = raw.component_coefficient == null ? null : Number(raw.component_coefficient)
      component = { raw, group: groups[raw.component_type], name: raw.component_name ?? '', unit: raw.component_unit ?? '', code: raw.component_code || raw.component_ref_code || raw.component_master_code || '', coefficient, expression: expression(raw.component_formula_coefficient), order: raw.component_order ?? null, description: raw.component_description ?? '', source_id: raw.component_id, source_ref_id: raw.component_ref_id ?? null, master_code: raw.component_master_code ?? '', master_name: raw.component_master_name ?? '', variables: new Map() }
      job.components.set(key, component)
    } else if (componentFields.some(key => JSON.stringify(component.raw[key]) !== JSON.stringify(raw[key]))) throw new Error(`Konflik komponen pada baris ${index + 1}`)
    if (raw.variable_id) {
      const variable = { source_id: raw.variable_id, source_ref_id: raw.variable_ref_id ?? null, code: raw.variable_code ?? '', name: raw.variable_name ?? '', unit: raw.variable_unit ?? '', coefficient: raw.variable_coefficient ?? null, expression: expression(raw.variable_formula_coefficient), type: raw.variable_type ?? '', order: raw.variable_order ?? null, final_value: raw.variable_final_value ?? null, var_description: raw.variable_var_descriptions ?? '', description: raw.variable_description ?? '' }
      const prior = component.variables.get(raw.variable_id)
      if (prior && JSON.stringify(prior) !== JSON.stringify(variable)) throw new Error(`Konflik variabel pada baris ${index + 1}`)
      component.variables.set(raw.variable_id, variable)
    }
  }
  return [...jobs.values()].map(({ raw, components, ...job }) => ({ ...job, components: [...components.values()].map(({ raw, variables, ...component }) => ({ ...component, variables: [...variables.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code)) })).sort((a, b) => a.group.localeCompare(b.group) || (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)) }))
}

function compareComponents(before, after) {
  const key = c => JSON.stringify([c.group, textKey(c.name), unitKey(c.unit)])
  const old = indexBy(before.filter(c => c.group !== 'smkk'), key), next = indexBy(after, key)
  const differences = []
  for (const [k, rows] of old) {
    const candidates = next.get(k)
    if (!candidates) { differences.push({ kind: 'old_component_only', name: rows[0].name }); continue }
    if (rows.length !== candidates.length) { differences.push({ kind: 'component_multiplicity', name: rows[0].name, before: rows.length, after: candidates.length }); continue }
    const sort = values => values.map(c => c.coefficient).filter(c => c != null).sort((a, b) => a - b)
    const a = sort(rows), b = sort(candidates)
    if (a.length && b.length && (a.length !== b.length || a.some((value, i) => Math.abs(value - b[i]) > Math.max(1e-8, Math.abs(value) * 1e-6)))) differences.push({ kind: 'coefficient_difference', name: rows[0].name, before: a, after: b })
  }
  return differences
}

export function reconcileMaster(items, jobs) {
  const expanded = jobs.flatMap(job => job.regulations.filter(regulation => regulations.includes(regulation)).map(regulation => ({ ...job, regulation })))
  const byCode = indexBy(expanded, j => JSON.stringify([j.field, j.regulation, codeKey(j.code)]))
  const byName = indexBy(expanded, j => JSON.stringify([j.field, j.regulation, textKey(j.name), unitKey(j.unit)]))
  const consumed = new Set(), changes = []
  const allEditions = indexBy(jobs, j => JSON.stringify([j.field, codeKey(j.code) || `name:${textKey(j.name)}`]))
  for (const item of items) {
    const reasons = [], differences = []
    const identity = JSON.stringify([item.field, item.regulation, codeKey(item.code)])
    let candidates = codeKey(item.code) ? byCode.get(identity) ?? [] : byName.get(JSON.stringify([item.field, item.regulation, textKey(item.name), unitKey(item.unit)])) ?? []
    const exact = candidates.filter(j => textKey(j.name) === textKey(item.name) && unitKey(j.unit) === unitKey(item.unit) && codeKey(j.code) === codeKey(item.code))
    if (exact.length) candidates = exact
    const contents = indexBy(candidates, j => fingerprint([textKey(j.name), unitKey(j.unit), j.job_type, j.overhead, analysisContent(j)]))
    let source = null
    if (!candidates.length) reasons.push('Pekerjaan tidak ditemukan pada JSON untuk bidang, kode/nama, satuan, dan regulasi ini.')
    else if (contents.size !== 1) reasons.push('Terdapat beberapa kandidat sumber dengan metadata atau analisis berbeda; perlu pemilihan manual.')
    else {
      source = candidates[0]
      candidates.forEach(j => consumed.add(`${j.source_id}|${j.regulation}`))
      if (!exact.length) {
        if (textKey(source.name) !== textKey(item.name)) differences.push({ kind: 'name', before: item.name, after: source.name })
        if (unitKey(source.unit) !== unitKey(item.unit)) differences.push({ kind: 'unit', before: item.unit, after: source.unit })
        reasons.push('Kode dan regulasi ditemukan tetapi nama atau satuan berbeda; identitas perlu ditinjau.')
      }
    }
    const components = source?.components.map((c, position) => ({ ...c, id: `master-${fingerprint([item.id, position, componentContent(c)]).slice(0, 24)}`, sourceLine: `SIPASTI JSON: ${c.group}; urutan ${c.order ?? position + 1}` }))
    const editionEvidence = allEditions.get(JSON.stringify([item.field, codeKey(item.code) || `name:${textKey(item.name)}`])) ?? []
    const sourceRegulations = [...new Set(editionEvidence.flatMap(j => j.regulations))].sort()
    if (!candidates.length && sourceRegulations.length && !sourceRegulations.includes(item.regulation)) reasons.push(`Regulasi berbeda: JSON mencantumkan ${sourceRegulations.join(', ')} untuk kode pekerjaan ini; edisi katalog ${item.regulation} belum terbukti.`)
    if (source) {
      if (!textKey(source.unit) || !textKey(item.unit)) reasons.push('Satuan hasil pekerjaan belum tersedia.')
      if (item.output_quantity !== 1) reasons.push('Basis kuantitas katalog bukan satu; JSON tidak menyediakan basis analisis eksplisit untuk mengonfirmasinya.')
      if (item.field !== 'SMKK' && !components.length) reasons.push('Pekerjaan non-SMKK belum memiliki rincian komponen.')
      for (const [position, c] of components.entries()) {
        if (!textKey(c.name) || ['', '-'].includes(unitKey(c.unit))) reasons.push(`Komponen ${position + 1}: nama atau satuan belum lengkap.`)
        if (c.coefficient !== null && (!Number.isFinite(c.coefficient) || c.coefficient < 0)) reasons.push(`Komponen ${position + 1}: koefisien tidak valid.`)
        if (c.coefficient === null && !c.expression) reasons.push(`Komponen ${position + 1}: koefisien dan rumus belum tersedia.`)
        const labor = ['oh', 'oj', 'ob', 'jam', 'oranghari', 'orangjam', 'orangbulan']
        if (c.group === 'tenaga' && !labor.includes(unitKey(c.unit))) reasons.push(`Komponen ${position + 1}: satuan tenaga kerja perlu diperiksa.`)
        if (c.group !== 'tenaga' && ['oh', 'oj', 'ob', 'oranghari', 'orangjam', 'orangbulan'].includes(unitKey(c.unit))) reasons.push(`Komponen ${position + 1}: kategori komponen dan satuan tenaga kerja tidak selaras.`)
      }
      differences.push(...compareComponents(item.components, components))
      if (differences.some(d => ['old_component_only', 'component_multiplicity', 'coefficient_difference'].includes(d.kind))) reasons.push('Rincian JSON berbeda dari analisis katalog sebelumnya; komponen sumber disimpan dan perbedaan perlu diperiksa.')
    }
    const matched = source && exact.length > 0
    changes.push({ id: item.id, code: item.code, name: item.name, field: item.field, regulation: item.regulation, before_fingerprint: catalogFingerprint(item), verification_status: reasons.length ? 'needs_review' : 'verified', verification_notes: [...new Set(reasons)], matched: !!matched, components: matched && item.field !== 'SMKK' ? components : null, analysis_status: matched && item.field !== 'SMKK' ? (reasons.length ? 'needs_review' : 'extracted') : item.analysis_status, source_rows: matched ? [...new Set(candidates.flatMap(j => j.rows))].sort((a, b) => a - b) : [], source_job_ids: source ? candidates.map(j => j.source_id) : [], source_regulations: sourceRegulations, differences, candidates: candidates.map(j => ({ code: j.code, name: j.name, unit: j.unit, regulation: j.regulation, source_id: j.source_id })) })
  }
  const unmatched = expanded.filter(j => !consumed.has(`${j.source_id}|${j.regulation}`))
  return { changes, unmatched, excluded: jobs.filter(j => !j.regulations.some(r => regulations.includes(r))).map(j => ({ code: j.code, name: j.name, field: j.field, regulations: j.regulations, rows: j.rows })), summary: { catalog_versions: items.length, source_jobs: jobs.length, source_rows: jobs.reduce((n, j) => n + j.rows.length, 0), source_components: jobs.reduce((n, j) => n + j.components.length, 0), verified: changes.filter(c => c.verification_status === 'verified').length, needs_review: changes.filter(c => c.verification_status === 'needs_review').length, enriched: changes.filter(c => c.components !== null).length, unmatched_source_versions: unmatched.length } }
}

function csv(rows, columns) {
  const cell = value => `"${String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replaceAll('"', '""')}"`
  return '\uFEFF' + [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\r\n')
}
async function main() {
  const [input, snapshot, output] = process.argv.slice(2)
  if (!input || !snapshot || !output) throw new Error('Gunakan: node scripts/reconcile-ahsp-master.mjs <master.json> <snapshot.json> <folder-laporan>')
  const bytes = readFileSync(input), document = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
  const arrays = Object.values(document)
  if (arrays.length !== 1 || !Array.isArray(arrays[0]) || !arrays[0].length) throw new Error('Sumber harus berisi satu array data tidak kosong')
  const backup = JSON.parse(readFileSync(snapshot, 'utf8'))
  const result = reconcileMaster(backup.items, groupMaster(arrays[0]))
  const folder = resolve(output)
  mkdirSync(folder, { recursive: true })
  const plan = { source_name: basename(input), source_sha256: createHash('sha256').update(bytes).digest('hex'), snapshot: resolve(snapshot), snapshot_sha256: createHash('sha256').update(readFileSync(snapshot)).digest('hex'), generated_at: new Date().toISOString(), ...result }
  writeFileSync(join(folder, 'plan.json'), JSON.stringify(plan))
  writeFileSync(join(folder, 'summary.json'), JSON.stringify({ ...result.summary, source_sha256: plan.source_sha256 }, null, 2))
  writeFileSync(join(folder, 'reconciliation.csv'), csv(result.changes, ['id','code','name','field','regulation','verification_status','verification_notes','source_job_ids','differences']))
  writeFileSync(join(folder, 'regulations.csv'), csv(result.changes, ['id','code','name','field','regulation','source_regulations','matched','verification_status','verification_notes']))
  writeFileSync(join(folder, 'unmatched-source.csv'), csv(result.unmatched, ['code','name','unit','field','regulation','rows']))
  writeFileSync(join(folder, 'excluded-source.csv'), csv(result.excluded, ['code','name','field','regulations','rows']))
  console.log(JSON.stringify(result.summary, null, 2))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
