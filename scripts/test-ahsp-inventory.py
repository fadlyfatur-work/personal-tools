import pathlib,runpy,unittest
m=runpy.run_path(str(pathlib.Path(__file__).with_name('ahsp-inventory.py')))
class Table:
 def __init__(self,rows): self.rows=rows; self.bbox=(0,0,100,100)
 def extract(self): return self.rows
class InventoryTest(unittest.TestCase):
 def test_native_bm_payment_code_mapping(self):
  resolver=runpy.run_path(str(pathlib.Path(__file__).with_name('ahsp-bm-pages.py')))['analysis_pages']
  class Page:
   def __init__(self,text): self.text=text
   def get_text(self,sort=True): return self.text
  doc=[Page('') for _ in range(34)]
  doc[3]=Page('B.1 2.1.(1) Daftar isi')
  doc[30]=Page('B.1 Galian (2.1.(1))\nASUMSI')
  doc[31]=Page('A. TENAGA\n1. Pekerja L01 Jam 1 1 1')
  doc[32]=Page('Akhir tabel\nB.2 Batu (2.2.(1))')
  mapped=resolver(doc)
  self.assertEqual(mapped['2.1.(1)'][:2],(31,33))
  self.assertIn('Akhir tabel',mapped['2.1.(1)'][2])
  doc[33]=Page('B.2 Batu varian lain (2.2.(1))')
  self.assertNotIn('2.2.(1)',resolver(doc))
 def test_output_basis(self):
  self.assertEqual(m['quantity']('Pemasangan 10 m3 beton','m3'),10)
  self.assertEqual(m['quantity']('Pengecoran pakai pompa T = 50 m','m3'),1)
  self.assertEqual(m['quantity']("Per-m' penetrasi turap panjang 4 m'","m'"),1)
  self.assertEqual(m['quantity']('Pemasangan 1 titik lampu tiang 9 m','titik'),1)
 def test_unreadable_resource_name(self):
  rows=[['No','Uraian','Kode','Satuan','Koefisien'],['A','Tenaga Kerja','','',''],['1','Pekerja','L.01','OH','0,2'],['B','Bahan','','',''],['1','','M.01','kg','1'],['C','Peralatan','','',''],['F','Harga Satuan Pekerjaan (D+E)','','','']]
  self.assertEqual(m['component_table'](Table(rows))['status'],'needs_review')
  rows[4][1]='Semen'
  self.assertEqual(m['component_table'](Table(rows))['status'],'extracted')
 def test_merged_section_heading(self):
  rows=[['No','Uraian','Kode','Satuan','Koefisien'],['A','Tenaga Kerja','','',''],['1','Pekerja','L.01','OH','0,2'],['B\n1','Bahan *)\nPC: Portland Cement','','Buah','1'],['C\n1','Peralatan\nExcavator','E.01','Jam','0,5'],['F','Harga Satuan Pekerjaan (D+E)','','','']]
  result=m['component_table'](Table(rows))
  self.assertEqual([c['group'] for c in result['components']],['tenaga','bahan','alat'])
  self.assertEqual(result['components'][1]['name'],'PC: Portland Cement')
  self.assertEqual(result['components'][1]['unit'],'Buah')
  self.assertEqual(result['components'][2]['name'],'Excavator')
 def test_merged_resources_are_not_one_component(self):
  rows=[['No','Uraian','Kode','Satuan','Koefisien'],['A','Tenaga Kerja','','',''],['1','Pekerja','L.01','OH','0,2'],['B 1 2','Bahan Semen Pasir','M.01 M.02','kg m3','1 2'],['C','Peralatan','','',''],['F','Harga Satuan Pekerjaan (D+E)','','','']]
  result=m['component_table'](Table(rows))
  self.assertEqual(result['status'],'needs_review')
  self.assertEqual(len(result['components']),1)
 def test_non_labor_unit_not_imported_as_labor(self):
  rows=[['No','Uraian','Kode','Satuan','Koefisien'],['A','Tenaga Kerja','','',''],['1','Pekerja','L.01','OH','0,2'],['2','Base camp','','m2','12']]
  result=m['component_table'](Table(rows))
  self.assertEqual(result['status'],'needs_review')
  self.assertEqual(len(result['components']),1)
if __name__=='__main__': unittest.main()
