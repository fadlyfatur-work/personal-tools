import assert from 'node:assert/strict'
import fs from 'node:fs'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

assert.ok(fs.existsSync('lib/report/model.ts'), 'Report snapshot domain is not implemented')
const m={...loadSuiteModule('lib/report/model.ts'),...loadSuiteModule('lib/report/seed.ts')}
const seed=m.createSeed()
assert.equal(seed.provinces.length,38)
const summary=m.summarize(seed)
assert.deepEqual(JSON.parse(JSON.stringify(summary.roles)),[15,1,2,0,2,0])
assert.equal(summary.provincesWithAccounts,15)
assert.equal(summary.totalPackages,null)
assert.equal(summary.integrationPercent,null)
assert.equal(m.integration(0,0),null)
assert.equal(m.integration(null,0),null)
assert.equal(m.integration(4,0),0)
assert.equal(m.integration(4,3),75)
const bad=structuredClone(seed)
bad.provinces[0].totalPackages=2
bad.provinces[0].integratedPackages=3
assert.throws(()=>m.validateDocument(bad),/terintegrasi/i)
bad.provinces[0].integratedPackages=0
bad.provinces[0].totalPackages=-1
assert.throws(()=>m.validateDocument(bad))
const duplicate=structuredClone(seed)
duplicate.provinces[1].id=duplicate.provinces[0].id
assert.throws(()=>m.validateDocument(duplicate),/provinsi/i)
const input=structuredClone(seed), now='2026-11-11T04:00:00.000Z'
input.provinces[0].totalPackages=4
input.provinces[0].packages.push(m.newPackage('Paket uji','test-package'))
input.provinces[0].packages[0].pu='selesai'
const prepared=m.prepareDocument(input,seed,now,'2026-11-11')
assert.equal(prepared.provinces[0].totalUpdatedAt,now)
assert.equal(prepared.provinces[0].packages[0].createdAt,now)
const unchanged=m.prepareDocument(prepared,prepared,'2026-11-11T05:00:00.000Z','2026-11-11')
assert.equal(unchanged.provinces[0].packages[0].updatedAt,now)
assert.equal(unchanged.provinces[0].totalUpdatedAt,now)
const copied=m.carryForward({date:'2026-11-10',revision:2,document:prepared,created_at:now,updated_at:now},'2026-11-11')
copied.document.provinces[0].notes='baru'
assert.notEqual(prepared.provinces[0].notes,'baru')
assert.equal(copied.revision,0)
const sorted=m.sortProvinces(prepared.provinces)
assert.equal(sorted[0].id,prepared.provinces[0].id)
const counts=structuredClone(seed)
counts.provinces[0].accounts.sekda.count=0
assert.throws(()=>m.validateDocument(counts),/akun/i)
const lost=structuredClone(prepared)
lost.provinces[0].packages=[]
assert.throws(()=>m.prepareDocument(lost,prepared,now,'2026-11-11'),/paket.*hilang/i)
const almost=structuredClone(seed.provinces[0]);almost.totalPackages=1000000;almost.integratedPackages=999999
assert.equal(m.provinceSummary(almost).integrationComplete,false,'Rounding must never mark an unfinished integration green')
const early=structuredClone(seed);early.provinces[12].accounts.sekda.status='ada'
const earlier=m.prepareDocument(early,seed,'2026-11-11T04:00:00Z','2026-11-11')
const late=structuredClone(earlier);late.provinces[11].accounts.sekda.status='ada'
const times=m.prepareDocument(late,earlier,'2026-11-11T05:00:00Z','2026-11-11')
assert.equal(m.sortProvinces(times.provinces.filter(p=>['aceh','sumatera-utara'].includes(p.id)))[0].id,'sumatera-utara','Known first-progress time breaks a same-day tie')
console.log('PASS: source seed, unknown vs zero, totals, timestamps, isolated snapshots and sorting.')
