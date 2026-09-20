export interface FintrackUser {
  id: string
  name: string
  email: string
  avatar_url?: string | null
}

export type AccountKind = 'cash' | 'bank' | 'ewallet' | 'emergency_fund' | 'investment' | 'debt' | 'receivable'
export type AccountClassification = 'asset' | 'liability'

export interface Account {
  id: string
  plan_id: string
  name: string
  kind: AccountKind
  classification: AccountClassification
  initial_balance: number
  current_balance: number
  include_in_net_worth: boolean
  sort_order: number
  archived: boolean
  access_role: 'owner' | 'member' | 'viewer'
  can_manage: boolean
}

export interface Category {
  id: string
  plan_id: string
  name: string
  type: 'income' | 'expense'
  archived_at?: string | null
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  plan_id: string
  from_account_id?: string | null
  to_account_id?: string | null
  category_id?: string | null
  amount: number
  type: TransactionType
  note?: string | null
  transaction_date: string
  created_at?: string
  status?: 'posted' | 'voided'
}

export interface FintrackSummary {
  assets: number
  liabilities: number
  net_worth: number
  income: number
  expense: number
}

export interface ReportSlice {
  category_id: string | null
  category_ids: string[]
  name: string
  amount: number
}

export interface FintrackReport {
  month: string
  period_start: string
  period_end: string
  income: ReportSlice[]
  expense: ReportSlice[]
  transactions: Transaction[]
  previous: { month: string; income: number; expense: number }
  daily: Array<{ day: string; income: number; expense: number }>
  trend_detail_loaded: boolean
}

export interface FintrackCollaboration {
  owned_accounts: Array<{ id: string; name: string; kind: string; current_balance: number }>
  pending_requests: Array<{ id: string; account_id: string; requester_id: string; requester: { name: string; email: string } | null; account: { name: string } | null }>
  shared_with_me: unknown[]
  collaborators: Array<{ account_id: string; user_id: string; user: { name: string; email: string } | null; account: { name: string } | null }>
}

export interface FintrackBootstrap {
  user: FintrackUser
  has_pin: boolean
  month_cutoff_day: number
  personal_plan_id: string | null
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  summary: FintrackSummary
  report: FintrackReport
  collaboration: FintrackCollaboration
}
