import pathlib,json,re,runpy,collections,hashlib,datetime,argparse
parser=argparse.ArgumentParser(); parser.add_argument('--corpus',type=pathlib.Path,required=True); parser.add_argument('--inventory',type=pathlib.Path,required=True); args=parser.parse_args()
root=args.corpus
import pymupdf
m=runpy.run_path(str(pathlib.Path(__file__).with_name('ahsp-inventory.py')))
clean,ck,uk,nk=m['clean'],m['codekey'],m['unitkey'],m['namekey']
data=json.loads(args.inventory.read_text(encoding='utf-8'))
removed=[i for i in data['items'] if m['token'](i['code'])=='kode']

data['items']=[i for i in data['items'] if m['token'](i['code'])!='kode' and i['regulation']=='SE 47/2026']
data['sources']=[s for s in data['sources'] if s['id']!='permen08-2023']
data['master_rows']=[r for r in data['master_rows'] if r['regulation']=='SE 47/2026' or (r['regulation']=='PERMEN 08/2023' and r['raw']['job_field_name']=='Umum')]
for i in data['items']:
 if i['source_id'] is None and i['field'] in m['DIVISIONS']: i['division']=m['divisions'](i['field'],i['code']) or i['division']

sid='permen08-2023'; path=root/'2023pmpupr8.pdf'; doc=pymupdf.open(path)
data['sources'].append({'id':sid,'title':'Permen PUPR 8/2023 - bidang Umum dan pedoman dasar','annex':'Pedoman dasar','url':'https://jdih.pu.go.id/internal/produk_hukum/download/PermenPUPR/2023/08/2023pmpupr8.pdf','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'page_count':len(doc),'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'regulation':'PERMEN 08/2023','assets':[]})
toc='\n'.join(doc[p].get_text(sort=True) for p in range(132,139))
entries=[]
toc=re.sub(r'^\s*-\d+-\s*$','',toc,flags=re.M)
for match in re.finditer(r'^\s*(U\.[\d.a-z]+(?:\s*\([abc]\))?)\s+(.+?)(?=^\s*U\.|\Z)',toc,re.S|re.I|re.M):
 code,body=match.groups()
 if not re.search(r'\([abc]\)$',code,re.I): continue
 printed=re.search(r'(\d+)\s*$',body)
 if not printed: continue
 title=re.sub(r'\.{2,}\s*$','',body[:printed.start()]).strip()
 entries.append({'code':clean(code),'name':clean(title),'printed':int(printed[1]),'page':int(printed[1])+14})
bycode=collections.defaultdict(list); bypage=collections.defaultdict(list)
for e in entries: bycode[ck(e['code'])].append(e); bypage[e['page']].append(e)
tablecache={}
for row in data['master_rows']:
 if row['regulation']!='PERMEN 08/2023': continue
 matches=bycode[ck(row['code'])]
 page=None; title=row['name']; components=[]; status='unavailable'; notes=[]; rec='belum_ditemukan'; unit=row['unit']; basis=1
 if len(matches)==1 and 1<=matches[0]['page']<=len(doc):
  e=matches[0]; page=e['page']; title=e['name']; rec='cocok' if nk(title)==nk(row['name']) else 'berbeda'
  if rec=='berbeda': notes.append('Nama master berbeda dari judul daftar isi: '+row['name'])
  if page not in tablecache: tablecache[page]=[c for t in doc[page-1].find_tables().tables if (c:=m['component_table'](t))]
  tables=tablecache[page]; siblings=bypage[page]
  if len(tables)==len(siblings):
   table=tables[siblings.index(e)]; components=table['components']; status=table['status']
  else: notes.append('Jumlah tabel tidak sama dengan jumlah judul pada halaman; pemetaan komponen memerlukan tinjauan.')
  qty=re.search(r'\b(\d+(?:[.,]\d+)?)\s*(m[²³23\u2019\']?|kg|buah|unit|batang)(?!\w)',title,re.I)
  if qty and not re.search(r'(panjang|tinggi|diameter|kedalaman|jarak|ukuran)\s*$',title[max(0,qty.start()-25):qty.start()],re.I) and uk(qty[2])==uk(row['unit']): basis=m['numeric'](qty[1]); unit=qty[2].replace('²','2').replace('³','3').replace('’',"'")
  else: status='needs_review' if components else 'unavailable'; notes.append('Basis satuan belum terbaca pada judul; satuan tampilan berasal dari master.')
  if uk(unit)!=uk(row['unit']): rec='berbeda'; notes.append(f"Satuan master {row['unit']}; satuan judul {unit}.")
 else: notes.append('Kode belum berhasil dipetakan ke daftar isi Permen; nama dan satuan berasal dari master.')
 text=f'Halaman PDF {page}\n'+doc[page-1].get_text(sort=True) if page else ''
 overhead=re.search(r'(\d+)\s*%\s*[-–]\s*(\d+)\s*%',text)
 item={'id':m['identity']('PERMEN 08/2023','Umum',ck(row['code'])),'code':row['code'],'name':title,'unit':unit,'field':'Umum','division':'','regulation':'PERMEN 08/2023','ahsp_type':'','regulation_status':'','source_id':sid,'page_from':page,'page_to':page,'printed_page':str(matches[0]['printed']) if len(matches)==1 else '', 'analysis_status':status,'components':components,'source_text':text,'overhead_min':float(overhead[1]) if overhead else None,'overhead_max':float(overhead[2]) if overhead else None,'output_quantity':basis,'reconciliation_status':rec,'reconciliation_notes':notes,'master_rows':[row['row_number']]}
 existing=next((i for i in data['items'] if i['id']==item['id']),None)
 if existing:
  existing['master_rows'].append(row['row_number']); existing['reconciliation_status']='perlu_ditinjau'
  existing['reconciliation_notes'].append('Kode Umum berulang dalam master; semua baris asal dipertahankan.')
  rec='perlu_ditinjau'
  for prior in data['master_rows']:
   if prior['row_number'] in existing['master_rows']: prior.update(status=rec,notes=existing['reconciliation_notes'])
 else: data['items'].append(item)
 row.update(item_id=item['id'],status=rec,notes=existing['reconciliation_notes'] if existing else notes)
print('UMUM',len(entries),collections.Counter(i['analysis_status'] for i in data['items'] if i['field']=='Umum'),flush=True)

# The current SMKK cost list has native codes and units in BM appendix A.7.
# Read the item and unit columns; prices and quantities printed there are examples.
bm=pymupdf.open(root/'10903.pdf'); smkk={ck(i['code']):i for i in data['items'] if i['field']=='SMKK'}
for pi in range(39,46):
 page=bm[pi]; words=page.get_text('words'); text=page.get_text(sort=True)
 for table in page.find_tables().tables:
  header=table.extract()[0]
  namecol=next((i for i,c in enumerate(header) if m['token'](c)=='uraian'),None)
  unitcol=next((i for i,c in enumerate(header) if m['token'](c)=='satuan'),None)
  if namecol is None or unitcol is None: continue
  nc=table.rows[0].cells[namecol]; uc=table.rows[0].cells[unitcol]
  codes=sorted([w for w in words if ck(w[4]) in smkk and table.bbox[1]<w[1]<table.bbox[3]],key=lambda w:w[1])
  for pos,w in enumerate(codes):
   item=smkk[ck(w[4])]; cy=(w[1]+w[3])/2
   units=[u for u in words if uc[0]<=u[0]<=uc[2] and abs((u[1]+u[3])/2-cy)<8]
   if not units: continue
   unit=clean(' '.join(u[4] for u in sorted(units,key=lambda u:u[0])))
   bands=[r.bbox for r in table.rows[1:] if r.bbox[0]>nc[0] and r.bbox[1]<=cy<=r.bbox[3]]
   allcodes=[u for u in words if re.fullmatch(r'1\.22\.\([^)]*\)',u[4]) and u[1]>w[1]+1]
   nexttop=min((u[1] for u in allcodes),default=table.bbox[3])
   band=min(bands,key=lambda b:b[3]-b[1]) if bands else (0,w[1]-.5,0,nexttop-.5)
   top=max(w[1]-.5,band[1]); bottom=min(nexttop-.5,band[3])
   namewords=[u for u in words if nc[0]<=u[0]<=nc[2] and top<=(u[1]+u[3])/2<=bottom]
   name=clean(' '.join(u[4] for u in sorted(namewords,key=lambda u:(round(u[1]/3),u[0]))))
   original=next(r['raw'] for r in data['master_rows'] if r['row_number'] in item['master_rows'])
   notes=[]; status='cocok'
   if nk(name)!=nk(original['name']): status='berbeda'; notes.append('Nama master: '+original['name'])
   if uk(unit)!=uk(original['unit']): status='berbeda'; notes.append('Satuan master: '+original['unit'])
   if not name: continue
   component={'id':'smkk','group':'smkk','name':name,'code':item['code'],'unit':unit,'coefficient':1,'expression':'Kuantitas biaya × harga per unit','sourceLine':'Satu unit biaya SMKK; jumlah proyek diisi pada volume. Harga contoh PDF tidak dipakai.'}
   item.update(name=name,unit=unit,source_id='10903',page_from=pi+1,page_to=pi+1,source_text=f'Halaman PDF {pi+1}\n'+text,components=[component],analysis_status='extracted',ahsp_type='Informatif',overhead_min=0,overhead_max=0,output_quantity=1,reconciliation_status=status,reconciliation_notes=notes+['Biaya SMKK dihitung berdasarkan kuantitas dan harga per unit. Kuantitas serta harga contoh lampiran tidak diimpor sebagai harga proyek.'])
   for row in data['master_rows']:
    if row['row_number'] in item['master_rows']: row.update(status=status,notes=notes)
print('SMKK',collections.Counter(i['analysis_status'] for i in data['items'] if i['field']=='SMKK'),flush=True)

data['report'].update(items=len(data['items']),master_rows=len(data['master_rows']),current_master_rows=len(data['master_rows']),reconciliation=dict(collections.Counter(i['reconciliation_status'] for i in data['items'])),analysis=dict(collections.Counter(i['analysis_status'] for i in data['items'])),fields=dict(collections.Counter(i['field'] for i in data['items'])))
args.inventory.write_text(json.dumps(data,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(data['report'],ensure_ascii=True),flush=True)
