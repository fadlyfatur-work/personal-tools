import pathlib,json,shutil,hashlib,argparse
parser=argparse.ArgumentParser(); parser.add_argument('--corpus',type=pathlib.Path,required=True); parser.add_argument('--output',type=pathlib.Path,required=True); args=parser.parse_args()
root=args.corpus
import pymupdf
output=args.output; output.mkdir(parents=True,exist_ok=True)
manifest=[]
for sid in ['10892','10894','10897','10899','10901','10903','10904','10906','permen08-2023']:
 source=root/('2023pmpupr8.pdf' if sid=='permen08-2023' else f'{sid}.pdf'); doc=pymupdf.open(source); digest=hashlib.sha256(source.read_bytes()).hexdigest()
 ranges=[(0,len(doc)-1)] if source.stat().st_size<45*1024*1024 else [(i,min(i+799,len(doc)-1)) for i in range(0,len(doc),800)]
 for start,end in ranges:
  name=f'{sid}-{start+1}-{end+1}.pdf'; dest=output/name
  if not dest.exists():
   if len(ranges)==1: shutil.copyfile(source,dest)
   else:
    part=pymupdf.open(); part.insert_pdf(doc,from_page=start,to_page=end); part.save(dest,garbage=4,deflate=True)
  manifest.append({'source_id':sid,'source_sha256':digest,'page_start':start+1,'page_end':end+1,'file':name})
  print(name,dest.stat().st_size,flush=True)
(output/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
