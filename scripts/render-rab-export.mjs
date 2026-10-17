import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const runtime = path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const require = createRequire(path.join(runtime, 'package.json'))
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href)
const filename = process.argv[2] || '.next/rab-tests/ui-export.xlsx'
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filename))
console.log((await workbook.inspect({ kind: 'region', sheetId: 'Final RAB', range: 'A6:G12', maxChars: 1800, tableMaxRows: 7, tableMaxCols: 7 })).ndjson)
const regions = process.argv.includes('--usage') ? [['Rekapitulasi', 'A1:D36'], ['Rekapitulasi MPTK', 'A1:E14'], ['Rincian Penggunaan', 'A1:M5'], ['Cakupan Komponen', 'A1:I5'], ['Final RAB', 'A6:H10'], ['Regulasi Utama', 'A1:O3']] : [['Rekapitulasi', 'A1:D38'], ['Final RAB', 'A1:H12']]
for (const [sheetName, range] of regions) {
  const image = await workbook.render({ sheetName, range, scale: 1, format: 'png' })
  const output = '.next/rab-tests/' + (process.argv.includes('--usage') ? 'usage-' + sheetName.toLowerCase().replaceAll(' ', '-') + '.png' : sheetName === 'Rekapitulasi' ? 'rekap-preview.png' : 'final-rab-preview.png')
  await fs.writeFile(output, new Uint8Array(await image.arrayBuffer()))
  console.log('Rendered', output)
}
