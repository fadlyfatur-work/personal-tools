import {createHmac,randomUUID} from 'node:crypto'
import bcrypt from 'bcryptjs'
import {SignJWT,jwtVerify} from 'jose'
export const DOCUMENTS_COOKIE='documents_tag_access'
export const DOCUMENTS_GRANT_SECONDS=8*60*60
export function normalizePin(value:unknown){
  if(typeof value!=='string'||!/^\d{5,12}$/.test(value.trim()))throw new Error('PIN harus berisi 5–12 digit angka.')
  return value.trim()
}
export function pinDigest(pin:string,secret:string){if(secret.length<32)throw new Error('Kunci akses belum dikonfigurasi.');return createHmac('sha256',secret).update(normalizePin(pin)).digest('hex')}
export const hashPin=(pin:string)=>bcrypt.hash(normalizePin(pin),12)
export const verifyPin=(pin:string,hash:string)=>bcrypt.compare(normalizePin(pin),hash)
export type DocumentGrant={tagId:string;version:number;expiresAt:number;id:string}
export async function createDocumentGrant(input:{tagId:string;version:number},secret:string){
  if(secret.length<32)throw new Error('Kunci sesi belum dikonfigurasi.')
  return new SignJWT({tagId:input.tagId,version:input.version}).setProtectedHeader({alg:'HS256'}).setIssuer('personal-tools-documents').setAudience('documents-tag').setJti(randomUUID()).setIssuedAt().setExpirationTime(`${DOCUMENTS_GRANT_SECONDS}s`).sign(new TextEncoder().encode(secret))
}
export async function readDocumentGrant(token:string,secret:string):Promise<DocumentGrant|null>{
  if(secret.length<32)return null
  try{const{payload}=await jwtVerify(token,new TextEncoder().encode(secret),{algorithms:['HS256'],issuer:'personal-tools-documents',audience:'documents-tag'});if(typeof payload.tagId!=='string'||!Number.isSafeInteger(payload.version)||typeof payload.exp!=='number'||typeof payload.jti!=='string')return null;return{tagId:payload.tagId,version:payload.version as number,expiresAt:payload.exp,id:payload.jti}}catch{return null}
}
export function grantMatchesTag(grant:DocumentGrant|null,tag:{id:string;access_version:number;active:boolean}){return Boolean(grant&&grant.tagId===tag.id&&grant.version===tag.access_version&&tag.active&&grant.expiresAt>Date.now()/1000)}
