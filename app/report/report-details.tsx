'use client'

import {useEffect,useId,useRef,useState,type ReactNode} from 'react'
import {Plus,Trash,X} from '@phosphor-icons/react'
import {ROLES,ROLE_LABELS,STEPS,STEP_LABELS,WORKFLOW_STATUS,newPackage,setPackageName,provinceName,provinceSummary,recordedAccountCount,timeLabel,workflowStatusOf,type ProvinceReport,type ReportPackage,type AccountRole,type AccountDetail} from '@/lib/report/model'
import s from './report.module.css'

export function ReportDialog({title,children,onClose,busy=false,wide=false,progressLabel,onDelete,deletePrompt='Data ini akan dihapus dari draft.'}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean;progressLabel?:string;onDelete?:()=>void;deletePrompt?:string}) {
  const ref=useRef<HTMLDialogElement>(null)
  const titleId=useId()
  const [confirmDelete,setConfirmDelete]=useState(false)
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close()}},[])
  return <dialog ref={ref} className={wide?`${s.dialog} ${s.wideDialog}`:s.dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!busy)onClose()}}>
    <header className={s.dialogHeader}><h2 id={titleId}>{title}</h2><div className={s.dialogActions}>{onDelete&&<button className={s.dangerIconButton} type="button" onClick={()=>setConfirmDelete(true)} disabled={busy} aria-label="Hapus data provinsi" title="Hapus data provinsi"><Trash size={18}/></button>}<button className={s.iconButton} type="button" onClick={onClose} disabled={busy} aria-label="Tutup panel"><X size={20}/></button></div></header>
    <div className={s.dialogBody}>{confirmDelete&&onDelete?<section className={s.deleteConfirm} role="alertdialog" aria-label="Konfirmasi hapus data"><p>{deletePrompt}</p><div><button className={s.button} type="button" onClick={()=>setConfirmDelete(false)} disabled={busy}>Batal</button><button className={s.dangerButton} type="button" onClick={()=>{onDelete();setConfirmDelete(false)}} disabled={busy}><Trash size={16}/>Hapus data</button></div></section>:children}</div>
    {busy&&<div className={s.dialogSavingOverlay} role="status" aria-live="polite">{progressLabel
      ? <div className={s.importProgress}><strong>{progressLabel}</strong><progress aria-label={progressLabel}/></div>
      : <span className={s.savingIndicator}>Menyimpan perubahan...</span>}</div>}
  </dialog>
}
export function ConfirmDialog({title,children,onClose,onConfirm,confirmLabel='Hapus data',busy=false,confirmDisabled=false}:{title:string;children:ReactNode;onClose:()=>void;onConfirm:()=>void;confirmLabel?:string;busy?:boolean;confirmDisabled?:boolean}){
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close()}},[])
  return <dialog ref={ref} className={s.confirmDialog} aria-labelledby="report-confirm-title" onCancel={event=>{event.preventDefault();if(!busy)onClose()}}>
    <h3 id="report-confirm-title">{title}</h3><div>{children}</div><div className={s.toolActions}><button className={s.button} type="button" onClick={onClose} disabled={busy}>Batal</button><button className={s.dangerButton} type="button" onClick={onConfirm} disabled={busy||confirmDisabled}><Trash size={16}/>{confirmLabel}</button></div>
  </dialog>
}
const numeric=(value:string)=>value===''?null:Number(value)
export function AccountPanel({province,role,editable,canSave,onChange,onSave}:{province:ProvinceReport;role:AccountRole;editable:boolean;canSave:boolean;onChange:(update:(p:ProvinceReport)=>void)=>void;onSave:()=>Promise<void>}) {
  const a=province.accounts[role]
  const [saving,setSaving]=useState(false),[saveMessage,setSaveMessage]=useState(''),[confirmDelete,setConfirmDelete]=useState(false),[deleteDetailId,setDeleteDetailId]=useState('')
  function patchDetail(id:string,key:keyof AccountDetail,value:string){onChange(p=>{const d=p.accounts[role].details.find(d=>d.id===id)!;d[key]=value})}
  async function saveChanges(){setSaving(true);setSaveMessage('');try{await onSave();setSaveMessage('Perubahan tersimpan.')}catch(error){setSaveMessage(error instanceof Error?error.message:'Perubahan belum dapat disimpan.')}finally{setSaving(false)}}
  return <>
    <p className={s.panelIntro}>{ROLE_LABELS[role]} di {provinceName(province.id,province.name)}. T/C berarti sumber belum mencatat akun. Status ini tidak memastikan akun belum tersedia.</p>
    <fieldset disabled={!editable} className={s.formFields}>
      <div className={s.formRow}><label>Status akun<select value={a.status} onChange={e=>onChange(p=>{const next=e.target.value as typeof a.status;p.accounts[role].status=next;p.accounts[role].count=next==='tidak_ada'?0:next==='tc'?null:p.accounts[role].count===0?null:p.accounts[role].count})}><option value="ada">Ada</option><option value="tc">T/C - tidak tercatat</option><option value="tidak_ada">Tidak ada · sudah dikonfirmasi</option></select></label>
      <label>Jumlah akun<input type="number" min={a.status==='ada'?1:0} max={1000000} value={a.count??''} disabled={a.status!=='ada'} placeholder={recordedAccountCount(a)?.toString()??'Belum diketahui'} onChange={e=>onChange(p=>{p.accounts[role].count=numeric(e.target.value)})}/>
        {a.status==='ada'&&a.count===null&&recordedAccountCount(a)!==null&&<small>Dihitung dari rincian akun yang sudah diberi nama.</small>}
      </label></div>
      <label>Catatan peran<textarea rows={2} maxLength={3000} value={a.note} onChange={e=>onChange(p=>{p.accounts[role].note=e.target.value})}/></label>
      <div className={s.sectionHeader}><h3>Rincian akun</h3>{editable&&<button type="button" className={s.button} disabled={a.status!=='ada'} onClick={()=>onChange(p=>{p.accounts[role].details.push({id:crypto.randomUUID(),label:'',institution:'',email:'',note:''})})}><Plus size={16}/>Tambah akun</button>}</div>
      {!a.details.length&&<p className={s.quiet}>Rincian akun belum diisi. Data awal hanya mencatat status pembuatan akun.</p>}
      {a.details.map((d,index)=><section key={d.id} className={s.detailBlock}><h4>Akun {index+1}</h4><div className={s.formRow}><label>Nama / label akun<input value={d.label} maxLength={160} onChange={e=>patchDetail(d.id,'label',e.target.value)}/></label><label>Instansi<input value={d.institution} maxLength={200} onChange={e=>patchDetail(d.id,'institution',e.target.value)}/></label></div><label>Email (opsional)<input type="email" value={d.email} maxLength={254} onChange={e=>patchDetail(d.id,'email',e.target.value)}/></label><label>Keterangan<textarea rows={2} value={d.note} maxLength={3000} onChange={e=>patchDetail(d.id,'note',e.target.value)}/></label>{editable&&<button className={s.textButton} type="button" onClick={()=>setDeleteDetailId(d.id)}>Hapus rincian akun ini</button>}{editable&&deleteDetailId===d.id&&<ConfirmDialog title="Hapus rincian akun?" onClose={()=>setDeleteDetailId('')} onConfirm={()=>{onChange(p=>{p.accounts[role].details=p.accounts[role].details.filter(item=>item.id!==d.id)});setDeleteDetailId('')}} confirmLabel="Hapus rincian"><p>Rincian akun ini akan dihapus dari draft.</p></ConfirmDialog>}</section>)}
    </fieldset>
    <p className={s.timestamp}>Terakhir diubah: {timeLabel(a.updatedAt)}.</p>
    {editable&&<div className={s.modalSave}>{saveMessage&&<p role={saveMessage.includes('tersimpan')?'status':'alert'} className={saveMessage.includes('tersimpan')?s.notice:s.error}>{saveMessage}</p>}<button className={s.textDangerButton} type="button" disabled={saving||!(a.status!=='tc'||a.count!==null||a.details.length>0||a.note)} onClick={()=>setConfirmDelete(true)}><Trash size={16}/>Hapus data akun</button><button className={s.primaryButton} type="button" disabled={saving||!canSave} onClick={()=>void saveChanges()}>{saving?'Menyimpan...':'Simpan perubahan'}</button></div>}
    {editable&&confirmDelete&&<ConfirmDialog title="Hapus data akun?" onClose={()=>setConfirmDelete(false)} onConfirm={()=>{onChange(p=>{const account=p.accounts[role];account.status='tc';account.count=null;account.details=[];account.note='' });setConfirmDelete(false);setSaveMessage('Data dihapus dari draft. Pilih Simpan perubahan untuk menerapkan.')}} confirmLabel="Hapus data"><p>Data akun ini akan dihapus dari draft dan statusnya kembali menjadi T/C.</p></ConfirmDialog>}
  </>
}
export function PackagePanel({pkg,provinceName,editable,canSave,onChange,onSave}:{pkg:ReportPackage;provinceName:string;editable:boolean;canSave:boolean;onChange:(update:(pkg:ReportPackage)=>void)=>void;onSave:()=>Promise<void>}){
  const [saving,setSaving]=useState(false),[message,setMessage]=useState('')
  async function saveChanges(){setSaving(true);setMessage('');try{await onSave();setMessage('Perubahan tersimpan.')}catch(error){setMessage(error instanceof Error?error.message:'Perubahan belum dapat disimpan.')}finally{setSaving(false)}}
  return <>
    <p className={s.panelIntro}>{provinceName}. Perbarui status proses paket di Tahap 4.</p>
    {pkg.active&&<div className={s.packageDetailSummary}><span className={`${s.workflowStatus} ${s.incomplete}`}>{WORKFLOW_STATUS[workflowStatusOf(pkg)]}</span><small>Paket aktif</small></div>}
    {!pkg.active&&<p className={s.packageReason}>Alasan penonaktifan: {pkg.inactiveReason||'Tidak dicatat'}</p>}
    <fieldset className={s.formFields} disabled={!editable}>
      <label>Nama paket<input value={pkg.name} maxLength={240} onChange={event=>onChange(item=>{setPackageName(item,event.target.value)})}/></label>
      {pkg.active&&<div className={s.packageStageList}>{STEPS.map(step=><div className={s.packageStageRow} key={step}><span>{STEP_LABELS[step]}</span><strong className={pkg[step]==='selesai'?s.complete:pkg[step]==='proses'?s.incomplete:s.packageStageNone}>{pkg[step]==='selesai'?'Selesai':pkg[step]==='proses'?'Proses':'-'}</strong></div>)}</div>}
      {pkg.active&&<label>Catatan paket (opsional)<textarea rows={3} maxLength={3000} value={pkg.note} onChange={event=>onChange(item=>{item.note=event.target.value})}/></label>}
    </fieldset>
    <p className={s.timestamp}>Ditambahkan pada: {timeLabel(pkg.createdAt)}<br/>Nama terakhir diubah: {timeLabel(pkg.nameUpdatedAt)}<br/>Progres terakhir diperbarui: {timeLabel(pkg.statusUpdatedAt)}</p>
    {editable&&<div className={s.modalSave}>{message&&<p role={message.includes('tersimpan')?'status':'alert'} className={message.includes('tersimpan')?s.notice:s.error}>{message}</p>}<button className={s.primaryButton} type="button" disabled={saving||!canSave} onClick={()=>void saveChanges()}>{saving?'Menyimpan...':'Simpan perubahan'}</button></div>}
  </>
}
export function ProvincePanel({province,editable,canSave,onChange,onSaveNotes,onSaveChanges}:{province:ProvinceReport;editable:boolean;canSave:boolean;onChange:(update:(p:ProvinceReport)=>void)=>void;onSaveNotes:(provinceId:string,analysis:string,followUp:string)=>Promise<void>;onSaveChanges:()=>Promise<void>}) {
  const {totalPackages,integratedPackages}=provinceSummary(province)
  const orderedPackages=[...province.packages.filter(pkg=>pkg.active),...province.packages.filter(pkg=>!pkg.active)]
  const [analysis,setAnalysis]=useState(''),[followUp,setFollowUp]=useState(''),[noteError,setNoteError]=useState(''),[noteStatus,setNoteStatus]=useState(''),[savingNote,setSavingNote]=useState(false)
  const [savingChanges,setSavingChanges]=useState(false),[changeMessage,setChangeMessage]=useState('')
  const notesHistory=province.notesHistory||[]
  async function saveNote(){
    const nextAnalysis=analysis.trim(),nextFollowUp=followUp.trim()
    if(!nextAnalysis&&!nextFollowUp){setNoteError('Isi analisis/kendala atau tindak lanjut terlebih dahulu.');return}
    setSavingNote(true);setNoteError('');setNoteStatus('')
    try{await onSaveNotes(province.id,nextAnalysis,nextFollowUp);setAnalysis('');setFollowUp('');setNoteStatus('Catatan berhasil ditambahkan.')}catch(error){setNoteError(error instanceof Error?error.message:'Catatan belum dapat disimpan.')}finally{setSavingNote(false)}
  }
  async function saveChanges(){setSavingChanges(true);setChangeMessage('');try{await onSaveChanges();setChangeMessage('Perubahan tersimpan.')}catch(error){setChangeMessage(error instanceof Error?error.message:'Perubahan belum dapat disimpan.')}finally{setSavingChanges(false)}}
  return <>
    <p className={s.panelIntro}>Paket aktif dan progres integrasinya di {provinceName(province.id,province.name)}.</p>
    <fieldset disabled={!editable} className={s.formFields}>
      <div className={s.packageMetrics} aria-label="Ringkasan paket"><article><span>Total paket aktif</span><strong>{totalPackages}</strong></article><article><span>Siap integrasi SIPD</span><strong>{integratedPackages}</strong><small>Termasuk paket yang sudah diterima SIPD</small></article></div>
      <div className={s.sectionHeader}><h3>Paket</h3>{editable&&<button type="button" className={s.button} onClick={()=>onChange(p=>{p.packages.push(newPackage(''))})}><Plus size={16}/>Tambah paket</button>}</div>
      {!province.packages.length&&<p className={s.emptyDetail}>Belum ada nama paket. {editable?'Pilih Tambah paket untuk mulai mengisi.':'Buka rincian provinsi untuk menambahkan paket.'}</p>}
      {orderedPackages.map((pkg,index)=><section className={`${s.packageModalCard} ${!pkg.active?s.packageInactive:''}`} key={pkg.id}>
        <div className={s.packageModalHeading}><h4>{pkg.name||`Paket ${index+1}`}</h4>{pkg.active&&<span className={`${s.workflowStatus} ${s.incomplete}`}>{WORKFLOW_STATUS[workflowStatusOf(pkg)]}</span>}</div>
        {editable?<label>Nama paket<input value={pkg.name} maxLength={240} onChange={e=>onChange(p=>{setPackageName(p.packages.find(item=>item.id===pkg.id)!,e.target.value)})}/></label>:<p className={s.packageModalName}>{pkg.name||'Tambahkan nama paket'}</p>}
        {pkg.active&&<div className={s.packageStageList}>{STEPS.map(step=><div className={s.packageStageRow} key={step}><span>{STEP_LABELS[step]}</span><strong className={pkg[step]==='selesai'?s.complete:pkg[step]==='proses'?s.incomplete:s.packageStageNone}>{pkg[step]==='selesai'?'Selesai':pkg[step]==='proses'?'Proses':'-'}</strong></div>)}</div>}
        {pkg.active&&(editable?<label>Catatan paket<textarea rows={2} maxLength={3000} value={pkg.note} onChange={e=>onChange(p=>{p.packages.find(item=>item.id===pkg.id)!.note=e.target.value})}/></label>:pkg.note&&<p className={s.packageNote}>{pkg.note}</p>)}
        {!pkg.active&&pkg.inactiveReason&&<small className={s.packageReason}>Alasan penonaktifan: {pkg.inactiveReason}</small>}
        <p className={s.packageTimestamps}>Diinput {timeLabel(pkg.createdAt)} · Nama diubah {timeLabel(pkg.nameUpdatedAt)} · Progres diubah {timeLabel(pkg.statusUpdatedAt)}</p>
      </section>)}
      {editable&&<section className={s.noteComposer} aria-label="Catatan laporan">
        <h3>Tambah catatan</h3>
        <label>Analisis / kendala<textarea rows={3} maxLength={3000} value={analysis} onChange={e=>{setAnalysis(e.target.value);setNoteStatus('')}} placeholder="Tulis analisis atau kendala" disabled={savingNote}/></label>
        <label>Tindak lanjut<textarea rows={3} maxLength={3000} value={followUp} onChange={e=>{setFollowUp(e.target.value);setNoteStatus('')}} placeholder="Tulis tindak lanjut" disabled={savingNote}/></label>
        {noteError&&<p role="alert" className={s.error}>{noteError}</p>}{noteStatus&&<p role="status" className={s.notice}>{noteStatus}</p>}
        <button className={s.primaryButton} type="button" onClick={()=>void saveNote()} disabled={savingNote||(!analysis.trim()&&!followUp.trim())}>{savingNote?'Menyimpan...':'Simpan catatan'}</button>
      </section>}
      <section className={s.noteHistory} aria-label="Riwayat catatan"><h3>Riwayat catatan</h3>
        {notesHistory.length?notesHistory.slice().reverse().map(entry=><article key={entry.id}><time>Dicatat {timeLabel(entry.createdAt)}</time>{entry.analysis&&<p><strong>Analisis / kendala</strong>{entry.analysis}</p>}{entry.followUp&&<p><strong>Tindak Lanjut</strong>{entry.followUp}</p>}</article>):province.notes||province.followUp?<article><time>Tanggal catatan lama tidak tersedia</time>{province.notes&&<p><strong>Analisis / kendala</strong>{province.notes}</p>}{province.followUp&&<p><strong>Tindak Lanjut</strong>{province.followUp}</p>}</article>:<p className={s.quiet}>Belum ada catatan tersimpan.</p>}
      </section>
      {editable&&<div className={s.modalSave}>{changeMessage&&<p role={changeMessage.includes('tersimpan')?'status':'alert'} className={changeMessage.includes('tersimpan')?s.notice:s.error}>{changeMessage}</p>}<button className={s.primaryButton} type="button" disabled={savingChanges||savingNote||!canSave} onClick={()=>void saveChanges()}>{savingChanges?'Menyimpan...':'Simpan perubahan'}</button></div>}
    </fieldset>
    <p className={s.quiet}>Alur paket: PU → BPKAD → APIP. Jika dikembalikan untuk perbaikan, proses dimulai lagi dari PU. Catatan paket tidak wajib.</p>
  </>
}
export function AccessPanel({onSave}:{onSave:(body:{adminPin?:string;userPin?:string})=>Promise<void>}) {
  const [adminPin,setAdminPin]=useState(''),[userPin,setUserPin]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  return <form className={s.formFields} onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{await onSave({...adminPin?{adminPin}:{},...userPin?{userPin}:{}});setAdminPin('');setUserPin('');setMessage('PIN diperbarui. Sesi lama untuk peran yang diubah sudah dibatalkan.')}catch(error){setMessage(error instanceof Error?error.message:'PIN belum dapat diperbarui.')}finally{setBusy(false)}}}>
    <p className={s.panelIntro}>Isi PIN yang ingin diganti. Kosongkan isian peran yang tetap menggunakan PIN sebelumnya.</p>
    <label>PIN admin baru<input type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="new-password" value={adminPin} onChange={e=>setAdminPin(e.target.value)}/></label>
    <label>PIN penginput baru<input type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="new-password" value={userPin} onChange={e=>setUserPin(e.target.value)}/></label>
    <p className={s.quiet}>Gunakan 6-12 digit angka dan PIN yang berbeda untuk kedua peran.</p>
    {message&&<p role="status" className={s.notice}>{message}</p>}
    <button className={s.primaryButton} disabled={busy||(!adminPin&&!userPin)} type="submit">{busy?'Menyimpan...':'Simpan PIN'}</button>
  </form>
}
export const accountRoles=ROLES
