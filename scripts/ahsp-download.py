import argparse, pathlib, urllib.request

parser=argparse.ArgumentParser(); parser.add_argument('directory',type=pathlib.Path); args=parser.parse_args()
args.directory.mkdir(parents=True,exist_ok=True)
for id in ['10892','10894','10897','10899','10901','10903','10904','10906','2023pmpupr8']:
    path=args.directory/f'{id}.pdf'
    if path.exists() and path.read_bytes()[:4]==b'%PDF': continue
    url='https://jdih.pu.go.id/internal/produk_hukum/download/PermenPUPR/2023/08/2023pmpupr8.pdf' if id=='2023pmpupr8' else f'https://binakonstruksi.pu.go.id/?download_id={id}&sdm_process_download=1'
    with urllib.request.urlopen(url,timeout=120) as response:
        blob=response.read()
    if not blob.startswith(b'%PDF'): raise ValueError(f'Expected an official PDF for {id}')
    path.write_bytes(blob)
    print(f'{id}: {len(blob)} bytes')
