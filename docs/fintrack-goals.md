# Goals FinTrack

Halaman `/fintrack/goals` dibuka melalui tombol **Tujuan** di navigasi bawah.

Navigasi bawah: Beranda, Aktivitas, Catat, Tujuan, Kelola. Setelan dibuka melalui tombol profil di kanan atas. Aksi keluar tersedia pada bagian Akun di halaman Setelan.

## Aktivasi database

Jalankan `supabase/migrations/202610040001_fintrack_goals.sql` melalui Supabase SQL Editor, setelah semua migrasi sebelumnya. Migrasi ini menambahkan tabel tujuan, item kebutuhan, agregasi realisasi, dan RPC. Tidak ada perubahan saldo pada dompet lama.

Sebelum migrasi diterapkan, halaman menampilkan pesan bahwa Goals belum tersedia. Halaman FinTrack lain tetap memakai RPC transaksi lama jika tidak ada kaitan item.

## Perilaku

- Membuat tujuan sekaligus membuat dompet dengan saldo nol secara atomik. Dana dimasukkan melalui transfer dari dompet lain.
- Target, ikon, tenggat opsional, serta estimasi per item dapat diubah. Jumlah estimasi item tidak otomatis mengubah target.
- Progres = saldo dompet + seluruh pengeluaran berstatus `posted` dari dompet itu. Pengeluaran tanpa item juga dihitung. Agregasi berasal dari seluruh riwayat, bukan batas 60 transaksi bootstrap.
- Transfer keluar mengurangi progres. Transfer masuk tidak menambah pengeluaran dalam laporan. Belanja dari dompet tujuan masuk ke laporan pengeluaran biasa.
- Pengeluaran bisa dikaitkan ke item melalui formulir transaksi. RPC memastikan item milik pengguna dan cocok dengan dompet asal, lalu menyimpan kaitan dan perubahan saldo dalam satu transaksi database.
- Mengedit transaksi membatalkan transaksi lama lalu membuat pengganti sesuai mekanisme FinTrack. Transaksi yang dibatalkan tidak ikut realisasi.
- Menghapus item mempertahankan transaksi dan saldo, serta melepas kaitan item. Mengarsipkan tujuan mempertahankan dompet, aset, dan transaksi; tujuan dapat dipulihkan selama dompetnya belum diarsipkan melalui Kelola.
- Tujuan investasi mencatat dana, belum mencatat unit aset atau perubahan harga pasar.
- Goals hanya dikelola oleh pemilik dompet. Kolaborasi goal belum tersedia.

## Pemeriksaan

`node scripts/test-fintrack-goals.mjs`, `npm run typecheck`, `npm run lint`, dan `npm run build`.
