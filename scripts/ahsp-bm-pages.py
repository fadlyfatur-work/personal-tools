"""Resolve native Bina Marga analysis headings; no OCR and no workbook-derived data."""
import argparse, collections, hashlib, json, pathlib, re, unicodedata
import pymupdf


def analysis_pages(doc):
    pages = [page.get_text(sort=True) for page in doc]
    starts, found = [], collections.defaultdict(list)
    for page, text in enumerate(pages):
        for line in text.splitlines():
            line = unicodedata.normalize('NFKC', line).strip()
            if page < 30 or not re.match(r'^[A-J]\.\d+\s+', line):
                continue
            starts.append(page)
            match = re.search(r'\((\d+\.\d+\.\([\w]+\))\)\s*$', line)
            if match:
                found[match[1].lower()].append(page)
    result = {}
    for code, hits in found.items():
        if len(hits) != 1:
            continue
        start = hits[0]
        # Include the next heading's page: its preceding lines can finish this table.
        end = min((page for page in starts if page > start), default=len(pages)-1)
        result[code] = (start+1, end+1, '\n\n'.join(f'Halaman PDF {p+1}\n{pages[p]}' for p in range(start, end+1)))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', type=pathlib.Path, required=True)
    parser.add_argument('--items', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    doc = pymupdf.open(args.pdf)
    index = analysis_pages(doc)
    snapshot = json.loads(args.items.read_text(encoding='utf-8'))
    items = snapshot.get('items', []) if isinstance(snapshot, dict) else [entry.get('item', entry) for entry in snapshot]
    patches = []
    for item in items:
        if item['field'] != 'Bina Marga' or item['regulation'] != 'SE 47/2026' or item['components'] or item.get('analysis_target_id'):
            continue
        code = item['code'].replace(' ', '').lower()
        match = index.get(code)
        heading = re.compile(r'^\s*[A-J]\.\d+\s+.*\(' + re.escape(code) + r'\)\s*$', re.I | re.M)
        if not match or heading.search(item['source_text']):
            continue
        start, end, text = match
        printed = re.search(r'^\s*-\s*(\d+)\s*-\s*$', text, re.M)
        patches.append({'before': item, 'after': {'source_id': '10903', 'page_from': start, 'page_to': end, 'printed_page': printed[1] if printed else '', 'source_text': text}})
    args.output.write_text(json.dumps({'source_id': '10903', 'sha256': hashlib.sha256(args.pdf.read_bytes()).hexdigest(), 'patches': patches}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps([{'code': p['before']['code'], 'before': p['before']['page_from'], 'after': [p['after']['page_from'], p['after']['page_to']]} for p in patches]))
