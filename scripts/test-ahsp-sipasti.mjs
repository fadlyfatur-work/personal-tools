import assert from 'node:assert/strict'
import { reconcile } from './reconcile-ahsp-sipasti.mjs'

const fields = [{ id: 'sda', name: 'Sumber Daya Air' }, { id: 'bm', name: 'Bina Marga' }]
const database = (id, code, name, field = 'Sumber Daya Air', regulation = 'SE 47/2026') => ({ id, code, name, field, regulation, unit: 'm3', division: '', ahsp_type: '' })
const sipasti = (code, name, field = 'sda') => ({ code, name, job_field_id: field, regulasi_se: 'SE 182/2025, SE 47/2026', unit: 'm3', job_type: 'informative' })
const original = [database('a', ' A.1 ', 'Nama database'), database('b', 'A.2a', 'Varian A'), database('c', 'A.3', 'Pekerjaan pertama'), database('d', 'A.3', 'Pekerjaan lain'), database('e', 'A.1', 'Nama database', 'Bina Marga'), database('f', 'A.1', 'Nama database', 'Sumber Daya Air', 'PERMEN 08/2023')]
const rows = [sipasti('a.1', 'Nama SIPASTI'), sipasti('A.2b', 'Varian B'), sipasti('A.3', 'Pekerjaan pertama'), sipasti('A.3', 'Pekerjaan pertama'), { ...sipasti('A.4', 'Satuan kosong'), unit: null }]
const before = JSON.stringify(original)
const result = reconcile(original, fields, rows)
assert.equal(JSON.stringify(original), before, 'Reconciliation never mutates existing analysis or metadata')
assert.equal(result.changes.find(row => row.id === 'a').status, 'both', 'Whitespace/case code changes match, title differences are reported separately')
assert.equal(result.changes.find(row => row.id === 'b').status, 'database_only', 'Letter suffixes remain distinct')
assert.equal(result.changes.find(row => row.id === 'c').status, 'both')
assert.equal(result.changes.find(row => row.id === 'd').status, 'database_only', 'A shared code cannot verify a different work item')
assert.equal(result.changes.find(row => row.id === 'e').status, 'database_only', 'The same code in another field remains distinct')
assert.equal(result.changes.find(row => row.id === 'f').status, 'database_only', 'The same code in another regulation remains distinct')
assert.equal(result.summary.added, 2, 'Duplicate SIPASTI rows do not create duplicate items')
assert.equal(result.changes.find(row => row.id === 'c').rows.length, 2, 'Every source row retains provenance')
assert.equal(result.changes.find(row => row.item?.code === 'A.4').item.unit, '')
for (const row of result.changes.filter(row => row.item)) {
  assert.equal(row.item.analysis_status, 'unavailable')
  assert.deepEqual(row.item.components, [])
  assert.equal(row.item.source_id, null, 'SIPASTI summaries are not misrepresented as extracted appendix analysis')
}
const rerun = reconcile([...original, ...result.changes.filter(row => row.item).map(row => row.item)], fields, rows)
assert.equal(rerun.summary.added, 0, 'Re-running the same source is idempotent')
assert.equal(rerun.summary.sipasti_only, 2, 'Imported-only items retain their provenance on subsequent runs')
assert.throws(() => reconcile(original, fields, [{ ...rows[0], job_field_id: 'unknown' }]), /identitas tidak valid/)
assert.throws(() => reconcile(original, fields, [{ ...rows[0], regulasi_se: 'SE 182\/2025' }]), /di luar cakupan/)
const correctionField = { id: 'c7c994df-efb0-48d6-9cb4-5e5e2fad69ps', name: 'Bina Marga' }
const correctionRows = [{ ...sipasti('2.3.(25a)1', '1Saluran U Pracetak Tipe DS 5', correctionField.id) }]
const correction = reconcile([database('correct', '2.3.(25a)', 'Saluran U Pracetak Tipe DS 5', 'Bina Marga')], [correctionField], correctionRows)
assert.equal(correction.summary.added, 0, 'The user-confirmed SIPASTI typo resolves to the existing item')
assert.equal(correction.summary.both, 1)
assert.equal(correction.summary.identity_corrections, 1)
assert.equal(correctionRows[0].code, '2.3.(25a)1', 'The raw export retains its original identity for auditing')
const permenFields = [...fields, { id: 'umum', name: 'Umum' }, { id: 'smkk', name: 'SMKK' }]
const permenDatabase = [database('latest', 'A.1', 'Pekerjaan 2026'), database('base', 'U.1', 'Pekerjaan umum', 'Umum', 'PERMEN 08/2023')]
const permenRows = [sipasti('A.1', 'Pekerjaan 2026'), { ...sipasti('U.1', 'Pekerjaan umum', 'umum'), regulasi_se: 'PERMEN 08/2023' }, { ...sipasti(null, 'Poster/leaflet', 'smkk'), regulasi_se: 'PERMEN 08/2023' }]
const permen = reconcile(permenDatabase, permenFields, permenRows)
assert.equal(permen.summary.both, 2, 'The combined export reconciles Permen Umum and SE 2026 without changing regulation identity')
assert.equal(permen.summary.excluded_rows, 1, 'Legacy SMKK is excluded unless explicitly selected')
assert.deepEqual(permen.changes.find(row => row.id === 'base').rows, [2], 'Original export row numbers remain intact after exclusions')
const withLegacy = reconcile(permenDatabase, permenFields, [...permenRows, { ...permenRows[2], name: 'Spanduk' }, permenRows[2]], { includePermenSmkk: true })
assert.equal(withLegacy.summary.added, 2, 'Code-less work items use their name and unit rather than collapsing into a single null code')
assert.ok(withLegacy.changes.filter(row => row.item).every(row => row.item.regulation === 'PERMEN 08/2023' && row.item.code === ''))
assert.equal(withLegacy.summary.excluded_rows, 0)
console.log('AHSP SIPASTI: identity, collisions, duplicates, metadata preservation, missing units, source provenance and idempotence passed.')
