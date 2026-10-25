# FinTrack: pemulihan tugas dan pembayaran utang

Tanggal: 25 Oktober 2026. Lingkup: lima koreksi audit UX dan kategori opsional untuk pembayaran utang/paylater.

## Kontrak pengalaman

- Kelola kategori dari formulir transaksi menyimpan draf sementara di provider React, membuka tab Kategori, dan menyediakan Kembali ke transaksi. Nominal, dompet, kategori, catatan, tanggal, item Goals, serta identitas transaksi edit dipertahankan. Draf tidak ditulis ke disk dan tidak bertahan setelah refresh halaman; logout membersihkannya.
- Menutup sheet dengan isian berubah menawarkan Lanjutkan mengisi/Buang perubahan. Sheet tidak ditutup selama penyimpanan berjalan. Simpan berhasil menutupnya tanpa pertanyaan buang.
- Lihat aktivitas pada Goal membawa account_id; filter Dompet langsung terbuka dan dapat dilepas melalui Semua dompet.
- Login menerjemahkan error callback Google ke pesan aman untuk oauth, identity, dan bootstrap.
- Goals memberi label Total pendanaan dan menjelaskan saldo tersedia + dana yang sudah digunakan. Perhitungan Goals tidak berubah.

## Pembayaran utang/paylater

Di Kelola, buka menu dompet Utang lalu pilih Bayar utang. Pengguna juga dapat memilih Transfer pada composer, dengan dompet aset sebagai asal dan dompet utang sebagai tujuan.

Formulir menyediakan kategori pengeluaran opsional dan pilihan Hitung sebagai pengeluaran. Pada pembayaran baru pilihan ini aktif; pada transaksi lama mengikuti metadata tersimpan. Jika pembelian paylater sudah dicatat sebagai pengeluaran, nonaktifkan agar tidak dihitung dua kali. Ini pilihan basis pencatatan per transaksi, bukan deduplikasi otomatis terhadap pembelian lama.

Ledger tetap memakai type=transfer sehingga RPC lama mengurangi saldo asal dan saldo utang secara atomik. Metadata debt_payment_expense menentukan peran di laporan; total, kategori, tren, kalender, budget, dan feed menganggap pembayaran bertanda ini sebagai pengeluaran. Transfer biasa tetap dikecualikan. Kategori kosong masuk Tanpa kategori.

Jika sumber pembayaran adalah dompet Goals, pembayaran yang dihitung sebagai pengeluaran juga masuk dana terpakai Goals. Rumus total pendanaan tetap saldo tersedia + dana terpakai.

## Rollout database

Jalankan **hanya** `supabase/migrations/202610250001_fintrack_debt_payment_expense.sql` setelah migrasi sebelumnya melalui Supabase SQL Editor. Jangan mengulang reset. Deploy aplikasi setelah migrasi berhasil dan muat ulang klien lama.

Migrasi menambah satu kolom boolean default false dan RPC khusus. Tidak ada backfill dan transaksi lama tidak diklasifikasikan ulang. RPC memanggil mekanisme saldo yang sudah ada, memvalidasi asal aset/tujuan utang dan kategori pengeluaran, lalu menyimpan metadata dalam transaksi database yang sama. Fungsi hanya dapat dipanggil service_role; route tetap memakai identitas FinTrack.

Rollback aplikasi dapat menghentikan pemakaian fitur baru, tetapi versi lama tidak memahami metadata laporan pembayaran; jangan menganggap laporan versi lama setara. Jangan menghapus transaksi atau mengubah saldo untuk rollback UI.

## Verifikasi dan batas bukti

Tes Node mencakup UX helper, routing RPC, kategori, total harian/mingguan/bulanan, transfer biasa, Goals, kalender, cache, dan gesture sheet. Browser memakai API simulasi untuk draf-kategori-kembali, lanjut/buang, error OAuth, filter Goals, payload pembayaran berkategori, dan viewport 320/390/768.

Tes tersebut tidak membuktikan penerapan SQL, saldo di Supabase, OAuth nyata, atau akses kolaborasi/RLS pada lingkungan tujuan. SQL belum dijalankan pada database asli.

Hasil pemeriksaan lokal: seluruh sembilan skrip regresi FinTrack yang dijalankan lulus, TypeScript dan lint terkait lulus, serta walkthrough browser sintetis lulus. `npm run build` dengan Turbopack gagal memulai proses CSS (`app/globals.css`, node process exited before connect). Pemeriksaan pembanding `npm run build -- --webpack` berhasil tanpa mengubah konfigurasi build proyek.
