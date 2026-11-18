import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const filename = new URL('../.env.local', import.meta.url)
let current = await readFile(filename, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
const keys = { AHSP_AI_ADMIN_TOKEN: randomBytes(32).toString('base64url'), AHSP_AI_ENCRYPTION_KEY: randomBytes(32).toString('base64') }
const added = []
for (const [key, value] of Object.entries(keys)) {
  if (new RegExp(`^${key}=.+$`, 'm').test(current)) continue
  if (new RegExp(`^${key}=.*$`, 'm').test(current)) current = current.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`)
  else current += `${current.endsWith('\n') || !current ? '' : '\n'}${key}=${value}\n`
  added.push(key)
}
if (added.length) await writeFile(filename, current, { encoding: 'utf8', mode: 0o600 })
console.log(added.length ? `Disiapkan di .env.local: ${added.join(', ')}. Nilai rahasia tidak dicetak.` : 'Konfigurasi AI sudah ada; tidak ada kunci yang diganti.')
console.log('Restart dev server. Salin AHSP_AI_ADMIN_TOKEN dari .env.local ke kolom Kunci akses pengelola. Terapkan migrasi 202610250002_ahsp_ai_profiles.sql melalui Supabase SQL Editor.')
