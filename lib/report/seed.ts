import {PROVINCES,ROLES,validateDocument,type ReportDocument} from './model'

// Keep source report data out of the public client model; serve it only after PIN verification.
export function createSeed():ReportDocument {
  const hasSekda=new Set([0,1,2,3,4,5,6,7,8,9,10,17,21,29,30])
  return validateDocument({schemaVersion:1,source:{date:'2026-11-10',accountTotal:20,label:'PDF Monitoring ASB Provinsi, 10 November 2026. Rekap 20 akun provinsi; rincian identitas akun dan paket tidak tersedia.'},provinces:PROVINCES.map(([id],index)=>({
    id,accounts:Object.fromEntries(ROLES.map(role=>[role,{status:(role==='sekda'&&hasSekda.has(index))||(role==='kepalaDinas'&&index===3)||(['kepalaBpkad','penyusunHarga'].includes(role)&&[3,10].includes(index))?'ada':'tc',count:null,details:[],note:'',updatedAt:null}])),
    totalPackages:null,integratedPackages:null,packages:[],notes:'',followUp:'',totalUpdatedAt:null,integrationUpdatedAt:null,firstProgressDate:hasSekda.has(index)?'2026-11-10':null,firstProgressAt:null,
  }))})
}
