export const walletProviders = [
  { code: 'bca', name: 'BCA', kind: 'bank', domain: 'www.bca.co.id' },
  { code: 'mandiri', name: 'Mandiri', kind: 'bank', domain: 'www.bankmandiri.co.id' },
  { code: 'bri', name: 'BRI', kind: 'bank', domain: 'bri.co.id' },
  { code: 'bni', name: 'BNI', kind: 'bank', domain: 'www.bni.co.id' },
  { code: 'bsi', name: 'BSI', kind: 'bank', domain: 'www.bankbsi.co.id' },
  { code: 'gopay', name: 'GoPay', kind: 'ewallet', domain: 'gopay.co.id' },
  { code: 'ovo', name: 'OVO', kind: 'ewallet', domain: 'www.ovo.id' },
  { code: 'dana', name: 'DANA', kind: 'ewallet', domain: 'www.dana.id' },
  { code: 'shopeepay', name: 'ShopeePay', kind: 'ewallet', domain: 'shopeepay.co.id' },
] as const

export function validProvider(code: string | null | undefined, kind: string) {
  return !code || walletProviders.some(provider => provider.code === code && provider.kind === kind)
}
