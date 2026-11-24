'use client'

import {useEffect,useId,useRef,useState,type ReactNode} from 'react'
import {CaretDown,CheckCircle,Clock,PencilSimple,Plus,Question,Trash,X,XCircle} from '@phosphor-icons/react'
import {PACKAGE_ENVIRONMENTS,PACKAGE_ENVIRONMENT_LABELS,PACKAGE_EVIDENCE_URL_LIMIT,PACKAGE_PIC_NAME_LIMIT,PACKAGE_PIC_PHONE_LIMIT,PACKAGE_CONFIRMATION_STATUSES,PACKAGE_CONFIRMATION_LABELS,packageConfirmationStatus,packageEvidenceLink,type PackageEnvironment,type PackageConfirmationStatus} from '@/lib/report/model'
import {ROLES,ROLE_LABELS,STEPS,STEP_LABELS,WORKFLOW_STATUS,newPackage,setPackageConfirmationStatus,setPackageName,provinceName,provinceSummary,recordedAccountCount,timeLabel,workflowStatusOf,type ProvinceReport,type ReportPackage,type AccountRole,type AccountDetail} from '@/lib/report/model'
import s from './report.module.css'

export function ReportDialog({title,children,onClose,busy=false,wide=false,packageDialog=false,progressLabel,onDelete,deletePrompt='Data ini akan dihapus dari draft.'}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean;packageDialog?:boolean;progressLabel?:string;onDelete?:()=>void;deletePrompt?:string}) {
  const ref=useRef<HTMLDialogElement>(null)
  const titleId=useId()
  const [confirmDelete,setConfirmDelete]=useState(false)
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close()}},[])
  return <dialog ref={ref} className={packageDialog?`${s.dialog} ${s.packageDialog}`:wide?`${s.dialog} ${s.wideDialog}`:s.dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!busy)onClose()}}>
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
export function AccountPanel({province,role,editable,canDelete,canSave,onChange,onSave}:{province:ProvinceReport;role:AccountRole;editable:boolean;canDelete:boolean;canSave:boolean;onChange:(update:(p:ProvinceReport)=>void)=>void;onSave:()=>Promise<void>}) {
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
      {a.details.map((d,index)=><section key={d.id} className={s.detailBlock}><h4>Akun {index+1}</h4><div className={s.formRow}><label>Nama / label akun<input value={d.label} maxLength={160} onChange={e=>patchDetail(d.id,'label',e.target.value)}/></label><label>Instansi<input value={d.institution} maxLength={200} onChange={e=>patchDetail(d.id,'institution',e.target.value)}/></label></div><label>Email (opsional)<input type="email" value={d.email} maxLength={254} onChange={e=>patchDetail(d.id,'email',e.target.value)}/></label><label>Keterangan<textarea rows={2} value={d.note} maxLength={3000} onChange={e=>patchDetail(d.id,'note',e.target.value)}/></label>{canDelete&&<button className={s.textButton} type="button" onClick={()=>setDeleteDetailId(d.id)}>Hapus rincian akun ini</button>}{canDelete&&deleteDetailId===d.id&&<ConfirmDialog title="Hapus rincian akun?" onClose={()=>setDeleteDetailId('')} onConfirm={()=>{onChange(p=>{p.accounts[role].details=p.accounts[role].details.filter(item=>item.id!==d.id)});setDeleteDetailId('')}} confirmLabel="Hapus rincian"><p>Rincian akun ini akan dihapus dari draft.</p></ConfirmDialog>}</section>)}
    </fieldset>
    <p className={s.timestamp}>Terakhir diubah: {timeLabel(a.updatedAt)}.</p>
    {editable&&<div className={s.modalSave}>{saveMessage&&<p role={saveMessage.includes('tersimpan')?'status':'alert'} className={saveMessage.includes('tersimpan')?s.notice:s.error}>{saveMessage}</p>}{canDelete&&<button className={s.textDangerButton} type="button" disabled={saving||!(a.status!=='tc'||a.count!==null||a.details.length>0||a.note)} onClick={()=>setConfirmDelete(true)}><Trash size={16}/>Hapus data akun</button>}<button className={s.primaryButton} type="button" disabled={saving||!canSave} onClick={()=>void saveChanges()}>{saving?'Menyimpan...':'Simpan perubahan'}</button></div>}
    {canDelete&&confirmDelete&&<ConfirmDialog title="Hapus data akun?" onClose={()=>setConfirmDelete(false)} onConfirm={()=>{onChange(p=>{const account=p.accounts[role];account.status='tc';account.count=null;account.details=[];account.note='' });setConfirmDelete(false);setSaveMessage('Data dihapus dari draft. Pilih Simpan perubahan untuk menerapkan.')}} confirmLabel="Hapus data"><p>Data akun ini akan dihapus dari draft dan statusnya kembali menjadi T/C.</p></ConfirmDialog>}
  </>
}
type EvidenceProps={pkg:ReportPackage;onChange?:(update:(pkg:ReportPackage)=>void)=>void}
export function PackageEnvironmentBadge({environment,count}:{environment:PackageEnvironment;count?:number}){
  return <span className={s.environmentBadge} data-environment={environment}>{PACKAGE_ENVIRONMENT_LABELS[environment]}{count===undefined?'':` · ${count}`}</span>
}
function PackageEnvironmentField({pkg,onChange}:EvidenceProps){
  if(!onChange)return null
  return <label>Lingkungan paket
    <select value={pkg.environment??''} onChange={event=>{
      const environment=PACKAGE_ENVIRONMENTS.find(value=>value===event.target.value)??null
      onChange(item=>{item.environment=environment})
    }}>
      <option value="">Belum ditentukan</option>
      {PACKAGE_ENVIRONMENTS.map(environment=><option key={environment} value={environment}>{PACKAGE_ENVIRONMENT_LABELS[environment]}</option>)}
    </select>
  </label>
}
function PackageConfirmation({pkg,onChange}:EvidenceProps){
  const status=packageConfirmationStatus(pkg)
  if(!onChange){const Icon=status==='confirmed'?CheckCircle:status==='checking'?Clock:status==='cancelled'?XCircle:Question;return <span className={s.packageStatusBadge} data-status={status}><Icon size={14} weight="bold" aria-hidden="true"/>{PACKAGE_CONFIRMATION_LABELS[status]}</span>}
  return <fieldset className={s.packageStatusField}>
    <legend>Status paket</legend>
    <div className={s.packageStatusChoices} role="group" aria-label="Status paket">
      {PACKAGE_CONFIRMATION_STATUSES.map(value=>{const StatusIcon=value==='confirmed'?CheckCircle:value==='checking'?Clock:value==='cancelled'?XCircle:Question;return <button key={value} type="button" aria-pressed={status===value}
        className={s.packageStatusBadge} data-status={value} data-selected={status===value}
        onClick={()=>onChange(item=>setPackageConfirmationStatus(item,value as PackageConfirmationStatus))}>
        <StatusIcon size={14} weight="bold" aria-hidden="true"/>{PACKAGE_CONFIRMATION_LABELS[value]}
      </button>})}
    </div>
    {status!=='confirmed'&&<small className={s.quiet}>Catatan/alasan wajib diisi untuk paket yang belum terkonfirmasi atau dibatalkan.</small>}
  </fieldset>
}
function PackageNoteField(props:{value:string;required:boolean;onChange?:(value:string)=>void}|{pkg:ReportPackage;onChange?:(update:(pkg:ReportPackage)=>void)=>void}){
  if('pkg'in props){
    const required=packageConfirmationStatus(props.pkg)!=='confirmed'
    if(!props.onChange)return props.pkg.note?<p className={s.packageNote}>{props.pkg.note}</p>:null
    return <label>{required?'Catatan / alasan (wajib)':'Catatan paket (opsional)'}
      <textarea rows={2} maxLength={3000} value={props.pkg.note} required={required} onChange={event=>{const note=event.target.value;props.onChange?.(item=>{item.note=note})}}/>
    </label>
  }
  if(!props.onChange)return null
  return <label>Tambah catatan paket {props.required&&<span className={s.requiredNote}>(wajib)</span>}
    <textarea rows={2} maxLength={3000} value={props.value} required={props.required} placeholder="Tulis catatan baru (opsional)" onChange={event=>props.onChange?.(event.target.value)}/>
  </label>
}
function PackageSectionHeading({title,editing,editable,onEdit,onCancel}:{title:string;editing:boolean;editable:boolean;onEdit:()=>void;onCancel:()=>void}){
  return <div className={s.packageSectionHeading}><h3>{title}</h3>{editable&&(editing
    ?<button type="button" className={s.packageSectionCancel} aria-label={`Batalkan edit ${title.toLowerCase()}`} title="Batal edit" onClick={onCancel}><X size={15}/></button>
    :<button type="button" className={s.packageSectionEdit} aria-label={`Edit ${title.toLowerCase()}`} title={`Edit ${title.toLowerCase()}`} onClick={onEdit}><PencilSimple size={15}/></button>)}</div>
}
function PackageNoteTimeline({pkg}:{pkg:ReportPackage}){
  if(!pkg.noteHistory?.length)return null
  return <section className={s.packageNoteTimeline} aria-label="Riwayat catatan paket"><h4>Riwayat catatan</h4><ol>{pkg.noteHistory.slice().reverse().map(entry=><li key={entry.id}><time>{entry.createdAt?timeLabel(entry.createdAt):'Tanggal catatan lama tidak tersedia'}</time><p>{entry.text}</p></li>)}</ol></section>
}
function EvidenceCheck({pkg,onChange}:EvidenceProps){
  return onChange?<label className={s.evidenceCheck}>
    <input type="checkbox" checked={pkg.evidenceChecked} aria-label={`Bukti dukung ${pkg.name||'paket baru'} tersedia`}
      onChange={event=>{const checked=event.target.checked;onChange(item=>{item.evidenceChecked=checked})}}/>
    Tersedia
  </label>:<span className={s.evidenceStatus} data-checked={pkg.evidenceChecked}>
    {pkg.evidenceChecked?'Ditandai tersedia':'Belum ditandai'}
  </span>
}
function EvidenceUrl({pkg,onChange}:EvidenceProps){
  const href=packageEvidenceLink(pkg.evidenceUrl)
  return onChange?<input className={s.evidenceUrlInput} type="url" inputMode="url" value={pkg.evidenceUrl} maxLength={PACKAGE_EVIDENCE_URL_LIMIT}
    aria-label={`URL bukti dukung ${pkg.name||'paket baru'}`} aria-invalid={!!pkg.evidenceUrl.trim()&&!href} placeholder="https://"
    onChange={event=>{const value=event.target.value;onChange(item=>{item.evidenceUrl=value})}}/>
    :href?<a className={s.evidenceLink} href={href} target="_blank" rel="noopener noreferrer">Buka bukti dukung<span className={s.srOnly}>{` ${pkg.name} (tab baru)`}</span></a>:<span className={s.quiet}>—</span>
}
function PackageEvidenceFields(props:EvidenceProps){
  return <div className={s.packageEvidenceFields}>
    <div>{props.onChange?'Bukti dukung (opsional)':'Bukti dukung'}<EvidenceCheck {...props}/></div>
    {props.onChange?<label>URL bukti dukung (opsional)<EvidenceUrl {...props}/></label>:<EvidenceUrl {...props}/>}
  </div>
}
function PackagePic({pkg,onChange}:EvidenceProps){
  return <div className={s.packagePic}>
    {onChange?<>
      <label>Nama PIC<input value={pkg.picName} maxLength={PACKAGE_PIC_NAME_LIMIT} autoComplete="off"
        onChange={event=>{const value=event.target.value;onChange(item=>{item.picName=value})}}/></label>
      <label>Nomor kontak<input type="tel" value={pkg.picPhone} maxLength={PACKAGE_PIC_PHONE_LIMIT} autoComplete="off"
        onChange={event=>{const value=event.target.value;onChange(item=>{item.picPhone=value})}}/></label>
    </>:pkg.picName&&pkg.picPhone?<>
      <strong>{pkg.picName}</strong><a className={s.evidenceLink} href={`tel:${pkg.picPhone.replace(/[^+\d]/g,'')}`}>{pkg.picPhone}</a>
    </>:<span className={s.quiet}>—</span>}
  </div>
}
export function PackagePanel({pkg,editable,canSave,onChange,onSave}:{pkg:ReportPackage;editable:boolean;canSave:boolean;onChange:(update:(pkg:ReportPackage)=>void)=>void;onSave:(note?:string)=>Promise<void>}){
  const [saving,setSaving]=useState(false),[message,setMessage]=useState(''),[noteDraft,setNoteDraft]=useState('')
  const [editingSections,setEditingSections]=useState(()=>({details:!pkg.createdAt,pic:!pkg.createdAt||(!pkg.picName&&!pkg.picPhone),evidence:!pkg.createdAt||(!pkg.evidenceChecked&&!pkg.evidenceUrl)}))
  const [sectionSnapshots,setSectionSnapshots]=useState<{details?:{name:string;environment:ReportPackage['environment']};pic?:{picName:string;picPhone:string};evidence?:{evidenceChecked:boolean;evidenceUrl:string}}>({})
  const persisted=Boolean(pkg.createdAt)
  const detailsEditing=editable&&editingSections.details
  const picEditing=editable&&editingSections.pic
  const evidenceEditing=editable&&editingSections.evidence
  function editSection(section:'details'|'pic'|'evidence'){
    setSectionSnapshots(current=>({...current,[section]:section==='details'?{name:pkg.name,environment:pkg.environment}:section==='pic'?{picName:pkg.picName,picPhone:pkg.picPhone}:{evidenceChecked:pkg.evidenceChecked,evidenceUrl:pkg.evidenceUrl}}))
    setEditingSections(current=>({...current,[section]:true}))
  }
  function cancelSection(section:'details'|'pic'|'evidence'){
    const original=sectionSnapshots[section]
    if(original)onChange(item=>{
      if(section==='details'&&'name'in original){item.name=original.name;item.environment=original.environment}
      if(section==='pic'&&'picName'in original){item.picName=original.picName;item.picPhone=original.picPhone}
      if(section==='evidence'&&'evidenceChecked'in original){item.evidenceChecked=original.evidenceChecked;item.evidenceUrl=original.evidenceUrl}
    })
    setEditingSections(current=>({...current,[section]:false}))
    setSectionSnapshots(current=>{const next={...current};delete next[section];return next})
  }
  const noteRequired=pkg.active&&packageConfirmationStatus(pkg)!=='confirmed'&&!pkg.note.trim()
  async function saveChanges(){setSaving(true);setMessage('');try{await onSave(noteDraft.trim()||undefined);setNoteDraft('');setEditingSections({details:false,pic:false,evidence:false});setSectionSnapshots({});setMessage('Perubahan tersimpan.')}catch(error){setMessage(error instanceof Error?error.message:'Perubahan belum dapat disimpan.')}finally{setSaving(false)}}
  return <>
    {pkg.active&&<div className={`${s.packageDossierMeta} ${s.packageDossierSummaryBox}`}>
      <div className={s.packageDossierSummaryStatus}>{pkg.environment&&<PackageEnvironmentBadge environment={pkg.environment}/>}</div>
      <div className={s.packageDossierSummaryTimes}><span><small>Ditambahkan</small>{timeLabel(pkg.createdAt)}</span><span><small>Diperbarui</small>{timeLabel(pkg.updatedAt)}</span></div>
    </div>}
    <fieldset className={`${s.packageDossier} ${!pkg.active?`${s.packageInactive} ${s.packageModalCard}`:''}`} data-confirmation={pkg.active?packageConfirmationStatus(pkg):undefined} disabled={!editable}>
      {!pkg.active&&<p className={s.packageReason}><strong>Paket nonaktif</strong><br/>Alasan penonaktifan: {pkg.inactiveReason||'Tidak dicatat'}</p>}
      {pkg.active&&<PackageConfirmation pkg={pkg} onChange={editable?onChange:undefined}/>}
      <div className={s.packageDossierGrid}>
        <div className={s.packageDossierMain}>
          <section className={s.packageDossierSection}>
            <PackageSectionHeading title="Rincian pekerjaan" editing={detailsEditing} editable={editable&&persisted} onEdit={()=>editSection('details')} onCancel={()=>cancelSection('details')}/>
            {detailsEditing?<><label>Nama paket<input value={pkg.name} maxLength={240} onChange={event=>onChange(item=>{setPackageName(item,event.target.value)})}/></label><PackageEnvironmentField pkg={pkg} onChange={onChange}/></>:<><p className={s.packageDossierValue}>{pkg.name}</p><div className={s.packageDossierInlineValue}><span>Lingkungan paket</span>{pkg.environment?<PackageEnvironmentBadge environment={pkg.environment}/>:<span>Belum ditentukan</span>}</div></>}
            {pkg.active&&pkg.confirmed&&<div className={s.packageStageList} aria-label="Progres tahap 4">{STEPS.map(step=><div className={s.packageStageRow} key={step}><span>{STEP_LABELS[step]}</span><strong className={pkg[step]==='selesai'?s.complete:pkg[step]==='proses'?s.incomplete:s.packageStageNone}>{pkg[step]==='selesai'?'Selesai':pkg[step]==='proses'?'Proses':'-'}</strong></div>)}</div>}
          </section>
          {pkg.active&&<section className={s.packageDossierSection}><PackageNoteField value={noteDraft} required={noteRequired} onChange={editable?setNoteDraft:undefined}/><PackageNoteTimeline pkg={pkg}/></section>}
        </div>
        {pkg.active&&<aside className={s.packageDossierAside}>
          <section className={s.packageDossierSection}><PackageSectionHeading title="Penanggung jawab" editing={picEditing} editable={editable&&persisted} onEdit={()=>editSection('pic')} onCancel={()=>cancelSection('pic')}/>{picEditing?<PackagePic pkg={pkg} onChange={onChange}/>:<div className={s.packageDossierValueGroup}><strong>{pkg.picName||'Belum ada PIC'}</strong>{pkg.picPhone&&<a className={s.evidenceLink} href={`tel:${pkg.picPhone.replace(/[^+\d]/g,'')}`}>{pkg.picPhone}</a>}</div>}</section>
          <section className={s.packageDossierSection}><PackageSectionHeading title="Bukti dukung" editing={evidenceEditing} editable={editable&&persisted} onEdit={()=>editSection('evidence')} onCancel={()=>cancelSection('evidence')}/>{evidenceEditing?<PackageEvidenceFields pkg={pkg} onChange={onChange}/>:<div className={s.packageDossierValueGroup}><span className={s.evidenceStatus} data-checked={pkg.evidenceChecked}>{pkg.evidenceChecked?'Bukti dukung terkumpul':'Belum ada bukti dukung'}</span>{packageEvidenceLink(pkg.evidenceUrl)?<a className={s.evidenceLink} href={packageEvidenceLink(pkg.evidenceUrl)!} target="_blank" rel="noopener noreferrer">{pkg.evidenceUrl}</a>:<small className={s.quiet}>URL belum dicantumkan</small>}</div>}</section>
        </aside>}
      </div>
    </fieldset>
    {editable&&<div className={s.modalSave}>{message&&<p role={message.includes('tersimpan')?'status':'alert'} className={message.includes('tersimpan')?s.notice:s.error}>{message}</p>}<button className={s.primaryButton} type="button" disabled={saving||(!canSave&&!noteDraft.trim())||(noteRequired&&!noteDraft.trim())} onClick={()=>void saveChanges()}>{saving?'Menyimpan...':'Simpan perubahan'}</button></div>}
  </>
}
export function ProvincePanel({province,editable,canDelete,canSave,onChange,onSaveNotes,onSaveChanges}:{province:ProvinceReport;editable:boolean;canDelete:boolean;canSave:boolean;onChange:(update:(p:ProvinceReport)=>void)=>void;onSaveNotes:(provinceId:string,analysis:string,followUp:string)=>Promise<void>;onSaveChanges:()=>Promise<void>}) {
  const {totalPackages,integratedPackages}=provinceSummary(province)
  const activePackages=province.packages.filter(pkg=>pkg.active)
  const inactivePackages=province.packages.filter(pkg=>!pkg.active)
  const [newPackageId,setNewPackageId]=useState('')
  const [archiveId,setArchiveId]=useState('')
  const [archiveReason,setArchiveReason]=useState('')
  const [analysis,setAnalysis]=useState(''),[followUp,setFollowUp]=useState(''),[noteError,setNoteError]=useState(''),[noteStatus,setNoteStatus]=useState(''),[savingNote,setSavingNote]=useState(false)
  const [savingChanges,setSavingChanges]=useState(false),[changeMessage,setChangeMessage]=useState('')
  const notesHistory=province.notesHistory||[]
  const archivePackage=province.packages.find(pkg=>pkg.id===archiveId)
  async function saveNote(){
    const nextAnalysis=analysis.trim(),nextFollowUp=followUp.trim()
    if(!nextAnalysis&&!nextFollowUp){setNoteError('Isi analisis/kendala atau tindak lanjut terlebih dahulu.');return}
    setSavingNote(true);setNoteError('');setNoteStatus('')
    try{await onSaveNotes(province.id,nextAnalysis,nextFollowUp);setAnalysis('');setFollowUp('');setNoteStatus('Catatan berhasil ditambahkan.')}catch(error){setNoteError(error instanceof Error?error.message:'Catatan belum dapat disimpan.')}finally{setSavingNote(false)}
  }
  async function saveChanges(){setSavingChanges(true);setChangeMessage('');try{await onSaveChanges();setChangeMessage('Perubahan tersimpan.')}catch(error){setChangeMessage(error instanceof Error?error.message:'Perubahan belum dapat disimpan.')}finally{setSavingChanges(false)}}
  function addPackage(){
    const pkg=newPackage('')
    onChange(p=>{p.packages.push(pkg)})
    setNewPackageId(pkg.id)
  }
  function renderPackage(pkg:ReportPackage){
    const persisted=Boolean(pkg.createdAt)
    const updatePackage=editable?(update:(item:ReportPackage)=>void)=>onChange(p=>{
      const item=p.packages.find(row=>row.id===pkg.id)
      if(item)update(item)
    }):undefined
    return <details className={`${s.packageModalCard} ${!pkg.active?s.packageInactive:''}`} data-confirmation={pkg.active?packageConfirmationStatus(pkg):undefined} key={pkg.id} open={pkg.id===newPackageId&&!pkg.createdAt}>
      <summary className={s.modalDisclosureSummary}>
        <span className={s.packageMeta}><span>{pkg.name||'Paket baru'}</span>{pkg.active&&pkg.environment&&<PackageEnvironmentBadge environment={pkg.environment}/>}</span>
        <CaretDown aria-hidden="true" size={16}/>
      </summary>
      <div className={s.modalDisclosureBody}>
        {pkg.active&&<div className={`${s.packageDossier} ${s.packageDossierEmbedded}`} data-confirmation={packageConfirmationStatus(pkg)}>
          {persisted&&<div className={`${s.packageDossierMeta} ${s.packageDossierSummaryBox}`}>
            <div className={s.packageDossierSummaryStatus}>{pkg.environment&&<PackageEnvironmentBadge environment={pkg.environment}/>}</div>
            <div className={s.packageDossierSummaryTimes}><span><small>Ditambahkan</small>{timeLabel(pkg.createdAt)}</span><span><small>Diperbarui</small>{timeLabel(pkg.updatedAt)}</span></div>
          </div>}
          {persisted&&<PackageConfirmation pkg={pkg} onChange={updatePackage}/>}
          <div className={s.packageDossierGrid}>
            <div className={s.packageDossierMain}>
              <section className={s.packageDossierSection}>
                <h3>Rincian pekerjaan</h3>
                {updatePackage&&<label>Nama paket<input value={pkg.name} maxLength={240} onChange={event=>{
                  const name=event.target.value
                  updatePackage(item=>setPackageName(item,name))
                }}/></label>}
                {updatePackage?<PackageEnvironmentField pkg={pkg} onChange={updatePackage}/>:pkg.environment?<PackageEnvironmentBadge environment={pkg.environment}/>:<span className={s.quiet}>Lingkungan aplikasi belum ditentukan</span>}
                {pkg.confirmed&&<div className={s.packageStageList} aria-label="Progres tahap 4">{STEPS.map(step=><div className={s.packageStageRow} key={step}><span>{STEP_LABELS[step]}</span><strong className={pkg[step]==='selesai'?s.complete:pkg[step]==='proses'?s.incomplete:s.packageStageNone}>{pkg[step]==='selesai'?'Selesai':pkg[step]==='proses'?'Proses':'-'}</strong></div>)}</div>}
              </section>
              <section className={s.packageDossierSection}>
                <PackageNoteField pkg={pkg} onChange={updatePackage}/>
              </section>
            </div>
            <aside className={s.packageDossierAside}>
              <section className={s.packageDossierSection}>
                <h3>Penanggung jawab</h3>
                <PackagePic pkg={pkg} onChange={updatePackage}/>
              </section>
              <section className={s.packageDossierSection}>
                <h3>Dokumen pendukung</h3>
                <PackageEvidenceFields pkg={pkg} onChange={updatePackage}/>
              </section>
            </aside>
          </div>
          {canDelete&&updatePackage&&<div className={s.packageDossierActions}><span className={s.quiet}>Perubahan akan tersimpan bersama data provinsi.</span><button type="button" className={s.dangerIconButton} title="Nonaktifkan paket" aria-label={`Nonaktifkan paket ${pkg.name||'baru'}`}
            onClick={()=>{setArchiveId(pkg.id);setArchiveReason('')}}><Trash size={16}/></button></div>}
        </div>}
        {!pkg.active&&<>
          {pkg.inactiveReason&&<small className={s.packageReason}>Alasan penonaktifan: {pkg.inactiveReason}</small>}
          <p className={s.packageTimestamps}>Diinput {timeLabel(pkg.createdAt)} · Nama diubah {timeLabel(pkg.nameUpdatedAt)} · Progres diubah {timeLabel(pkg.statusUpdatedAt)}</p>
          {updatePackage&&<div className={s.packageDossierActions}>{canDelete&&<button type="button" className={s.dangerIconButton} title="Hapus paket nonaktif" aria-label={`Hapus paket nonaktif ${pkg.name||''}`} onClick={()=>{setArchiveId(pkg.id);setArchiveReason('')}}><Trash size={16}/></button>}<button type="button" className={s.button} onClick={()=>updatePackage(item=>{item.active=true;item.inactiveReason=''})}>Aktifkan kembali</button></div>}
        </>}
      </div>
    </details>
  }
  return <>
    <p className={s.panelIntro}>Paket aktif dan progres integrasinya di {provinceName(province.id,province.name)}.</p>
    <fieldset disabled={!editable} className={s.formFields}>
      <div className={s.packageMetrics} aria-label="Ringkasan paket"><article><span>Paket aktif terkonfirmasi</span><strong>{totalPackages}</strong></article><article><span>Siap integrasi SIPD</span><strong>{integratedPackages}</strong><small>Termasuk paket yang sudah diterima SIPD</small></article></div>
      <div className={s.sectionHeader}><h3>Paket aktif</h3>{editable&&<button type="button" className={s.button} onClick={addPackage}><Plus size={16}/>Tambah paket</button>}</div>
      {activePackages.length?activePackages.map(renderPackage):<p className={s.emptyDetail}>Belum ada paket aktif. {editable&&'Pilih Tambah paket untuk mulai mengisi.'}</p>}
      {(editable||savingChanges)&&<div className={s.modalSave}>
        {changeMessage&&<p role={changeMessage.includes('tersimpan')?'status':'alert'} className={changeMessage.includes('tersimpan')?s.notice:s.error}>{changeMessage}</p>}
        <button className={s.primaryButton} type="button" disabled={savingChanges||savingNote||!canSave} onClick={()=>void saveChanges()}>{savingChanges?'Menyimpan...':'Simpan perubahan'}</button>
      </div>}
      {!!inactivePackages.length&&<>
        <div className={s.sectionHeader}><h3>Paket nonaktif</h3></div>
        {inactivePackages.map(renderPackage)}
      </>}
      {(editable||savingNote)&&<details className={s.noteComposer}>
        <summary className={s.modalDisclosureSummary}>Tambah catatan<CaretDown aria-hidden="true" size={16}/></summary>
        <div className={s.modalDisclosureBody}>
          <label>Analisis / kendala<textarea rows={3} maxLength={3000} value={analysis} onChange={e=>{setAnalysis(e.target.value);setNoteStatus('')}} placeholder="Tulis analisis atau kendala" disabled={savingNote}/></label>
          <label>Tindak lanjut<textarea rows={3} maxLength={3000} value={followUp} onChange={e=>{setFollowUp(e.target.value);setNoteStatus('')}} placeholder="Tulis tindak lanjut" disabled={savingNote}/></label>
          {noteError&&<p role="alert" className={s.error}>{noteError}</p>}{noteStatus&&<p role="status" className={s.notice}>{noteStatus}</p>}
          <div><button className={s.primaryButton} type="button" onClick={()=>void saveNote()} disabled={savingNote||(!analysis.trim()&&!followUp.trim())}>{savingNote?'Menyimpan...':'Simpan catatan'}</button></div>
        </div>
      </details>}
      <section className={s.noteHistory} aria-label="Riwayat catatan"><h3>Riwayat catatan</h3>
        <small>Catatan provinsi tidak disertakan dalam PDF.</small>
        {notesHistory.length?notesHistory.slice().reverse().map(entry=><article key={entry.id}><time>Dicatat {timeLabel(entry.createdAt)}</time>{entry.analysis&&<p><strong>Analisis / kendala</strong>{entry.analysis}</p>}{entry.followUp&&<p><strong>Tindak Lanjut</strong>{entry.followUp}</p>}</article>):province.notes||province.followUp?<article><time>Tanggal catatan lama tidak tersedia</time>{province.notes&&<p><strong>Analisis / kendala</strong>{province.notes}</p>}{province.followUp&&<p><strong>Tindak Lanjut</strong>{province.followUp}</p>}</article>:<p className={s.quiet}>Belum ada catatan tersimpan.</p>}
      </section>
    </fieldset>
    {archivePackage&&<ConfirmDialog title={!archivePackage.active&&archivePackage.createdAt?'Hapus paket nonaktif?':archivePackage.createdAt?'Nonaktifkan paket?':'Hapus paket baru?'}
      onClose={()=>setArchiveId('')}
      confirmLabel={!archivePackage.active&&archivePackage.createdAt?'Hapus permanen':archivePackage.createdAt?'Nonaktifkan paket':'Hapus paket'}
      confirmDisabled={!!archivePackage.createdAt&&archivePackage.active&&!archiveReason.trim()}
      onConfirm={()=>{
        onChange(p=>{
          const item=p.packages.find(pkg=>pkg.id===archivePackage.id)
          if(!item)return
          if(item.createdAt&&item.active){item.active=false;item.inactiveReason=archiveReason.trim()}
          else p.packages=p.packages.filter(pkg=>pkg.id!==item.id)
        })
        setArchiveId('')
      }}>
      {!archivePackage.active&&archivePackage.createdAt?<p>Paket nonaktif akan dihapus permanen dari laporan beserta riwayatnya. Tindakan ini tidak dapat dibatalkan.</p>:archivePackage.createdAt?<label>Alasan penonaktifan (wajib)<input value={archiveReason} maxLength={3000} onChange={event=>setArchiveReason(event.target.value)}/></label>:<p>Paket baru akan dihapus dari draft.</p>}
    </ConfirmDialog>}
    <p className={s.quiet}>Alur paket terkonfirmasi: PU → BPKAD → APIP. Jika dikembalikan untuk perbaikan, proses dimulai lagi dari PU.</p>
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
