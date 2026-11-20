import {
  ROLES, accountLabel, provinceName, validateDocument,
  type AccountDetail, type AccountRole, type ProvinceReport, type ReportDocument,
} from './model'

export type ImportMode = 'excel' | 'json'
export const IMPORT_LIMIT = 8 * 1024 * 1024

const roleMap = new Map<string, AccountRole>([
  ['skpd_admin_prov', 'sekda'], ['kepala_pu', 'kepalaDinas'], ['kepala_bpkad', 'kepalaBpkad'],
  ['apip', 'apip'], ['penyusun_harga', 'penyusunHarga'], ['penyusun_asb', 'penyusunAsb'],
])
const normalize = (name: string) => name.toLocaleLowerCase('id-ID').replace(/[^a-z0-9]+/g, ' ').trim()
const provinceKey = (name: string) => normalize(name).replace(/^provinsi /, '').replace(/^bangka belitung$/, 'kepulauan bangka belitung')
const excluded = /\b(?:stranas\s*pk|testing|latihan)\b/
const record = (input: unknown): Record<string, unknown> =>
  input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
const field = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const codeOf = (value: unknown) => typeof value === 'number' ? String(value) : field(value)

export function readSipastiHierarchy(text: string, base: ReportDocument) {
  if (new TextEncoder().encode(text).byteLength > IMPORT_LIMIT) throw new Error('JSON maksimal 8 MB.')
  let raw: unknown
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new Error('JSON tidak valid. Periksa isi file atau teks yang ditempel.') }
  const roots = record(raw).data
  if (!Array.isArray(roots)) throw new Error('JSON SIPASTI Pemda harus berisi daftar hierarki pada bagian data.')
  if (roots.length > 10000) throw new Error('JSON maksimal 10.000 simpul hierarki.')
  const document = validateDocument(base)
  const provinces = new Map(document.provinces.map(p => [provinceKey(provinceName(p.id, p.name)), p]))
  const stack = roots.map(node => ({node, parent: undefined as ProvinceReport | undefined})).reverse()
  const seen = new Set<string>(), matchedDetails = new Set<string>(), provinceIds = new Set<string>()
  let skipped = 0, visited = 0
  while (stack.length) {
    if (++visited > 10000) throw new Error('JSON maksimal 10.000 simpul hierarki.')
    const {node, parent} = stack.pop()!
    const row = record(node), rawRole = field(row.role).toLowerCase(), area = record(row.daerah)
    if (!rawRole) throw new Error('Ada simpul hierarki JSON tanpa peran akun.')
    const code = codeOf(area.kode_daerah) || codeOf(row.ref_daerah_kode)
    const areaName = field(area.nama_daerah)
    const label = field(row.nama), email = field(row.email), institution = field(row.jabatan)
    const skipBranch = rawRole === 'skpd_admin_kab_kota' || code === '99' || (code && !/^\d{2}$/.test(code))
      || [rawRole, field(row.role_label), areaName, label, email, institution].some(value => excluded.test(normalize(value)))
    if (skipBranch) { skipped++; continue }
    const province = areaName ? provinces.get(provinceKey(areaName)) : parent
    if (row.children !== undefined && row.children !== null && !Array.isArray(row.children)) {
      throw new Error('Bagian children pada hierarki JSON harus berupa daftar.')
    }
    if (Array.isArray(row.children)) {
      if (visited + stack.length + row.children.length > 10000) throw new Error('JSON maksimal 10.000 simpul hierarki.')
      for (let i = row.children.length - 1; i >= 0; i--) stack.push({node:row.children[i], parent:province})
    }
    const role = roleMap.get(rawRole)
    if (!role) continue
    if (!province) { skipped++; continue }
    const externalId = field(row.id)
    if (!/^[a-zA-Z0-9_-]{1,72}$/.test(externalId) || !label) {
      throw new Error(`ID atau nama akun JSON tidak valid untuk ${provinceName(province.id, province.name)}.`)
    }
    if (seen.has(externalId)) throw new Error('Hierarki JSON memuat ID akun ganda.')
    seen.add(externalId)
    provinceIds.add(province.id)
    const account = province.accounts[role], id = `sipasti-${externalId}`
    const emails = email ? account.details.filter(detail => !matchedDetails.has(detail.id) && !detail.id.startsWith('sipasti-')
      && detail.email.toLowerCase() === email.toLowerCase()) : []
    const existing = account.details.find(detail => detail.id === id || detail.id === externalId)
      ?? (emails.length === 1 ? emails[0] : undefined)
    const detail: AccountDetail = {
      id: existing?.id ?? id,
      label,
      institution: institution && institution !== '-' ? institution : existing?.institution ?? '',
      email: email || existing?.email || '',
      note: existing?.note ?? '',
    }
    if (existing) Object.assign(existing, detail)
    else account.details.push(detail)
    matchedDetails.add(detail.id)
    account.status = 'ada'
    account.count = Math.max(account.count ?? 0, account.details.length)
  }
  return {document: validateDocument(document), provinceIds: [...provinceIds], skipped}
}

function rowChanges<T extends {id: string}>(before: T[], after: T[]) {
  const previous = new Map(before.map(item => [item.id, item]))
  const added = after.filter(item => !previous.has(item.id))
  const updated = after.filter(item => previous.has(item.id) && JSON.stringify(item) !== JSON.stringify(previous.get(item.id)))
  return {added, updated}
}
const accountSummary = (account: ProvinceReport['accounts'][AccountRole]) => [account.status, account.count, account.note]

export function importDifferences(base: ReportDocument, next: ReportDocument, provinceIds: string[]) {
  const previous = new Map(base.provinces.map(p => [p.id, p]))
  const incoming = new Map(next.provinces.map(p => [p.id, p]))
  return provinceIds.flatMap(id => {
    const before = previous.get(id), after = incoming.get(id)
    if (!before || !after) return []
    const accounts = ROLES.map(role => {
      const old = before.accounts[role], value = after.accounts[role]
      const changes = rowChanges(old.details, value.details)
      const summaryChanged = JSON.stringify(accountSummary(old)) !== JSON.stringify(accountSummary(value))
      const label = (account: typeof value) => `${accountLabel(account)}${account.count === null ? '' : ` (${account.count})`}`
      return {role, ...changes, summaryChanged, beforeLabel:label(old), afterLabel:label(value), before:old, after:value}
    })
    const packages = rowChanges(before.packages, after.packages)
    const notes = before.notes !== after.notes || before.followUp !== after.followUp
    const changed = notes || !!(packages.added.length || packages.updated.length)
      || accounts.some(a => a.summaryChanged || a.added.length || a.updated.length)
    return [{id, name: provinceName(id, after.name), before, after, accounts, packages, notes, changed}]
  })
}

export type ImportRow = ReturnType<typeof importDifferences>[number]

export function selectImportRows(base: ReportDocument, rows: ImportRow[], selected: ReadonlySet<string>) {
  const changes = new Map(rows.filter(row => row.changed && selected.has(row.id)).map(row => [row.id, row.after]))
  return validateDocument({...base, provinces: base.provinces.map(p => changes.get(p.id) ?? p)})
}
