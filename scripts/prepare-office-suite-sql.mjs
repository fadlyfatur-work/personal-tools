import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'

const files=['migrations/202610260001_tools.sql','migrations/202610260002_documents.sql','migrations/202610260003_office.sql','migrations/202610260004_operations.sql','migrations/202610280001_tools_admin.sql','setup-office-accounts.sql']
const sql=files.map(file=>`-- Source: supabase/${file}\n${readFileSync(`supabase/${file}`,'utf8')}`).join('\n\n')
mkdirSync('.next',{recursive:true})
writeFileSync('.next/office-suite-activation.sql',`-- Office Suite activation. Review before running in the intended Supabase SQL Editor.\n-- Contains application schema, private storage setup, and the two requested account roles.\n-- No account passwords, API keys, or example PINs. No FinTrack reset migration.\n\n${sql}`)
console.log('Prepared .next/office-suite-activation.sql. No database was contacted. This file is removed by a clean build; regenerate when needed.')
