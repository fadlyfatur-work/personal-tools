'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from '@phosphor-icons/react'
import TransactionForm from './transaction-form'
import { fetchFintrackBootstrap, fintrackKeys } from '@/lib/fintrackClient'
import type { Account, Category, FintrackBootstrap, FintrackUser, Transaction } from '@/types/fintrack'

type Palette = 'forest' | 'ocean' | 'earth'
type Theme = 'light' | 'dark'

interface FintrackContextValue {
  palette: Palette
  setPalette: (palette: Palette) => void
  theme: Theme
  setTheme: (theme: Theme) => void
  data: FintrackBootstrap | undefined
  user: FintrackUser | null
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  loading: boolean
  error: string
  setUser: (user: FintrackUser | null) => void
  setAccounts: (updater: React.SetStateAction<Account[]>) => void
  setCategories: (updater: React.SetStateAction<Category[]>) => void
  updateData: (updater: (current: FintrackBootstrap) => FintrackBootstrap) => void
  refreshData: () => Promise<void>
  clearCache: () => void
  beginTask: (id: string, label: string) => void
  endTask: (id: string) => void
  isBusy: (id?: string) => boolean
  openComposer: (transaction?: Transaction | null) => void
  applyTransactionChange: (previous: Transaction | null, next: Transaction | null) => void
}

const FintrackContext = createContext<FintrackContextValue | null>(null)

function getPaletteSnapshot(): Palette {
  const saved = window.localStorage.getItem('fintrack-palette')
  return saved === 'ocean' || saved === 'earth' ? saved : 'forest'
}

function subscribePalette(callback: () => void) {
  window.addEventListener('fintrack:palette-changed', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('fintrack:palette-changed', callback)
    window.removeEventListener('storage', callback)
  }
}

function getThemeSnapshot(): Theme {
  const saved = window.localStorage.getItem('fintrack-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function subscribeTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  window.addEventListener('fintrack:theme-changed', callback)
  window.addEventListener('storage', callback)
  media.addEventListener('change', callback)
  return () => {
    window.removeEventListener('fintrack:theme-changed', callback)
    window.removeEventListener('storage', callback)
    media.removeEventListener('change', callback)
  }
}

function accountDelta(transaction: Transaction, account: Account) {
  const amount = Number(transaction.amount)
  let delta = 0
  if (transaction.from_account_id === account.id) delta += transaction.type === 'expense' && account.classification === 'liability' ? amount : -amount
  if (transaction.to_account_id === account.id) delta += transaction.type === 'income' && account.classification === 'liability' ? -amount : amount
  return delta
}

function rebuildDerived(data: FintrackBootstrap, accounts: Account[], transactions: Transaction[]) {
  const included = accounts.filter((account) => account.access_role === 'owner' && account.include_in_net_worth !== false)
  const assets = included.filter((account) => account.classification === 'asset').reduce((sum, account) => sum + Number(account.current_balance), 0)
  const liabilities = included.filter((account) => account.classification === 'liability').reduce((sum, account) => sum + Number(account.current_balance), 0)
  const monthly = transactions.filter((transaction) => transaction.transaction_date.startsWith(data.report.month))
  const income = monthly.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  const expense = monthly.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  const categoryMap = new Map(data.categories.map((category) => [category.id, category.name]))
  const reportFor = (type: 'income' | 'expense') => {
    const grouped = new Map<string, { category_id: string | null; name: string; amount: number }>()
    monthly.filter((transaction) => transaction.type === type).forEach((transaction) => {
      const key = transaction.category_id || 'uncategorized'
      const current = grouped.get(key) || { category_id: transaction.category_id || null, name: transaction.category_id ? categoryMap.get(transaction.category_id) || 'Tanpa kategori' : 'Tanpa kategori', amount: 0 }
      current.amount += Number(transaction.amount)
      grouped.set(key, current)
    })
    return [...grouped.values()].sort((a, b) => b.amount - a.amount)
  }
  return { ...data, accounts, transactions, summary: { assets, liabilities, net_worth: assets - liabilities, income, expense }, report: { ...data.report, income: reportFor('income'), expense: reportFor('expense') } }
}

export function FintrackProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: 1000 * 60 * 60, retry: false, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: false },
    },
  }))
  return <QueryClientProvider client={queryClient}><FintrackState>{children}</FintrackState></QueryClientProvider>
}

function FintrackState({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const palette = useSyncExternalStore<Palette>(subscribePalette, getPaletteSnapshot, () => 'forest')
  const theme = useSyncExternalStore<Theme>(subscribeTheme, getThemeSnapshot, () => 'light')
  const shouldBootstrap = !pathname.includes('/login') && !pathname.includes('/register') && !pathname.includes('/reset-pin')
  const query = useQuery({ queryKey: fintrackKeys.bootstrap, queryFn: fetchFintrackBootstrap, enabled: shouldBootstrap })
  const [tasks, setTasks] = useState<Record<string, string>>({})
  const [loaderVisible, setLoaderVisible] = useState(false)
  const [composer, setComposer] = useState<{ open: boolean; editing: Transaction | null }>({ open: false, editing: null })

  useEffect(() => {
    const error = query.error as (Error & { status?: number }) | null
    if (error?.status === 401) router.replace('/fintrack/login')
  }, [query.error, router])

  useEffect(() => {
    if (Object.keys(tasks).length === 0) {
      const hideTimer = window.setTimeout(() => setLoaderVisible(false), 0)
      return () => window.clearTimeout(hideTimer)
    }
    const timer = window.setTimeout(() => setLoaderVisible(true), 350)
    return () => window.clearTimeout(timer)
  }, [tasks])

  const setPalette = useCallback((next: Palette) => {
    window.localStorage.setItem('fintrack-palette', next)
    window.dispatchEvent(new Event('fintrack:palette-changed'))
  }, [])
  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem('fintrack-theme', next)
    window.dispatchEvent(new Event('fintrack:theme-changed'))
  }, [])
  const beginTask = useCallback((id: string, label: string) => setTasks((current) => ({ ...current, [id]: label })), [])
  const endTask = useCallback((id: string) => setTasks((current) => { const next = { ...current }; delete next[id]; return next }), [])
  const isBusy = useCallback((id?: string) => id ? Boolean(tasks[id]) : Object.keys(tasks).length > 0, [tasks])
  const updateData = useCallback((updater: (current: FintrackBootstrap) => FintrackBootstrap) => {
    queryClient.setQueryData<FintrackBootstrap>(fintrackKeys.bootstrap, (current) => current ? updater(current) : current)
  }, [queryClient])
  const setUser = useCallback((user: FintrackUser | null) => {
    if (!user) return queryClient.removeQueries({ queryKey: ['fintrack'] })
    updateData((current) => ({ ...current, user }))
  }, [queryClient, updateData])
  const setAccounts = useCallback((updater: React.SetStateAction<Account[]>) => updateData((current) => {
    const accounts = typeof updater === 'function' ? updater(current.accounts) : updater
    return rebuildDerived(current, accounts, current.transactions)
  }), [updateData])
  const setCategories = useCallback((updater: React.SetStateAction<Category[]>) => updateData((current) => {
    const categories = typeof updater === 'function' ? updater(current.categories) : updater
    const next = { ...current, categories }
    return rebuildDerived(next, next.accounts, next.transactions)
  }), [updateData])
  const refreshData = useCallback(async () => { await query.refetch() }, [query])
  const clearCache = useCallback(() => queryClient.removeQueries({ queryKey: ['fintrack'] }), [queryClient])
  const openComposer = useCallback((transaction?: Transaction | null) => setComposer({ open: true, editing: transaction || null }), [])
  const applyTransactionChange = useCallback((previous: Transaction | null, next: Transaction | null) => updateData((current) => {
    const accounts = current.accounts.map((account) => ({ ...account, current_balance: Number(account.current_balance) - (previous ? accountDelta(previous, account) : 0) + (next ? accountDelta(next, account) : 0) }))
    const withoutPrevious = previous ? current.transactions.filter((item) => item.id !== previous.id) : current.transactions
    const transactions = next ? [next, ...withoutPrevious.filter((item) => item.id !== next.id)] : withoutPrevious
    return rebuildDerived(current, accounts, transactions)
  }), [updateData])

  const value = useMemo<FintrackContextValue>(() => ({
    palette, setPalette, theme, setTheme, data: query.data, user: query.data?.user || null, accounts: query.data?.accounts || [], categories: query.data?.categories || [], transactions: query.data?.transactions || [], loading: shouldBootstrap && query.isPending, error: query.error instanceof Error ? query.error.message : '', setUser, setAccounts, setCategories, updateData, refreshData, clearCache, beginTask, endTask, isBusy, openComposer, applyTransactionChange,
  }), [palette, setPalette, theme, setTheme, query.data, query.isPending, query.error, shouldBootstrap, setUser, setAccounts, setCategories, updateData, refreshData, clearCache, beginTask, endTask, isBusy, openComposer, applyTransactionChange])
  const labels = Object.values(tasks)

  return (
    <FintrackContext.Provider value={value}>
      <div className="fintrack-app" data-palette={palette} data-theme={theme}>
        <div className="ft-ambient" aria-hidden="true" />
        <div className="ft-global-loader" data-visible={loaderVisible} role="status" aria-live="polite" aria-hidden={!loaderVisible}><span>{labels.at(-1) || 'Menyelaraskan'}</span><i aria-hidden="true" /></div>
        <div className="ft-page-transition" key={pathname}>{children}</div>
        {composer.open && <TransactionModal editing={composer.editing} onClose={() => setComposer({ open: false, editing: null })} />}
      </div>
    </FintrackContext.Provider>
  )
}

function TransactionModal({ editing, onClose }: { editing: Transaction | null; onClose: () => void }) {
  const { accounts, categories, loading, applyTransactionChange } = useFintrack()
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [onClose])

  function saved(transaction: Transaction) {
    applyTransactionChange(editing, transaction)
    onClose()
  }

  return (
    <div className="ft-modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section className="ft-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
        <div className="ft-modal-header"><div><p>Transaksi</p><h2 id="transaction-modal-title">{editing ? 'Perbarui catatan' : 'Catat uang masuk atau keluar'}</h2></div><button className="ft-icon-button" type="button" onClick={onClose} aria-label="Tutup pencatatan"><X size={19} /></button></div>
        <div className="ft-modal-body" data-updating={loading}>
          {accounts.length === 0 && !loading ? <div className="ft-empty ft-modal-empty"><div><strong>Buat dompet terlebih dahulu</strong><p>Transaksi membutuhkan dompet sebagai sumber atau tujuan saldo.</p><Link href="/fintrack/manage" className="ft-button ft-button-primary" onClick={onClose}>Kelola dompet</Link></div></div> : <TransactionForm key={editing?.id || 'new'} accounts={accounts} categories={categories} editing={editing} onCancelEdit={onClose} onSaved={saved} />}
        </div>
      </section>
    </div>
  )
}

export function useFintrack() {
  const value = useContext(FintrackContext)
  if (!value) throw new Error('useFintrack harus digunakan di dalam FintrackProvider')
  return value
}
