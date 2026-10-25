export function loginCallbackMessage(code: string | null) {
  return ({ oauth: 'Masuk dengan Google belum berhasil. Coba lagi.', identity: 'Email akun Google belum dapat dikenali. Coba masuk dengan akun lain.', bootstrap: 'Profil FinTrack belum dapat disiapkan. Coba masuk kembali.' } as Record<string, string>)[code || ''] || ''
}

export function activityAccount(value: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : '__all__'
}

export function sheetCloseState(dirty: boolean, busy: boolean, force: boolean) {
  return force ? 'close' : busy ? 'wait' : dirty ? 'confirm' : 'close'
}
