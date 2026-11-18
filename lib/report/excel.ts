import PizZip from 'pizzip'
import {PROVINCES,ROLES,ROLE_LABELS,STEPS,STATUSES,STATUS_LABELS,WORKFLOW_STATUS,provinceName,newPackage,validateDocument,type ReportDocument,type AccountRole,type AccountDetail,type WorkflowStatus} from './model'

const XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const escape=(value:string)=>value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const column=(index:number):string=>index>=26?column(Math.floor(index/26)-1)+String.fromCharCode(65+index%26):String.fromCharCode(65+index)
type Cell=string|number|null
const HEADERS={
  Provinsi:['ID Provinsi','Provinsi','Total Paket (otomatis)','Siap Integrasi (otomatis)','Catatan','Tindak Lanjut','Total Diubah Pada','Integrasi Diubah Pada'],
  Akun:['ID Provinsi','Provinsi','Peran','Status','Jumlah','ID Akun','Nama Akun','Instansi','Email','Keterangan Akun','Catatan Peran','Diubah Pada'],
  Paket:['ID Provinsi','Provinsi','ID Paket','Nama Paket','PU','BPKAD','APIP','Perbaikan','Aktif','Alasan Nonaktif','Catatan','Dicatat Pada','Nama Diubah Pada','Status Diubah Pada','Status Alur Tahap 4','Tujuan Perbaikan'],
}
function worksheet(rows:Cell[][]){
  return `${XML}<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="16" width="24" customWidth="1"/></cols><sheetData>${rows.map((row,r)=>`<row r="${r+1}">${row.map((value,c)=>`<c r="${column(c)}${r+1}" t="inlineStr"${r===0?' s="1"':''}><is><t xml:space="preserve">${escape(String(value??''))}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
}
export function createReportWorkbook(doc:ReportDocument,date:string):Uint8Array {
  const sheets:Record<string,Cell[][]>={
    Petunjuk:[['REPORT_ASB_VERSION','3'],['TANGGAL_LAPORAN',date],['Cara mengisi','Edit data pada sheet Akun dan Paket. Jangan ubah header dan ID yang sudah terisi.'],['Jumlah paket','Total paket dan jumlah siap integrasi dihitung otomatis dari daftar paket aktif. Kolom pada sheet Provinsi hanya informasi.'],['Status akun','Ada / T/C / Tidak ada. Jumlah Tidak ada harus 0; T/C kosong.'],['Status paket','Selesai / Proses / -. Aktif: Ya / Tidak; nonaktif wajib alasan. Status Alur Tahap 4 mengikuti urutan PU, BPKAD, APIP, integrasi SIPD.'],['Paket atau akun baru','Isi provinsi dan nama. Kosongkan ID Paket/ID Akun agar dibuat otomatis.'],['Tanggal dan waktu','Kolom timestamp hanya informasi. Waktu perubahan ditetapkan server saat disimpan.'],['Impor','Impor ke tanggal yang sama, periksa pratinjau lalu Submit perubahan. Rumus tidak diterima.']],
    Provinsi:[HEADERS.Provinsi,...doc.provinces.map(p=>[p.id,provinceName(p.id,p.name),p.totalPackages,p.integratedPackages,p.notes,p.followUp,p.totalUpdatedAt,p.integrationUpdatedAt])],
    Akun:[HEADERS.Akun,...doc.provinces.flatMap(p=>ROLES.flatMap(role=>{
      const a=p.accounts[role],details:(AccountDetail|null)[]=a.details.length?a.details:[null]
      return details.map(d=>[p.id,provinceName(p.id,p.name),ROLE_LABELS[role],{ada:'Ada',tc:'T/C',tidak_ada:'Tidak ada'}[a.status],a.count,d?.id||'',d?.label||'',d?.institution||'',d?.email||'',d?.note||'',a.note,a.updatedAt])
    }))],
    Paket:[HEADERS.Paket,...doc.provinces.flatMap(p=>p.packages.map(pkg=>[p.id,provinceName(p.id,p.name),pkg.id,pkg.name,...STEPS.map(step=>STATUS_LABELS[pkg[step]]),pkg.active?'Ya':'Tidak',pkg.inactiveReason,pkg.note,pkg.createdAt,pkg.nameUpdatedAt,pkg.statusUpdatedAt,WORKFLOW_STATUS[pkg.workflowStatus||'pu'],pkg.returnTarget==='pu'?'PU':pkg.returnTarget==='bpkad'?'BPKAD':'']))],
  }
  const zip=new PizZip(),names=Object.keys(sheets)
  zip.file('[Content_Types].xml',`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  zip.file('_rels/.rels',`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file('xl/workbook.xml',`${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${names.map((name,i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels',`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${REL}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="style" Type="${REL}/styles" Target="styles.xml"/></Relationships>`)
  zip.file('xl/styles.xml',`${XML}<styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFF8FAFC"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF234F84"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`)
  names.forEach((name,i)=>zip.file(`xl/worksheets/sheet${i+1}.xml`,worksheet(sheets[name])))
  return zip.generate({type:'uint8array',compression:'DEFLATE'})
}

export async function readReportWorkbook(bytes:Uint8Array,base:ReportDocument,date:string,parseXml:(xml:string)=>Document=xml=>new DOMParser().parseFromString(xml,'application/xml')) {
  if(bytes.length>8*1024*1024)throw new Error('Ukuran Excel maksimal 8 MB.')
  let zip:PizZip
  try{zip=new PizZip(bytes)}catch{throw new Error('File bukan workbook XLSX yang dapat dibaca.')}
  const entries=Object.values(zip.files)
  if(entries.length>150)throw new Error('Workbook memiliki terlalu banyak bagian.')
  const expanded=entries.reduce((sum,entry)=>sum+((entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize||0),0)
  if(expanded>32*1024*1024)throw new Error('Isi workbook setelah dibuka maksimal 32 MB.')
  let actualBytes=0
  async function xml(path:string){
    const file=zip.file(path)
    if(!file)throw new Error(`Bagian workbook tidak ditemukan: ${path}`)
    // PizZip reads ZIP metadata; native streaming inflation enforces actual output limits.
    const data=(file as unknown as {_data:{compressionMethod:string;uncompressedSize:number;getCompressedContent:()=>Uint8Array}})._data
    const compressed=Uint8Array.from(data.getCompressedContent())
    let stream=new Blob([compressed.buffer]).stream()
    if(data.compressionMethod==='\x08\x00'){
      if(typeof DecompressionStream==='undefined')throw new Error('Browser ini belum mendukung impor Excel. Gunakan Chrome atau Edge terbaru.')
      stream=stream.pipeThrough(new DecompressionStream('deflate-raw'))
    }else if(data.compressionMethod!=='\x00\x00')throw new Error('Metode kompresi workbook tidak didukung.')
    const reader=stream.getReader(),decoder=new TextDecoder(),parts:string[]=[]
    let length=0
    try{
      for(;;){
        const chunk=await reader.read();if(chunk.done)break
        length+=chunk.value.byteLength;actualBytes+=chunk.value.byteLength
        if(length>16*1024*1024||actualBytes>32*1024*1024){await reader.cancel();throw new Error('Isi workbook melampaui batas: maksimal 16 MB per bagian dan 32 MB keseluruhan.')}
        parts.push(decoder.decode(chunk.value,{stream:true}))
      }
    }finally{reader.releaseLock()}
    if(length!==data.uncompressedSize)throw new Error('Ukuran isi workbook tidak sesuai. File mungkin rusak.')
    parts.push(decoder.decode())
    const text=parts.join('')
    if(text.length>16*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('XML workbook terlalu besar atau berisi DTD yang tidak diizinkan.')
    const document=parseXml(text)
    if(document.getElementsByTagName('parsererror').length)throw new Error('XML workbook tidak valid.')
    return document
  }
  const nodes=(root:Document|Element,name:string)=>Array.from(root.getElementsByTagNameNS('*',name))
  const shared=zip.file('xl/sharedStrings.xml')?nodes(await xml('xl/sharedStrings.xml'),'si').map(si=>nodes(si,'t').map(n=>n.textContent||'').join('')):[]
  const relations=new Map(nodes(await xml('xl/_rels/workbook.xml.rels'),'Relationship').map(r=>[r.getAttribute('Id'),r]))
  const sheetMap=new Map(nodes(await xml('xl/workbook.xml'),'sheet').map(sheet=>{
    const rel=relations.get(sheet.getAttributeNS(REL,'id')||sheet.getAttribute('r:id'))
    const target=rel?.getAttribute('Target')||''
    if(!target||rel?.getAttribute('TargetMode')==='External'||target.includes('..')||target.includes('\\'))throw new Error('Lokasi sheet workbook tidak valid.')
    return [sheet.getAttribute('name'),target.startsWith('/')?target.slice(1):`xl/${target}`] as const
  }))
  async function rows(name:string):Promise<{number:number;cells:string[]}[]>{
    const target=sheetMap.get(name)
    if(!target)throw new Error(`Sheet ${name} tidak ditemukan. Unduh template terbaru.`)
    const document=await xml(target)
    if(nodes(document,'f').length)throw new Error(`Sheet ${name}: rumus tidak diperbolehkan; gunakan angka atau teks biasa.`)
    const all=nodes(document,'row')
    if(all.length>10000)throw new Error(`Sheet ${name} maksimal 10.000 baris.`)
    return all.map((row,index)=>{
      const cells:string[]=[]
      for(const cell of nodes(row,'c')){
        const ref=cell.getAttribute('r')||'',letters=ref.match(/^[A-Z]+/)?.[0]
        if(!letters)throw new Error(`Sheet ${name}: referensi sel tidak valid.`)
        const columnIndex=[...letters].reduce((sum,char)=>sum*26+char.charCodeAt(0)-64,0)-1
        if(columnIndex>30)throw new Error(`Sheet ${name}: kolom di luar template.`)
        const raw=nodes(cell,'v')[0]?.textContent||''
        const value=cell.getAttribute('t')==='s'?shared[Number(raw)]:cell.getAttribute('t')==='inlineStr'?nodes(cell,'t').map(n=>n.textContent||'').join(''):raw
        if(value===undefined||value.length>4000)throw new Error(`Sheet ${name}: isi sel tidak valid atau terlalu panjang.`)
        cells[columnIndex]=value
      }
      return {number:Number(row.getAttribute('r'))||index+1,cells}
    }).filter(row=>row.cells.some(value=>value?.trim()))
  }
  const info=await rows('Petunjuk')
  if(info.find(row=>row.cells[0]==='REPORT_ASB_VERSION')?.cells[1]!=='3')throw new Error('Versi template tidak cocok. Unduh template terbaru.')
  if(info.find(row=>row.cells[0]==='TANGGAL_LAPORAN')?.cells[1]!==date)throw new Error('Tanggal Excel berbeda dari tanggal laporan yang sedang dibuka.')
  const doc=validateDocument(base),owners=new Map(doc.provinces.flatMap(p=>p.packages.map(pkg=>[pkg.id,p.id])))
  const seenProvinces=new Set<string>(),seenPackages=new Set<string>(),seenAccounts=new Set<string>(),groups=new Map<string,{summary:string;hasEmpty:boolean}>()
  function province(row:string[]){
    let key=(row[0]||'').trim()
    if(!key){const name=(row[1]||'').trim().toLowerCase().replace(/^provinsi /,'');key=PROVINCES.find(([id,label])=>id===name||label.toLowerCase()===name||(name==='bangka belitung'&&id==='kepulauan-bangka-belitung'))?.[0]||''}
    const p=doc.provinces.find(item=>item.id===key)
    if(!p)throw new Error('Provinsi tidak dikenal; gunakan ID atau nama dari template.')
    return p
  }
  function number(raw:string|undefined){if(!raw?.trim())return null;const n=Number(raw);if(!Number.isSafeInteger(n)||n<0||n>1_000_000)throw new Error('Jumlah harus angka bulat nonnegatif, maksimal 1.000.000.');return n}
  for(const name of ['Provinsi','Akun','Paket'] as const){
    const content=await rows(name),header=content.shift()?.cells
    if(!header||HEADERS[name].some((label,i)=>header[i]!==label))throw new Error(`Header sheet ${name} berubah. Gunakan template terbaru.`)
    for(const {number:rowNumber,cells:r} of content){
      try{
        const p=province(r)
        if(name==='Provinsi'){
          if(seenProvinces.has(p.id))throw new Error('Provinsi ganda.')
          seenProvinces.add(p.id);p.notes=r[4]||'';p.followUp=r[5]||''
        }else if(name==='Akun'){
          const role=ROLES.find(role=>role===(r[2]||'').trim()||ROLE_LABELS[role].toLowerCase()===(r[2]||'').trim().toLowerCase()) as AccountRole|undefined
          if(!role)throw new Error('Peran akun tidak dikenal.')
          const account=p.accounts[role],value=(r[3]||'').trim().toLowerCase(),accountStatus=value==='ada'?'ada':value==='t/c'?'tc':value==='tidak ada'?'tidak_ada':null
          if(!accountStatus)throw new Error('Status akun harus Ada, T/C, atau Tidak ada.')
          const count=number(r[4]),key=`${p.id}:${role}`,summary=JSON.stringify([accountStatus,count,r[10]||'']),group=groups.get(key)
          if(group&&(group.summary!==summary||group.hasEmpty||!r[6]?.trim()))throw new Error('Ringkasan peran ganda atau tidak konsisten.')
          groups.set(key,{summary,hasEmpty:!r[6]?.trim()});account.status=accountStatus;account.count=count;account.note=r[10]||''
          if(r[6]?.trim()){
            const detailId=r[5]?.trim()||crypto.randomUUID()
            if(seenAccounts.has(detailId))throw new Error('ID akun ganda.')
            seenAccounts.add(detailId)
            const detail={id:detailId,label:r[6].trim(),institution:r[7]||'',email:r[8]||'',note:r[9]||''}
            const existing=account.details.findIndex(d=>d.id===detailId)
            if(existing>=0)account.details[existing]=detail;else account.details.push(detail)
          }else if(r[5]?.trim())throw new Error('Nama akun wajib untuk ID akun yang terisi.')
        }else{
          if(!r[3]?.trim())throw new Error('Nama paket wajib diisi.')
          const packageId=r[2]?.trim()||crypto.randomUUID()
          if(seenPackages.has(packageId))throw new Error('ID paket ganda.')
          if(owners.has(packageId)&&owners.get(packageId)!==p.id)throw new Error('ID paket milik provinsi lain.')
          seenPackages.add(packageId)
          let pkg=p.packages.find(item=>item.id===packageId)
          if(!pkg){pkg=newPackage(r[3].trim(),packageId);p.packages.push(pkg)}
          pkg.name=r[3].trim()
          STEPS.forEach((step,i)=>{const value=r[i+4]?.trim().toLowerCase()||'-';if(!STATUSES.includes(value as typeof STATUSES[number]))throw new Error(`Status ${step} harus Selesai, Proses, atau -.`);pkg![step]=value as typeof STATUSES[number]})
          const workflowLabel=(r[14]||'').trim(),workflow=Object.entries(WORKFLOW_STATUS).find(([,label])=>label===workflowLabel)?.[0] as WorkflowStatus|undefined
          if(!workflow)throw new Error('Status Alur Tahap 4 harus diisi sesuai daftar status pada template terbaru.')
          pkg.workflowStatus=workflow;pkg.repairStatus=pkg.perbaikan;pkg.returnTarget=workflow==='returned_pu'?'pu':workflow==='returned_bpkad'?'bpkad':null
          if(r[15]&&(!['PU','BPKAD'].includes(r[15].trim())||!workflow.startsWith('returned_')))throw new Error('Tujuan Perbaikan hanya PU/BPKAD dan hanya untuk paket yang dikembalikan.')
          if(workflow.startsWith('returned_')){pkg.repairStatus='proses';pkg.perbaikan='proses';pkg.returnTarget=(r[15]?.trim().toLowerCase()==='bpkad'||workflow==='returned_bpkad')?'bpkad':'pu'}
          if(r[8]&&!['ya','tidak'].includes(r[8].trim().toLowerCase()))throw new Error('Aktif harus Ya atau Tidak.')
          pkg.active=(r[8]?.trim().toLowerCase()||'ya')==='ya';pkg.inactiveReason=r[9]||'';pkg.note=r[10]||''
        }
      }catch(error){throw new Error(`Sheet ${name}, baris ${rowNumber}: ${error instanceof Error?error.message:'isian tidak valid'}`)}
    }
  }
  validateDocument(doc)
  const changes=doc.provinces.filter(p=>JSON.stringify(p)!==JSON.stringify(base.provinces.find(item=>item.id===p.id))).map(p=>provinceName(p.id,p.name))
  return {document:doc,changes}
}
