'use client'

import {useCallback,useEffect,useRef,useState} from 'react'
import dynamic from 'next/dynamic'
import {ArrowClockwise,CaretDown,ChartLineUp,Check,Clock,DownloadSimple,Eye,FileXls,Gear,Minus,NotePencil,PencilSimple,Plus,SignOut,Table,Trash,UploadSimple,Warning,X} from '@phosphor-icons/react'
import {SuiteSurface,ThemePicker} from '@/app/tools/components/suite-theme'
import {ROLES,ROLE_LABELS,STEPS,STEP_LABELS,WORKFLOW_STATUS,accountLabel,dateLabel,newPackage,newProvince,provinceName,provinceSummary,setPackageName,sortProvinces,stepSummary,summarize,timeLabel,today,validateDocument,workflowStatusOf,type AccountRole,type ProvinceReport,type ReportPackage,type ReportDocument,type ReportSnapshot,type ReportHistoryPoint,type ReportChange,type Step,type WorkflowStatus} from '@/lib/report/model'
import {ReportDialog,ConfirmDialog,AccountPanel,ProvincePanel,PackagePanel,AccessPanel} from './report-details'
import s from './report.module.css'

const ReportChart=dynamic(()=>import('./report-chart'),{loading:()=> <p role="status" className={s.notice}>Menyiapkan grafik perkembangan...</p>})
type Payload={role:'admin'|'user';snapshot:ReportSnapshot|null;previous:ReportSnapshot|null;initial:ReportDocument|null;history:ReportHistoryPoint[];changes:ReportChange[];recapSavedForToday:boolean}
type Modal={type:'account';id:string;role:AccountRole}|{type:'province';id:string}|{type:'package';id:string;packageId:string}|{type:'workflow';id:string;step:Step}|{type:'access'}|{type:'addProvince'}|null
class ReportRequestError extends Error{constructor(message:string,public status:number){super(message)}}
function ReportLoader({checkingAccess}:{checkingAccess:boolean}){
  return <div className={s.reportLoader} role="status">
    <span className={s.srOnly}>{checkingAccess?'Memeriksa akses…':'Memuat laporan…'}</span>
    <div className={s.loaderTable} aria-hidden="true">
      <div className={s.loaderHead}><span/><span/><span/></div>
      {[0,1,2].map(row=><div className={s.loaderRow} key={row}><span/><span/><span/></div>)}
    </div>
  </div>
}
function stageTone({done,processing,complete}:ReturnType<typeof stepSummary>,step:Step){
  if(step==='perbaikan'&&processing)return 'stageRepair'
  if(complete)return 'stageDone'
  return processing||done?'stageProcess':'stageNone'
}
function recordWorkflow(pkg:ReportPackage,to:WorkflowStatus,kind:'advanced'|'repair',note=''){
  pkg.workflowHistory.push({id:crypto.randomUUID(),from:workflowStatusOf(pkg),to,kind,note,createdAt:null})
  pkg.workflowStatus=to
}
function WorkflowPanel({province,step,canTransition,canDelete,onAdvance,onReturn,onDelete}:{province:ProvinceReport;step:Step;canTransition:boolean;canDelete:boolean;onAdvance:(id:string)=>void;onReturn:(id:string,note:string)=>void;onDelete:(id:string)=>void}){
  const packages=province.packages.filter(pkg=>pkg.active)
  const [returnId,setReturnId]=useState(''),[repairNote,setRepairNote]=useState(''),[deleteId,setDeleteId]=useState('')
  return <>
    <p className={s.panelIntro}>Rincian {STEP_LABELS[step]} untuk {provinceName(province.id,province.name)}. Alur paket: PU → BPKAD → APIP → siap integrasi → diterima SIPD.</p>
    {!packages.length?<p className={s.emptyDetail}>Belum ada paket aktif. Tambahkan nama paket melalui kolom Nama paket.</p>:<div className={s.workflowList}>{packages.map(pkg=>{
      const status=workflowStatusOf(pkg)
      const repairEvents=pkg.workflowHistory.filter(event=>event.kind==='repair')
      const canReturnToPu=pkg.apip!=='selesai'&&(pkg.bpkad==='proses'||pkg.bpkad==='selesai'||pkg.apip==='proses')
      const canReset=status!=='pu'||pkg.workflowHistory.length>0||pkg.repairStatus!=='-'
      return <article className={s.workflowItem} key={pkg.id}>
        <strong>{pkg.name||'Tambahkan nama paket'}</strong>
        <small>{STEP_LABELS[step]}: {pkg[step]==='-'?'Belum dimulai':pkg[step]==='selesai'?'Selesai':'Proses'}</small>
        <span className={`${s.workflowStatus} ${status==='received'?s.complete:pkg.repairStatus==='proses'?s.warning:s.incomplete}`}>{WORKFLOW_STATUS[status]}</span>
        <small>Perbaikan: {pkg.repairStatus==='proses'?'Proses':pkg.repairStatus==='selesai'?'Selesai':'-'}</small>
        {(canTransition||canDelete)&&<div className={s.workflowActions}>
          {canTransition&&canReturnToPu&&<button type="button" className={s.textButton} onClick={()=>{setReturnId(pkg.id);setRepairNote('')}}>Kembalikan ke PU</button>}
          {canTransition&&status!=='received'&&<button type="button" className={s.button} onClick={()=>onAdvance(pkg.id)}>{status==='pu'?'PU selesai → BPKAD':status==='bpkad'?'BPKAD selesai → APIP':status==='apip'?'APIP selesai → Siap Integrasi':'Tandai diterima SIPD'}</button>}
          {canDelete&&canReset&&<button type="button" className={s.dangerIconButton} aria-label={`Hapus progres Tahap 4 ${pkg.name||'paket'}`} title="Hapus progres Tahap 4" onClick={()=>setDeleteId(pkg.id)}><Trash size={17}/></button>}
        </div>}
        {returnId===pkg.id&&<div className={s.repairComposer}><label>Catatan perbaikan (opsional)<textarea rows={2} maxLength={3000} value={repairNote} onChange={event=>setRepairNote(event.target.value)} placeholder="Catatan untuk proses perbaikan"/></label><div className={s.toolActions}><button type="button" className={s.button} onClick={()=>setReturnId('')}>Batal</button><button type="button" className={s.primaryButton} onClick={()=>{onReturn(pkg.id,repairNote);setReturnId('')}}>Kembalikan ke PU</button></div></div>}
        {step==='perbaikan'&&<section className={s.repairHistory}><h4>Riwayat perbaikan</h4>{repairEvents.length?repairEvents.slice().reverse().map(event=><article key={event.id}><strong>{event.from?WORKFLOW_STATUS[event.from]:'Status sebelumnya tidak tercatat'} → {WORKFLOW_STATUS[event.to]}</strong><time>{timeLabel(event.createdAt)}</time>{event.note&&<p>{event.note}</p>}</article>):<p className={s.quiet}>Belum ada riwayat perbaikan.</p>}</section>}
        <details className={s.workflowTimeline}><summary>Riwayat perpindahan status ({pkg.workflowHistory.length})</summary>{pkg.workflowHistory.length?<ol>{pkg.workflowHistory.slice().reverse().map(event=><li key={event.id}><strong>{event.from?WORKFLOW_STATUS[event.from]:'Paket dibuat'} → {WORKFLOW_STATUS[event.to]}</strong><time>{timeLabel(event.createdAt)}</time>{event.kind==='repair'&&event.note&&<p>Catatan perbaikan: {event.note}</p>}</li>)}</ol>:<p className={s.quiet}>Belum ada riwayat perpindahan status.</p>}</details>
        {canDelete&&deleteId===pkg.id&&<ConfirmDialog title="Hapus progres Tahap 4?" onClose={()=>setDeleteId('')} onConfirm={()=>{onDelete(pkg.id);setDeleteId('')}} confirmLabel="Hapus progres"><p>Status paket akan kembali ke penyusunan oleh PU. Riwayat perpindahan dan catatan perbaikan akan dihapus.</p></ConfirmDialog>}
      </article>
    })}</div>}
  </>
}
function PackageInputCard({pkg,index,editing,onUpdate,onRemove,onOpen}:{pkg:ReportPackage;index:number;editing:boolean;onUpdate:(update:(pkg:ReportPackage)=>void)=>void;onRemove:()=>void;onOpen:()=>void}){
  const [confirmDelete,setConfirmDelete]=useState(false),[reason,setReason]=useState('')
  const isUnsubmittedEmpty=!pkg.name.trim()&&!pkg.createdAt
  return <section className={`${s.packageEditItem} ${!pkg.active?s.packageInactive:''}`}>
    <div className={s.packageEditHeading}><div className={s.packageHeadingLine}><strong>Paket {index+1}{!pkg.active?' · Nonaktif':''}</strong>{editing&&(pkg.active||isUnsubmittedEmpty)&&<button type="button" className={s.dangerIconButton} aria-label={`Hapus paket ${pkg.name||index+1}`} title="Hapus paket" onClick={()=>{setConfirmDelete(true);setReason('')}}><Trash size={16}/></button>}</div>{pkg.nameUpdatedAt&&<small>Nama terakhir diubah {timeLabel(pkg.nameUpdatedAt)}</small>}</div>
    {editing?<label>Nama paket<input value={pkg.name} maxLength={240} onChange={event=>onUpdate(item=>{setPackageName(item,event.target.value)})}/></label>:<button type="button" className={s.packageNameButton} onClick={onOpen}>{pkg.name||'Tambahkan nama paket'}</button>}
    {!pkg.active&&pkg.inactiveReason&&<small>Alasan penonaktifan: {pkg.inactiveReason}</small>}
    {editing&&<><label className={s.checkLabel}><input type="checkbox" checked={pkg.active} onChange={event=>event.target.checked?onUpdate(item=>{item.active=true;item.inactiveReason='' }):(setConfirmDelete(true),setReason(''))}/>Paket aktif</label>{!pkg.active&&<label>Alasan penonaktifan<input value={pkg.inactiveReason} maxLength={3000} onChange={event=>onUpdate(item=>{item.inactiveReason=event.target.value})}/></label>}</>}
    <small>Ditambahkan pada {timeLabel(pkg.createdAt)}</small>
    {confirmDelete&&<ConfirmDialog title={isUnsubmittedEmpty?'Hapus paket baru?':'Nonaktifkan paket?'} onClose={()=>setConfirmDelete(false)} onConfirm={()=>{if(isUnsubmittedEmpty)onRemove();else onUpdate(item=>{item.active=false;item.inactiveReason=reason.trim()});setConfirmDelete(false)}} confirmLabel={isUnsubmittedEmpty?'Hapus paket':'Nonaktifkan paket'} confirmDisabled={!isUnsubmittedEmpty&&!reason.trim()}>
      {isUnsubmittedEmpty?<p>Paket kosong ini akan dihapus dari draft.</p>:<><p>Paket akan dipindahkan ke arsip. Riwayat paket tetap tersimpan.</p><label>Alasan penonaktifan (wajib)<input autoFocus value={reason} maxLength={3000} onChange={event=>setReason(event.target.value)} placeholder="Tuliskan alasan"/></label></>}
    </ConfirmDialog>}
  </section>
}
function PackageCell({province,editing,onUpdate,onRemove,onAdd,onOpen}:{province:ProvinceReport;editing:boolean;onUpdate:(id:string,update:(pkg:ReportPackage)=>void)=>void;onRemove:(id:string)=>void;onAdd:()=>void;onOpen:(id:string)=>void}){
  const state=provinceSummary(province)
  const inactive=province.packages.map((pkg,index)=>({pkg,index})).filter(({pkg})=>!pkg.active)
  const activeLabel=state.active.length===1?state.active[0].name||'Tambahkan nama paket':`${state.active.length} Paket`
  const packageCard=({pkg,index}:{pkg:ReportPackage;index:number})=><PackageInputCard key={pkg.id} pkg={pkg} index={index} editing={editing} onUpdate={update=>onUpdate(pkg.id,update)} onRemove={()=>onRemove(pkg.id)} onOpen={()=>onOpen(pkg.id)}/>
  return <td className={s.packageCell}>
    <details className={s.packageDisclosure}>
      <summary title={activeLabel}>{state.active.length===1?<><span className={s.packageName}>{activeLabel}</span><small>Ditambahkan pada {timeLabel(state.active[0].createdAt)}</small></>:<span className={s.packageCount}>{activeLabel}</span>}<CaretDown size={14}/></summary>
      <div className={s.packageExpansion}>{province.packages.map((pkg,index)=>pkg.active&&(pkg.name.trim()||editing)?packageCard({pkg,index}):null)}{editing&&<button className={s.textButton} type="button" onClick={onAdd}><Plus size={16}/>Tambah paket</button>}{inactive.length>0&&<details className={`${s.packageDisclosure} ${s.inactiveDisclosure}`}><summary title="Lihat paket yang dihapus atau nonaktif"><span className={s.packageCount}>{inactive.length} Paket dihapus/nonaktif</span><CaretDown size={14}/></summary><div className={s.packageExpansion}>{inactive.map(packageCard)}</div></details>}</div>
    </details>
  </td>
}
async function request<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(`/api/report${path}`,{...options,cache:'no-store',headers:{'Content-Type':'application/json',...options.headers}})
  const payload=await response.json()
  if(!response.ok)throw new ReportRequestError(payload.error||'Permintaan laporan gagal. Coba kembali.',response.status)
  return payload.data
}
function download(bytes:Uint8Array,name:string,type:string){
  const url=URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer],{type})),a=document.createElement('a')
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
type FilterStage='all'|'stage1'|'stage2'|'stage3'|'stage4'|'stage5'
type FilterStatus='all'|'ada'|'tc'|'none'|'selesai'|'proses'|'not-started'|'nd'
function matchesQuickFilter(p:ProvinceReport,stage:FilterStage,status:FilterStatus){
  if(status==='all')return true
  const accountStages:Record<Exclude<FilterStage,'all'|'stage4'|'stage5'>,AccountRole[]>={stage1:['sekda'],stage2:['kepalaDinas','kepalaBpkad','apip'],stage3:['penyusunHarga','penyusunAsb']}
  const matchesAccount=(roles:AccountRole[])=>roles.some(role=>({ada:p.accounts[role].status==='ada',tc:p.accounts[role].status==='tc',none:p.accounts[role].status==='tidak_ada'}[status as 'ada'|'tc'|'none']||false))
  const active=p.packages.filter(pkg=>pkg.active),workflow=active.map(workflowStatusOf)
  const matchesPackage=()=>status==='nd'?!active.length:status==='selesai'?workflow.includes('received'):status==='proses'?workflow.some(value=>['pu','bpkad','apip','ready','returned_pu','returned_bpkad'].includes(value)):status==='not-started'?active.some(pkg=>pkg.pu==='-'&&pkg.bpkad==='-'&&pkg.apip==='-'):false
  const matchesIntegration=()=>{
    const {totalPackages,integratedPackages}=provinceSummary(p)
    if(totalPackages===0)return status==='nd'
    if(status==='selesai')return integratedPackages===totalPackages
    if(status==='proses')return integratedPackages>0&&integratedPackages<totalPackages
    if(status==='not-started')return integratedPackages===0
    return false
  }
  if(stage==='stage4')return ['selesai','proses','not-started','nd'].includes(status)&&matchesPackage()
  if(stage==='stage5')return matchesIntegration()
  if(stage!=='all')return ['ada','tc','none'].includes(status)&&matchesAccount(accountStages[stage])
  if(['ada','tc','none'].includes(status)&&matchesAccount(ROLES as unknown as AccountRole[]))return true
  return matchesPackage()||matchesIntegration()
}
export default function ReportClient(){
  const [data,setData]=useState<Payload|null>(null),[role,setRole]=useState<'admin'|'user'|null>(null)
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pin,setPin]=useState('')
  const [draft,setDraft]=useState<ReportDocument|null>(null),[editing,setEditing]=useState(false),[order,setOrder]=useState<string[]>([]),[reason,setReason]=useState(''),[source,setSource]=useState<'manual'|'import'>('manual')
  const [modal,setModal]=useState<Modal>(null),[query,setQuery]=useState(''),[tab,setTab]=useState<'table'|'chart'|'history'>('table'),[filterStage,setFilterStage]=useState<FilterStage>('all'),[filterStatus,setFilterStatus]=useState<FilterStatus>('all')
  const [range,setRange]=useState({from:'2026-11-10',to:today()}),[preview,setPreview]=useState<{document:ReportDocument;changes:string[]}|null>(null)
  const [viewingRecap,setViewingRecap]=useState('')
  const [pending,setPending]=useState<{action:(latest?:ReportSnapshot)=>void;label:string}|null>(null)
  const [newProvinceLabel,setNewProvinceLabel]=useState(''),[addProvinceError,setAddProvinceError]=useState('')
  const fileInput=useRef<HTMLInputElement>(null),loadId=useRef(0)
  const maxDate=today(),date=data?.snapshot?.date||today(),document=draft||data?.snapshot?.document||data?.initial||null
  const labelProvince=(id:string)=>{const province=document?.provinces.find(row=>row.id===id);return provinceName(id,province?.name)}
  const baseline=data?.snapshot?.document||data?.initial
  const dirty=Boolean(draft&&baseline)&&JSON.stringify(draft)!==JSON.stringify(baseline)
  const applyPayload=useCallback((result:Payload)=>{
    const snapshot=result.snapshot?{...result.snapshot,document:validateDocument(result.snapshot.document)}:null,initial=result.initial?validateDocument(result.initial):null
    setRole(result.role);setData({...result,snapshot,initial});setDraft(null);setEditing(false);setReason('');setSource('manual')
    setOrder(snapshot?sortProvinces(snapshot.document.provinces).map(p=>p.id):initial?sortProvinces(initial.provinces).map(p=>p.id):[])
  },[])
  const applyError=useCallback((error:unknown)=>{
    if(error instanceof ReportRequestError&&error.status===401){setRole(null);setData(null);setDraft(null);setEditing(false)}
    setError(error instanceof Error?error.message:'Laporan belum dapat dimuat.')
  },[])
  const load=useCallback(async(from:string,to:string,snapshotDate?:string)=>{
    const id=++loadId.current;setLoading(true);setError('');setData(null);setDraft(null);setEditing(false);setOrder([])
    try{
      const query=new URLSearchParams({from,to});if(snapshotDate)query.set('snapshot',snapshotDate)
      const result=await request<Payload>(`?${query}`)
      if(id!==loadId.current)return
      applyPayload(result);setViewingRecap(snapshotDate||'')
    }catch(error){if(id!==loadId.current)return;applyError(error)}
    finally{if(id===loadId.current)setLoading(false)}
  },[applyPayload,applyError])
  useEffect(()=>{
    let active=true
    async function initialize(){
      try{
        const result=await request<Payload>(`?from=2026-11-10&to=${today()}`)
        if(active)applyPayload(result)
      }catch(error){if(active)applyError(error)}
      finally{if(active)setLoading(false)}
    }
    void initialize()
    return()=>{active=false}
  },[applyPayload,applyError])
  useEffect(()=>{if(!dirty)return;const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault()};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent)},[dirty])
  const summary=document?summarize(document):null
  const previousSummary=data?.previous?.document?summarize(validateDocument(data.previous.document)):data?.history.filter(point=>point.date<(viewingRecap||data.snapshot?.date||today())).at(-1)?.summary.all||null
  function updateProvince(id:string,update:(province:ProvinceReport)=>void){
    setDraft(current=>{if(!current)return current;const next=structuredClone(current),province=next.provinces.find(p=>p.id===id);if(province)update(province);return next});setNotice('')
  }
  function toggleAccount(provinceId:string,accountRole:AccountRole){
    updateProvince(provinceId,province=>{const account=province.accounts[accountRole],next=account.status==='ada'?'tc':'ada';account.status=next;if(next==='tc'){account.count=null;account.details=[]}else if(account.count===0)account.count=null})
  }
  function updateWorkflowPackage(provinceId:string,packageId:string,change:(pkg:ReportPackage)=>void){
    if(viewingRecap||busy)return
    const base=draft||data?.snapshot?.document||data?.initial
    if(!base)return
    const next=validateDocument(base),province=next.provinces.find(item=>item.id===provinceId),pkg=province?.packages.find(item=>item.id===packageId)
    if(!pkg)return
    change(pkg)
    if(editing){setDraft(next);setNotice('Perubahan status menunggu Submit perubahan.');return}
    void save(false,next)
  }
  function advancePackage(provinceId:string,packageId:string){
    updateWorkflowPackage(provinceId,packageId,pkg=>{const current=workflowStatusOf(pkg)
      if(current==='pu'){pkg.pu='selesai';pkg.bpkad='proses';if(pkg.repairStatus==='proses'){pkg.repairStatus='selesai';pkg.perbaikan='selesai'};recordWorkflow(pkg,'bpkad','advanced');return}
      if(current==='bpkad'){pkg.bpkad='selesai';pkg.apip='proses';recordWorkflow(pkg,'apip','advanced');return}
      if(current==='apip'){pkg.apip='selesai';recordWorkflow(pkg,'ready','advanced');return}
      if(current==='ready'){recordWorkflow(pkg,'received','advanced')}
    })
  }
  function returnPackage(provinceId:string,packageId:string,note:string){
    updateWorkflowPackage(provinceId,packageId,pkg=>{if(!(pkg.bpkad==='proses'||pkg.bpkad==='selesai'||pkg.apip==='proses'))return;recordWorkflow(pkg,'pu','repair',note.trim());pkg.returnTarget='pu';pkg.pu='proses';pkg.bpkad='-';pkg.apip='-';pkg.repairStatus='proses';pkg.perbaikan='proses'})
  }
  function resetWorkflow(provinceId:string,packageId:string){
    updateWorkflowPackage(provinceId,packageId,pkg=>{pkg.workflowStatus='pu';pkg.pu=pkg.name.trim()?'proses':'-';pkg.bpkad='-';pkg.apip='-';pkg.perbaikan='-';pkg.repairStatus='-';pkg.returnTarget=null;pkg.workflowHistory=[]})
  }
  function removeDraftPackage(provinceId:string,packageId:string){
    updateProvince(provinceId,province=>{province.packages=province.packages.filter(pkg=>pkg.id!==packageId)})
  }
  function clearProvinceData(provinceId:string){
    updateProvince(provinceId,province=>{province.totalPackages=null;province.integratedPackages=null;province.notes='';province.followUp='';province.notesHistory=[];for(const accountRole of ROLES){const account=province.accounts[accountRole];account.status='tc';account.count=null;account.details=[];account.note=''}for(const pkg of province.packages){if(pkg.active){pkg.active=false;pkg.inactiveReason='Data provinsi dihapus oleh pengguna'}}})
    setNotice(`${labelProvince(provinceId)} dikosongkan di draft. Paket dipindahkan ke arsip nonaktif agar riwayat tetap ada.`)
  }
  function applySavedSnapshot(saved:ReportSnapshot,source:'manual'|'import'|'recap',changed:string[],reason:string,recapSaved=false){
    const document=validateDocument(saved.document),snapshot={...saved,document}
    const historyPoint:ReportHistoryPoint={date:saved.date,summary:{all:summarize(document),provinces:document.provinces.map(p=>{const summary=provinceSummary(p);return {id:p.id,total:summary.totalPackages,integrated:summary.integratedPackages,percent:summary.percent,accounts:ROLES.filter(accountRole=>p.accounts[accountRole].status==='ada').length}})}}
    const change:ReportChange={id:-saved.revision,report_date:saved.date,revision:saved.revision,created_at:saved.updated_at,actor_role:role||'user',source,reason,changed_provinces:changed}
    setData(current=>current?{...current,snapshot,initial:null,history:[...current.history.filter(point=>point.date!==saved.date),historyPoint].sort((a,b)=>a.date.localeCompare(b.date)),changes:[change,...(current.snapshot?.date===saved.date?current.changes:[])].slice(0,50),recapSavedForToday:recapSaved||current.recapSavedForToday}:current)
    setDraft(null);setEditing(false);setOrder(sortProvinces(document.provinces).map(p=>p.id))
  }
  async function save(propagateError=false,documentOverride?:ReportDocument):Promise<ReportSnapshot|null>{
    const documentToSave=documentOverride||draft
    if(!documentToSave)return null
    if(data?.snapshot&&!dirty&&!documentOverride)return data.snapshot
    const emptyPackage=documentToSave.provinces.flatMap(province=>province.packages.map(pkg=>({province,pkg}))).find(({pkg})=>!pkg.name.trim())
    if(emptyPackage){setError(`${provinceName(emptyPackage.province.id,emptyPackage.province.name)}: nama paket wajib diisi. Lengkapi atau hapus kartu paket kosong sebelum submit.`);return null}
    setBusy('save');setError('');setNotice('')
    try{
      validateDocument(documentToSave)
      const before=data?.snapshot?.document||data?.initial
      const changed=documentToSave.provinces.filter(p=>JSON.stringify(p)!==JSON.stringify(before?.provinces.find(row=>row.id===p.id))).map(p=>p.id)
      const saved=await request<ReportSnapshot>('',{method:'POST',body:JSON.stringify({date,revision:data?.snapshot?.revision||0,document:documentToSave,source,reason})})
      applySavedSnapshot(saved,source,changed,reason);setNotice(`Perubahan ${dateLabel(saved.date)} berhasil disimpan · Revisi ${saved.revision}.`);return saved
    }catch(error){const message=error instanceof Error?error.message:'Perubahan belum tersimpan. Draft tetap tersedia.';setError(message);if(propagateError)throw new Error(message);return null}finally{setBusy('')}
  }
  async function saveProvinceNotes(provinceId:string,analysis:string,followUp:string):Promise<void>{
    const current=draft||data?.snapshot?.document
    if(!current)throw new Error('Buka mode edit sebelum menyimpan catatan.')
    const next=validateDocument(current),province=next.provinces.find(row=>row.id===provinceId)
    if(!province)throw new Error('Provinsi tidak ditemukan pada laporan ini.')
    if(province.notesHistory.length>=200)throw new Error('Riwayat catatan provinsi ini sudah mencapai batas 200 entri.')
    province.notes=analysis;province.followUp=followUp
    province.notesHistory.push({id:crypto.randomUUID(),analysis,followUp,createdAt:null})
    setBusy('note');setError('');setNotice('')
    try{
      const saved=await request<ReportSnapshot>('',{method:'POST',body:JSON.stringify({date,revision:data?.snapshot?.revision||0,document:next,source,reason})})
      applySavedSnapshot(saved,source,[provinceId],reason);setNotice(`Catatan ${labelProvince(provinceId)} tersimpan dalam riwayat. Revisi ${saved.revision}.`)
    }finally{setBusy('')}
  }
  function guard(label:string,action:(latest?:ReportSnapshot)=>void){if(dirty)setPending({label,action});else action()}
  async function resolvePending(keep:boolean){
    if(!pending)return
    const action=pending.action
    if(keep){const saved=await save();if(!saved)return;setPending(null);action(saved)}
    else{setDraft(null);setEditing(false);setPending(null);action()}
  }
  function ensureDraft(){const base=draft||data?.snapshot?.document||data?.initial;if(!base)return null;if(!draft){const next=validateDocument(base);setDraft(next);setOrder(sortProvinces(next.provinces).map(p=>p.id))}return base}
  function beginEdit(){if(viewingRecap)return;const base=data?.snapshot?.document||data?.initial;if(!base)return;if(!draft)setDraft(validateDocument(base));setEditing(true);setError('');setNotice('')}
  function cancelEdit(){guard('membatalkan mode edit',()=>{setDraft(null);setEditing(false);setError('');setNotice('')})}
  function openProvince(id:string){
    ensureDraft();setError('');setNotice('')
    setModal({type:'province',id})
  }
  function openAccount(id:string,accountRole:AccountRole){
    ensureDraft();setError('');setNotice('')
    setModal({type:'account',id,role:accountRole})
  }
  function openWorkflow(id:string,step:Step){
    ensureDraft();setError('');setNotice('')
    setModal({type:'workflow',id,step})
  }
  function openPackage(id:string,packageId:string){
    ensureDraft();setError('');setNotice('')
    setModal({type:'package',id,packageId})
  }
  async function saveModalChanges(){
    if(!draft)throw new Error('Tidak ada perubahan untuk disimpan.')
    await save(true)
  }
  function addProvince(name:string){
    const label=name.trim(),base=`tambahan-${label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`
    if(!label)throw new Error('Isi nama provinsi terlebih dahulu.')
    if(!document)throw new Error('Buat laporan sebelum menambah provinsi.')
    const id=base==='tambahan-'?`tambahan-${crypto.randomUUID()}`:base
    if(document.provinces.some(p=>p.id===id||provinceName(p.id,p.name).toLocaleLowerCase('id-ID')===label.toLocaleLowerCase('id-ID')))throw new Error('Provinsi tersebut sudah ada di laporan.')
    const row=newProvince(label,id)
    setDraft(current=>current?{...current,provinces:[...current.provinces,row]}:current)
    setOrder(current=>[...current,id]);setModal(null);setError('');setNotice(`${label} ditambahkan ke draft. Pilih Submit perubahan untuk mencatatnya.`)
  }
  async function saveRecap(latest?:ReportSnapshot){
    const snapshot=latest||data?.snapshot,documentToSave=snapshot?.document||data?.initial
    if(!documentToSave){setError('Tidak ada data untuk direkap.');return}
    const recapDate=today()
    setBusy('recap');setError('');setNotice('')
    try{const saved=await request<ReportSnapshot>('',{method:'POST',body:JSON.stringify({date:recapDate,revision:snapshot?.date===recapDate?snapshot.revision:0,document:documentToSave,source:'recap',reason:'Rekap harian'})});applySavedSnapshot(saved,'recap',[], 'Rekap harian',true);setNotice(`Rekap ${dateLabel(saved.date)} berhasil disimpan · Revisi ${saved.revision}.`)}catch(error){setError(error instanceof Error?error.message:'Rekap belum dapat disimpan.')}finally{setBusy('')}
  }
  async function exportPdf(latest?:ReportSnapshot){
    const snapshot=latest||data?.snapshot
    if(!snapshot){setError('Simpan laporan sebelum mengunduh PDF.');return}
    setBusy('pdf');setError('')
    try{const {createReportPdf}=await import('@/lib/report/pdf');createReportPdf(snapshot).save(`Laporan-ASB-${snapshot.date}.pdf`)}catch(error){setError(error instanceof Error?error.message:'PDF belum dapat dibuat.')}finally{setBusy('')}
  }
  async function template(latest?:ReportSnapshot){
    const snapshot=latest||data?.snapshot,templateDocument=snapshot?.document||data?.initial
    if(!templateDocument){setError('Data laporan belum tersedia untuk membuat template.');return}
    setBusy('excel');setError('')
    try{const {createReportWorkbook}=await import('@/lib/report/excel');download(createReportWorkbook(templateDocument,snapshot?.date||today()),`Template-ASB-${snapshot?.date||today()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}catch(error){setError(error instanceof Error?error.message:'Template belum dapat dibuat.')}finally{setBusy('')}
  }
  async function importExcel(file:File){
    const base=draft||data?.snapshot?.document||data?.initial
    if(!base)return
    setBusy('import');setError('')
    try{
      if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>8*1024*1024)throw new Error('Pilih file .xlsx berukuran maksimal 8 MB.')
      const {readReportWorkbook}=await import('@/lib/report/excel')
      setPreview(await readReportWorkbook(new Uint8Array(await file.arrayBuffer()),base,date))
    }catch(error){setError(error instanceof Error?error.message:'Excel belum dapat diimpor.')}finally{setBusy('');if(fileInput.current)fileInput.current.value=''}
  }
  async function logout(){setBusy('logout');try{await request('/auth',{method:'DELETE'});setRole(null);setData(null);setDraft(null);setEditing(false);setModal(null);setNotice('');setError('')}catch(error){setError(error instanceof Error?error.message:'Belum dapat keluar.')}finally{setBusy('')}}
  const selectedProvince=modal&&'id'in modal?document?.provinces.find(p=>p.id===modal.id):null
  const selectedPackage=modal?.type==='package'?selectedProvince?.packages.find(pkg=>pkg.id===modal.packageId):null
  const rows=document?order.map(id=>document.provinces.find(p=>p.id===id)!).filter(p=>p&&provinceName(p.id,p.name).toLowerCase().includes(query.toLowerCase())&&matchesQuickFilter(p,filterStage,filterStatus)):[]
  const canEditModal=Boolean(modal&&modal.type!=='access'&&modal.type!=='addProvince')&&!busy&&!viewingRecap
  const overallSummary=document?summarize(document):null
  const filterStatusOptions: [FilterStatus,string][]=filterStage==='stage1'||filterStage==='stage2'||filterStage==='stage3'?[['all','Semua status'],['ada','Ada'],['tc','T/C'],['none','Tidak ada']]:filterStage==='stage4'?[['all','Semua status'],['selesai','Selesai'],['proses','Proses'],['not-started','- / Belum dimulai'],['nd','N/D']]:filterStage==='stage5'?[['all','Semua status'],['selesai','Selesai'],['proses','Proses'],['not-started','- / Belum dimulai'],['nd','N/D']]:[['all','Semua status'],['ada','Ada'],['tc','T/C'],['none','Tidak ada'],['selesai','Selesai'],['proses','Proses'],['not-started','- / Belum dimulai'],['nd','N/D']]
  return <SuiteSurface className={s.page}>
    <a className={s.skip} href="#report-content">Lewati ke laporan</a>
    <div className={`${s.frame} ${loading||!role?s.loginFrame:''}`}>
      <main id="report-content">
        <h1 className={s.srOnly}>Laporan ASB Provinsi</h1>
        {loading?<ReportLoader checkingAccess={!role}/>:!role?<section className={s.login} aria-labelledby="report-login-title"><div className={s.loginMark}><Table size={28} weight="duotone"/></div><h2 id="report-login-title">Buka Laporan</h2><p>Masukkan PIN admin atau penginput untuk melihat laporan.</p><form onSubmit={async event=>{event.preventDefault();setBusy('login');setError('');try{const result=await request<{role:'admin'|'user'}>('/auth',{method:'POST',body:JSON.stringify({pin})});setRole(result.role);setPin('');await load(range.from,range.to)}catch(error){setError(error instanceof Error?error.message:'Akses belum dapat dibuka.')}finally{setBusy('')}}}><label htmlFor="report-pin">PIN</label><input id="report-pin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="current-password" value={pin} onChange={e=>setPin(e.target.value)} required aria-describedby="report-login-error"/>{error&&<p id="report-login-error" role="alert" className={s.error}>{error}</p>}<button className={s.primaryButton} disabled={Boolean(busy)} type="submit">{busy==='login'?'Memeriksa...':'Buka Laporan'}</button></form><p className={s.quiet}>Belum punya PIN? Hubungi admin laporan.</p></section>:<>
          <div className={s.reportToolbar}><div className={s.latestLabel}><span>{viewingRecap?'Rekap tersimpan':'Laporan terbaru'}</span><strong>{data?.snapshot?dateLabel(data.snapshot.date):'Data sumber · belum ada rekapitulasi tersimpan'}</strong><small>Terakhir diperbarui {data?.snapshot?timeLabel(data.snapshot.updated_at):'Belum ada pembaruan'}</small></div><div className={s.toolActions} role="group" aria-label="Aksi laporan">{viewingRecap?<button type="button" className={s.button} onClick={()=>void load(range.from,range.to)} disabled={Boolean(busy)||loading}><ArrowClockwise size={17}/>Kembali ke terbaru</button>:!data?.recapSavedForToday&&<button type="button" className={s.primaryButton} onClick={()=>guard('simpan rekap',latest=>void saveRecap(latest))} disabled={Boolean(busy)||loading}><Check size={18}/>Simpan rekap</button>}<button type="button" className={s.iconButton} aria-label="Unduh template Excel" title="Unduh template Excel" disabled={!document||Boolean(busy)||loading} onClick={()=>guard('unduh template',latest=>void template(latest))}><FileXls size={19}/></button><button type="button" className={s.iconButton} aria-label="Impor Excel" title="Impor Excel" disabled={!document||Boolean(busy)||loading||Boolean(viewingRecap)} onClick={()=>guard('impor Excel',()=>fileInput.current?.click())}><UploadSimple size={19}/></button><button type="button" className={s.iconButton} aria-label={busy==='pdf'?'Membuat PDF':'Unduh PDF'} title={busy==='pdf'?'Membuat PDF':'Unduh PDF'} disabled={!data?.snapshot||Boolean(busy)||loading} onClick={()=>guard('unduh PDF',latest=>void exportPdf(latest))}><DownloadSimple size={19}/></button><ThemePicker/>{role==='admin'&&<button type="button" className={s.iconButton} aria-label="Pengaturan PIN laporan" title="Pengaturan PIN" onClick={()=>setModal({type:'access'})} disabled={Boolean(busy)}><Gear size={19}/></button>}{role&&<button type="button" className={s.iconButton} aria-label="Keluar dari laporan" title="Keluar" onClick={()=>guard('keluar',()=>void logout())} disabled={Boolean(busy)}><SignOut size={18}/></button>}</div><input ref={fileInput} type="file" accept=".xlsx" className={s.hidden} aria-label="Pilih file Excel laporan" onChange={e=>{const file=e.target.files?.[0];if(file)void importExcel(file)}}/></div>
          {!viewingRecap&&data?.recapSavedForToday&&<p className={s.notice} role="status">Rekap hari ini sudah tersimpan. Lihat perkembangannya di tab Perkembangan</p>}
          {viewingRecap&&<p className={s.notice} role="status">Sedang melihat rekap {dateLabel(viewingRecap)} dalam mode baca.</p>}
          {error&&<div className={s.error} role="alert">{error} <button type="button" className={s.iconButton} aria-label="Muat ulang laporan" title="Muat ulang" disabled={Boolean(busy)} onClick={()=>guard('muat ulang',()=>void load(range.from,range.to))}><ArrowClockwise size={17}/></button></div>}
          {notice&&<p role="status" className={s.notice}>{notice}</p>}
          {data&&<>
            <div className={s.tabs} aria-label="Bagian laporan"><button type="button" aria-pressed={tab==='table'} onClick={()=>setTab('table')}><Table size={17}/>Tabel Progres</button><button type="button" aria-pressed={tab==='chart'} onClick={()=>guard('lihat perkembangan',()=>setTab('chart'))}><ChartLineUp size={17}/>Perkembangan</button>{role==='admin'&&<button type="button" aria-pressed={tab==='history'} onClick={()=>guard('lihat riwayat',()=>setTab('history'))}>Riwayat</button>}</div>
            {tab==='table'&&overallSummary&&<details className={s.reportSummary}><summary><span>Ringkasan akun dan ASB</span><CaretDown size={16}/></summary><div className={s.reportSummaryGrid}>{ROLES.map((accountRole,index)=>{const change=previousSummary?overallSummary.roles[index]-previousSummary.roles[index]:null;return <article className={s.reportSummaryCard} key={accountRole}><span>{ROLE_LABELS[accountRole]}</span><strong>{overallSummary.roles[index]}{change!==null&&<small className={s.reportSummaryDelta}>({change>0?'+':''}{change})</small>}</strong><small>Provinsi dengan akun</small></article>})}<article className={s.reportSummaryCard}><span>Total ASB</span><strong>{overallSummary.totalPackages}{previousSummary&&<small className={s.reportSummaryDelta}>({overallSummary.totalPackages-previousSummary.totalPackages>0?'+':''}{overallSummary.totalPackages-previousSummary.totalPackages})</small>}</strong><small>Paket aktif bernama</small></article><article className={s.reportSummaryCard}><span>Paket integrasi SIPD</span><strong>{overallSummary.integratedPackages}{previousSummary&&<small className={s.reportSummaryDelta}>({overallSummary.integratedPackages-previousSummary.integratedPackages>0?'+':''}{overallSummary.integratedPackages-previousSummary.integratedPackages})</small>}</strong><small>Siap integrasi atau diterima SIPD</small></article></div></details>}
            {tab==='table'&&<>
              {!document?<section className={s.empty}><h2>Data rekap belum tersedia</h2><p>Muat ulang setelah rekap awal disiapkan.</p></section>:<>
                <div className={s.tableBar}><h2 className={s.srOnly}>Progress provinsi</h2><div className={s.tableControls}><label className={s.searchLabel}>Cari provinsi<input type="search" placeholder="Ketik nama provinsi" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className={s.quickFilters}><label>Tahap<select aria-label="Filter tahap" value={filterStage} onChange={e=>{setFilterStage(e.target.value as FilterStage);setFilterStatus('all')}}><option value="all">Semua Tahapan</option><option value="stage1">Tahap 1 · Sekda</option><option value="stage2">Tahap 2 · Pimpinan/APIP</option><option value="stage3">Tahap 3 · Penyusun</option><option value="stage4">Tahap 4 · Paket</option><option value="stage5">Tahap 5 · Integrasi</option></select></label><label>Status<select aria-label="Filter status" value={filterStatus} onChange={e=>setFilterStatus(e.target.value as FilterStatus)}>{filterStatusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><div className={s.editControl}><span>{viewingRecap?'Mode lihat':'Mode Edit'}</span><button type="button" className={editing?s.cancelButton:s.iconButton} aria-label={editing?'Submit perubahan':'Edit tabel'} title={viewingRecap?'Rekap tersimpan hanya untuk dilihat':editing?'Submit perubahan':'Edit tabel'} disabled={Boolean(busy)||Boolean(viewingRecap)||(editing&&!dirty)} onClick={()=>editing?void save():beginEdit()}>{editing?<><Check size={16}/>Submit</>:<PencilSimple size={19}/>}</button>{editing&&<button type="button" className={s.cancelButton} onClick={cancelEdit} disabled={Boolean(busy)}><X size={16}/>Batal</button>}</div></div></div>
                <div className={s.statusLegend} aria-label="Legenda status"><span className={s.legendDone}><Check size={15}/>Ada / Selesai</span><span className={s.legendProcess}><Clock size={15}/>Proses akun</span><span className={s.legendStageProcess}><Clock size={15}/>Proses Tahap 4</span><span className={s.legendRepair}><Warning size={15}/>Perbaikan</span><span className={s.legendWarning}><Warning size={15}/>T/C · data perlu dilengkapi</span><span className={s.legendUnknown}><Minus size={15}/>N/D · belum ada data</span></div>
                <div className={s.tableScroll} role="region" aria-label="Tabel progres ASB. Geser ke samping untuk melihat tahapan lainnya." tabIndex={0}><fieldset className={s.tableFieldset} disabled={Boolean(busy)}><table className={s.reportTable}><caption className={s.srOnly}>Tabel progres ASB. Geser ke samping untuk melihat tahapan lainnya. Urutan provinsi mengikuti jumlah proses yang selesai, posisi akun, lalu tanggal mulai progres.</caption>
                  <thead>
                    <tr>
                      <th rowSpan={2} className={s.numberHead}>No</th>
                      <th rowSpan={2} className={s.provinceHead}><div className={s.provinceHeadContent}><span>Provinsi</span>{editing&&<button type="button" className={s.addProvinceButton} aria-label="Tambah provinsi" title="Tambah provinsi" disabled={Boolean(busy)} onClick={()=>{setNewProvinceLabel('');setAddProvinceError('');setModal({type:'addProvince'})}}><Plus size={17}/></button>}</div></th>
                      <th rowSpan={4}>Nama Paket</th>
                      <th colSpan={1} className={s.stageOne}><span>Tahap 1</span>Akun Sekda</th><th colSpan={3} className={s.stageTwo}><span>Tahap 2</span>Pimpinan &amp; APIP</th><th colSpan={2} className={s.stageThree}><span>Tahap 3</span>Penyusun</th><th colSpan={4} className={s.stageFour}><span>Tahap 4</span>Proses ASB</th><th colSpan={2} className={s.stageFive}><span>Tahap 5</span>Integrasi SIPD</th><th colSpan={3}>Ringkasan</th></tr><tr><th>Status Akun</th><th>Kepala Dinas</th><th>Kepala BPKAD</th><th>APIP</th><th>Harga</th><th>ASB</th><th>PU</th><th>BPKAD</th><th>APIP</th><th>Perbaikan</th><th>Total paket</th><th>Siap integrasi</th><th>% integrasi</th><th>Progres keseluruhan</th><th>Posisi akun</th></tr></thead>
                  <tbody>{rows.map((p,index)=>{
                    const state=provinceSummary(p),hasNotes=Boolean(p.notes||p.followUp||p.notesHistory?.length)
                    return <tr key={p.id}><td className={s.numberCell}>{index+1}</td><th scope="row" className={s.provinceCell}><button type="button" title={hasNotes?"Ada catatan tersimpan":"Buka detail provinsi"} aria-label={`${provinceName(p.id)}${hasNotes?" memiliki catatan.":"."} Buka detail provinsi`} onClick={()=>openProvince(p.id)}>{provinceName(p.id,p.name)}{hasNotes&&<NotePencil size={14}/>}{editing&&<PencilSimple size={13}/>}</button></th><PackageCell province={p} editing={editing} onUpdate={(packageId,update)=>updateProvince(p.id,province=>{const pkg=province.packages.find(item=>item.id===packageId);if(pkg)update(pkg)})} onRemove={packageId=>removeDraftPackage(p.id,packageId)} onOpen={packageId=>openPackage(p.id,packageId)} onAdd={()=>updateProvince(p.id,province=>{province.packages.push(newPackage(''))})}/>
                      {ROLES.map(accountRole=>{const a=p.accounts[accountRole],description=`${ROLE_LABELS[accountRole]}: ${accountLabel(a)}. Jumlah ${a.count??'belum diketahui'}. ${a.details.map(d=>d.label).slice(0,4).join(', ')}`;return <td key={accountRole} className={a.status==='ada'?s.complete:a.status==='tc'?s.warning:s.unknown}><div className={s.accountCell}>{editing?<button type="button" className={s.cellButton} title={a.status==='ada'?'Ubah menjadi T/C':'Ubah menjadi Ada'} aria-label={`Ubah status ${ROLE_LABELS[accountRole]} ${provinceName(p.id,p.name)} dari ${accountLabel(a)}`} onClick={()=>toggleAccount(p.id,accountRole)}><span className={s.statusText}>{a.status==='ada'?<Check size={14}/>:a.status==='tc'?<Warning size={14}/>:<Minus size={14}/>}{accountLabel(a)}</span></button>:<button type="button" className={s.cellButton} title={description} aria-label={`${description} Buka rincian`} onClick={()=>openAccount(p.id,accountRole)}><span className={s.statusText}>{a.status==='ada'?<Check size={14}/>:a.status==='tc'?<Warning size={14}/>:<Minus size={14}/>}{accountLabel(a)}</span></button>}<span className={s.hoverInfo} role="tooltip">{description}</span></div></td>})}
                      {STEPS.map(step=>{
                        const stage=stepSummary(p,step)
                        return <td key={step} className={`${s.stageCell} ${s[stageTone(stage,step)]}`}><button type="button" className={s.stageCellButton} aria-label={`Lihat progres ${STEP_LABELS[step]} ${provinceName(p.id,p.name)}: ${stage.label==='—'?'Belum ada status':stage.label}`} title={`Lihat progres ${STEP_LABELS[step]} per paket`} onClick={()=>openWorkflow(p.id,step)}><span>{stage.label}</span><Eye size={14}/></button></td>
                      })}
                      <td><button className={s.cellButton} aria-label={`Lihat ${state.totalPackages} paket aktif ${provinceName(p.id,p.name)}`} onClick={()=>openProvince(p.id)}>{state.totalPackages}</button></td>
                      <td><button className={s.cellButton} aria-label={`Lihat ${state.integratedPackages} paket siap integrasi ${provinceName(p.id,p.name)}`} onClick={()=>openProvince(p.id)}>{state.integratedPackages}</button></td>
                      <td><div className={s.progressCell}>{state.percent===null?<span className={s.progressUnknown}><Minus size={14}/>N/D</span>:<><div className={s.progressTrack} role="progressbar" aria-label={`Integrasi ${provinceName(p.id,p.name)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent}><span className={s.progressFill} style={{width:`${Math.min(state.percent,100)}%`}}/></div><span className={s.statusText}>{state.percent.toLocaleString('id-ID')}%</span></>}</div></td>
                      <td className={s.unknown} title="Rumus progres keseluruhan belum ditetapkan"><div className={s.progressCell}><div className={s.progressTrack} aria-hidden="true"/><span className={s.progressUnknown}><Minus size={14}/>N/D</span></div></td>
                      <td className={s.positionCell}>{state.accountStage?<span className={`${s.position} ${state.accountStage===1?s.positionStageOne:state.accountStage===2?s.positionStageTwo:s.positionStageThree}`}>Tahap {state.accountStage}</span>:<span className={`${s.position} ${s.positionWarning}`}><Warning size={13}/>T/C</span>}</td>
                    </tr>
                  })}</tbody><tfoot><tr><th colSpan={3}>Provinsi dengan akun tercatat</th>{summary?.roles.map((count,index)=><td key={index}>{count}</td>)}<td colSpan={4}>Status tahap 4</td><td>{summary?.totalPackages??'N/D'}</td><td>{summary?.integratedPackages??'N/D'}</td><td>{summary?.integrationPercent===null?'-':`${summary?.integrationPercent}%`}</td><td colSpan={2}>Data rekap tersimpan</td></tr></tfoot>
                </table></fieldset>{rows.length===0&&<p className={s.emptyDetail}>Provinsi tidak ditemukan. Periksa kata kunci atau filter.</p>}</div>
                <p className={s.quiet}>Jumlah paket dihitung dari paket aktif. Posisi akun menunjukkan tahap tertinggi yang memiliki akun.</p>
                {document.source&&<p className={s.source}>Sumber awal: {document.source.label}</p>}
              </>}
            </>}
            {tab==='chart'&&<ReportChart history={data.history} provinces={document?.provinces||[]} from={range.from} to={range.to} maxDate={maxDate} onRange={(from,to)=>{setRange({from,to});void load(from,to)}} onOpenRecap={snapshotDate=>{setTab('table');void load(range.from,range.to,snapshotDate)}}/>}
            {tab==='history'&&role==='admin'&&<section className={s.history}><h2>Riwayat revisi · {dateLabel(date)}</h2>{data.changes.length?data.changes.map(change=><article key={change.id}><strong>Revisi {change.revision}</strong><p>{timeLabel(change.created_at)} | {change.actor_role==='admin'?'Admin':'Penginput'} | {change.source==='import'?'Impor Excel':change.source==='recap'?'Simpan rekap':change.source==='seed'?'Data sumber awal':'Edit tabel'}</p><p>{change.reason||'Laporan diperbarui.'}</p>{change.changed_provinces.length>0&&<small>{change.changed_provinces.map(labelProvince).join(', ')}</small>}</article>):<p className={s.emptyDetail}>Belum ada perubahan tersimpan untuk tanggal ini.</p>}</section>}
          </>}
        </>}
      </main>
      {!loading&&<footer className={s.footer}>{data?.snapshot&&<span>Terakhir disimpan {timeLabel(data.snapshot.updated_at)}</span>}<button type="button" className={s.iconButton} aria-label="Muat ulang laporan" title="Muat ulang" onClick={()=>guard('muat ulang',()=>void load(range.from,range.to))} disabled={Boolean(busy)||loading}><ArrowClockwise size={17}/></button></footer>}
    </div>
            {(['save','note','recap'].includes(busy)&&!modal)&&<div className={s.savingOverlay} role="status" aria-live="polite"><span className={s.savingIndicator}>Menyimpan perubahan...</span></div>}
            {modal&&<ReportDialog title={modal.type==='access'?'Pengaturan PIN':modal.type==='addProvince'?'Tambah provinsi':modal.type==='account'?`${ROLE_LABELS[modal.role]} · ${provinceName(modal.id,selectedProvince?.name)}`:modal.type==='package'?`Detail paket · ${selectedPackage?.name||provinceName(modal.id,selectedProvince?.name)}`:modal.type==='workflow'?`Progres ${STEP_LABELS[modal.step]} · ${provinceName(modal.id,selectedProvince?.name)}`:provinceName(modal.id,selectedProvince?.name)} onClose={()=>setModal(null)} busy={Boolean(busy)} onDelete={modal.type==='province'&&selectedProvince&&!viewingRecap?()=>clearProvinceData(selectedProvince.id):undefined} deletePrompt="Data akun dan catatan provinsi akan dikosongkan. Semua paket aktif dipindahkan ke arsip nonaktif; nama dan riwayatnya tetap tersimpan.">{modal.type==='access'?<AccessPanel onSave={body=>request('/access',{method:'PUT',body:JSON.stringify(body)})}/>:modal.type==='addProvince'?<form className={s.formFields} onSubmit={event=>{event.preventDefault();try{addProvince(newProvinceLabel)}catch(error){setAddProvinceError(error instanceof Error?error.message:'Provinsi belum dapat ditambahkan.')}}}><p className={s.panelIntro}>Provinsi tambahan masuk ke laporan ini dan akan dihitung dalam rekap.</p><label>Nama provinsi<input autoFocus value={newProvinceLabel} maxLength={120} onChange={event=>{setNewProvinceLabel(event.target.value);setAddProvinceError('')}} placeholder="Masukkan nama provinsi" required/></label>{addProvinceError&&<p role="alert" className={s.error}>{addProvinceError}</p>}<button className={s.primaryButton} type="submit">Tambah provinsi</button></form>:selectedProvince&&selectedPackage&&modal.type==='package'?<PackagePanel pkg={selectedPackage} provinceName={provinceName(selectedProvince.id,selectedProvince.name)} editable={canEditModal} canSave={dirty} onChange={update=>updateProvince(selectedProvince.id,province=>{const pkg=province.packages.find(item=>item.id===selectedPackage.id);if(pkg)update(pkg)})} onSave={saveModalChanges}/>:selectedProvince&&modal.type==='workflow'?<WorkflowPanel province={selectedProvince} step={modal.step} canTransition={!busy&&!viewingRecap} canDelete={!busy&&!viewingRecap} onAdvance={packageId=>advancePackage(selectedProvince.id,packageId)} onReturn={(packageId,note)=>returnPackage(selectedProvince.id,packageId,note)} onDelete={packageId=>resetWorkflow(selectedProvince.id,packageId)}/>:selectedProvince&&modal.type==='account'?<AccountPanel province={selectedProvince} role={modal.role} editable={canEditModal} canSave={dirty} onChange={update=>updateProvince(selectedProvince.id,update)} onSave={saveModalChanges}/>:selectedProvince&&<ProvincePanel province={selectedProvince} editable={canEditModal} canSave={dirty} onChange={update=>updateProvince(selectedProvince.id,update)} onSaveNotes={saveProvinceNotes} onSaveChanges={saveModalChanges}/>}</ReportDialog>}
    {preview&&<ReportDialog title="Pratinjau impor Excel" onClose={()=>setPreview(null)}><p>{preview.changes.length} provinsi akan diperbarui pada {dateLabel(date)}.</p>{preview.changes.length>0?<ul className={s.previewList}>{preview.changes.map(name=><li key={name}>{name}</li>)}</ul>:<p>Tidak ada perbedaan dengan data saat ini.</p>}<p className={s.quiet}>Impor belum disimpan. Periksa draft, lalu pilih Submit perubahan.</p><div className={s.toolActions}><button className={s.button} type="button" onClick={()=>setPreview(null)}>Batal</button><button className={s.primaryButton} type="button" onClick={()=>{setDraft(preview.document);setEditing(true);setSource('import');setOrder(order.length?order:sortProvinces(preview.document.provinces).map(p=>p.id));setPreview(null);setTab('table');setNotice('Impor diterapkan ke draft. Periksa lalu pilih Submit perubahan.')}}>Terapkan ke draft</button></div></ReportDialog>}
    {pending&&<ReportDialog title="Perubahan belum disimpan" onClose={()=>setPending(null)} busy={Boolean(busy)}><p>Simpan atau buang perubahan sebelum {pending.label} dilanjutkan.</p>{error&&<p className={s.error} role="alert">{error}</p>}<div className={s.guardActions}><button className={s.button} disabled={Boolean(busy)} onClick={()=>setPending(null)}>Kembali</button><button className={s.button} disabled={Boolean(busy)} onClick={()=>void resolvePending(false)}>Buang draft</button><button className={s.primaryButton} disabled={Boolean(busy)} onClick={()=>void resolvePending(true)}>{busy?'Menyimpan...':'Simpan & lanjut'}</button></div></ReportDialog>}
  </SuiteSurface>
}
