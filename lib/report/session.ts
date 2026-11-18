import {SignJWT,jwtVerify} from 'jose'

export type ReportRole = 'admin'|'user'
export const REPORT_COOKIE='report_session'
export const REPORT_SESSION_SECONDS=8*60*60
export async function createReportSession(role:ReportRole,version:number,secret:string) {
  if(secret.length<32)throw new Error('Kunci sesi laporan belum dikonfigurasi.')
  return new SignJWT({role,version}).setProtectedHeader({alg:'HS256'}).setIssuer('personal-tools-report').setAudience('report').setIssuedAt().setExpirationTime(`${REPORT_SESSION_SECONDS}s`).sign(new TextEncoder().encode(secret))
}
export async function readReportSession(token:string,secret:string):Promise<{role:ReportRole;version:number}|null> {
  if(secret.length<32)return null
  try{
    const {payload}=await jwtVerify(token,new TextEncoder().encode(secret),{algorithms:['HS256'],issuer:'personal-tools-report',audience:'report'})
    if(!['admin','user'].includes(String(payload.role))||!Number.isSafeInteger(payload.version)||Number(payload.version)<1)return null
    return {role:payload.role as ReportRole,version:payload.version as number}
  }catch{return null}
}
