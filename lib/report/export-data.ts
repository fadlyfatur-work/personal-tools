import {provinceSummary, timeLabel, workflowStatusOf, packageConfirmationStatus, PACKAGE_CONFIRMATION_LABELS, type ProvinceReport, type ReportPackage, type PackageConfirmationStatus} from './model'

const phaseDate = new Intl.DateTimeFormat('id-ID', {dateStyle: 'long', timeZone: 'Asia/Jakarta'})
const phases = [
  {step:'pu', workflow:'pu', next:'bpkad', labels:['Penyusunan PU','Selesai PU']},
  {step:'bpkad', workflow:'bpkad', next:'apip', labels:['Penyusunan BPKAD','Selesai BPKAD']},
  {step:'apip', workflow:'apip', next:'ready', labels:['Pemeriksaan APIP','Approval APIP']},
] as const

export function exportPackageGroups(province:ProvinceReport){
  const {active,confirmed}=provinceSummary(province)
  return (['confirmed','unconfirmed','checking','cancelled'] as PackageConfirmationStatus[]).map(status=>({
    status,label:PACKAGE_CONFIRMATION_LABELS[status],confirmed:status==='confirmed',
    packages:status==='confirmed'?confirmed:active.filter(pkg=>packageConfirmationStatus(pkg)===status),
  })).filter(group=>group.packages.length)
}

function packageStatus(pkg:ReportPackage){
  const history=pkg.workflowHistory??[]
  const cycle=history.slice(Math.max(0,history.findLastIndex(event=>event.to==='pu')))
  const stages=phases.flatMap(({step,workflow,next,labels})=>{
    if(pkg[step]==='-')return []
    const finished=pkg[step]==='selesai'
    const event=cycle.findLast(item=>finished?item.kind==='advanced'&&item.from===workflow&&item.to===next:item.to===workflow)
    const date=event?.createdAt??(!finished&&workflowStatusOf(pkg)===workflow?pkg.statusUpdatedAt:null)
    return [`${labels[Number(finished)]} - ${date?phaseDate.format(new Date(date)):'Belum tercatat'}`]
  })
  return stages.join(' | ')||'Belum dimulai'
}

export function exportPackageDetails(pkg:ReportPackage):string[]{
  const lines=[`Tanggal tercatat: ${timeLabel(pkg.createdAt)}`]
  if(packageConfirmationStatus(pkg)!=='confirmed')return [...lines,`Catatan / alasan: ${pkg.note}`]
  lines.push(`Status: ${packageStatus(pkg)}`)
  if(pkg.picName&&pkg.picPhone){
    const digits=pkg.picPhone.replace(/\D/g,'')
    const masked=digits.length>4?`****${digits.slice(-4)}`:'****'
    lines.push(`PIC Paket: ${pkg.picName} | ${masked}`)
  }
  lines.push(`Bukti dukung: ${pkg.evidenceChecked?'Terkumpul':'Belum ada'}`)
  return lines
}

export function exportProvinceNotes(province:ProvinceReport){
  return province.notesHistory?.length?[...province.notesHistory].reverse()
    :province.notes||province.followUp?[{createdAt:null,analysis:province.notes,followUp:province.followUp}]:[]
}
