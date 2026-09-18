import { Bank, Coins, CreditCard, HandCoins, PiggyBank, Wallet } from '@phosphor-icons/react'
import type { Account } from '@/types/fintrack'

const icons = {
  cash: Wallet,
  bank: Bank,
  ewallet: CreditCard,
  emergency_fund: PiggyBank,
  investment: Coins,
  debt: CreditCard,
  receivable: HandCoins,
}

export function AccountCard({ account }: { account: Account }) {
  const Icon = icons[account.kind] || Wallet
  return (
    <article className="ft-account">
      <div className="ft-account-icon"><Icon size={18} weight="fill" /></div>
      <div>
        <p className="ft-account-name">{account.name}</p>
        <p className="ft-account-balance">{formatRupiah(account.current_balance)}</p>
        {account.access_role !== 'owner' && <div className="ft-shared-label">Dibagikan kepada Anda</div>}
      </div>
    </article>
  )
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
}
