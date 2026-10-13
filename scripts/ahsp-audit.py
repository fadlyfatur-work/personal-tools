import argparse,collections,json,pathlib,runpy
import pymupdf
parser=argparse.ArgumentParser(); parser.add_argument('--corpus',type=pathlib.Path,required=True); parser.add_argument('--inventory',type=pathlib.Path,required=True); args=parser.parse_args()
m=runpy.run_path(str(pathlib.Path(__file__).with_name('ahsp-inventory.py')))
data=json.loads(args.inventory.read_text(encoding='utf-8')); docs={}; cache={}; changed=[]
def signature(components): return [(c['group'],m['clean'](c['name']),m['clean'](c['unit']),c['coefficient'],c['expression']) for c in components]
for index,item in enumerate(data['items']):
 if item['analysis_status']!='extracted' or item['source_id'] not in ('10901','10904'): continue
 sid=item['source_id']; page=item['page_from']; key=(sid,page)
 if key not in cache:
  if sid not in docs: docs[sid]=pymupdf.open(args.corpus/f'{sid}.pdf')
  cache[key]=[t for table in docs[sid][page-1].find_tables().tables if (t:=m['component_table'](table))]
 matches=[t for t in cache[key] if signature(t['components'])==signature(item['components'])]
 if not matches or any(t['status']!='extracted' for t in matches):
  item['analysis_status']='needs_review'; item['reconciliation_notes'].append('Pemeriksaan ulang struktur tabel belum memastikan seluruh baris komponen terbaca.'); changed.append(item['id'])
 if len(cache)%100==0: print('AUDIT',len(cache),len(changed),flush=True)
data['report']['analysis']=dict(collections.Counter(i['analysis_status'] for i in data['items']))
args.inventory.write_text(json.dumps(data,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps({'pages_checked':len(cache),'downgraded':len(changed),'analysis':data['report']['analysis']}),flush=True)
