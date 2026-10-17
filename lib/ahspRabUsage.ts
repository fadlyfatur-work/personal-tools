import { rabText, rabUnit, type RabCandidate, type RabRow } from './ahspRab'
import type { MptkGroup } from './ahspMptk'

export type RabUsageResource = { group: MptkGroup; name: string; unit: string; code: string }
export type RabUsageAnalysis = {
  item: RabCandidate; analysis: RabCandidate; status: string; components: RabUsageResource[];
  excluded_components: number; note: string; identity_scope?: string;
}
export type RabUsageSource = Pick<RabRow, 'id' | 'sheet' | 'row' | 'source' | 'name'>
export type RabUsageJob = { item: RabCandidate; analysis: RabCandidate; sources: RabUsageSource[]; review: boolean; note: string }
export type RabUsageComponent = RabUsageResource & { key: string; codes: string[]; total: number; jobs: RabUsageJob[] }
export type RabUsageCoverage = { source: RabUsageSource; item: RabCandidate; available: boolean; review: boolean; note: string }
export type RabUsageReport = { components: RabUsageComponent[]; coverage: RabUsageCoverage[]; matched: number; covered: number; review: number; uniqueJobs: number }

export function rabUsageResourceKey(resource: RabUsageResource, analysis?: RabUsageAnalysis | null): string {
  const code = resource.code.trim().toUpperCase()
  const prefix = { tenaga: 'L', bahan: 'M', alat: 'E' }[resource.group]
  const verifiedCode = analysis?.identity_scope && new RegExp(`^${prefix}\\d[\\w.()/+-]*$`).test(code)
  return JSON.stringify([resource.group, verifiedCode ? ['code', analysis.identity_scope, code] : ['name', rabText(resource.name)], rabUnit(resource.unit)])
}

export function buildRabUsage(rows: RabRow[], analyses: RabUsageAnalysis[]): RabUsageReport {
  const lookup = new Map(analyses.map(analysis => [analysis.item.id, analysis]))
  const components = new Map<string, RabUsageComponent>()
  const coverage: RabUsageCoverage[] = []
  const seenRows = new Set<string>()
  for (const row of rows) {
    if (row.excluded || row.status !== 'matched' || !row.candidate || seenRows.has(row.id)) continue
    seenRows.add(row.id)
    const item = row.candidate, data = lookup.get(item.id)
    const source = { id: row.id, sheet: row.sheet, row: row.row, source: row.source, name: row.name }
    const changed = data && (rabText(item.name) !== rabText(data.item.name) || rabText(item.code) !== rabText(data.item.code) || item.regulation !== data.item.regulation || rabUnit(item.unit) !== rabUnit(data.item.unit))
    const resources = changed ? [] : data?.components.filter(c => ['tenaga', 'bahan', 'alat'].includes(c.group) && c.name.trim() && c.unit.trim() && c.unit.trim() !== '-') ?? []
    const available = resources.length > 0
    const review = available && (data!.status !== 'extracted' || data!.excluded_components > 0 || !!data!.note)
    const note = changed ? 'Identitas katalog berubah. Periksa pasangan dan lakukan rekonsiliasi ulang.' : !data ? 'Rincian analisis belum dimuat atau item tidak ditemukan.' : data.note || (!available ? 'Rincian komponen MPTK belum tersedia.' : review ? 'Rincian tersedia sebagian atau analisis perlu ditinjau.' : '')
    coverage.push({ source, item, available, review, note })
    const perRow = new Set<string>()
    for (const resource of resources) {
      const key = rabUsageResourceKey(resource, data)
      let component = components.get(key)
      if (!component) {
        component = { ...resource, key, codes: [], total: 0, jobs: [] }
        components.set(key, component)
      }
      if (resource.code && !component.codes.includes(resource.code)) component.codes.push(resource.code)
      if (perRow.has(key)) continue
      perRow.add(key)
      component.total++
      let job = component.jobs.find(job => job.item.id === item.id)
      if (!job) { job = { item, analysis: data!.analysis, sources: [], review, note }; component.jobs.push(job) }
      job.sources.push(source)
    }
  }
  return { components: [...components.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id') || a.unit.localeCompare(b.unit, 'id')),
    coverage, matched: coverage.length, covered: coverage.filter(c => c.available).length, review: coverage.filter(c => c.review).length, uniqueJobs: new Set(coverage.map(c => c.item.id)).size }
}
