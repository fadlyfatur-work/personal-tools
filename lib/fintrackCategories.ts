import type { Category, ReportSlice, Transaction } from '@/types/fintrack'

type ReportCategory = Pick<Category, 'id' | 'name' | 'emoji' | 'parent_id'>

export function categoryBudget(category: Category, categories: Category[]) {
  if (category.parent_id || category.budget_mode !== 'children') return Number(category.budget_amount || 0)
  return categories.filter(item => item.parent_id === category.id && !item.archived_at).reduce((sum, item) => sum + Number(item.budget_amount || 0), 0)
}

export function categorySlices(transactions: Transaction[], categories: ReportCategory[], type: 'income' | 'expense', parentId?: string | null, groupParents = true): ReportSlice[] {
  const categoryMap = new Map(categories.map(item => [item.id, item]))
  const grouped = new Map<string, ReportSlice>()
  for (const transaction of transactions) {
    if (transaction.type !== type) continue
    const leaf = transaction.category_id ? categoryMap.get(transaction.category_id) : undefined
    if (parentId && leaf?.id !== parentId && leaf?.parent_id !== parentId) continue
    const category = groupParents && !parentId && leaf?.parent_id ? categoryMap.get(leaf.parent_id) || leaf : leaf
    const key = category?.id || '__none__'
    const entry = grouped.get(key) || { category_id: category?.id || null, category_ids: [], name: parentId && category?.id === parentId ? `${category.name} (langsung)` : category?.name || 'Tanpa kategori', emoji: category?.emoji, amount: 0 }
    if (transaction.category_id && !entry.category_ids.includes(transaction.category_id)) entry.category_ids.push(transaction.category_id)
    entry.amount += Number(transaction.amount)
    grouped.set(key, entry)
  }
  return [...grouped.values()].sort((a, b) => b.amount - a.amount)
}
