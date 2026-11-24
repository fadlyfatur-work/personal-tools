import {z} from 'zod'

export const PROVINCES = [
  ['sumatera-selatan','Sumatera Selatan'],['lampung','Lampung'],['jawa-barat','Jawa Barat'],['jawa-tengah','Jawa Tengah'],
  ['di-yogyakarta','DI Yogyakarta'],['banten','Banten'],['nusa-tenggara-timur','Nusa Tenggara Timur'],['kalimantan-barat','Kalimantan Barat'],
  ['kalimantan-selatan','Kalimantan Selatan'],['sulawesi-tengah','Sulawesi Tengah'],['papua-selatan','Papua Selatan'],['aceh','Aceh'],
  ['sumatera-utara','Sumatera Utara'],['sumatera-barat','Sumatera Barat'],['riau','Riau'],['jambi','Jambi'],['bengkulu','Bengkulu'],
  ['kepulauan-bangka-belitung','Kepulauan Bangka Belitung'],['kepulauan-riau','Kepulauan Riau'],['dki-jakarta','DKI Jakarta'],['jawa-timur','Jawa Timur'],
  ['bali','Bali'],['nusa-tenggara-barat','Nusa Tenggara Barat'],['kalimantan-tengah','Kalimantan Tengah'],['kalimantan-timur','Kalimantan Timur'],
  ['kalimantan-utara','Kalimantan Utara'],['sulawesi-utara','Sulawesi Utara'],['sulawesi-selatan','Sulawesi Selatan'],['sulawesi-tenggara','Sulawesi Tenggara'],
  ['gorontalo','Gorontalo'],['sulawesi-barat','Sulawesi Barat'],['maluku','Maluku'],['maluku-utara','Maluku Utara'],['papua','Papua'],
  ['papua-barat','Papua Barat'],['papua-tengah','Papua Tengah'],['papua-pegunungan','Papua Pegunungan'],['papua-barat-daya','Papua Barat Daya'],
] as const
export const ROLES = ['sekda','kepalaDinas','kepalaBpkad','apip','penyusunHarga','penyusunAsb'] as const
export type AccountRole = typeof ROLES[number]
export const ROLE_LABELS: Record<AccountRole,string> = {sekda:'Sekda / Admin SKPD',kepalaDinas:'Kepala Dinas',kepalaBpkad:'Kepala BPKAD',apip:'APIP',penyusunHarga:'Penyusun Harga',penyusunAsb:'Penyusun ASB'}
export const STEPS = ['pu','bpkad','apip','perbaikan'] as const
export const STEP_LABELS = {pu:'PU',bpkad:'BPKAD',apip:'APIP',perbaikan:'Perbaikan'}
export type Step = typeof STEPS[number]
export const WORKFLOW_STATUS = {pu:'Penyusunan ASB oleh PU',bpkad:'Diperiksa oleh BPKAD',apip:'Diperiksa oleh APIP',ready:'Siap Integrasi SIPD',received:'Sudah diterima SIPD',returned_pu:'Dikembalikan ke PU',returned_bpkad:'Dikembalikan ke BPKAD'} as const
export type WorkflowStatus=keyof typeof WORKFLOW_STATUS
export const STATUSES = ['-','proses','selesai'] as const
export const STATUS_LABELS = {'-':'-',proses:'Proses',selesai:'Selesai'}
export const PACKAGE_ENVIRONMENTS = ['staging','production'] as const
export type PackageEnvironment = typeof PACKAGE_ENVIRONMENTS[number]
export const PACKAGE_ENVIRONMENT_LABELS: Record<PackageEnvironment,string> = {staging:'Aplikasi Latihan',production:'Aplikasi Utama'}
export const PACKAGE_CONFIRMATION_STATUSES = ['unconfirmed','checking','confirmed','cancelled'] as const
export type PackageConfirmationStatus = typeof PACKAGE_CONFIRMATION_STATUSES[number]
export const PACKAGE_CONFIRMATION_LABELS: Record<PackageConfirmationStatus,string> = {unconfirmed:'Belum terkonfirmasi',checking:'Dalam konfirmasi',confirmed:'Terkonfirmasi',cancelled:'Dibatalkan'}
const timestamp = z.string().datetime({offset:true}).nullable()
const count = z.number().int().min(0).max(1_000_000).nullable()
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)
const note = z.string().max(3000)
const packageNoteHistorySchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),text:note,createdAt:timestamp}).strict()
const status = z.enum(STATUSES)
const workflowStatusSchema=z.enum(['pu','bpkad','apip','ready','received','returned_pu','returned_bpkad'])
const detailSchema = z.object({id,label:z.string().trim().min(1).max(160),institution:z.string().max(200),email:z.union([z.literal(''),z.email().max(254)]),note}).strict()
const noteHistorySchema = z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),analysis:note,followUp:note,createdAt:timestamp}).strict()
const workflowEventSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),from:workflowStatusSchema.nullable(),to:workflowStatusSchema,kind:z.enum(['created','confirmed','advanced','repair']),note,createdAt:timestamp}).strict()
const accountSchema = z.object({status:z.enum(['ada','tc','tidak_ada']),count,details:z.array(detailSchema).max(200),note,updatedAt:timestamp}).strict()
export const PACKAGE_EVIDENCE_URL_LIMIT = 2048
export const PACKAGE_PIC_NAME_LIMIT = 160
export const PACKAGE_PIC_PHONE_LIMIT = 40
const packageSchema = z.object({
  id,name:z.string().trim().min(1).max(240),confirmed:z.boolean().default(true),confirmationStatus:z.enum(PACKAGE_CONFIRMATION_STATUSES).optional(),environment:z.enum(PACKAGE_ENVIRONMENTS).nullable().default(null),
  evidenceChecked:z.boolean().default(false),evidenceUrl:z.string().trim().max(PACKAGE_EVIDENCE_URL_LIMIT).default(''),
  picName:z.string().trim().max(PACKAGE_PIC_NAME_LIMIT).default(''),picPhone:z.string().trim().max(PACKAGE_PIC_PHONE_LIMIT).default(''),
  pu:status,bpkad:status,apip:status,perbaikan:status,workflowStatus:workflowStatusSchema.optional(),repairStatus:status.optional(),
  returnTarget:z.enum(['pu','bpkad']).nullable().optional(),workflowHistory:z.array(workflowEventSchema).max(1000).default([]),
  active:z.boolean(),inactiveReason:note,note,noteHistory:z.array(packageNoteHistorySchema).max(500).default([]),createdAt:timestamp,updatedAt:timestamp,nameUpdatedAt:timestamp,statusUpdatedAt:timestamp,
}).strict()
const provinceSchema = z.object({id,name:z.string().trim().min(1).max(120).optional(),accounts:z.object({sekda:accountSchema,kepalaDinas:accountSchema,kepalaBpkad:accountSchema,apip:accountSchema,penyusunHarga:accountSchema,penyusunAsb:accountSchema}).strict(),totalPackages:count,integratedPackages:count,packages:z.array(packageSchema).max(1000),notes:note,followUp:note,notesHistory:z.array(noteHistorySchema).max(200).default([]),totalUpdatedAt:timestamp,integrationUpdatedAt:timestamp,firstProgressDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),firstProgressAt:timestamp.default(null)}).strict()
const documentSchema = z.object({schemaVersion:z.literal(1),source:z.object({label:z.string().max(300),date:z.string(),accountTotal:z.number().int().nonnegative()}).strict().nullable(),provinces:z.array(provinceSchema).min(38).max(200)}).strict()
export type AccountDetail = z.infer<typeof detailSchema>
export type AccountInfo = z.infer<typeof accountSchema>
export type ReportPackage = z.infer<typeof packageSchema>
export type ProvinceReport = z.infer<typeof provinceSchema>
export type ReportDocument = z.infer<typeof documentSchema>
export type ReportSnapshot = {date:string;revision:number;document:ReportDocument;created_at:string;updated_at:string}
export type ReportChange = {id:number;report_date:string;revision:number;created_at:string;actor_role:'admin'|'user';source:string;reason:string;changed_provinces:string[]}
export type ReportHistoryPoint = {date:string;summary:{all:ReturnType<typeof summarize>;provinces:{id:string;total:number|null;integrated:number|null;percent:number|null;accounts:number}[]}}
export const provinceName = (id:string,customName?:string) => PROVINCES.find(item=>item[0]===id)?.[1] || customName || id.replace(/^tambahan-/,'').replaceAll('-',' ').replace(/\b\p{L}/gu,letter=>letter.toUpperCase())
export const accountLabel = (account:AccountInfo) => ({ada:'Ada',tc:'T/C',tidak_ada:'Tidak ada'})[account.status]
export function recordedAccountCount(account:AccountInfo):number|null {
  if(account.status==='tc')return null
  if(account.status==='tidak_ada')return 0
  return account.count ?? (account.details.filter(detail=>detail.label.trim()).length || null)
}
export function recordedAccountsByRole(doc:ReportDocument){
  return ROLES.map(role=>doc.provinces.reduce((total,p)=>total+(recordedAccountCount(p.accounts[role])??0),0))
}
export const dateLabel = (value:string) => new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`))
export const timeLabel = (value:string|null) => value ? `${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))} WIB` : 'Belum tersedia'
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export function validReportDate(value:unknown):value is string {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value && value>='2026-11-10' && value<=today()
}
export function integration(total:number|null, integrated:number|null) {
  return total!==null && total>0 && integrated!==null ? Math.round(integrated/total*10000)/100 : null
}
export function packageEvidenceLink(value:string|undefined):string|null {
  const text=value?.trim()||''
  if(text.length>PACKAGE_EVIDENCE_URL_LIMIT||!/^https?:\/\//i.test(text))return null
  try{
    const url=new URL(text)
    return url.username||url.password?null:url.href
  }catch{return null}
}
export function newPackage(name:string,id:string=crypto.randomUUID()):ReportPackage {
  return {id,name,confirmed:false,confirmationStatus:'unconfirmed',environment:null,evidenceChecked:false,evidenceUrl:'',picName:'',picPhone:'',pu:'-',bpkad:'-',apip:'-',perbaikan:'-',workflowStatus:'pu',repairStatus:'-',returnTarget:null,workflowHistory:[],active:true,inactiveReason:'',note:'',noteHistory:[],createdAt:null,updatedAt:null,nameUpdatedAt:null,statusUpdatedAt:null}
}
export function setPackageName(pkg:ReportPackage,name:string){
  pkg.name=name
}
function resetPackageStages(pkg:ReportPackage){
  pkg.pu=pkg.confirmed?'proses':'-'
  pkg.bpkad='-';pkg.apip='-';pkg.perbaikan='-';pkg.workflowStatus='pu';pkg.repairStatus='-';pkg.returnTarget=null
}
export function packageConfirmationStatus(pkg:Pick<ReportPackage,'confirmationStatus'|'confirmed'>):PackageConfirmationStatus {
  return pkg.confirmationStatus??(pkg.confirmed?'confirmed':'unconfirmed')
}
export function setPackageConfirmationStatus(pkg:ReportPackage,status:PackageConfirmationStatus){
  if(packageConfirmationStatus(pkg)===status)return
  pkg.confirmationStatus=status
  pkg.confirmed=status==='confirmed'
  resetPackageStages(pkg)
}
export function setPackageConfirmation(pkg:ReportPackage,confirmed:boolean){
  setPackageConfirmationStatus(pkg,confirmed?'confirmed':'unconfirmed')
}
export function workflowStatusOf(pkg:ReportPackage):WorkflowStatus {
  if(pkg.workflowStatus)return pkg.workflowStatus
  if(pkg.perbaikan==='proses')return 'returned_pu'
  if(pkg.apip==='selesai')return 'ready'
  if(pkg.apip==='proses')return 'apip'
  if(pkg.bpkad==='selesai')return 'apip'
  if(pkg.bpkad==='proses')return 'bpkad'
  if(pkg.pu==='selesai')return 'bpkad'
  return 'pu'
}
export function newProvince(name:string,id:string):ProvinceReport {
  return {id,name,accounts:Object.fromEntries(ROLES.map(role=>[role,{status:'tc',count:null,details:[],note:'',updatedAt:null}])) as unknown as ProvinceReport['accounts'],totalPackages:0,integratedPackages:0,packages:[],notes:'',followUp:'',notesHistory:[],totalUpdatedAt:null,integrationUpdatedAt:null,firstProgressDate:null,firstProgressAt:null}
}
export function validateDocument(value:unknown,previous?:ReportDocument):ReportDocument {
  const result=documentSchema.safeParse(value)
  if(!result.success)throw new Error(`Isian laporan tidak valid: ${result.error.issues[0]?.path.join('.')} ${result.error.issues[0]?.message}`)
  const doc=result.data, known=new Set<string>(), names=new Set<string>(), packages=new Set<string>(), accounts=new Set<string>()
  const priorPackages=previous?new Map(previous.provinces.flatMap(p=>p.packages.map(pkg=>[pkg.id,pkg] as const))):null
  for(const p of doc.provinces){
    const standard=PROVINCES.some(([id])=>id===p.id),custom=p.id.startsWith('tambahan-')&&Boolean(p.name?.trim())
    if((!standard&&!custom)||known.has(p.id))throw new Error('Provinsi tidak dikenal atau tercatat ganda.')
    known.add(p.id)
    const name=provinceName(p.id,p.name)
    const normalizedName=name.toLocaleLowerCase('id-ID')
    if(names.has(normalizedName))throw new Error('Nama provinsi tercatat lebih dari satu kali.')
    names.add(normalizedName)
    for(const pkg of p.packages){
      pkg.confirmationStatus??=pkg.confirmed?'confirmed':'unconfirmed'
      pkg.confirmed=pkg.confirmationStatus==='confirmed'
      pkg.workflowStatus??=workflowStatusOf(pkg)
      pkg.repairStatus??=(pkg.perbaikan==='proses'?'proses':pkg.perbaikan==='selesai'?'selesai':'-')
      pkg.returnTarget??=(pkg.workflowStatus==='returned_bpkad'?'bpkad':pkg.workflowStatus==='returned_pu'?'pu':null)
      pkg.workflowHistory??=[]
      pkg.noteHistory??=[]
      if(pkg.workflowStatus==='returned_pu'||pkg.workflowStatus==='returned_bpkad'){pkg.workflowStatus='pu';pkg.returnTarget='pu';pkg.pu='proses';pkg.bpkad='-';pkg.apip='-';pkg.repairStatus='proses';pkg.perbaikan='proses'}
      const before=priorPackages?.get(pkg.id)
      if(!pkg.noteHistory.length&&pkg.note.trim()&&pkg.createdAt&&(!before||before.note===pkg.note))pkg.noteHistory=[{id:`legacy-${pkg.id}`,text:pkg.note.trim(),createdAt:pkg.updatedAt??pkg.createdAt}]
      if(!pkg.confirmed||(pkg.active&&priorPackages&&(!before||packageConfirmationStatus(before)!=='confirmed')))resetPackageStages(pkg)
      if(pkg.active&&!pkg.confirmed&&!pkg.note.trim())throw new Error(`${name}: isi catatan atau alasan untuk paket “${pkg.name}” yang belum dikonfirmasi.`)
      if(packages.has(pkg.id))throw new Error(`${name}: ID paket ganda.`)
      packages.add(pkg.id)
      if(pkg.evidenceUrl&&!packageEvidenceLink(pkg.evidenceUrl))throw new Error(`${name}: URL bukti dukung paket “${pkg.name}” harus berupa tautan http/https yang valid.`)
      if(Boolean(pkg.picName)!==Boolean(pkg.picPhone))throw new Error(`${name}: isi nama dan nomor kontak PIC untuk paket “${pkg.name}”.`)
      if(pkg.picPhone&&!/^\+?[0-9(). -]*\d[0-9(). -]*$/.test(pkg.picPhone))throw new Error(`${name}: nomor kontak PIC paket “${pkg.name}” tidak valid.`)
      if(!pkg.active&&!pkg.inactiveReason.trim())throw new Error(`${name}: alasan penonaktifan paket wajib diisi.`)
      if(pkg.workflowStatus.startsWith('returned_')&&(pkg.repairStatus!=='proses'||!pkg.returnTarget))throw new Error(`${name}: paket yang dikembalikan harus memiliki tujuan dan perbaikan aktif.`)
      if(['ready','received'].includes(pkg.workflowStatus)&&pkg.repairStatus==='proses')throw new Error(`${name}: paket siap integrasi atau diterima SIPD tidak dapat dikembalikan.`)
    }
    const {totalPackages,integratedPackages}=provinceSummary(p)
    p.totalPackages=totalPackages
    p.integratedPackages=integratedPackages
    const noteIds=new Set<string>()
    for(const entry of p.notesHistory){if(noteIds.has(entry.id))throw new Error(`${name}: ID riwayat catatan ganda.`);noteIds.add(entry.id)}
    for(const role of ROLES){
      const a=p.accounts[role]
      if((a.status==='ada'&&a.count!==null&&a.count<1)||(a.status==='tc'&&a.count!==null)||(a.status==='tidak_ada'&&a.count!==0)||(a.details.length>0&&a.status!=='ada')||(a.count!==null&&a.count<a.details.length))throw new Error(`${name}: status, jumlah, dan rincian akun ${ROLE_LABELS[role]} tidak sesuai.`)
      for(const detail of a.details){if(accounts.has(detail.id))throw new Error(`${name}: ID rincian akun ganda.`);accounts.add(detail.id)}
    }
  }
  if(PROVINCES.some(([provinceId])=>!known.has(provinceId)))throw new Error('Daftar 38 provinsi sumber tidak boleh dihapus.')
  return doc
}
const accountValue = (a:AccountInfo) => JSON.stringify({status:a.status,count:a.count,details:a.details,note:a.note})
const packageValue = (p:ReportPackage) => JSON.stringify({name:p.name,confirmationStatus:packageConfirmationStatus(p),environment:p.environment??null,evidenceChecked:p.evidenceChecked??false,evidenceUrl:p.evidenceUrl??'',picName:p.picName??'',picPhone:p.picPhone??'',active:p.active,inactiveReason:p.inactiveReason,note:p.note,noteHistory:p.noteHistory??[],workflowStatus:p.workflowStatus,repairStatus:p.repairStatus,returnTarget:p.returnTarget,workflowHistory:p.workflowHistory,...Object.fromEntries(STEPS.map(step=>[step,p[step]]))})
export function prepareDocument(value:unknown, previous:ReportDocument, now:string, reportDate:string):ReportDocument {
  const doc=validateDocument(value,previous)
  doc.source=previous.source
  if(previous.provinces.some(old=>!doc.provinces.some(p=>p.id===old.id)))throw new Error('Provinsi yang sudah tercatat tidak boleh dihapus.')
  const owners=new Map(previous.provinces.flatMap(p=>p.packages.map(pkg=>[pkg.id,p.id] as const)))
  for(const p of doc.provinces){
    const old=previous.provinces.find(item=>item.id===p.id)||newProvince(p.name||provinceName(p.id),p.id)
    const oldNotes=new Map((old.notesHistory||[]).map(entry=>[entry.id,entry.createdAt]))
    p.notesHistory=p.notesHistory.map(entry=>({...entry,createdAt:oldNotes.get(entry.id)||now}))
    if(old.packages.some(pkg=>pkg.active&&!p.packages.some(item=>item.id===pkg.id)))throw new Error('Paket aktif tidak boleh dihapus; nonaktifkan terlebih dahulu.')
    p.totalUpdatedAt=p.totalPackages!==old.totalPackages?now:old.totalUpdatedAt
    p.integrationUpdatedAt=p.integratedPackages!==old.integratedPackages?now:old.integrationUpdatedAt
    for(const role of ROLES)p.accounts[role].updatedAt=accountValue(p.accounts[role])!==accountValue(old.accounts[role])?now:old.accounts[role].updatedAt
    for(const pkg of p.packages){
      if(owners.has(pkg.id)&&owners.get(pkg.id)!==p.id)throw new Error('ID paket tidak boleh dipindah ke provinsi lain.')
      const before=old.packages.find(item=>item.id===pkg.id)
      pkg.createdAt=before?.createdAt||now
      if(pkg.active&&pkg.confirmed&&(!before||packageConfirmationStatus(before)!=='confirmed')){
        pkg.workflowHistory.push({id:crypto.randomUUID(),from:null,to:'pu',kind:'confirmed',note:'',createdAt:null})
      }
      if(!pkg.noteHistory.length&&before?.note.trim())pkg.noteHistory.push({id:`legacy-${pkg.id}`,text:before.note.trim(),createdAt:before.updatedAt??before.createdAt})
      if(pkg.note.trim()&&pkg.note.trim()!==(before?.note.trim()??''))pkg.noteHistory.push({id:crypto.randomUUID(),text:pkg.note.trim(),createdAt:now})
      pkg.updatedAt=!before||packageValue(pkg)!==packageValue(before)?now:before.updatedAt
      pkg.nameUpdatedAt=!before||pkg.name!==before.name?now:before.nameUpdatedAt
      pkg.statusUpdatedAt=!before||packageConfirmationStatus(pkg)!==packageConfirmationStatus(before)||STEPS.some(step=>pkg[step]!==before[step])||pkg.workflowStatus!==before.workflowStatus||pkg.repairStatus!==before.repairStatus||pkg.returnTarget!==before.returnTarget||pkg.active!==before.active?now:before.statusUpdatedAt
      const eventTimes=new Map((before?.workflowHistory||[]).map(event=>[event.id,event.createdAt]))
      pkg.workflowHistory=pkg.workflowHistory.map(event=>({...event,createdAt:eventTimes.get(event.id)||now}))
    }
    const progressing=ROLES.some(role=>p.accounts[role].status==='ada')||p.packages.some(pkg=>pkg.active&&STEPS.some(step=>pkg[step]!=='-'))||(p.integratedPackages||0)>0
    p.firstProgressDate=old.firstProgressDate || (progressing?reportDate:null)
    const recordedDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))
    p.firstProgressAt=old.firstProgressAt || (!old.firstProgressDate&&progressing&&reportDate===recordedDate?now:null)
  }
  return doc
}
export function carryForward(snapshot:ReportSnapshot,date:string):ReportSnapshot {
  return {...snapshot,date,revision:0,document:validateDocument(snapshot.document)}
}
export function provinceSummary(p:ProvinceReport) {
  const active=p.packages.filter(pkg=>pkg.active&&pkg.name.trim())
  const confirmed=active.filter(pkg=>packageConfirmationStatus(pkg)==='confirmed')
    .sort((a,b)=>Number(b.environment==='production')-Number(a.environment==='production'))
  const totalPackages=confirmed.length,integratedPackages=confirmed.filter(pkg=>['ready','received'].includes(workflowStatusOf(pkg))).length
  const progress=overallProgress(p,confirmed)
  const overallPercent=weightedProgressPercent(progress)
  const accountStage=ROLES.slice(4).some(role=>p.accounts[role].status==='ada')?3:ROLES.slice(1,4).some(role=>p.accounts[role].status==='ada')?2:p.accounts.sekda.status==='ada'?1:0
  const positionStage=confirmed[0]?.environment==='production'?4:accountStage
  return {accountStage,positionStage,active,confirmed,totalPackages,integratedPackages,completeDetails:true,completedSteps:confirmed.reduce((sum,pkg)=>sum+(['pu','bpkad','apip'] as const).filter(step=>pkg[step]==='selesai').length,0),percent:integration(totalPackages,integratedPackages),overallPercent,integrationComplete:totalPackages>0&&integratedPackages===totalPackages}
}
function overallProgress(p:ProvinceReport,confirmed:ReportPackage[]=p.packages.filter(pkg=>pkg.active&&pkg.name.trim()&&packageConfirmationStatus(pkg)==='confirmed')) {
  return {
    accountsDone:ROLES.filter(role=>p.accounts[role].status==='ada').length,
    accountsTotal:Number(ROLES.length),
    stageFourDone:confirmed.reduce((sum,pkg)=>sum+(['pu','bpkad','apip'] as const).filter(step=>pkg[step]==='selesai').length,0),
    packages:confirmed.length,
    integratedDone:confirmed.filter(pkg=>workflowStatusOf(pkg)==='received').length,
    otherDone:confirmed.reduce((sum,pkg)=>sum+Number(pkg.environment!==null)+Number(pkg.evidenceChecked)+Number(packageEvidenceLink(pkg.evidenceUrl)!==null),0),
  }
}
function weightedProgressPercent({accountsDone,accountsTotal,stageFourDone,packages,integratedDone,otherDone}:ReturnType<typeof overallProgress>) {
  const accountScore=30*accountsDone/accountsTotal
  const packageScore=packages?60*stageFourDone/(packages*3)+5*integratedDone/packages+5*otherDone/(packages*3):0
  return Math.round((accountScore+packageScore)*100)/100
}
export function stepSummary(p:ProvinceReport,step:Step) {
  const {confirmed}=provinceSummary(p), done=confirmed.filter(pkg=>pkg[step]==='selesai').length, processing=confirmed.filter(pkg=>pkg[step]==='proses').length
  const label=[done&&`${done} selesai`,processing&&`${processing} proses`].filter(Boolean).join(' · ')||'—'
  return {done,processing,unknown:confirmed.length-done-processing,complete:confirmed.length>0&&done===confirmed.length,hasData:confirmed.length>0,label}
}
export function countPackageEnvironments(packages:ReportPackage[]){
  return PACKAGE_ENVIRONMENTS.map(environment=>({
    environment,count:packages.filter(pkg=>pkg.environment===environment).length,
  })).filter(({count})=>count>0)
}
export function sortProvinces(rows:ProvinceReport[]):ProvinceReport[] {
  const sourceOrder=new Map<string,number>(PROVINCES.map(([id],index)=>[id,index]))
  return rows.map(province=>{
    const {totalPackages,completedSteps,positionStage}=provinceSummary(province)
    const roles=ROLES.filter(role=>province.accounts[role].status==='ada').length
    const hasPackage=Number(province.packages.some(pkg=>pkg.active&&pkg.name.trim()&&packageConfirmationStatus(pkg)!=='cancelled'))
    const hasProgress=Number(positionStage>0||completedSteps>0||totalPackages>0)
    return {province,roles,hasPackage,completedSteps,positionStage,hasProgress}
  }).sort((a,b)=>
    Number(b.positionStage===4)-Number(a.positionStage===4)
    ||b.hasProgress-a.hasProgress
    ||(a.hasProgress?b.roles-a.roles||b.completedSteps-a.completedSteps||b.hasPackage-a.hasPackage:b.hasPackage-a.hasPackage)
    ||b.positionStage-a.positionStage
    ||(a.province.firstProgressDate||'9999').localeCompare(b.province.firstProgressDate||'9999')
    ||(a.province.firstProgressAt||'9999').localeCompare(b.province.firstProgressAt||'9999')
    ||(sourceOrder.get(a.province.id)??PROVINCES.length)-(sourceOrder.get(b.province.id)??PROVINCES.length)
  ).map(({province})=>province)
}
export function summarize(doc:ReportDocument) {
  const roles=ROLES.map(role=>doc.provinces.filter(p=>p.accounts[role].status==='ada').length)
  const accountEntries=doc.provinces.flatMap(p=>ROLES.map(role=>p.accounts[role]))
  const packageCoverage=doc.provinces.length
  const integratedCoverage=doc.provinces.length
  const totalPackages=doc.provinces.reduce((sum,p)=>sum+provinceSummary(p).totalPackages,0)
  const integratedPackages=doc.provinces.reduce((sum,p)=>sum+provinceSummary(p).integratedPackages,0)
  const progressCounts=doc.provinces.map(p=>overallProgress(p))
  const nationalProgress=progressCounts.reduce((total,progress)=>({
    accountsDone:total.accountsDone+progress.accountsDone,
    accountsTotal:total.accountsTotal+progress.accountsTotal,
    stageFourDone:total.stageFourDone+progress.stageFourDone,
    packages:total.packages+progress.packages,
    integratedDone:total.integratedDone+progress.integratedDone,
    otherDone:total.otherDone+progress.otherDone,
  }),{accountsDone:0,accountsTotal:0,stageFourDone:0,packages:0,integratedDone:0,otherDone:0})
  return {provinceCount:doc.provinces.length,roles,provincesWithAccounts:doc.provinces.filter(p=>ROLES.some(role=>p.accounts[role].status==='ada')).length,accountCount:accountEntries.reduce((sum,a)=>sum+(recordedAccountCount(a)??0),0),accountCountComplete:accountEntries.every(a=>a.count!==null),packageCoverage,integratedCoverage,totalPackages,integratedPackages,integrationPercent:packageCoverage===doc.provinces.length&&integratedCoverage===doc.provinces.length?integration(totalPackages,integratedPackages):null,overallProgressPercent:nationalProgress.accountsTotal?weightedProgressPercent(nationalProgress):null,completedSteps:doc.provinces.reduce((sum,p)=>sum+provinceSummary(p).completedSteps,0)}
}
