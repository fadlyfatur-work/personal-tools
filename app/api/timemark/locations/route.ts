export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') || '').trim().replace(/\s+/g, ' ')
  if (query.length < 5 || query.length > 200) {
    return Response.json({ error: 'Ketik 5–200 karakter untuk mencari lokasi.' }, { status: 400 })
  }
  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) return Response.json({ error: 'Pencarian lokasi belum diaktifkan. Silakan isi manual.' }, { status: 503 })
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete')
  url.search = new URLSearchParams({ text: query, filter: 'countrycode:id', limit: '5', lang: 'id', format: 'json', apiKey }).toString()
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) return Response.json({ error: 'Layanan lokasi sedang tidak tersedia. Silakan isi manual.' }, { status: response.status === 429 ? 429 : 502 })
    const data = await response.json()
    if (!Array.isArray(data.results)) throw new Error('Invalid provider response')
    const results = [...new Set<string>(data.results
      .filter((item: { country_code?: string; formatted?: string }) => item?.country_code === 'id' && typeof item.formatted === 'string' && item.formatted.trim())
      .map((item: { formatted: string }) => item.formatted.slice(0, 400)))].slice(0, 5)
    return Response.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Pencarian lokasi gagal. Coba lagi atau isi manual.' }, { status: 502 })
  }
}
