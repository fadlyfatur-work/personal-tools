import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { AI_LIMITS, parseAiItems, readAiPath, redactAi, renderAiTemplate, type AiConfig, type AiJson, type AiTrace } from './ahspRabAi'
import { clientKey, rateLimit } from './rateLimit'

export function checkAiAccess(request: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const limit = rateLimit(`ahsp-ai-access:${clientKey(request)}`, 60, 60000)
  if (!limit.ok) return Response.json({ error: 'Terlalu banyak permintaan AI. Coba lagi sebentar.' }, { status: 429 })
  if (!env.AHSP_AI_ADMIN_TOKEN || env.AHSP_AI_ADMIN_TOKEN.length < 32 || !env.AHSP_AI_ENCRYPTION_KEY) return Response.json({ error: 'Pengelola perlu mengatur AHSP_AI_ADMIN_TOKEN (minimal 32 karakter) dan AHSP_AI_ENCRYPTION_KEY (32 byte base64) di server.' }, { status: 503 })
  const supplied = request.headers.get('x-ahsp-ai-access') || ''
  if (!timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(env.AHSP_AI_ADMIN_TOKEN).digest())) return Response.json({ error: 'Masukkan kunci akses pengelola untuk menggunakan API AI.' }, { status: 401 })
  return null
}
function encryptionKey(secret = process.env.AHSP_AI_ENCRYPTION_KEY) {
  const key = Buffer.from(secret || '', 'base64')
  if (key.length !== 32) throw new Error('Kunci enkripsi server harus 32 byte dalam base64.')
  return key
}
export function sealAiKey(value: string, secret?: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.')
}
export function openAiKey(value: string, secret?: string) {
  const [version, iv, tag, data] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Format kunci tersimpan tidak didukung.')
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(iv, 'base64'))
  cipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8')
}

const blocked4 = new BlockList(), blocked6 = new BlockList()
for (const [ip, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked4.addSubnet(ip, prefix, 'ipv4')
for (const [ip, prefix] of [['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) blocked6.addSubnet(ip, prefix, 'ipv6')
export function isPublicAiAddress(address: string) {
  const family = isIP(address)
  return family === 4 ? !blocked4.check(address, 'ipv4') : family === 6 && !blocked6.check(address, 'ipv6')
}
export function validateAiUrl(endpoint: string) {
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.hash || isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) throw new Error('Gunakan URL HTTPS publik pada port 443, tanpa kredensial atau alamat IP.')
  if (/\{\{|\}\}/.test(endpoint)) throw new Error('Variabel URL belum terisi. Hanya {{model}} yang didukung pada URL.')
  return url
}
export async function readAiJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new Error('Batas ukuran permintaan AI terlampaui.')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Permintaan kosong.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new Error('Batas ukuran permintaan AI terlampaui.') } chunks.push(value) }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Error('Isi permintaan harus JSON yang valid.') }
}

export async function postAiHttps(url: URL, headers: Record<string, string>, body: string, signal?: AbortSignal): Promise<{ status: number; body: string }> {
  const addresses = await lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(item => !isPublicAiAddress(item.address))) throw new Error('Alamat API mengarah ke jaringan privat atau alamat yang dibatasi.')
  const pinned = addresses[0]
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, signal, agent: false,
      lookup: (_hostname, options, callback) => { if (options.all) callback(null, [pinned]); else callback(null, pinned.address, pinned.family) },
    }, response => {
      const chunks: Buffer[] = []; let size = 0
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > AI_LIMITS.response) response.destroy(new Error('Respons API melebihi 2 MB. Kurangi halaman atau keluaran model.')); else chunks.push(chunk) })
      response.on('error', reject)
      response.on('end', () => resolve({ status: response.statusCode || 502, body: Buffer.concat(chunks).toString('utf8') }))
    })
    const timer = setTimeout(() => req.destroy(new Error('API tidak merespons dalam 120 detik.')), 120000)
    req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end(body)
  })
}

export type AiCallInput = { stage: 'ocr' | 'structure'; text?: string; image?: string; mime?: string; page?: number; pages: number[] }
export async function callAiModel(config: AiConfig, key: string, input: AiCallInput, transport = postAiHttps, signal?: AbortSignal) {
  const start = Date.now()
  const trace: AiTrace = { id: randomUUID(), stage: input.stage, profile: config.name, model: config.model, page: input.page ?? null, startedAt: new Date(start).toISOString(), durationMs: 0, status: null, ok: false, request: null, response: null }
  try {
    const stage = config[input.stage]
    const vars: Record<string, AiJson> = { model: config.model, prompt: stage.prompt, page: input.page ?? null, pages: input.pages, ocr_text: input.text || '', image_mime: input.mime || '', image_base64: input.image || '', image_data_url: input.image ? `data:${input.mime};base64,${input.image}` : '', api_key: key }
    const endpoint = config.endpoint.replaceAll('{{model}}', encodeURIComponent(config.model))
    const url = validateAiUrl(endpoint)
    const headers = renderAiTemplate(config.headers, { api_key: key, model: config.model }) as Record<string, string>
    for (const [name, value] of Object.entries(headers)) if (!/^[!#$%&'*+.^_`|~\w-]+$/.test(name) || /[\r\n]/.test(value) || /^(host|content-length|connection|transfer-encoding|cookie|proxy-authorization)$/i.test(name)) throw new Error('Nama atau nilai header tidak diizinkan.')
    const body = renderAiTemplate(stage.body as AiJson, vars)
    const serialized = JSON.stringify(body)
    if (Buffer.byteLength(serialized) > AI_LIMITS.bytes) throw new Error('Body API melebihi 10 MB.')
    trace.request = redactAi({ url: endpoint, method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body }, [key])
    const response = await transport(url, headers, serialized, signal)
    trace.status = response.status
    let raw: unknown
    try { raw = JSON.parse(response.body) } catch { raw = response.body }
    trace.response = redactAi(raw, [key])
    if (response.status < 200 || response.status >= 300) throw new Error(response.status >= 300 && response.status < 400 ? 'API mengalihkan alamat. Gunakan URL tujuan akhir; redirect tidak diikuti.' : `API mengembalikan HTTP ${response.status}. Lihat respons untuk rincian.`)
    if (['length', 'MAX_TOKENS', 'max_tokens'].includes(String(readAiPath(raw, 'choices[0].finish_reason') || readAiPath(raw, 'candidates[0].finishReason') || readAiPath(raw, 'stop_reason') || ''))) throw new Error('Respons model terpotong karena batas token. Kurangi halaman atau sesuaikan template.')
    trace.usage = redactAi(readAiPath(raw, 'usage') ?? readAiPath(raw, 'usageMetadata'), [key])
    const content = readAiPath(raw, stage.responsePath)
    if (content === undefined || content === null) throw new Error('Jalur respons tidak ditemukan. Periksa pemetaan respons profil.')
    if (input.stage === 'ocr') {
      if (typeof content !== 'string' || !content.trim() || content.length > AI_LIMITS.text) throw new Error('Teks OCR kosong atau melebihi batas 120.000 karakter.')
      trace.ok = true; trace.result = redactAi(content, [key])
      return { text: content, trace }
    }
    const items = parseAiItems(content, config, input.pages)
    trace.ok = true; trace.result = redactAi(items, [key])
    return { items, trace }
  } catch (error) { trace.error = String(redactAi(error instanceof Error ? error.message : 'Panggilan AI gagal.', [key])); return { trace } }
  finally { trace.durationMs = Date.now() - start }
}
