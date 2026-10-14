import type { Transaction } from '@/types/fintrack'

export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function transactionDayLabel(day: string, now = new Date()) {
  const today = jakartaDate(now)
  const yesterday = new Date(`${today}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (day === today) return 'Hari ini'
  if (day === yesterday.toISOString().slice(0, 10)) return 'Kemarin'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
}

export function groupTransactions(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  for (const item of transactions) groups.set(item.transaction_date, [...(groups.get(item.transaction_date) || []), item])
  return [...groups].sort(([a], [b]) => b.localeCompare(a))
}

export function calendarCells(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`)
  const padding = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return Array.from({ length: Math.ceil((padding + count) / 7) * 7 }, (_, index) => index >= padding && index < padding + count ? `${month}-${String(index - padding + 1).padStart(2, '0')}` : null)
}
