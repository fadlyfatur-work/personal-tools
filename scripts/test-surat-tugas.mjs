// Run with npm run dev active. No database writes or external requests.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import PizZip from 'pizzip'

const base = process.env.DOCUMENTS_TEST_URL || 'http://localhost:3000'
const single = {
  nomor_surat: '123/ST/2026', menimbang_1: 'Pelaksanaan koordinasi teknis.', menimbang_2: '',
  dasar: 'Program kerja tahun 2026.', nama_acara: 'Koordinasi & evaluasi',
  tanggal_perjalanan_dinas: { start: '2026-09-29', end: '2026-09-29' },
  kota_tujuan: 'Bandung', provinsi_tujuan: 'Jawa Barat', jenis_transportasi: 'Transportasi darat',
  sumber_anggaran: 'Anggaran kegiatan tahun 2026', tanggal: '2026-09-28',
}
const employees = count => Array.from({ length: count }, (_, index) => ({
  nama_lengkap: `Pegawai Uji ${index + 1}`, golongan: 'III', sub_golongan: 'a',
  nip: `0000000000000000${String(index + 1).padStart(2, '0')}`, jabatan: 'Jabatan untuk pengujian template',
}))
const generate = (count, changes = {}) => fetch(`${base}/api/generate`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'surat_tugas', single: { ...single, ...changes }, groups: { pegawai: employees(count) } }),
})
mkdirSync('.next/surat-tugas-check', { recursive: true })
for (const count of [1, 20]) {
  const response = await generate(count)
  assert.equal(response.status, 200, await response.clone().text())
  const bytes = Buffer.from(await response.arrayBuffer())
  const zip = new PizZip(bytes)
  const xml = zip.file('word/document.xml').asText()
  assert.equal((xml.match(/<w:tr(?:\s[^>]*)?>/g) || []).length, count + 9, 'No blank employee rows')
  for (let index = 1; index <= count; index++) assert.match(xml, new RegExp(`Pegawai Uji ${index}(?:<| )`))
  assert.ok(xml.includes('29 September 2026'))
  assert.ok(!xml.includes('29 s.d. 29'))
  assert.ok(xml.includes('Transportasi darat') && !xml.includes('Transportasi Transportasi'))
  assert.ok(xml.replace(/<[^>]*>/g, '').includes('Disaintina Ari Nusanti'))
  assert.ok(!xml.includes('Sabilissalam') && !xml.includes('{{'))
  assert.ok(zip.file('word/header1.xml').asText().includes(' PAGE '))
  writeFileSync(`.next/surat-tugas-check/${count}-pegawai.docx`, bytes)
}
for (const [start, end, expected] of [
  ['2026-08-01', '2026-08-03', '1 s.d. 3 Agustus 2026'],
  ['2026-08-31', '2026-09-02', '31 Agustus 2026 s.d. 2 September 2026'],
]) {
  const response = await generate(1, { tanggal_perjalanan_dinas: { start, end }, jenis_transportasi: 'Transportasi udara' })
  assert.equal(response.status, 200)
  const xml = new PizZip(Buffer.from(await response.arrayBuffer())).file('word/document.xml').asText()
  assert.ok(xml.includes(expected))
  assert.ok(xml.includes('Transportasi udara'))
}
assert.equal((await generate(1, { jenis_transportasi: 'Transportasi air' })).status, 200)
for (const [count, changes] of [
  [0, {}], [21, {}], [1, { jenis_transportasi: 'Tidak tersedia' }], [1, { nomor_surat: '' }],
  [1, { tanggal_perjalanan_dinas: { start: '2026-09-30', end: '2026-09-29' } }],
  [1, { tanggal: '2026-02-30' }],
]) assert.equal((await generate(count, changes)).status, 400)
console.log('Surat Tugas: 1/20 employees, dynamic rows, fixed signer, dates, 3 transport options and invalid-input rejection passed.')
