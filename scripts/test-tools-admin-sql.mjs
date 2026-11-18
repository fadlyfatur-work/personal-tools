import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PGlite} from '../.next/office-db-check/node_modules/@electric-sql/pglite/dist/index.js'
const db=new PGlite()
const admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',member='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const scalar=async(sql,params=[]) => (await db.query(sql,params)).rows[0].value
try{
 await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text);')
 await db.query('insert into auth.users values($1,$2),($3,$4)',[admin,'admin@example.invalid',member,'member@example.invalid'])
 await db.exec(fs.readFileSync('supabase/migrations/202610260001_tools.sql','utf8'))
 await db.exec(fs.readFileSync('supabase/migrations/202610280001_tools_admin.sql','utf8'))
 const boot=async id=>scalar('select tools_bootstrap($1,$2) as value',[id,'Pengguna'])
 const change=async(actor,target,data,revision=1)=>scalar('select tools_manage_user($1,$2,$3,$4::jsonb) as value',[actor,target,revision,JSON.stringify(data)])
 assert.equal((await boot(admin)).is_suite_admin,false)
 await boot(member)
 await db.query('update tools_profiles set is_suite_admin=true where user_id=$1',[admin])
 await assert.rejects(()=>change(member,admin,{is_suite_admin:true}),/TOOLS_ADMIN_REQUIRED/)
 await assert.rejects(()=>change(admin,admin,{is_suite_admin:false}),/TOOLS_SELF_LOCKOUT/)
 await assert.rejects(()=>change(admin,admin,{is_active:false}),/TOOLS_SELF_LOCKOUT/)
 const changed=await change(admin,member,{name:'Diubah',is_active:false,is_template_admin:true,is_suite_admin:false})
 assert.equal(changed.revision,2);assert.equal(changed.is_active,false)
 await assert.rejects(()=>boot(member),/TOOLS_ACCOUNT_DISABLED/)
 await assert.rejects(()=>change(admin,member,{name:'Lama'}),/TOOLS_USER_CONFLICT/)
 await change(admin,member,{is_active:true},2)
 assert.equal((await boot(member)).is_suite_admin,false)
 await db.exec('set role authenticated;')
 await assert.rejects(()=>boot(admin),/permission denied/)
 await db.exec('reset role;')
 console.log('PASS: SQL admin role, self-lockout protection, revision conflict, disabled-account denial and service-only RPC.')
}finally{await db.close()}
