const key = 'timemark-locations-id-v1'
type Entry = { query: string; results: string[]; expires: number }
export const normalizeQuery = (query: string) => query.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')

function entries(): Entry[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(data)) return []
    return data.filter((item): item is Entry => item && typeof item.query === 'string' &&
      typeof item.expires === 'number' && item.expires > Date.now() && Array.isArray(item.results) &&
      item.results.length <= 5 && item.results.every((text: unknown) => typeof text === 'string' && text.length <= 400)).slice(-200)
  } catch { return [] }
}

export function cachedLocations(query: string): string[] | undefined {
  return entries().find(item => item.query === normalizeQuery(query))?.results
}

export function cacheLocations(query: string, results: string[]) {
  const normalized = normalizeQuery(query)
  const next = entries().filter(item => item.query !== normalized)
  next.push({ query: normalized, results, expires: Date.now() + (results.length ? 7 * 24 : 1) * 60 * 60 * 1000 })
  try { localStorage.setItem(key, JSON.stringify(next.slice(-200))) }
  catch { /* Autocomplete remains usable when browser storage is full or disabled. */ }
}
