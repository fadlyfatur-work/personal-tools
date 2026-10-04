export async function POST(request: Request) {
  let body: { lat?: unknown; lon?: unknown }
  try { body = await request.json() } catch { return Response.json({ error: 'Koordinat tidak valid.' }, { status: 400 }) }
  if (!body || typeof body.lat !== 'number' || typeof body.lon !== 'number' || !Number.isFinite(body.lat) || !Number.isFinite(body.lon) || Math.abs(body.lat) > 90 || Math.abs(body.lon) > 180) {
    return Response.json({ error: 'Koordinat tidak valid.' }, { status: 400 })
  }
  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) return Response.json({ error: 'Alamat otomatis belum aktif.' }, { status: 503 })
  const url = new URL('https://api.geoapify.com/v1/geocode/reverse')
  url.search = new URLSearchParams({ lat: String(body.lat), lon: String(body.lon), lang: 'id', format: 'json', limit: '1', apiKey }).toString()
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Provider unavailable')
    const data = await response.json()
    const location = data.results?.[0]
    if (location?.country_code !== 'id' || typeof location.formatted !== 'string' || !location.formatted.trim()) {
      return Response.json({ error: 'Alamat Indonesia tidak ditemukan untuk koordinat ini.' }, { status: 404 })
    }
    return Response.json({ address: location.formatted.slice(0, 400) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return Response.json({ error: 'Alamat tidak dapat diambil saat ini.' }, { status: 502 }) }
}
