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
