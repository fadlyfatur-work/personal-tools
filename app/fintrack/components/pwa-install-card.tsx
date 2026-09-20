'use client'

import { CheckCircle, DownloadSimple, ShareNetwork } from '@phosphor-icons/react'
import { usePwaInstall } from './connectivity-gate'

export function PwaInstallCard() {
  const { promptEvent, installed, ios } = usePwaInstall()

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') return
  }

  return <section className="ft-card ft-settings-card"><div className="ft-theme-row"><span className="ft-account-icon">{installed ? <CheckCircle size={18} weight="fill" /> : <DownloadSimple size={18} weight="fill" />}</span><div><strong>Install FinTrack</strong><span>{installed ? 'Sudah terpasang di perangkat ini.' : 'Buka langsung dari ikon seperti aplikasi.'}</span></div></div>{!installed && promptEvent && <button className="ft-button ft-button-primary ft-pwa-install" type="button" onClick={install}><DownloadSimple size={17} />Install FinTrack</button>}{!installed && ios && <div className="ft-pwa-help"><ShareNetwork size={18} /><p>Buka menu <strong>Share</strong> di Safari, pilih <strong>Add to Home Screen</strong>, lalu aktifkan <strong>Open as Web App</strong>.</p></div>}{!installed && !ios && !promptEvent && <p className="ft-hint">Jika tombol install belum muncul, gunakan menu browser lalu pilih “Install app” atau “Add to home screen”.</p>}</section>
}
