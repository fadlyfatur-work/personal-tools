"""Import the supplied OOXML without reserializing its layout or drawing parts."""
import base64
import io
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

source = zipfile.ZipFile(sys.argv[1])
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings = [''.join(s.itertext()) for s in ET.fromstring(source.read('xl/sharedStrings.xml'))]
sheet_names = [s.attrib['name'] for s in ET.fromstring(source.read('xl/workbook.xml')).find('s:sheets', ns)][:10]
clear = {
    4: {'C3', 'C4', 'B8', 'B9', 'U21', 'V21', 'W21'},
    5: {'D5', 'B9', 'K18', 'M18'},
    6: {'U12', 'V47', 'AH55', 'V62', 'V63'},
    7: {'N16', 'N41', 'O42', 'AA27', 'Y66'},
    8: {'G7', 'G8', 'G9', 'B30'},
    9: {'O10'},
    10: {'D27', 'D28', 'H28', 'G42'},
}

def clean_sheet(index):
    xml = source.read(f'xl/worksheets/sheet{index}.xml').decode()
    def cell(match):
        raw = match[0]
        ref = re.search(r'\br="([A-Z]+)(\d+)"', raw)
        col, row = ref[1], int(ref[2])
        attrs = raw.split('>')[0].rstrip('/')
        attrs = re.sub(r' t="[^"]*"', '', attrs)
        blank = (index == 3 and row > 2) or ref[1] + ref[2] in clear.get(index, set()) or '<f' in raw or ' t="e"' in raw
        blank |= index == 4 and (row > 30 or len(col) > 1 and col > 'X')
        blank |= index == 5 and (row > 25 or len(col) > 1 or col > 'N')
        blank |= index == 7 and (row > 94 or len(col) > 1 and col > 'AL')
        blank |= index == 8 and (row > 67 or len(col) > 1 or col > 'P')
        blank |= index == 9 and (len(col) > 1 and col > 'AA')
        blank |= index == 10 and row > 51
        if blank:
            return attrs + '/>'
        if ' t="s"' in raw:
            value = re.search(r'<v>(\d+)</v>', raw)
            return attrs + ' t="inlineStr"><is><t xml:space="preserve">' + escape(strings[int(value[1])]) + '</t></is></c>'
        return raw
    xml = re.sub(r'<c\b[^>]*?(?:/>|>.*?</c>)', cell, xml, flags=re.S)
    # Old validation lists depend on private personnel databases and external workbooks.
    xml = re.sub(r'<dataValidations\b.*?</dataValidations>|<autoFilter\b[^>]*/>', '', xml, flags=re.S)
    return xml

parts = {f'xl/worksheets/sheet{i}.xml': clean_sheet(i).encode() for i in range(1, 11)}
parts['xl/styles.xml'] = source.read('xl/styles.xml')
parts['xl/theme/theme1.xml'] = source.read('xl/theme/theme1.xml')
queue = list(parts)
while queue:
    part = queue.pop()
    relpath = posixpath.join(posixpath.dirname(part), '_rels', posixpath.basename(part) + '.rels')
    if relpath not in source.namelist() or relpath in parts:
        continue
    xml = source.read(relpath).decode()
    # Comments contain source authors and are outside the printed template.
    xml = re.sub(r'<Relationship\b[^>]*(?:/comments"|/hyperlink")[^>]*/>', '', xml)
    parts[relpath] = xml.encode()
    for rel in ET.fromstring(xml):
        if rel.attrib.get('TargetMode') == 'External':
            raise ValueError('Unexpected external drawing dependency')
        target = posixpath.normpath(posixpath.join(posixpath.dirname(part), rel.attrib['Target']))
        if target not in parts:
            content = source.read(target)
            if target.endswith(('.xml', '.vml')):
                content = re.sub(rb' fmla(?:Link|Range)="[^"]*"', b'', content)
                content = re.sub(rb'<(?:x:)?Fmla(?:Link|Range)>.*?</(?:x:)?Fmla(?:Link|Range)>', b'', content, flags=re.S)
            parts[target] = content
            queue.append(target)

wb = source.read('xl/workbook.xml').decode()
wb = re.sub(r'<sheets>.*?</sheets>', '<sheets>' + ''.join(re.findall(r'<sheet\b[^>]*/>', wb)[:10]) + '</sheets>', wb, flags=re.S)
names = []
for match in re.finditer(r'<definedName\b[^>]*>.*?</definedName>', wb, re.S):
    if 'name="_xlnm.Print_' in match[0] and int(re.search(r'localSheetId="(\d+)"', match[0])[1]) < 10:
        names.append(match[0])
wb = re.sub(r'<definedNames>.*?</definedNames>', '<definedNames>' + ''.join(names) + '</definedNames>', wb, flags=re.S)
wb = re.sub(r'<externalReferences>.*?</externalReferences>', '', wb, flags=re.S)
wb = re.sub(r'activeTab="\d+"', 'activeTab="2"', wb)
parts['xl/workbook.xml'] = wb.encode()
wbr = source.read('xl/_rels/workbook.xml.rels').decode()
wbr = re.sub(r'<Relationship\b[^>]*/>', lambda m: m[0] if re.search(r'Target="(?:worksheets/sheet(?:[1-9]|10)\.xml|styles\.xml|theme/theme1\.xml)"', m[0]) else '', wbr)
parts['xl/_rels/workbook.xml.rels'] = wbr.encode()
parts['_rels/.rels'] = b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
ct = source.read('[Content_Types].xml').decode()
ct = re.sub(r'<Override\b[^>]*/>', lambda m: m[0] if re.search(r'PartName="/([^"]+)"', m[0])[1] in parts else '', ct)
parts['[Content_Types].xml'] = ct.encode()
out = io.BytesIO()
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as target:
    for name, value in parts.items():
        target.writestr(name, value)
Path('lib/nominatif/template-original.json').write_text(json.dumps({'archive': base64.b64encode(out.getvalue()).decode(), 'sheetNames': sheet_names}), encoding='utf-8')
print(f'Imported {len(parts)} original parts; cleared source personnel, formulas, comments, and external links.')
