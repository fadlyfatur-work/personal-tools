'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toolsRequest, ToolsRequestError, useTools } from '@/lib/tools/client'
import { ToolsShell } from '@/app/tools/components/tools-shell'
import type { AccessTag, DocumentTemplate, DocumentVersion } from '@/lib/documents/types'
import type { TemplateConfig, DateRangeValue } from '@/types/templateSurat'
import { FieldConfig } from './field-config'
import { TestDocument } from './test-document'
import styles from '../documents.module.css'
const json = (body: unknown, method = 'POST'): RequestInit => ({ method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
const emptyTag = {name:'',kind:'instansi',organization:'',division:'',pin:''}
const emptyMetadata = {code:'',name:'',kind:'',organization:'',division:'',description:'',access_tag_id:''}
type Metadata = typeof emptyMetadata
type Detail = DocumentTemplate & { versions: DocumentVersion[] }
export default function AdminPage() {
  const tools = useTools()
  return <ToolsShell title="Pengelola template" description="Kelola koleksi akses, versi Word, dan penerbitan dokumen." section="documents" tools={tools}>{tools.context && (tools.context.isTemplateAdmin ? <AdminWorkspace key={`${tools.context.userId}:${tools.context.workspaceId}`} /> : <section className={styles.panel}><p role="alert">Akun ini tidak memiliki hak admin template.</p><Link href="/documents">Buka dokumen dengan PIN</Link></section>)}</ToolsShell>
}
function AdminWorkspace() {
  const [tags,setTags]=useState<AccessTag[]>([])
  const [templates,setTemplates]=useState<DocumentTemplate[]>([])
  const [tagId,setTagId]=useState('')
  const [tagForm,setTagForm]=useState(emptyTag)
  const [selected,setSelected]=useState<Detail|null>(null)
  const [metadata,setMetadata]=useState<Metadata>(emptyMetadata)
  const [fields,setFields]=useState<TemplateConfig>({single:[],groups:[]})
  const [file,setFile]=useState<File|null>(null)
  const [operationId,setOperationId]=useState('')
  const [versionId,setVersionId]=useState('')
  const [reviewed,setReviewed]=useState(false)
  const [testedVersionId,setTestedVersionId]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState('')
  const [attempt,setAttempt]=useState(0)
  const [conflict,setConflict]=useState(false)
  const [editorKey,setEditorKey]=useState(0)
  const tag=tags.find(item=>item.id===tagId)
  const version=selected?.versions.find(item=>item.id===versionId)
  const canReview=!!version&&(['validated','active'].includes(version.status)||(version.status==='history'&&testedVersionId===version.id))
  const metadataDirty=!!selected&&Object.entries(metadata).some(([key,value])=>key!=='code'&&selected[key as keyof Metadata]!==value)
  useEffect(()=>{
    const controller=new AbortController()
    Promise.all([toolsRequest<AccessTag[]>('/api/documents/admin/tags',{signal:controller.signal}),toolsRequest<DocumentTemplate[]>('/api/documents/admin/templates',{signal:controller.signal})]).then(([nextTags,nextTemplates])=>{if(!controller.signal.aborted){setTags(nextTags);setTemplates(nextTemplates)}}).catch(err=>{if(!controller.signal.aborted)setError(err.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[attempt])
  function report(err: unknown) {
    if(err instanceof ToolsRequestError&&[401,403].includes(err.status)){setTags([]);setTemplates([]);setSelected(null);setMetadata(emptyMetadata);setFields({single:[],groups:[]});setTagId('');setTagForm(emptyTag);setFile(null);setVersionId('');setTestedVersionId('')}
    setConflict(err instanceof ToolsRequestError&&err.status===409)
    setError(err instanceof Error?err.message:'Tindakan belum berhasil. Coba kembali.')
  }
  async function action(work:()=>Promise<void>){setBusy(true);setError('');setNotice('');setConflict(false);try{await work()}catch(err){report(err)}finally{setBusy(false)}}
  async function refresh(){const [nextTags,nextTemplates]=await Promise.all([toolsRequest<AccessTag[]>('/api/documents/admin/tags'),toolsRequest<DocumentTemplate[]>('/api/documents/admin/templates')]);setTags(nextTags);setTemplates(nextTemplates)}
  function setDetail(detail:Detail){setSelected(detail);setMetadata(Object.fromEntries(Object.keys(emptyMetadata).map(key=>[key,detail[key as keyof Metadata]||''])) as Metadata);const nextVersion=detail.versions[0];setVersionId(nextVersion?.id||'');setFields(nextVersion?.fields||{single:[],groups:[]});setFile(null);setOperationId('');setReviewed(false);setTestedVersionId('');setEditorKey(value=>value+1)}
  async function open(id:string){const detail=await toolsRequest<Detail>(`/api/documents/admin/templates/${id}`);setDetail(detail)}
  function newTemplate(){setSelected(null);setMetadata({...emptyMetadata,access_tag_id:tags.find(item=>item.active)?.id||''});setFields({single:[],groups:[]});setFile(null);setOperationId('');setVersionId('');setReviewed(false);setTestedVersionId('');setEditorKey(value=>value+1);setError('');setNotice('')}
  async function inspect(nextFile:File){
    setFile(nextFile);setOperationId(crypto.randomUUID());setReviewed(false);setTestedVersionId('')
    const body=new FormData();body.set('file',nextFile)
    const inspected=await toolsRequest<{fields:TemplateConfig;placeholders:string[]}>('/api/documents/admin/inspect',{method:'POST',body})
    if(!selected)setFields(inspected.fields)
    setNotice(`File dibaca: ${inspected.placeholders.length} variabel. ${selected?'Konfigurasi versi saat ini dipertahankan; sesuaikan jika penanda Word berubah.':'Periksa label dan jenis isian sebelum menyimpan.'}`)
  }
  async function saveTemplate(){
    if(file){let current=selected;if(current&&Object.entries(metadata).some(([key,value])=>key!=='code'&&current?.[key as keyof Metadata]!==value)){const updated=await toolsRequest<DocumentTemplate>(`/api/documents/admin/templates/${current.id}`,json({...metadata,revision:current.revision},'PATCH'));current={...current,...updated};setSelected(current)}const body=new FormData();body.set('file',file);body.set('metadata',JSON.stringify({...metadata,revision:current?.revision,fields,operation_id:operationId}));const saved=await toolsRequest<DocumentTemplate>(selected?`/api/documents/admin/templates/${selected.id}/versions`:'/api/documents/admin/templates',{method:'POST',body});await open(saved.id);await refresh();setNotice('Versi Word tersimpan sebagai draf. Uji dan periksa hasilnya sebelum diterbitkan.')}
    else if(selected){await toolsRequest(`/api/documents/admin/templates/${selected.id}`,json({...metadata,revision:selected.revision},'PATCH'));await open(selected.id);await refresh();setNotice('Metadata template disimpan.')}
    else throw Error('Pilih file DOCX untuk membuat template.')
  }
  async function test(single:Record<string,string|DateRangeValue>,groups:Record<string,Record<string,string>[]>){await action(async()=>{
    if(!selected||!versionId)return
    setReviewed(false);setTestedVersionId('')
    const response=await fetch(`/api/documents/admin/templates/${selected.id}/test`,{...json({version_id:versionId,single,groups}),credentials:'same-origin',cache:'no-store'})
    if(!response.ok){const body=await response.json().catch(()=>({}));throw new ToolsRequestError(body.error||'Uji Word gagal.',response.status,body.code)}
    const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`uji-${selected.code}.docx`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    const detail=await toolsRequest<Detail>(`/api/documents/admin/templates/${selected.id}`);setSelected(detail);setReviewed(false);setTestedVersionId(versionId)
    const warnings=response.headers.get('X-Warnings');setNotice(`Unduhan uji dimulai. Buka Word dan periksa semua isian.${warnings?' Catatan: '+JSON.parse(decodeURIComponent(warnings)).join(' '):''}`)
  })}
  async function status(next:DocumentTemplate['status']){if(!selected)return;if(!window.confirm(`${next==='deleted'?'Hapus template dari katalog':next==='inactive'?'Nonaktifkan template':'Pulihkan template sebagai draf'}?`))return;await action(async()=>{await toolsRequest(`/api/documents/admin/templates/${selected.id}${next==='deleted'?`?revision=${selected.revision}`:''}`,next==='deleted'?{method:'DELETE'}:json({revision:selected.revision,status:next},'PATCH'));await open(selected.id);await refresh();setNotice('Status template diperbarui.')})}
  return <div className={`${styles.page} ${styles.embedded}`}><Link href="/documents" className={styles.back}>‹ Katalog dokumen</Link>
    {error&&<div role="alert" className={styles.error}>{error}{conflict&&<div className={styles.actions}><button disabled={busy} className={styles.secondary} onClick={()=>void action(async()=>{if(!window.confirm('Muat data terbaru? Perubahan yang belum disimpan akan diganti.'))return;await refresh();if(selected)await open(selected.id);setTagId('');setTagForm(emptyTag);setConflict(false)})}>Muat data terbaru</button></div>}</div>}
    {notice&&<p role="status" className={styles.success}>{notice}</p>}
    {loading?<p role="status">Memuat pengelolaan dokumen…</p>:<div className={styles.adminWorkspace}><aside aria-label="Koleksi dan kelompok akses">
    <details className={styles.panel}><summary>Kelompok akses dan PIN ({tags.length})</summary><div className={styles.list}>{tags.map(item=><button key={item.id} className={styles.secondary} disabled={busy} onClick={()=>{setTagId(item.id);setTagForm({name:item.name,kind:item.kind,organization:item.organization,division:item.division,pin:''})}}>{item.name} · {item.active?'Aktif':'Nonaktif'} · {item.pin_configured?'PIN tersedia':'PIN dicabut'}</button>)}</div>
    <button className={styles.secondary} type="button" onClick={()=>{setTagId('');setTagForm(emptyTag)}}>Kelompok baru</button>
    <form onSubmit={e=>{e.preventDefault();void action(async()=>{if(tagForm.pin&&!window.confirm(tag?'Ganti PIN kelompok? Semua akses PIN lama akan berakhir.':'Buat kelompok akses dengan PIN ini?'))return;await toolsRequest(`/api/documents/admin/tags${tag?'/'+tag.id:''}`,json({...tagForm,pin:tagForm.pin||undefined,revision:tag?.revision},tag?'PATCH':'POST'));await refresh();setTagId('');setTagForm(emptyTag);setNotice('Kelompok akses disimpan. Berikan PIN kepada pengguna melalui saluran yang sesuai.')})}}>
    <h2>{tag?'Ubah kelompok':'Kelompok baru'}</h2><div className={styles.grid}>{(['name','kind','organization','division'] as const).map(key=><label key={key} className={styles.label}>{({name:'Nama kelompok',kind:'Jenis kelompok',organization:'Instansi / lembaga',division:'Divisi'})[key]}<input className={styles.input} required={key==='name'||key==='kind'} maxLength={key==='name'?100:key==='kind'?60:160} value={tagForm[key]} onChange={e=>setTagForm({...tagForm,[key]:e.target.value})} /></label>)}</div>
    <label className={styles.label}>{tag?'PIN baru (kosongkan untuk mempertahankan)':'PIN kelompok'}<input className={styles.input} type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{5,12}" minLength={5} maxLength={12} required={!tag} value={tagForm.pin} onChange={e=>setTagForm({...tagForm,pin:e.target.value})} /></label>
    <div className={styles.actions}><button className={styles.button} disabled={busy}>Simpan kelompok</button>{tag&&<><button type="button" className={styles.secondary} disabled={busy||!tag.pin_configured} onClick={()=>{if(window.confirm('Cabut PIN kelompok dan akhiri semua akses yang sedang terbuka?'))void action(async()=>{await toolsRequest(`/api/documents/admin/tags/${tag.id}`,json({revision:tag.revision,revoke:true},'PATCH'));await refresh();setTagId('');setTagForm(emptyTag);setNotice('PIN kelompok dicabut.')})}}>Cabut PIN</button><button type="button" className={styles.secondary} disabled={busy} onClick={()=>{if(window.confirm(`${tag.active?'Nonaktifkan':'Aktifkan'} kelompok ini?`))void action(async()=>{await toolsRequest(`/api/documents/admin/tags/${tag.id}`,json({revision:tag.revision,active:!tag.active},'PATCH'));await refresh();setTagId('');setTagForm(emptyTag)})}}>{tag.active?'Nonaktifkan kelompok':'Aktifkan kelompok'}</button><button type="button" className={styles.remove} disabled={busy} onClick={()=>{if(window.confirm('Arsipkan kelompok ini? Kelompok yang masih memiliki template tidak dapat diarsipkan.'))void action(async()=>{await toolsRequest(`/api/documents/admin/tags/${tag.id}?revision=${tag.revision}`,{method:'DELETE'});await refresh();setTagId('');setTagForm(emptyTag)})}}>Arsipkan kelompok</button></>}</div></form></details>
    <div className={styles.panel}><div className={styles.sectionHeading}><h2>Template dokumen</h2><button disabled={busy} className={styles.secondary} onClick={newTemplate}>Template baru</button></div><div className={styles.grid}><label className={styles.label}>Cari template<input className={styles.input} value={query} onChange={e=>setQuery(e.target.value)} /></label><label className={styles.label}>Status<select className={styles.input} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Semua status</option><option value="draft">Draf</option><option value="published">Terbit</option><option value="inactive">Nonaktif</option><option value="deleted">Dihapus</option></select></label></div><div className={styles.list}>{templates.filter(item=>(!filter||item.status===filter)&&item.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))).map(item=><button key={item.id} disabled={busy} aria-pressed={selected?.id===item.id} className={styles.secondary} onClick={()=>void action(()=>open(item.id))}><span>{item.name}</span><span className={styles.status}>{({draft:'Draf',published:'Terbit',inactive:'Nonaktif',deleted:'Dihapus'})[item.status]}</span></button>)}</div>{!templates.length&&<p>Belum ada template. Buat kelompok akses, lalu tambahkan file Word.</p>}<button className={styles.secondary} disabled={busy} onClick={()=>{setLoading(true);setAttempt(value=>value+1)}}>Muat ulang daftar</button></div>
    </aside><section aria-label="Editor template"><form key={editorKey} onSubmit={e=>{e.preventDefault();void action(saveTemplate)}}>
    <section className={styles.panel}><h2>{selected?'Edit template':'Template baru'}</h2>{selected&&<p className={styles.help}>Status: {({draft:'Draf',published:'Terbit',inactive:'Nonaktif',deleted:'Dihapus'})[selected.status]}. Revisi {selected.revision}.</p>}
    <div className={styles.grid}>{(['code','name','kind','organization','division'] as const).map(key=><label key={key} className={styles.label}>{({code:'Kode unik',name:'Nama dokumen',kind:'Jenis dokumen',organization:'Instansi / lembaga',division:'Divisi'})[key]}<input className={styles.input} required={key==='code'||key==='name'} disabled={key==='code'&&!!selected} maxLength={key==='code'?80:160} pattern={key==='code'?'[a-zA-Z][a-zA-Z0-9_-]{0,79}':undefined} value={metadata[key]} onChange={e=>setMetadata({...metadata,[key]:e.target.value})} /></label>)}<label className={styles.label}>Kelompok akses<select required className={styles.input} value={metadata.access_tag_id} onChange={e=>setMetadata({...metadata,access_tag_id:e.target.value})}><option value="">Pilih kelompok</option>{tags.map(item=><option key={item.id} value={item.id} disabled={!item.active}>{item.name}{item.active?'':' (nonaktif)'}</option>)}</select></label></div>
    <label className={styles.label}>Keterangan<textarea className={styles.input} maxLength={2000} value={metadata.description} onChange={e=>setMetadata({...metadata,description:e.target.value})} /></label>
    <label className={styles.label}>{selected?'File DOCX pengganti (opsional)':'File DOCX'}<input className={styles.input} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required={!selected} disabled={busy} onChange={e=>{const next=e.target.files?.[0];if(next)void action(()=>inspect(next))}} /></label><p className={styles.help}>Maksimal 10 MiB. File pengganti menjadi versi draf; versi yang sudah terbit tetap digunakan sampai penerbitan berikutnya.</p>
    {selected&&!file&&<p className={styles.notice}>Untuk mengubah konfigurasi isian, pilih file Word sebagai versi baru. Metadata dapat disimpan tanpa mengunggah ulang.</p>}
    </section>
    {(file||!selected)&&<FieldConfig value={fields} onChange={next=>{setFields(next);setOperationId(crypto.randomUUID());setReviewed(false)}} />}
    <div className={styles.actions}><button disabled={busy||selected?.status==='deleted'} className={styles.button}>{busy?'Menyimpan…':file?'Simpan versi Word':'Simpan metadata'}</button>{selected&&selected.status!=='deleted'&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void status('inactive')}>Nonaktifkan</button>}{selected&&selected.status!=='deleted'&&<button type="button" className={styles.remove} disabled={busy} onClick={()=>void status('deleted')}>Hapus template</button>}{selected?.status==='deleted'&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void status('draft')}>Pulihkan sebagai draf</button>}</div></form>
    {selected&&selected.status!=='deleted'&&!file&&<><section className={styles.panel}><label className={styles.label}>Versi Word untuk diuji<select className={styles.input} disabled={busy} value={versionId} onChange={e=>{setVersionId(e.target.value);setFields(selected.versions.find(item=>item.id===e.target.value)?.fields||{single:[],groups:[]});setReviewed(false);setTestedVersionId('')}}>{selected.versions.map(item=><option key={item.id} value={item.id}>{item.file_name} · {new Date(item.created_at).toLocaleString('id-ID')} · {item.id===selected.active_version_id?'Aktif':item.status==='validated'?'Sudah diuji':'Draf'}</option>)}</select></label></section>{version&&<TestDocument key={version.id} fields={version.fields} run={test} busy={busy} />}
    <section className={styles.panel}><h2>Terbitkan versi</h2><label className={styles.check}><input type="checkbox" checked={reviewed} disabled={busy||!canReview} onChange={e=>setReviewed(e.target.checked)} />Saya sudah memeriksa hasil Word dan menyetujui versi ini.</label><p className={styles.help}>Versi yang diterbitkan tersedia bagi pemegang PIN kelompok terpilih. Simpan metadata, lalu unduh dan periksa versi uji lebih dahulu.</p><button className={styles.button} disabled={busy||!reviewed||!canReview||metadataDirty} onClick={()=>{if(!selected||!version||!window.confirm('Terbitkan versi ini untuk seluruh pemegang PIN kelompok?'))return;void action(async()=>{await toolsRequest(`/api/documents/admin/templates/${selected.id}/publish`,json({revision:selected.revision,version_id:version.id,reviewed:true}));await open(selected.id);await refresh();setNotice('Versi template diterbitkan.')})}}>Terbitkan versi</button></section></>}
    </section></div>}
  </div>
}
