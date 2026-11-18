import type { TemplateConfig } from '@/types/templateSurat'
export type AccessTag = {id:string;name:string;kind:string;organization:string;division:string;active:boolean;revision:number;access_version:number;pin_hash?:string;pin_configured?:boolean}
export type DocumentTemplate = {id:string;code:string;name:string;kind:string;organization:string;division:string;description:string;access_tag_id:string;status:'draft'|'published'|'inactive'|'deleted';revision:number;active_version_id:string|null;version_id?:string|null}
export type DocumentVersion = {id:string;template_id:string;fields:TemplateConfig;file_key:string;file_name:string;checksum:string;status:'draft'|'validated'|'active'|'history';created_at:string}
