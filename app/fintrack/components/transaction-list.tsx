'use client'

import { reportTransactionType } from '@/lib/fintrackCategories'

import { ArrowDownLeft, ArrowUpRight, ArrowsLeftRight, Receipt } from '@phosphor-icons/react'
import { groupTransactions, transactionDayLabel } from '@/lib/fintrackPresentation'
import type { Account, Category, Transaction } from '@/types/fintrack'
import { formatRupiah } from './account-card'
import { ProviderIcon } from './provider-icon'

export function TransactionList({ transactions, accounts, categories, onEdit, showSubtotal = true, emptyLabel = 'Belum ada transaksi. Catat transaksi pertama Anda.' }: { transactions: Transaction[]; accounts: Account[]; categories: Category[]; onEdit: (item: Transaction) => void; showSubtotal?: boolean; emptyLabel?: string }) {
  if (!transactions.length) return <div className="ft-empty"><div><Receipt size={32} /><p>{emptyLabel}</p></div></div>
  return <div className="ft-day-list">{groupTransactions(transactions).map(([day, items]) => {
    const income = items.filter(item => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0)
    const expense = items.filter(item => reportTransactionType(item) === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
    return <section key={day}><div className="ft-day-heading"><h3>{transactionDayLabel(day)}</h3>{showSubtotal && <span aria-label="Subtotal transaksi yang ditampilkan">Subtotal {income > 0 && `+${formatRupiah(income)}`}{income > 0 && expense > 0 && ' · '}{expense > 0 && `−${formatRupiah(expense)}`}</span>}</div><div className="ft-day-transactions">{items.map(item => {
      const category = categories.find(category => category.id === item.category_id)
      const account = accounts.find(account => account.id === (item.type === 'income' ? item.to_account_id : item.from_account_id))
      const Icon = item.type === 'income' ? ArrowDownLeft : reportTransactionType(item) === 'expense' ? ArrowUpRight : ArrowsLeftRight
      return <button key={item.id} type="button" className="ft-transaction-row ft-transaction-button" onClick={() => onEdit(item)}><span className={`ft-transaction-icon ${item.type}`}>{category?.emoji || <Icon size={22} weight="bold" />}</span><span className="ft-transaction-copy"><strong>{item.note || category?.name || (item.debt_payment_expense ? 'Pembayaran utang' : item.type === 'transfer' ? 'Transfer antar-dompet' : 'Tanpa catatan')}</strong><span className="ft-transaction-category">{category?.name || (item.debt_payment_expense ? 'Pembayaran utang' : item.type === 'transfer' ? 'Transfer' : 'Tanpa kategori')}</span><span className="ft-transaction-wallet">{account && <ProviderIcon account={account} compact />}<span>{account?.name || 'Dompet'}{item.created_at && ` · ${new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(item.created_at))}`}</span></span></span><span className={`ft-transaction-amount ${item.type === 'income' ? 'ft-positive' : reportTransactionType(item) === 'expense' ? 'ft-negative' : ''}`}>{item.type === 'income' ? '+' : reportTransactionType(item) === 'expense' ? '−' : ''}{formatRupiah(item.amount)}</span></button>
    })}</div></section>
  })}</div>
}
