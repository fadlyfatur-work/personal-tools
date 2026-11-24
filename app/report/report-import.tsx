'use client'

import {useState} from 'react'
import {PACKAGE_ENVIRONMENT_LABELS, PACKAGE_CONFIRMATION_LABELS, packageConfirmationStatus, ROLE_LABELS, STEPS, STEP_LABELS, STATUS_LABELS, WORKFLOW_STATUS, dateLabel, provinceSummary, workflowStatusOf} from '@/lib/report/model'
import {IMPORT_LIMIT, importDifferences, readSipastiHierarchy, type ImportMode, type ImportRow} from '@/lib/report/import'
import type {ReportDocument} from '@/lib/report/model'
import {ReportDialog} from './report-details'
import s from './report.module.css'

export type ImportTarget = {document: ReportDocument; date: string; revision: number}
const modeLabel = {excel: 'Excel', json: 'JSON'} as const

export function ReportImport({target, onClose, onTemplate, onSave}: {
  target: ImportTarget
  onClose: () => void
  onTemplate: () => Promise<void>
  onSave: (rows: ImportRow[], selected: ReadonlySet<string>, mode: ImportMode) => Promise<void>
}) {
  const [mode, setMode] = useState<ImportMode>('excel')
  const [file, setFile] = useState<File | null>(null)
  const [json, setJson] = useState('')
  const [preview, setPreview] = useState<{rows: ImportRow[]; skipped: number} | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [operation, setOperation] = useState('')
  const [error, setError] = useState('')
  const busy = !!operation
  const changeIds = preview?.rows.filter(row => row.changed).map(row => row.id) ?? []
  const all = changeIds.length > 0 && selected.size === changeIds.length

  async function read() {
    setError('')
    setOperation(`Membaca ${modeLabel[mode]}…`)
    try {
      if (file && file.size > IMPORT_LIMIT) throw new Error('Ukuran file maksimal 8 MB.')
      let result: {document: ReportDocument; provinceIds: string[]; skipped?: number}
      if (mode === 'excel') {
        if (!file?.name.toLowerCase().endsWith('.xlsx')) throw new Error('Pilih file Excel berformat .xlsx.')
        const {readReportWorkbook} = await import('@/lib/report/excel')
        result = await readReportWorkbook(new Uint8Array(await file.arrayBuffer()), target.document, target.date)
      } else {
        if (file && !/\.(json|txt)$/i.test(file.name)) throw new Error('Pilih file JSON berformat .json atau .txt.')
        if (!file && !json.trim()) throw new Error('Pilih file atau tempel JSON.')
        result = readSipastiHierarchy(file ? await file.text() : json, target.document)
      }
      const rows = importDifferences(target.document, result.document, result.provinceIds)
        .sort((a, b) => Number(b.changed) - Number(a.changed) || a.name.localeCompare(b.name, 'id-ID'))
      if (!rows.length) throw new Error('Tidak ada data provinsi yang dapat diimpor dari masukan ini.')
      setPreview({rows, skipped: result.skipped ?? 0})
      setSelected(new Set(rows.filter(row => row.changed).map(row => row.id)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Data belum dapat dibaca.')
    } finally { setOperation('') }
  }

  async function download() {
    setError('')
    setOperation('Menyiapkan template Excel…')
    try { await onTemplate() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Template belum dapat diunduh.') }
    finally { setOperation('') }
  }

  async function save() {
    if (!preview || !selected.size || busy) return
    setError('')
    setOperation(`Menyimpan ${selected.size} provinsi…`)
    try { await onSave(preview.rows, selected, mode) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impor belum tersimpan. Coba kembali.') }
    finally { setOperation('') }
  }

  function toggle(id: string, checked: boolean) {
    setSelected(current => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return <ReportDialog key={preview?'preview':'source'} title={preview?`Pratinjau impor ${modeLabel[mode]}`:'Impor data laporan'}
    onClose={onClose} busy={busy} progressLabel={operation} wide={!!preview}>
    {error && <p className={s.error} role="alert">{error}</p>}
    {preview ? <>
      <p className={s.panelIntro}>{preview.rows.length} provinsi terbaca untuk laporan {dateLabel(target.date)}. {changeIds.length} memiliki perubahan.
        {!!preview.skipped && ' Akun di luar cakupan laporan dilewati.'}</p>
      <fieldset className={s.formFields} disabled={busy}>
        <div className={s.importSelection}>
          <label className={s.checkLabel}><input type="checkbox" checked={all} disabled={!changeIds.length}
            ref={input=>{if(input)input.indeterminate=!all&&selected.size>0}}
            onChange={event=>setSelected(new Set(event.target.checked ? changeIds : []))}/>Pilih semua</label>
          <span role="status">{selected.size} provinsi dipilih</span>
          <span className={s.importChanged}>Sel berwarna menandakan perubahan</span>
        </div>
        <div className={s.importTableScroll} role="region" aria-label="Tabel pratinjau impor" tabIndex={0}>
          <table className={s.importTable}>
            <thead><tr><th scope="col">Pilih</th><th scope="col">Provinsi</th>
              {preview.rows[0].accounts.map(({role})=><th scope="col" key={role}>{ROLE_LABELS[role]}</th>)}
              {mode==='excel'&&<><th scope="col">Paket ASB</th><th scope="col">Catatan provinsi</th></>}
            </tr></thead>
            <tbody>{preview.rows.map(row=><tr key={row.id}>
              <td><input type="checkbox" aria-label={`Pilih ${row.name}`} checked={selected.has(row.id)}
                disabled={!row.changed} onChange={event=>toggle(row.id,event.target.checked)}/></td>
              <th scope="row">{row.name}{!row.changed&&<small>Tidak berubah</small>}</th>
              {row.accounts.map(account=>{
                const changed=account.summaryChanged||!!(account.added.length||account.updated.length)
                return <td className={changed?s.importChanged:undefined} key={account.role}>
                  {account.beforeLabel!==account.afterLabel&&<small>Sebelumnya {account.beforeLabel}</small>}
                  <strong>{account.afterLabel}</strong>
                  {changed&&<details><summary>Rincian perubahan</summary>
                    {account.before.note!==account.after.note&&<p>Catatan peran {account.before.note||'Kosong'} → {account.after.note||'Kosong'}</p>}
                    {account.added.map(detail=><p key={detail.id}>Baru: {detail.label}{detail.institution&&` · ${detail.institution}`}{detail.email&&` · ${detail.email}`}{detail.note&&` · ${detail.note}`}</p>)}
                    {account.updated.map(detail=>{
                      const old=account.before.details.find(item=>item.id===detail.id)!
                      const describe=(item:typeof detail)=>[item.label,item.institution,item.email,item.note].filter(Boolean).join(' · ')
                      return <p key={detail.id}>Diperbarui: {describe(old)} → {describe(detail)}</p>
                    })}
                  </details>}
                </td>
              })}
              {mode==='excel'&&<PackageChanges row={row}/>}
              {mode==='excel'&&<td className={row.notes?s.importChanged:undefined}>{row.notes?<details><summary>Rincian perubahan</summary>
                {row.before.notes!==row.after.notes&&<p>Analisis / kendala: {row.before.notes||'Kosong'} → {row.after.notes||'Kosong'}</p>}
                {row.before.followUp!==row.after.followUp&&<p>Tindak lanjut: {row.before.followUp||'Kosong'} → {row.after.followUp||'Kosong'}</p>}
              </details>:'Tidak berubah'}</td>}
            </tr>)}</tbody>
          </table>
        </div>
        {!changeIds.length&&<p className={s.quiet}>Data yang dibaca sudah sama dengan laporan tersimpan.</p>}
        <div className={s.toolActions}>
          <button type="button" className={s.button} onClick={()=>{setPreview(null);setError('')}}>Kembali</button>
          <button type="button" className={s.primaryButton} onClick={()=>void save()} disabled={!selected.size}>Simpan</button>
        </div>
      </fieldset>
    </>:<>
      <div className={s.tabs} role="group" aria-label="Format impor">
        {(['excel','json'] as const).map(value=><button type="button" key={value} aria-pressed={mode===value} disabled={busy}
          onClick={()=>{setMode(value);setFile(null);setError('')}}>{modeLabel[value]}</button>)}
      </div>
      <form onSubmit={event=>{event.preventDefault();void read()}}>
        <fieldset className={s.formFields} disabled={busy}>
          <label>{mode==='excel'?'File Excel (.xlsx)':'File hierarki SIPASTI Pemda (.json atau .txt)'}
            <input key={mode} type="file" accept={mode==='excel'?'.xlsx':'.json,.txt,application/json'} onChange={event=>{
              const input=event.currentTarget.files?.[0]??null
              setFile(input)
              if (input&&mode==='json') setJson('')
            }}/>
          </label>
          {file&&<p className={s.quiet}>File dipilih: {file.name}</p>}
          {mode==='json'&&<label>Atau tempel JSON
            <textarea rows={7} maxLength={IMPORT_LIMIT} placeholder="Tempel JSON hierarki akun SIPASTI Pemda" value={json}
              onChange={event=>{setJson(event.target.value);setFile(null);const input=event.target.form?.querySelector<HTMLInputElement>('input[type="file"]');if(input)input.value=''}}/>
          </label>}
          <p className={s.quiet}>Ukuran maksimal 8 MB. {mode==='excel'?'Gunakan template untuk tanggal laporan yang sedang dibuka.':'JSON memperbarui akun provinsi.'}</p>
          <div className={s.toolActions}>
            {mode==='excel'&&<button type="button" className={s.button} onClick={()=>void download()}>Unduh template Excel</button>}
            <button type="submit" className={s.primaryButton} disabled={!file&&(mode==='excel'||!json.trim())}>Baca data</button>
          </div>
        </fieldset>
      </form>
    </>}
  </ReportDialog>
}

function PackageChanges({row}: {row: ImportRow}) {
  const changed = row.packages.added.length + row.packages.updated.length
  const total = provinceSummary(row.after).totalPackages
  const describe = (pkg: ImportRow['after']['packages'][number]) => [
    pkg.name,
    pkg.active ? (pkg.confirmed?WORKFLOW_STATUS[workflowStatusOf(pkg)]:PACKAGE_CONFIRMATION_LABELS[packageConfirmationStatus(pkg)]) : `Nonaktif: ${pkg.inactiveReason}`,
    pkg.active && pkg.environment ? PACKAGE_ENVIRONMENT_LABELS[pkg.environment] : '',
    ...STEPS.filter(step=>pkg[step]!=='-').map(step=>`${STEP_LABELS[step]}: ${STATUS_LABELS[pkg[step]]}`),
    `Bukti dukung: ${pkg.evidenceChecked?'Ditandai tersedia':'Belum ditandai'}${pkg.evidenceUrl?` · ${pkg.evidenceUrl}`:''}`,
    pkg.picName?`PIC: ${pkg.picName} (${pkg.picPhone})`:'',
    pkg.note,
  ].filter(Boolean).join(' · ')
  return <td className={changed?s.importChanged:undefined}>
    <strong>{total} paket terkonfirmasi</strong>
    {!!changed&&<details><summary>Rincian perubahan</summary>
      {row.packages.added.map(pkg=><p key={pkg.id}>Baru: {describe(pkg)}</p>)}
      {row.packages.updated.map(pkg=>{
        const old=row.before.packages.find(item=>item.id===pkg.id)!
        return <p key={pkg.id}>Diperbarui: {describe(old)} → {describe(pkg)}</p>
      })}
    </details>}
  </td>
}
