'use client'

import sources from '@/public/fintrack/providers/sources.json'
import Image from 'next/image'
import { useState } from 'react'
import { Bank, Coins, CreditCard, HandCoins, PiggyBank, Wallet } from '@phosphor-icons/react'
import type { Account } from '@/types/fintrack'
import { walletProviders } from '@/lib/fintrackProviders'

export function ProviderIcon({ account, compact = false }: { account: Pick<Account, 'kind' | 'provider_code'>; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  const provider = walletProviders.find(item => item.code === account.provider_code)
  const source = provider ? (sources as Record<string, { path?: string }>)[provider.code] : null
  const Icon = ({ bank: Bank, cash: Wallet, ewallet: CreditCard, emergency_fund: PiggyBank, investment: Coins, debt: CreditCard, receivable: HandCoins })[account.kind] || Wallet
  return <span className={`ft-provider-icon${compact ? ' ft-provider-icon-compact' : ''}`} data-provider={provider?.code}>{provider && source && !failed ? <Image unoptimized src={source.path || `/fintrack/providers/${provider.code}.png`} alt={provider.name} width={32} height={32} onError={() => setFailed(true)} /> : <Icon size={compact ? 14 : 26} weight="fill" aria-hidden="true" />}</span>
}
