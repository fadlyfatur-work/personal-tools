import PizZip from 'pizzip'
import {exportPackageDetails,exportPackageGroups,exportProvinceNotes} from './export-data'
import {PACKAGE_ENVIRONMENT_LABELS, ROLES, ROLE_LABELS, STEPS, STEP_LABELS, accountLabel, provinceName, provinceSummary, sortProvinces, stepSummary, summarize, timeLabel, type ReportSnapshot} from './model'

const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const office='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const relationships='http://schemas.openxmlformats.org/package/2006/relationships'
const word='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const escape=(value:string)=>value.replace(/\p{Cc}/gu,c=>c==='\n'||c==='\r'||c==='\t'?c:'')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const tableWidths=[470,2200,3000,1130,1130,1130,950,1120,1120,1250,1250,1250,1250,1150,1180,1050,1180,1000]

function paragraph(value:string,{style='',bold=false,color='1F2937',fill='',size=20,after=80,keep=false,center=false}={}){
  const properties=`${style?`<w:pStyle w:val="${style}"/>`:''}${keep?'<w:keepNext/>':''}${fill?`<w:shd w:val="clear" w:fill="${fill}"/>`:''}<w:spacing w:after="${after}"/>${center?'<w:jc w:val="center"/>':''}`
  const content=escape(value).split(/\r?\n/).map(part=>`<w:t xml:space="preserve">${part}</w:t>`).join('<w:br/>')
  return `<w:p><w:pPr>${properties}</w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr>${content}</w:r></w:p>`
}
type Cell={label:string;fill?:string;color?:string;span?:number}
function tableRow(cells:Cell[],header=false){
  let column=0
  const contents=cells.map(cell=>{
    const span=cell.span??1
    const width=tableWidths.slice(column,column+span).reduce((total,w)=>total+w,0)
    const center=column!==1&&column!==2
    column+=span
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:''}${cell.fill?`<w:shd w:val="clear" w:fill="${cell.fill}"/>`:''}<w:vAlign w:val="center"/></w:tcPr>${paragraph(cell.label,{bold:header,color:cell.color,size:16,after:0,center})}</w:tc>`
  }).join('')
  return `<w:tr><w:trPr><w:cantSplit/>${header?'<w:tblHeader/>':''}</w:trPr>${contents}</w:tr>`
}

export function createReportDocx(snapshot:ReportSnapshot){
  const provinces=sortProvinces(snapshot.document.provinces)
  const summary=summarize(snapshot.document)
  const groupHeaders:Cell[]=[
    {label:'No'},{label:'Provinsi'},{label:'Nama Paket'},
    {label:'Tahap 1 · Sekda'},{label:'Tahap 2 · Pimpinan & APIP',span:3},{label:'Tahap 3 · Penyusun',span:2},
    {label:'Tahap 4 · Proses ASB',span:4},{label:'Tahap 5 · Integrasi SIPD',span:2},{label:'Ringkasan',span:3},
  ]
  const headers=['No','Provinsi','Paket terkonfirmasi','Status akun','Kepala Dinas','Kepala BPKAD','APIP','Harga','ASB',...STEPS.map(step=>STEP_LABELS[step]),'Total paket','Siap integrasi','% integrasi','Progres keseluruhan','Posisi akun']
  const header=tableRow(groupHeaders.map(cell=>({...cell,fill:'203C65',color:'FFFFFF'})),true)
    +tableRow(headers.map(label=>({label,fill:'E8EEF6'})),true)
  const rows=provinces.map((province,index)=>{
    const info=provinceSummary(province),stripe=index%2?'F8FAFC':'FFFFFF'
    const cells:Cell[]=[
      {label:String(index+1)},{label:provinceName(province.id,province.name)},{label:info.confirmed.length===1?info.confirmed[0].name:`${info.totalPackages} Paket`},
      ...ROLES.map(role=>{
        const account=province.accounts[role]
        return {label:accountLabel(account),fill:account.status==='ada'?'DCF5E6':account.status==='tc'?'FFF1D6':'F1F3F6'}
      }),
      ...STEPS.map(step=>{
        const state=stepSummary(province,step)
        const fill=step==='perbaikan'&&state.processing?'FCE4E4':state.complete?'DCF5E6':state.processing||state.done?'FFF1D6':stripe
        return {label:state.label,fill}
      }),
      {label:String(info.totalPackages)},{label:String(info.integratedPackages)},
      {label:info.percent===null?'N/D':`${info.percent.toLocaleString('id-ID')}%`},
      {label:`${info.overallPercent.toLocaleString('id-ID')}%`},{label:info.accountStage?`Tahap ${info.accountStage}`:'T/C'},
    ]
    return tableRow(cells.map(cell=>({fill:stripe,...cell})))
  }).join('')
  const totals=tableRow([
    {label:'Provinsi dengan akun tercatat',span:3},...summary.roles.map(value=>({label:String(value)})),
    {label:'Proses ASB',span:4},{label:String(summary.totalPackages)},{label:String(summary.integratedPackages)},
    {label:summary.integrationPercent===null?'N/D':`${summary.integrationPercent.toLocaleString('id-ID')}%`},{label:`${summary.overallProgressPercent?.toLocaleString('id-ID')??'N/D'}%`},{label:'—'},
  ].map(cell=>({...cell,fill:'E8EEF6'})),false)
  const borders=['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="3" w:color="D7E0EA"/>`).join('')
  const width=tableWidths.reduce((sum,w)=>sum+w,0)
  const table=`<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/>
    <w:tblCellMar><w:top w:w="45" w:type="dxa"/><w:left w:w="65" w:type="dxa"/><w:bottom w:w="45" w:type="dxa"/><w:right w:w="65" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid>${tableWidths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${header}${rows}${totals}</w:tbl>`
  const updated=`Diperbarui pada: ${timeLabel(snapshot.updated_at)}`
  const title='Monitoring Progres Penerapan ASB Tingkat Provinsi SIPASTI Pemda'
  const overview=paragraph(title,{style:'Title',bold:true,size:32,keep:true,after:140})
    +paragraph(updated,{color:'596678',keep:true})
    +paragraph(ROLES.map((role,i)=>`${ROLE_LABELS[role]} (${summary.roles[i]})`).join(' | '),{keep:true,after:120})
    +table
    +paragraph('Bobot progres keseluruhan: Tahap 1-3 30%, Tahap 4 60%, integrasi 5%, indikator lainnya 5%. Jika belum ada paket terkonfirmasi, bobot paket bernilai 0%.',{size:15,color:'596678',after:120})
  const detail=provinces.map(province=>{
    const groups=exportPackageGroups(province),notes=exportProvinceNotes(province)
    if(!groups.length&&!notes.length)return ''
    const info=provinceSummary(province)
    return paragraph(provinceName(province.id,province.name),{style:'Heading2',bold:true,size:26,color:'203C65',keep:true})
      +paragraph(`Paket terkonfirmasi: ${info.totalPackages} (Diperbarui pada: ${timeLabel(province.totalUpdatedAt)})`,{color:'596678',keep:true})
      +groups.map(group=>{
        const tone=group.status==='confirmed'?{color:'146C3B',fill:'DCF5E6'}:group.status==='checking'?{color:'7A5008',fill:'FFF1D6'}:group.status==='cancelled'?{color:'9B302A',fill:'FBE8E7'}:{color:'9B1C1C',fill:'FCE9E8'}
        return paragraph(group.label,{...tone,style:'Heading3',bold:true,keep:true})
          +group.packages.map(pkg=>paragraph(pkg.name,{bold:true,keep:true,after:30})
            +exportPackageDetails(pkg).map((value,i)=>paragraph(value,{size:19,after:i===0?30:80})
              +(i===0&&pkg.environment?paragraph(`Lingkungan paket: ${PACKAGE_ENVIRONMENT_LABELS[pkg.environment]}`,{size:19,after:30}):'')).join('')).join('')
      }).join('')
      +paragraph('Riwayat Catatan',{style:'Heading3',bold:true,color:'203C65',keep:true})
      +(notes.length?notes.map(entry=>
        paragraph(entry.createdAt?timeLabel(entry.createdAt):'Tanggal catatan lama tidak tersedia',{color:'596678',size:18,keep:true})
        +(entry.analysis?paragraph(`Analisis / kendala: ${entry.analysis}`):'')
        +(entry.followUp?paragraph(`Tindak lanjut: ${entry.followUp}`):'')
      ).join(''):paragraph('Belum ada catatan tersimpan.',{color:'596678'}))
  }).join('')
  const landscape='<w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="23811" w:h="16838" w:orient="landscape"/><w:pgMar w:top="600" w:right="600" w:bottom="600" w:left="600" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr>'
  const portrait='<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="960" w:right="960" w:bottom="960" w:left="960" w:header="480" w:footer="480" w:gutter="0"/></w:sectPr>'
  const body=detail?overview+`<w:p><w:pPr>${landscape}</w:pPr></w:p>`+paragraph('Rincian Laporan',{style:'Heading1',bold:true,size:30,keep:true})+paragraph(updated,{color:'596678',keep:true})+detail+portrait:overview+landscape
  const style=(id:string,name:string,level?:number)=>`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${level===undefined?'':`<w:pPr><w:keepNext/><w:spacing w:before="180"/><w:outlineLvl w:val="${level}"/></w:pPr>`}</w:style>`
  const zip=new PizZip()
  zip.file('[Content_Types].xml',`${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`)
  zip.file('_rels/.rels',`${xml}<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="word/document.xml"/></Relationships>`)
  zip.file('word/_rels/document.xml.rels',`${xml}<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/styles" Target="styles.xml"/></Relationships>`)
  zip.file('word/styles.xml',`${xml}<w:styles xmlns:w="${word}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:lang w:val="id-ID"/></w:rPr></w:style>${style('Title','Title')}${style('Heading1','heading 1',0)}${style('Heading2','heading 2',1)}${style('Heading3','heading 3',2)}</w:styles>`)
  zip.file('word/document.xml',`${xml}<w:document xmlns:w="${word}"><w:body>${body}</w:body></w:document>`)
  return zip.generate({type:'uint8array',compression:'DEFLATE'})
}
