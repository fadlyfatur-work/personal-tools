import type { AhspItem } from './ahsp'
import type { RabUsageResource } from './ahspRabUsage'

export function readAhspNativeComponents(item: Pick<AhspItem, 'field' | 'code' | 'source_text'>): { components: RabUsageResource[]; skipped: number; zero: number } {
  const components: RabUsageResource[] = []
  if (item.field !== 'Bina Marga' || !item.code.trim()) return { components, skipped: 0, zero: 0 }
  const lines = item.source_text.normalize('NFKC').split(/\r?\n/)
  const code = item.code.replace(/\s/g, '').toLowerCase()
  const start = lines.findIndex(line => /^\s*[A-Z]\.\d+\s+/i.test(line) && line.replace(/\s/g, '').toLowerCase().endsWith(`(${code})`))
  if (start < 0) return { components, skipped: 0, zero: 0 }
  const groups = { A: 'tenaga', B: 'bahan', C: 'alat' } as const
  let group: RabUsageResource['group'] | null = null, skipped = 0, zero = 0
  const seenGroups = new Set<string>()
  for (const line of lines.slice(start + 1)) {
    if (/^\s*[A-Z]\.\d+\s+/i.test(line)) break
    const heading = /^\s*([ABC])[.)]\s*(TENAGA(?:\s+KERJA)?|BAHAN|PERALATAN|ALAT)\s*$/i.exec(line)
    if (heading) {
      const letter = heading[1].toUpperCase() as keyof typeof groups
      const expected = letter === 'A' ? /^TENAGA/i : letter === 'B' ? /^BAHAN/i : /^(PERALATAN|ALAT)/i
      group = expected.test(heading[2]) ? groups[letter] : null
      if (group) seenGroups.add(group)
      continue
    }
    if (/^\s*[D-F][.)]\s+/i.test(line)) break
    if (!group || !/^\s*\d+[.)]?\s+/.test(line)) continue
    // The final cost table has quantity and two price columns; productivity steps do not.
    const row = /^\s*\d+[.)]?\s+(.+?)\s+([A-Za-z%][\w²³’'/.-]*)\s+([+-]?\d[\d.,]*)(?:\s+[+-]?\d[\d.,]*){2}\s*$/.exec(line)
    if (!row) { skipped++; continue }
    let name = row[1].trim(), resourceCode = ''
    const suffix = /\s+(\(?[LME]\d[\w.()/+-]*\)?)$/.exec(name)
    if (suffix) { resourceCode = suffix[1].replace(/^\(|\)$/g, ''); name = name.slice(0, suffix.index).trim() }
    const unit = row[2]
    const laborUnit = /^(jam|oh|oj|ob)$/i.test(unit)
    const codeGroup = resourceCode[0]?.toUpperCase()
    if (!/[A-Za-z]{2}/.test(name) || /[=]|JUMLAH|KOEFISIEN/i.test(name) ||
      (group === 'tenaga' && !laborUnit) || (group === 'bahan' && laborUnit) || (group === 'alat' && /^(oh|oj|ob)$/i.test(unit)) ||
      (resourceCode && codeGroup !== ({ tenaga: 'L', bahan: 'M', alat: 'E' }[group]))) { skipped++; continue }
    if (/^[+-]?0+(?:[.,]0+)*$/.test(row[3])) { zero++; continue }
    components.push({ group, name, code: resourceCode, unit })
  }
  return seenGroups.size === 3 ? { components, skipped, zero } : { components: [], skipped, zero: 0 }
}
