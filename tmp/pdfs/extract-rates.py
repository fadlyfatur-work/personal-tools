import json, re
from pathlib import Path

text = Path('tmp/pdfs/pmk32.txt').read_text(encoding='utf-8')
pages = {int(p.split(' ===')[0]): p.split(' ===', 1)[1] for p in text.split('=== PAGE ')[1:]}
def money(s): return int(s.replace('.', ''))
def rows(page, unit, count):
    pattern = r'^\s*(\d+)\.\s+(.+?)\s+' + unit + r'\s+' + r'\s+'.join([r'Rp([\d.]+)'] * count)
    return re.findall(pattern, pages[page], re.M)
daily, hotels, transfers = rows(15, 'OH', 3), rows(19, 'OH', 4), rows(85, 'Orang/Kali', 1)
assert (len(daily), len(hotels), len(transfers)) == (38, 38, 34)
aliases = {'R I A U':'Riau', 'J A M B I':'Jambi', 'B A N T E N':'Banten', 'B A L I':'Bali', 'P A P U A':'Papua', 'D.K.I. JAKARTA':'DKI Jakarta', 'D.I. YOGYAKARTA':'DI Yogyakarta'}
provinces = []
for d, h in zip(daily, hotels):
    assert d[0] == h[0]
    name = re.sub(r'\s+', ' ', d[1]).strip()
    i = int(d[0])
    provinces.append({'name': aliases.get(name, name.title()), 'daily':list(map(money,d[2:])), 'hotel':list(map(money,h[2:])), 'transfer':money(transfers[i-1][2]) if i <= 34 else None})
# Preserve the city labels and direction printed in the source; no inferred routes.
flights = []
for p in range(86,91):
    for line in pages[p].splitlines():
        m = re.match(r'^\s*\d+\.?\s+(.+?)\s+Rp([\d.]+)\s+Rp([\d.]+)', line)
        if not m: continue
        pair = re.split(r'\s{2,}', m[1].strip())
        assert len(pair) == 2, (p,line,pair)
        flights.append({'from':pair[0].title(), 'to':pair[1].title(), 'business':money(m[2]), 'economy':money(m[3]), 'page':p})
assert len(flights) == 316
out = Path('lib/nominatif'); out.mkdir(parents=True,exist_ok=True)
(out/'pmk-32-2025.json').write_text(json.dumps({'provinces':provinces, 'flights':flights}, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
print(f'{len(provinces)} provinces, {len(flights)} flight routes extracted')
