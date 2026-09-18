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
  archived: boolean
  access_role: 'owner' | 'member' | 'viewer'
  can_manage: boolean
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
