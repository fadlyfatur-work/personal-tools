import fs from 'node:fs/promises'

const providers = { bca: 'https://www.bca.co.id', mandiri: 'https://www.bankmandiri.co.id', bri: 'https://bri.co.id', bni: 'https://www.bni.co.id', bsi: 'https://www.bankbsi.co.id', gopay: 'https://gopay.co.id', ovo: 'https://www.ovo.id', dana: 'https://www.dana.id', shopeepay: 'https://shopeepay.co.id' }
await fs.mkdir('public/fintrack/providers', { recursive: true })
const sources = JSON.parse(await fs.readFile('public/fintrack/providers/sources.json', 'utf8').catch(() => '{}'))
await Promise.all(Object.entries(providers).map(async ([code, site]) => {
  if (sources[code]) return
  try {
    const response = await fetch(site, { signal: AbortSignal.timeout(20000) })
    const html = await response.text()
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0])
    const icon = links.find(link => /rel=["'][^"']*apple-touch-icon/i.test(link)) || links.find(link => /rel=["'][^"']*icon/i.test(link))
    const href = icon?.match(/href=["']([^"']+)/i)?.[1] || '/favicon.ico'
    const url = new URL(href.replaceAll('&amp;', '&'), response.url).href
    const asset = await fetch(url, { signal: AbortSignal.timeout(20000) })
    const bytes = new Uint8Array(await asset.arrayBuffer())
    const type = asset.headers.get('content-type') || ''
    if (!asset.ok || /html/i.test(type) || bytes.length < 50 || bytes.length > 500000) throw new Error('Ikon raster tidak tersedia')
    const extension = /svg/i.test(type) ? 'svg' : /icon/i.test(type) ? 'ico' : 'png'
    await fs.writeFile(`public/fintrack/providers/${code}.${extension}`, bytes)
    sources[code] = { site, url, contentType: type, path: `/fintrack/providers/${code}.${extension}` }
    console.log(`${code}: tersimpan`)
  } catch (error) {
    try {
      const url = `https://www.google.com/s2/favicons?domain=${new URL(site).hostname}&sz=128`
      const result = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!result.ok) throw error
      await fs.writeFile(`public/fintrack/providers/${code}.png`, new Uint8Array(await result.arrayBuffer()))
      sources[code] = { site, url, contentType: result.headers.get('content-type'), path: `/fintrack/providers/${code}.png` }
      console.log(`${code}: favicon tersimpan`)
    } catch { console.log(`${code}: ${error.message}`) }
  }
}))
for (const [code, source] of Object.entries(sources)) source.path ||= `/fintrack/providers/${code}.png`
await fs.writeFile('public/fintrack/providers/sources.json', JSON.stringify(sources, null, 2) + '\n')
if (Object.keys(sources).length !== Object.keys(providers).length) process.exitCode = 1
