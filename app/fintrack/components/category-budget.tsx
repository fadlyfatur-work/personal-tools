import type { Category, ReportSlice } from '@/types/fintrack'
import { categoryBudget } from '@/lib/fintrackCategories'
import { CaretDown } from '@phosphor-icons/react'
import { formatRupiah } from './account-card'

export function CategoryBudget({ category, categories, totals, used: totalUsed }: { category: Category; categories: Category[]; totals: ReportSlice[]; used?: number }) {
  const children = categories.filter(item => item.parent_id === category.id)
  const budget = categoryBudget(category, categories)
  const usedFor = (id: string) => Number(totals.find(item => item.category_id === id)?.amount || 0)
  const used = totalUsed ?? (usedFor(category.id) + children.reduce((sum, item) => sum + usedFor(item.id), 0))
  const archivedUsed = Math.max(0, used - usedFor(category.id) - children.reduce((sum, item) => sum + usedFor(item.id), 0))
  const percentage = budget ? Math.round(used / budget * 100) : 0
  const content = <><div className="ft-budget-heading"><span className="ft-category-emoji">{category.emoji || '🏷️'}</span><span className="ft-budget-copy"><strong>{category.name}</strong><small>{formatRupiah(used)} dari {formatRupiah(budget)}</small></span><b>{percentage}%</b>{children.length > 0 && <CaretDown className="ft-budget-caret" size={18} aria-hidden="true" />}</div><i className="ft-budget-track"><span style={{ width: `${Math.min(percentage, 100)}%` }} /></i><p>{used > budget ? `Lebih ${formatRupiah(used - budget)}` : `Sisa ${formatRupiah(budget - used)}`}{children.length > 0 && ` · ${children.length} subkategori`}</p></>
  return <article data-over={used > budget} className="ft-budget-group">{children.length ? <details><summary>{content}</summary><div className="ft-budget-children">{children.map(child => {
    const spent = usedFor(child.id), target = Number(child.budget_amount || 0)
    return <div key={child.id} className="ft-budget-child" data-over={target > 0 && spent > target}><span>{child.emoji} {child.name}</span><strong>{formatRupiah(spent)}</strong><small>{target ? `Budget ${formatRupiah(target)} · ${spent > target ? 'Lebih' : 'Sisa'} ${formatRupiah(Math.abs(target - spent))}` : 'Tanpa target budget'}</small></div>
  })}{usedFor(category.id) > 0 && <div className="ft-budget-child"><span>Langsung ke induk</span><strong>{formatRupiah(usedFor(category.id))}</strong></div>}{archivedUsed > 0 && <div className="ft-budget-child"><span>Subkategori diarsipkan</span><strong>{formatRupiah(archivedUsed)}</strong></div>}</div></details> : content}</article>
}
