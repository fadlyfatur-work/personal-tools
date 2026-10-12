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
# Match unresolved BM codes to the visible native item headings. Do not invent scanned coefficients.
doc=pymupdf.open(root/'10903.pdf')
targets=[i for i in data['items'] if i['field']=='Bina Marga' and i['source_id'] is None and i['code']]
matches=collections.defaultdict(list); headings=[]
for pi,page in enumerate(doc):
 if pi<30: continue
 hs=m['headings'](page,'Bina Marga')
 for h in hs:
  headings.append(pi)
  for item in targets:
   if re.search(r'(?<![\d.])'+re.escape(ck(item['code']))+r'\)?(?:$|[^a-z\d.])',ck(h['text'])):
    matches[item['id']].append(pi)
for item in targets:
 found=matches[item['id']]
 if len(found)!=1: continue
 pi=found[0]; next_page=min((p for p in headings if p>pi),default=pi+3); end=min(next_page-1,pi+5,len(doc)-1)
 item.update(source_id='10903',page_from=pi+1,page_to=end+1,source_text='\n\n'.join(f'Halaman PDF {p+1}\n'+doc[p].get_text(sort=True) for p in range(pi,end+1)),reconciliation_status='perlu_ditinjau',reconciliation_notes=['Kode ditemukan pada judul analisis Bina Marga. Satuan dan komponen pada gambar belum diekstrak; data nama dan satuan masih berasal dari master.'])
 for row in item['master_rows']: raw[row].update(status='perlu_ditinjau',notes=item['reconciliation_notes'])
print('BM REFERENCES',sum(bool(matches[i['id']]) for i in targets),flush=True)
report=data['report']; report.update(items=len(data['items']),reconciliation=dict(collections.Counter(i['reconciliation_status'] for i in data['items'])),analysis=dict(collections.Counter(i['analysis_status'] for i in data['items'])))
args.inventory.write_text(json.dumps(data,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True),flush=True)
