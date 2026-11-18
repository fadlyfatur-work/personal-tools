import { readFile } from 'node:fs/promises'
import path from 'node:path'
export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params
  if (asset.length !== 2 || !['cmaps', 'standard_fonts', 'wasm'].includes(asset[0]) || !/^[a-zA-Z0-9_-]+\.(?:bcmap|pfb|ttf|otf|wasm|js)$/.test(asset[1])) return new Response('Not found', { status: 404 })
  try {
    const content = await readFile(path.join(process.cwd(), 'node_modules', 'pdfjs-dist', asset[0], asset[1]))
    const type = asset[1].endsWith('.wasm') ? 'application/wasm' : asset[1].endsWith('.js') ? 'text/javascript' : 'application/octet-stream'
    return new Response(content, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } })
  } catch { return new Response('Not found', { status: 404 }) }
}
