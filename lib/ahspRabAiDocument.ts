import { AI_LIMITS } from './ahspRabAi'

export type AiDocumentPage = { page: number; text: string; imageUrl: string; image: string; mime: 'image/jpeg' }
export type AiDocument = { kind: 'pdf' | 'image'; count: number; page: (n: number) => Promise<AiDocumentPage>; destroy: () => void }

export function parseAiPages(value: string, count: number) {
  const selected = new Set<number>()
  for (const part of value.split(',').map(s => s.trim()).filter(Boolean)) {
    if (!/^\d+(?:\s*-\s*\d+)?$/.test(part)) throw new Error('Gunakan nomor halaman seperti 1-3, 5.')
    const [start, end = start] = part.split('-').map(Number)
    if (start < 1 || end < start || end > count || end - start >= AI_LIMITS.pages) throw new Error(`Pilih halaman 1–${count}, maksimal ${AI_LIMITS.pages} halaman.`)
    for (let n = start; n <= end; n++) selected.add(n)
  }
  if (!selected.size || selected.size > AI_LIMITS.pages) throw new Error(`Pilih 1–${AI_LIMITS.pages} halaman.`)
  return [...selected].sort((a, b) => a - b)
}
const raster = (canvas: HTMLCanvasElement, page: number, text: string): AiDocumentPage => {
  const imageUrl = canvas.toDataURL('image/jpeg', .9)
  canvas.width = 0; canvas.height = 0
  return { page, text, imageUrl, image: imageUrl.slice(imageUrl.indexOf(',') + 1), mime: 'image/jpeg' }
}
export async function openAiDocument(file: File): Promise<AiDocument> {
  if (file.size > AI_LIMITS.bytes || !file.size) throw new Error('Pilih PDF atau gambar yang berisi data, maksimal 10 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdf = /\.pdf$/i.test(file.name) && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  if (pdf) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const task = pdfjs.getDocument({ data: bytes, useWasm: true, useSystemFonts: true, disableFontFace: true, enableXfa: false,
      cMapUrl: '/api/ahsp/rab/ai/pdf-assets/cmaps/', cMapPacked: true, standardFontDataUrl: '/api/ahsp/rab/ai/pdf-assets/standard_fonts/', wasmUrl: '/api/ahsp/rab/ai/pdf-assets/wasm/',
    })
    let doc
    try { doc = await task.promise } catch { void task.destroy(); throw new Error('PDF tidak dapat dibaca atau terlindungi sandi. Gunakan PDF tanpa sandi.') }
    if (doc.numPages > 500) { void task.destroy(); throw new Error('PDF maksimal 500 halaman; pecah dokumen sebelum diunggah. Maksimal 10 halaman diproses per impor.') }
    return { kind: 'pdf', count: doc.numPages, destroy: () => { void task.destroy() }, page: async n => {
      const page = await doc.getPage(n), original = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2.5, 2000 / Math.max(original.width, original.height)) })
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      try {
        await page.render({ canvas, viewport }).promise
        const content = await page.getTextContent()
        const lines = new Map<number, { x: number; text: string }[]>()
        for (const item of content.items) if ('str' in item) {
          const y = Math.round(item.transform[5] / 3) * 3
          lines.set(y, [...(lines.get(y) || []), { x: item.transform[4], text: item.str }])
        }
        const text = [...lines].sort((a, b) => b[0] - a[0]).map(([, line]) => line.sort((a, b) => a.x - b.x).map(item => item.text).join(' | ')).join('\n')
        if (text.length > AI_LIMITS.text) throw new Error('Teks halaman melebihi 120.000 karakter. Pilih dokumen yang lebih kecil.')
        return raster(canvas, n, text)
      } finally { canvas.width = 0; canvas.height = 0; page.cleanup() }
    } }
  }
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !(png || jpeg || webp)) throw new Error('Format tidak sesuai. Gunakan .xlsx, .pdf, .png, .jpg, atau .webp.')
  const bitmap = await createImageBitmap(new Blob([bytes], { type: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' }))
  if (bitmap.width * bitmap.height > 24000000) { bitmap.close(); throw new Error('Gambar maksimal 24 megapiksel. Kecilkan gambar sebelum diunggah.') }
  return { kind: 'image', count: 1, destroy: () => bitmap.close(), page: async () => {
    const ratio = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas')
    canvas.width = Math.ceil(bitmap.width * ratio); canvas.height = Math.ceil(bitmap.height * ratio)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return raster(canvas, 1, '')
  } }
}
