import pathlib,runpy,unittest
m=runpy.run_path(str(pathlib.Path(__file__).with_name('ahsp-inventory.py')))
class Table:
 def __init__(self,rows): self.rows=rows; self.bbox=(0,0,100,100)
 def extract(self): return self.rows
class InventoryTest(unittest.TestCase):
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
if __name__=='__main__': unittest.main()
