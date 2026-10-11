import type { Category, Transaction } from '@/types/fintrack'

export function compareBudgetUsage(a: { used: number; budget: number }, b: { used: number; budget: number }) {
  return b.used / b.budget - a.used / a.budget || b.used - a.used
}

export function compareCategoryUsage(a: Category, b: Category) {
  return (b.usage_count || 0) - (a.usage_count || 0) || a.name.localeCompare(b.name, 'id')
}

export function searchTransactionNotes(transactions: Transaction[], query: string) {
  const term = query.trim().toLocaleLowerCase('id')
  return term ? transactions.filter(item => (item.note || '').toLocaleLowerCase('id').includes(term)) : transactions
}

export function suggestTransactionNotes(transactions: Transaction[], query: string) {
  const term = query.trim().toLocaleLowerCase('id')
  if (Array.from(term).length < 3) return []
  const suggestions = new Map<string, { note: string; count: number }>()
  for (const transaction of transactions) {
    const note = transaction.note?.trim(), key = note?.toLocaleLowerCase('id')
    if (!note || !key || note.length > 100 || key === term || !key.includes(term)) continue
    const entry = suggestions.get(key)
    suggestions.set(key, { note: entry?.note || note, count: (entry?.count || 0) + 1 })
  }
  return [...suggestions.values()].sort((a, b) => b.count - a.count || a.note.localeCompare(b.note, 'id')).slice(0, 5).map(item => item.note)
}
