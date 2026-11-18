'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ToolsShell } from '@/app/tools/components/tools-shell'
import { Field, InventoryForms, PairFields, localTime, statusNames, styles, time, useOperations } from '@/lib/operations/client'
import type { Deployment, Inventory } from '@/lib/operations/types'

export default function DeploymentsPage() {
  const [cursor, setCursor] = useState('')
  const ops = useOperations<Inventory>('/api/deployments' + cursor)
  return <ToolsShell title="Deployment & Change Tracker" description="Catat perubahan layanan, bukti hasil, dan riwayat rollback." section="deployments" tools={ops.tools}>
    <div className={styles.actions}><Link className={styles.secondary} href="/monitoring">Buka Health Dashboard</Link><button className={styles.secondary} onClick={ops.refresh} disabled={ops.loading}>Muat ulang</button></div>
    {ops.error && <p className={styles.error} role="alert">{ops.error}</p>}{ops.notice && <p className={styles.notice} role="status">{ops.notice}</p>}{ops.loading && <p role="status">Memuat riwayat…</p>}
    {ops.data && <><DeploymentWorkspace key={ops.identity} ops={ops} data={ops.data}/><div className={styles.actions}>{cursor && <button className={styles.secondary} disabled={ops.loading} onClick={() => setCursor('')}>Kembali ke catatan terbaru</button>}{ops.data.nextCursor && <button className={styles.secondary} disabled={ops.loading} onClick={() => setCursor(ops.data!.nextCursor!)}>Lihat catatan lebih lama</button>}</div></>}
  </ToolsShell>
}
function DeploymentWorkspace({ ops, data }: { ops: ReturnType<typeof useOperations<Inventory>>; data: Inventory }) {
  const [edit, setEdit] = useState<Deployment | null>(null), [service, setService] = useState(''), [environment, setEnvironment] = useState(''), [status, setStatus] = useState(''), [query, setQuery] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const rows = data.deployments.filter(d => (!service || d.service_id === service) && (!environment || d.environment_id === environment) && (!status || d.status === status) && (!query || `${d.version} ${d.performer} ${d.changelog}`.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))) && (!from || Date.parse(d.deployed_at) >= Date.parse(`${from}T00:00:00+07:00`)) && (!to || Date.parse(d.deployed_at) <= Date.parse(`${to}T23:59:59+07:00`)))
  const label = (d: Deployment) => `${data.services.find(s => s.id === d.service_id)?.name || 'Layanan'} / ${data.environments.find(e => e.id === d.environment_id)?.name || 'Environment'}`
  return <>
    <p className={styles.notice}>Aplikasi ini hanya mencatat deployment dan rollback. Operasi infrastruktur dilakukan melalui prosedur Anda.</p>
    {ops.writable && <><InventoryForms data={data} save={ops.write} saving={ops.saving}/><details className={styles.panel} open={!!edit || undefined}><summary>{edit ? 'Sunting catatan deployment' : 'Catat deployment'}</summary>{!data.environments.length ? <p className={styles.empty}>Tambahkan layanan dan environment terlebih dahulu.</p> : <ReleaseForm key={edit?.id || 'new'} data={data} edit={edit} save={ops.write} saving={ops.saving} done={() => setEdit(null)}/>}</details></>}
    <section className={styles.panel}><h2>Timeline perubahan</h2><PairFields data={data} service={service} setService={setService} environment={environment} setEnvironment={setEnvironment}/><div className={styles.grid}>
      <Field label="Cari versi, PIC, atau perubahan"><input className={styles.input} value={query} onChange={e => setQuery(e.target.value)}/></Field><Field label="Status"><select className={styles.input} value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status</option>{['planned','in_progress','succeeded','failed','cancelled'].map(s => <option key={s} value={s}>{statusNames[s]}</option>)}</select></Field>
      <Field label="Dari tanggal (WIB)"><input className={styles.input} type="date" value={from} onChange={e => setFrom(e.target.value)}/></Field><Field label="Sampai tanggal (WIB)"><input className={styles.input} type="date" value={to} onChange={e => setTo(e.target.value)}/></Field></div>
      <p className={styles.muted}>Menampilkan paling banyak 200 catatan per halaman dan 300 rollback terkait. Filter berlaku pada halaman yang dimuat. Gunakan tombol catatan lebih lama untuk menelusuri riwayat.</p>
      {!rows.length ? <p className={styles.empty}>{data.deployments.length ? 'Tidak ada catatan yang sesuai filter.' : 'Belum ada deployment. Catat release pertama setelah layanan dan environment tersedia.'}</p> : <ol className={styles.list}>{rows.map(d => <li key={d.id} id={`release-${d.id}`}><div className={styles.row}><h3>{d.version} · {label(d)}</h3><strong>{statusNames[d.status]}</strong></div><p className={styles.muted}>{time(d.deployed_at)} · PIC {d.performer}</p><p style={{whiteSpace:'pre-wrap'}}>{d.changelog || 'Tidak ada rincian perubahan.'}</p>
      <details><summary>Konfigurasi, bukti, dan rencana rollback</summary><p style={{whiteSpace:'pre-wrap'}}>Konfigurasi: {d.configuration_notes || 'Tidak dicatat.'}</p><p style={{whiteSpace:'pre-wrap'}}>Rencana rollback: {d.rollback_plan || 'Belum dicatat.'}</p>{d.evidence_url && <a className={styles.secondary} href={d.evidence_url} target="_blank" rel="noreferrer">Buka bukti</a>}</details>
      <div className={styles.actions}>{ops.writable && <button className={styles.secondary} onClick={() => { setEdit(d); window.scrollTo({ top: 0, behavior: 'instant' }) }}>Sunting catatan</button>}<Link className={styles.secondary} href={`/monitoring?service=${d.service_id}&environment=${d.environment_id}`}>Lihat monitoring pasangan ini</Link></div>
      <details><summary>Riwayat rollback ({data.rollbacks.filter(r => r.deployment_id === d.id).length})</summary>{data.rollbacks.filter(r => r.deployment_id === d.id).map(r => <div key={r.id}><p><strong>Target {r.target_version} · {statusNames[r.status]}</strong><br/>{time(r.performed_at)} · {r.performer}</p><p style={{whiteSpace:'pre-wrap'}}>{r.result}</p></div>)}{ops.writable && <RollbackForm deployment={d.id} save={ops.write} saving={ops.saving}/>}</details>
      </li>)}</ol>}
    </section>
  </>
}
function ReleaseForm({ data, edit, save, saving, done }: { data: Inventory; edit: Deployment | null; save: (v: unknown) => Promise<boolean>; saving: boolean; done: () => void }) {
  const [service, setService] = useState(edit?.service_id || ''), [environment, setEnvironment] = useState(edit?.environment_id || '')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = Object.fromEntries(new FormData(form))
    const success = await save({ action: edit ? 'update' : 'create', ...(edit ? { id: edit.id, revision: edit.revision } : {}), data: { ...fields, service_id: service, environment_id: environment, deployed_at: new Date(String(fields.deployed_at)).toISOString() } })
    if (success) { form.reset(); setService(''); setEnvironment(''); done() }
  }
  return <form onSubmit={submit}><p className={styles.muted}>Isian belum tersimpan hilang ketika tab ditutup. Jangan mencatat kata sandi, token, atau secret konfigurasi.</p><PairFields data={data} service={service} setService={setService} environment={environment} setEnvironment={setEnvironment}/><div className={styles.grid}>
    <Field label="Versi"><input className={styles.input} name="version" required maxLength={120} defaultValue={edit?.version}/></Field><Field label="Waktu deployment (zona perangkat)"><input className={styles.input} name="deployed_at" type="datetime-local" required defaultValue={localTime(edit?.deployed_at || new Date().toISOString())}/></Field>
    <Field label="Pelaksana / PIC"><input className={styles.input} name="performer" required maxLength={160} defaultValue={edit?.performer}/></Field><Field label="Status aktual"><select className={styles.input} name="status" defaultValue={edit?.status || 'planned'}>{['planned','in_progress','succeeded','failed','cancelled'].map(s => <option key={s} value={s}>{statusNames[s]}</option>)}</select></Field></div>
    <Field label="Perubahan / changelog"><textarea className={styles.input} name="changelog" maxLength={12000} defaultValue={edit?.changelog}/></Field><Field label="Konfigurasi tanpa secret"><textarea className={styles.input} name="configuration_notes" maxLength={6000} defaultValue={edit?.configuration_notes}/></Field><Field label="URL bukti (opsional)"><input className={styles.input} name="evidence_url" type="url" maxLength={2000} defaultValue={edit?.evidence_url}/></Field><Field label="Rencana rollback"><textarea className={styles.input} name="rollback_plan" maxLength={6000} defaultValue={edit?.rollback_plan}/></Field>
    <div className={styles.actions}><button className={styles.button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan catatan'}</button>{edit && <button type="button" className={styles.secondary} onClick={done}>Batal menyunting</button>}</div>
  </form>
}
function RollbackForm({ deployment, save, saving }: { deployment: string; save: (v: unknown) => Promise<boolean>; saving: boolean }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget, fields = Object.fromEntries(new FormData(form)); if (await save({ action: 'rollback', deployment_id: deployment, ...fields, performed_at: new Date(String(fields.performed_at)).toISOString() })) form.reset() }
  return <form onSubmit={submit}><h3>Catat rollback</h3><div className={styles.grid}><Field label="Target versi"><input className={styles.input} name="target_version" required maxLength={120}/></Field><Field label="Waktu (zona perangkat)"><input className={styles.input} name="performed_at" type="datetime-local" required defaultValue={localTime(new Date().toISOString())}/></Field><Field label="Pelaksana"><input className={styles.input} name="performer" required maxLength={160}/></Field><Field label="Status rollback"><select className={styles.input} name="status">{['planned','succeeded','failed'].map(s => <option key={s} value={s}>{statusNames[s]}</option>)}</select></Field></div><Field label="Rencana / hasil pelaksanaan"><textarea className={styles.input} name="result" required maxLength={6000}/></Field><button className={styles.secondary} disabled={saving}>Simpan catatan rollback</button></form>
}
