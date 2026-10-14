import { ProviderIcon } from './provider-icon'
import { walletProviders } from '@/lib/fintrackProviders'
import type { Account } from '@/types/fintrack'

export function AccountCard({ account, selected = false, onClick }: { account: Account; selected?: boolean; onClick?: () => void }) {
  const provider = walletProviders.find(item => item.code === account.provider_code)
  const content = <>
      <div className="ft-account-top"><p className="ft-account-name">{account.name}</p><ProviderIcon account={account} /></div>
      <div>
        <span className="ft-account-kind">{provider?.name || ({ cash: 'Tunai', bank: 'Rekening bank', ewallet: 'E-wallet', debt: 'Utang', investment: 'Investasi', emergency_fund: 'Dana darurat', receivable: 'Piutang' })[account.kind]}</span>
        <p className="ft-account-balance">{formatRupiah(account.current_balance)}</p>
        {account.access_role !== 'owner' && <div className="ft-shared-label">Dibagikan kepada Anda</div>}
      </div>
    </>
  return onClick
    ? <button type="button" className="ft-account ft-account-button" data-selected={selected} aria-pressed={selected} onClick={onClick}>{content}</button>
    : <article className="ft-account">{content}</article>
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
}
