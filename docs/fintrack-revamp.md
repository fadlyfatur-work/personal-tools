# FinTrack revamp

Arah yang disetujui adalah aplikasi keuangan pribadi berbahasa Indonesia dengan tampilan mobile pada semua ukuran viewport, dengan Ocean sebagai palet awal. Forest, Earth, dan pilihan mode terang/gelap yang tersimpan tetap berlaku. Aturan visual normatif berada di `app/fintrack/DESIGN.md`; dokumen desain root tetap terbatas pada portfolio.

## Implementasi

`app/fintrack/revamp.css` dimuat setelah gaya FinTrack sebelumnya. Kekayaan bersih menjadi fokus dashboard. Kartu dompet menggunakan gradien terbatas dan ikon penyedia lokal. Navigasi mengambang serta padding konten memperhitungkan safe area.

Kanvas terpusat memakai `--ft-mobile-width: 430px` dengan lebar `min(100%, var(--ft-mobile-width))` pada ponsel, tablet, dan desktop. Dashboard tetap satu kolom dan dompet tetap carousel. Navigasi dibatasi 402px dan dialog 430px. Tipografi responsif mengikuti kontainer melalui `cqw`; penyesuaian layar di bawah 360px tetap berlaku. Warna teks dan permukaan berubah bersamaan saat tema diganti; transisi kontrol dibatasi pada transform dan opacity selama 150ms.

Feed dashboard dikelompokkan berdasarkan tanggal Indonesia, dimulai dari lima transaksi dan bertambah lima hingga dua puluh. Tombol tambah menyediakan alternatif untuk pemuatan melalui sentinel; aktivitas lengkap tersedia melalui tautan.

Baris subkategori pada pantauan budget menjadi tautan ke tab Transaksi di Aktivitas dengan periode budget, induk, dan kategori persis dalam query URL. Baris Langsung ke induk memakai kategori induk sebagai filter persis sehingga pengeluaran anak tidak ikut. Kategori tanpa rincian juga dapat diklik. Disclosure induk yang memiliki rincian tetap membuka/menutup daftar. Panel filter tujuan langsung terbuka, menyediakan pilihan Langsung ke induk, dan filter bertahan saat halaman dimuat ulang. Build, lint, tes kategori/aktivitas, serta pemeriksaan Playwright sintetis untuk kedua tautan dan reload lulus.

Aktivitas memakai kalender yang dapat dilipat, filter berbentuk pil, dan pilihan tanggal dalam rentang periode laporan. API laporan menyediakan `calendar_days` untuk rentang cutoff yang sama. Filter tanggal memilih aktivitas satu hari tanpa mengubah batas periode dasar. Laporan mengutamakan donut dan ranking kategori, disusul tren serta perbandingan. Klik grafik atau ranking melakukan drilldown kategori/subkategori dalam laporan; filter yang sama tetap diterapkan saat pengguna berpindah ke Transaksi. Goals dan budget kategori mempertahankan fungsi yang sudah ada.

`provider_code` menghubungkan pilihan bank/e-wallet dengan aset lokal. Katalog meliputi BCA, Mandiri, BRI, BNI, BSI, GoPay, OVO, DANA, dan ShopeePay. `public/fintrack/providers/sources.json` menyimpan situs penyedia, URL sumber, tipe konten, serta path lokal. Sebagian aset berasal dari favicon situs langsung; BRI, BNI, BSI, dan ShopeePay tercatat berasal dari layanan favicon Google. Ini adalah catatan asal aset, bukan klaim verifikasi merek atau lisensi. Penyedia yang tidak dipilih dan gambar gagal memakai ikon jenis dompet.

## Migrasi manual

Sebelum menggunakan penyimpanan penyedia pada database tujuan, terapkan `supabase/migrations/202610130010_fintrack_wallet_provider.sql` secara manual melalui Supabase SQL Editor dalam urutan filename, mengikuti `supabase/README.md`.

Migrasi menambah kolom nullable `provider_code` pada `fintrack_accounts` dan constraint yang membatasi kode sesuai jenis bank atau e-wallet. Dompet lama dapat tetap `null`; pengguna dapat memilih penyedia melalui Kelola. Jangan mengisi penyedia otomatis berdasarkan nama dompet. Tidak ada migration runner dan tidak ada instruksi menghapus schema.

Pekerjaan dokumentasi ini tidak menjalankan SQL dan tidak menulis database produksi. Penerapan migrasi, kompatibilitas schema pada deployment, persistensi penyedia, dan jalur auth/RLS membutuhkan verifikasi pada lingkungan tujuan.

## Batas bukti QA

Audit komponen lanjutan menghilangkan subtotal dari feed Beranda; Aktivitas tetap menampilkannya. Aksi muat ulang memakai tombol ikon 44px dan mempertahankan filter dompet, sedangkan tombol Semua dompet hanya muncul ketika filter aktif. Tautan semua aktivitas berada setelah daftar. Ikon sumber transaksi memakai kotak 20px dengan logo terpusat dan teks dompet terpotong bila terlalu panjang. Pemilih bulan mengisi kolom tengah di antara navigasi 44px; tombol filter laporan memenuhi lebar konten dengan indikator buka/tutup di kanan. Pemeriksaan Playwright sintetis pada 320, 390, 430, dan 1280px meluluskan kesamaan lebar, ikon persegi, pembatalan filter, muat ulang, pilihan filter laporan, serta ketiadaan overflow. Build produksi, TypeScript, dan lint file yang berubah lulus.

QA browser dengan bootstrap atau respons API sintetis hanya dapat menguji rendering dan interaksi terhadap fixture tersebut. Hasil itu tidak membuktikan autentikasi nyata, sinkronisasi Supabase, persistensi provider, izin kolaborasi/RLS, atau perubahan saldo RPC pada produksi. Jangan menyatakan SQL atau database produksi telah diverifikasi berdasarkan screenshot sintetis.

Pass browser sintetis awal yang dilaporkan pelaksana utama memeriksa lebar 320, 390, 768, dan 1280px pada Beranda, Aktivitas, Kelola, Goals, serta Pengaturan tanpa overflow dokumen. Pemeriksaan awal juga mencakup autofill keterangan, batas feed dua puluh transaksi, penyembunyian dompet Goals, pilihan penyedia, serta sheet dengan reduced motion. Ini belum merupakan persetujuan visual akhir; capture stabil yang diperbarui dan review akhir masih diperlukan.

Pemeriksaan lanjutan Playwright pada 14 Oktober 2026 meluluskan 35 kombinasi: lebar 320, 390, 430, 480, 768, 1280, dan 1920px pada lima halaman tersebut. Kanvas mengikuti `min(viewport, 430px)`, navigasi maksimal 402px, dan modal desktop 430px, tanpa overflow dokumen. Ukuran angka utama tetap 32,25px dari viewport 430 hingga 1920px. Navigasi tetap pada posisi bawah layar sebelum dan sesudah scroll. Alur fixture kembali meluluskan feed lima hingga dua puluh transaksi, autofill, kalender tetap terbuka, drilldown yang dipertahankan, pilihan penyedia, dan decoding sembilan aset.

Koreksi terakhir menghapus interpolasi warna pada kontrol dan tautan navigasi saat pergantian tema. Capture pergantian langsung setelah build produksi menunjukkan navigasi aktif dengan latar `rgb(36,61,76)` dan teks `rgb(130,178,255)`; transisi yang tersisa hanya transform dan opacity. Build produksi dan TypeScript lulus. Bukti ini tetap memakai data simulasi dan tidak memverifikasi database tujuan.

Dokumen ini mencatat struktur yang diperiksa dari source dan laporan pass awal tersebut. Status build, lint, tes, serta skenario browser lain harus dilaporkan dari output pelaksanaan aktual. Penulisan dokumen ini tidak menjalankan browser atau SQL.
