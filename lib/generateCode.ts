import { randomInt } from 'node:crypto'

export function generateCode(length = 5) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // tanpa karakter mirip (0/O, 1/I)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[randomInt(chars.length)]
  }
  return code
}