import argparse,collections,hashlib,json,pathlib
import pymupdf
parser=argparse.ArgumentParser(); parser.add_argument('--corpus',type=pathlib.Path,required=True); parser.add_argument('--inventory',type=pathlib.Path,required=True); parser.add_argument('--output',type=pathlib.Path,required=True); args=parser.parse_args()
data=json.loads(args.inventory.read_text(encoding='utf-8')); selected=collections.defaultdict(set)
for source in data['sources']: selected[source['id']].add(1)
for item in data['items']:
 if item['source_id'] and item['page_from']: selected[item['source_id']].update(range(item['page_from'],item['page_to']+1))
args.output.mkdir(parents=True,exist_ok=True); manifest=[]; total=0
for source in data['sources']:
 sid=source['id']; path=args.corpus/('2023pmpupr8.pdf' if sid=='permen08-2023' else f'{sid}.pdf')
 if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']: raise ValueError('Source fingerprint changed')
 doc=pymupdf.open(path); folder=args.output/sid; folder.mkdir(exist_ok=True)
 for page in sorted(selected[sid]):
  dest=folder/f'{page}.jpg'
  if not dest.exists():
   pdfpage=doc[page-1]; scale=1600/pdfpage.rect.width
   pdfpage.get_pixmap(matrix=pymupdf.Matrix(scale,scale),alpha=False).save(str(dest),jpg_quality=82)
  manifest.append({'source_id':sid,'source_sha256':source['sha256'],'page':page,'file':f'{sid}/{page}.jpg'}); total+=1
  if total%100==0: print('Rendered',total,flush=True)
 print('Source',sid,len(selected[sid]),flush=True)
(args.output/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8'); print('TOTAL',total,flush=True)
