import type { Role } from '@/lib/pos/model'

export const pageNames = {
  pos: 'Transaksi Baru', dashboard: 'Dashboard', transactions: 'Riwayat Transaksi', shift: 'Shift Kasir',
  products: 'Produk', categories: 'Kategori', inventory: 'Inventory', movements: 'Pergerakan Stok',
  opname: 'Stock Opname', approvals: 'Persetujuan', users: 'Pengguna & Role', reports: 'Laporan',
  cashiers: 'Performa Kasir', system: 'Penyimpanan Browser', audit: 'Aktivitas Lokal',
  integrations: 'Simulasi Integrasi', webhooks: 'Webhook Monitor', jobs: 'Failed Jobs', settings: 'Pengaturan Toko',
} as const
export type Page = keyof typeof pageNames
export const rolePages: Record<Role, Page[]> = {
  Kasir: ['pos', 'transactions', 'shift'],
  Supervisor: ['dashboard', 'transactions', 'shift', 'opname', 'approvals'],
  'Staff Gudang': ['inventory', 'movements', 'opname'],
  Admin: ['dashboard', 'products', 'categories', 'inventory', 'transactions', 'users', 'reports', 'settings'],
  Owner: ['dashboard', 'reports', 'products', 'categories', 'inventory', 'transactions', 'users', 'cashiers', 'settings'],
  'Super Admin': ['system', 'audit', 'integrations', 'webhooks', 'jobs', 'users', 'settings'],
}
export const subtitles: Record<Page, string> = {
  pos: 'Pilih produk dan selesaikan pembayaran pelanggan.', dashboard: 'Ringkasan penjualan dan kondisi stok dari data browser ini.',
  transactions: 'Telusuri transaksi dan unduh ulang struk PDF.', shift: 'Kelola modal awal dan cocokkan uang kas saat menutup shift.',
  products: 'Kelola katalog, harga, gambar, dan status penjualan.', categories: 'Kelompokkan produk agar mudah ditemukan di kasir.',
  inventory: 'Pantau stok yang sama dengan katalog kasir.', movements: 'Lihat perubahan stok dari penjualan dan penyesuaian lokal.',
  opname: 'Hitung stok fisik dan ajukan hasilnya untuk persetujuan.', approvals: 'Tinjau selisih stok sebelum mengubah persediaan.',
  users: 'Peragakan pengelolaan identitas dan peran pengguna contoh.', reports: 'Laporan dihitung dari transaksi yang tersimpan di browser.',
  cashiers: 'Bandingkan penjualan berdasarkan nama kasir pada transaksi.', system: 'Periksa data dan kapasitas yang dipakai demo lokal.',
  audit: 'Jejak tindakan yang dilakukan pada demo di browser ini.', integrations: 'Pelajari bagian integrasi yang dapat disiapkan saat penerapan.',
  webhooks: 'Contoh permukaan pemantauan event provider.', jobs: 'Contoh permukaan pemantauan pekerjaan sistem.',
  settings: 'Sesuaikan identitas toko pada struk transaksi berikutnya.',
}
