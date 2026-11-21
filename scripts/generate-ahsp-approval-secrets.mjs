import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import bcrypt from 'bcryptjs'

const terminal = createInterface({ input: stdin, output: stdout })
try {
  const pin = await terminal.question('Buat PIN admin baru (6–12 angka): ')
  if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN harus berisi 6–12 angka.')
  const hash = await bcrypt.hash(pin, 12)
  const secret = randomBytes(32).toString('base64url')
  stdout.write(`\nTambahkan ke .env.local (jangan commit):\nAHSP_APPROVAL_PIN_HASH=${hash}\nAHSP_APPROVAL_SESSION_SECRET=${secret}\n`)
} finally { terminal.close() }
