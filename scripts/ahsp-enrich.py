import pathlib,json,runpy,re,collections,argparse
parser=argparse.ArgumentParser(); parser.add_argument('--corpus',type=pathlib.Path,required=True); parser.add_argument('--inventory',type=pathlib.Path,required=True); args=parser.parse_args()
root=args.corpus
import pymupdf
m=runpy.run_path(str(pathlib.Path(__file__).with_name('ahsp-inventory.py')))
data=json.loads(args.inventory.read_text(encoding='utf-8'))
clean,ck,nk,uk=m['clean'],m['codekey'],m['namekey'],m['unitkey']
raw={r['row_number']:r for r in data['master_rows']}
for sid,field in [('10901','Sumber Daya Air'),('10904','Cipta Karya / Perumahan')]:
 targets=collections.defaultdict(list)
 for item in data['items']:
  if item['field']==field and item['source_id'] is None and item['code']: targets[ck(item['code'])].append(item)
 doc=pymupdf.open(root/f'{sid}.pdf'); found=collections.defaultdict(list)
 for pi,page in enumerate(doc):
  hs=[h for h in m['headings'](page,field) if ck(h['code']) in targets]
  if not hs: continue
  for table in page.find_tables().tables:
   component=m['component_table'](table)
   if not component: continue
   prev=[h for h in hs if h['y']<component['bbox'][1]]
   if prev: found[ck(prev[-1]['code'])].append((pi,prev[-1],component))
 print('ENRICH',field,len(targets),len(found),flush=True)
 for key,candidates in found.items():
  if len(candidates)!=1: continue
  pi,h,component=candidates[0]
  if not h['text']: continue
  title=h['text']; text=doc[pi].get_text(sort=True)
  quantity=re.search(r'\b(\d+(?:[.,]\d+)?)\s*(m[²³23\u2019\']?|kg|buah|unit|batang|titik)\b',title,re.I)
  if not quantity: continue
  unit=quantity[2].replace('²','2').replace('³','3').replace('’',"'")
  overhead=re.search(r'(\d+)\s*%\s*[-–]\s*(\d+)\s*%',text)
  printed=re.search(r'^\s*-?\s*(\d{3,5})\s*-?\s*$',text,re.M)
  for item in targets[key]:
   notes=[]
   if nk(item['name'])!=nk(title): notes.append('Nama master berbeda dari judul tabel analisis: '+item['name'])
   if uk(item['unit'])!=uk(unit): notes.append(f"Satuan master {item['unit']}; basis satuan judul tabel {unit}.")
   status='berbeda' if notes else 'cocok'
   if len(targets[key])>1: status='perlu_ditinjau'; notes.append('Kode dipakai oleh beberapa baris master; perlu memastikan varian yang digunakan.')
   item.update(name=title,unit=unit,division=m['divisions'](field,h['code']),source_id=sid,page_from=pi+1,page_to=pi+1,printed_page=printed[1] if printed else '',source_text=f'Halaman PDF {pi+1}\n'+text,components=component['components'],analysis_status=component['status'],output_quantity=m['numeric'](quantity[1]),overhead_min=float(overhead[1]) if overhead else None,overhead_max=float(overhead[2]) if overhead else None,reconciliation_status=status,reconciliation_notes=notes+['Padanan ditemukan pada judul dan tabel analisis; tipe normatif/informatif belum teridentifikasi pada daftar isi.'])
   for row in item['master_rows']: raw[row].update(status=status,notes=notes)
# Resolve by the payment code in the analysis heading, including prior TOC mappings.
doc=pymupdf.open(root/'10903.pdf')
native=runpy.run_path(str(pathlib.Path(__file__).with_name('ahsp-bm-pages.py')))['analysis_pages'](doc)
targets=[i for i in data['items'] if i['field']=='Bina Marga' and i['source_id'] in (None,'10903') and i['code'] and not i['components']]
changed=0
for item in targets:
 found=native.get(ck(item['code']))
 if not found or re.search(r'^\s*[A-J]\.\d+\s+.*\('+re.escape(ck(item['code']))+r'\)\s*$',item['source_text'],re.I|re.M): continue
 start,end,text=found
 printed=re.search(r'^\s*-\s*(\d+)\s*-\s*$',text,re.M)
 item.update(source_id='10903',page_from=start,page_to=end,printed_page=printed[1] if printed else '',source_text=text,reconciliation_status='perlu_ditinjau',reconciliation_notes=['Kode ditemukan pada judul analisis Bina Marga. Periksa rincian terhadap tabel analisis pada lampiran.'])
 for row in item['master_rows']: raw[row].update(status='perlu_ditinjau',notes=item['reconciliation_notes'])
 changed+=1
print('BM REFERENCES REPAIRED',changed,flush=True)
report=data['report']; report.update(items=len(data['items']),reconciliation=dict(collections.Counter(i['reconciliation_status'] for i in data['items'])),analysis=dict(collections.Counter(i['analysis_status'] for i in data['items'])))
args.inventory.write_text(json.dumps(data,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True),flush=True)
