import type { Category, ReportSlice } from '@/types/fintrack'
import Link from 'next/link'
import { categoryBudget, sortCategoryTree } from '@/lib/fintrackCategories'
import { CaretDown } from '@phosphor-icons/react'
import { formatRupiah } from './account-card'

export function CategoryBudget({ category, categories, totals, month, used: totalUsed }: { category: Category; categories: Category[]; totals: ReportSlice[]; month: string; used?: number }) {
  const activityLink = (id: string) => ({ pathname: '/fintrack/activity', query: { month, parent_id: category.id, category_id: id } })
  const allChildren = sortCategoryTree(categories.filter(item => item.parent_id === category.id))
  const budget = categoryBudget(category, categories)
  const usedFor = (id: string) => Number(totals.find(item => item.category_id === id)?.amount || 0)
  const children = allChildren.filter(item => usedFor(item.id) > 0)
  const used = totalUsed ?? (usedFor(category.id) + allChildren.reduce((sum, item) => sum + usedFor(item.id), 0))
  const archivedUsed = Math.max(0, used - usedFor(category.id) - allChildren.reduce((sum, item) => sum + usedFor(item.id), 0))
  const hasDetails = children.length > 0 || archivedUsed > 0
  const percentage = budget ? Math.round(used / budget * 100) : 0
  const content = <><div className="ft-budget-heading"><span className="ft-category-emoji">{category.emoji || '🏷️'}</span><span className="ft-budget-copy"><strong>{category.name}</strong><small>{formatRupiah(used)} dari {formatRupiah(budget)}</small></span><b>{percentage}%</b>{hasDetails && <CaretDown className="ft-budget-caret" size={18} aria-hidden="true" />}</div><i className="ft-budget-track"><span style={{ width: `${Math.min(percentage, 100)}%` }} /></i><p>{used > budget ? `Lebih ${formatRupiah(used - budget)}` : `Sisa ${formatRupiah(budget - used)}`}{children.length > 0 && ` · ${children.length} subkategori`}</p></>
  return <article data-over={used > budget} className="ft-budget-group">{hasDetails ? <details><summary>{content}</summary><div className="ft-budget-children">{children.map(child => {
    const spent = usedFor(child.id), target = Number(child.budget_amount || 0)
    return <Link href={activityLink(child.id)} key={child.id} className="ft-budget-child ft-budget-child-link" data-over={target > 0 && spent > target} aria-label={`Lihat transaksi ${child.name}`}><span>{child.emoji} {child.name}</span><strong>{formatRupiah(spent)}</strong><small>{target ? `Budget ${formatRupiah(target)} · ${spent > target ? 'Lebih' : 'Sisa'} ${formatRupiah(Math.abs(target - spent))}` : 'Tanpa target budget'}</small></Link>
  })}{usedFor(category.id) > 0 && <Link href={activityLink(category.id)} className="ft-budget-child ft-budget-child-link" aria-label={`Lihat transaksi langsung ke ${category.name}`}><span>Langsung ke induk</span><strong>{formatRupiah(usedFor(category.id))}</strong></Link>}{archivedUsed > 0 && <div className="ft-budget-child"><span>Subkategori diarsipkan</span><strong>{formatRupiah(archivedUsed)}</strong></div>}</div></details> : <Link href={activityLink(category.id)} className="ft-budget-parent-link" aria-label={`Lihat transaksi ${category.name}`}>{content}</Link>}</article>
}
