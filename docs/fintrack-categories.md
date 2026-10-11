# Kategori dan subkategori FinTrack

Kategori memiliki dua tingkat: induk dan subkategori. Kategori lama tetap menjadi induk tanpa perubahan transaksi.

## Mengaktifkan

Jalankan `supabase/migrations/202610070001_fintrack_subcategories.sql` melalui Supabase SQL Editor setelah migrasi sebelumnya, sebelum menjalankan versi aplikasi ini. Jangan mengulang migration reset. Migration menambahkan kolom dan trigger; tidak menghapus transaksi.

## Budget

- Subkategori memiliki target pengeluaran per periode masing-masing.
- Induk dapat memakai target sendiri (`fixed`) atau jumlah budget subkategori aktif (`children`).
- Pada mode target sendiri, total alokasi budget subkategori tidak boleh melebihi target induk. Budget induk juga tidak boleh diturunkan di bawah total alokasi anak.
- Batas berlaku pada target budget, bukan penolakan transaksi. Pengeluaran di atas target tetap dicatat dan ditandai sebagai kelebihan budget.
- Induk tanpa target tetap dapat memiliki subkategori. Pilih mode penjumlahan agar target anak menjadi target induk.
- Budget mengikuti cutoff periode pengguna. Transaksi langsung ke induk ikut dalam pemakaian induk.
- Perubahan kategori dikunci per plan pada trigger database untuk mencegah alokasi bersamaan melewati target.

## Laporan dan pengelolaan

Laporan awal mengelompokkan transaksi ke induk berdasarkan ID, termasuk transaksi subkategori yang telah diarsipkan. Pilih filter induk untuk melihat rincian subkategori dan transaksi langsung. Filter subkategori tersedia setelah memilih induk. Tren mengikuti filter induk; filter subkategori mempersempit rincian kategori dan daftar transaksi.

Daftar kategori disusun alfabetis berdasarkan induk, diikuti anak secara alfabetis. Di Kelola, label anak hanya namanya sendiri. Format `Belanja > Kebutuhan rumah` hanya dipakai dalam modal catat transaksi.

Pantauan budget hanya menampilkan kategori dengan total pengeluaran lebih dari nol dan target budget lebih dari nol, diurutkan berdasarkan persentase pemakaian terbesar. Induk tanpa pemakaian tidak ditampilkan; rincian anak tanpa pemakaian juga disembunyikan. Pantauan budget menampilkan induk dan membuka rincian lewat disclosure native. Total budget dan pemakaian tidak bergantung pada batas sepuluh transaksi yang ditampilkan bootstrap.

Induk dengan anak tidak dapat dipindahkan menjadi anak. Induk dengan anak aktif tidak dapat diarsipkan atau diganti tipenya; arsipkan atau pindahkan anak dahulu. Nama kategori unik per induk, tipe, dan plan.

## Pemeriksaan

`node scripts/test-fintrack-categories.mjs` memeriksa penjumlahan budget, arsip, induk bernama sama, rincian anak, transaksi langsung, transfer, duplikasi transaksi, dan total per periode. `node scripts/test-fintrack-activity.mjs` memeriksa filter dan pagination.

Setelah migration diterapkan, periksa di akun uji: buat induk dengan budget 1.000.000; buat anak dengan budget 600.000 dan 400.000; penambahan anak 1 atau penurunan induk menjadi 999.999 harus ditolak. Pindahkan salah satu anak, pilih mode penjumlahan, lalu periksa perubahan target dan laporan. Uji penyimpanan dua alokasi bersamaan dari tab berbeda. Pemeriksaan trigger terhadap database aktif belum dilakukan dalam implementasi lokal.

## Audit tampilan

Arah: daftar keuangan mobile FinTrack, mempertahankan palet dan komponen aplikasi. Variance 3, motion 2, density 5; ENERGY 2, RHYTHM 2, MOTION 2. Indentasi menyatakan hubungan anak; angka rupiah menjadi jangkar visual; caret menyatakan detail yang tersedia. Tidak ada aset atau dependensi baru.

- PASS interaksi disclosure: komponen asli dirender dalam pratinjau lokal dengan data berlabel simulasi; klik membuka detail, Enter membuka dan menutup, fokus terlihat.
- PASS tema komponen: pratinjau diperiksa dalam tema terang dan gelap, dengan token FinTrack.
- PASS tujuan visual: indentasi untuk hubungan induk–anak; progress untuk rasio pemakaian; disclosure untuk menjaga ringkasan mudah dipindai.
- PASS motion komponen: feedback tekan langsung, caret 180 ms, transisi dimatikan pada reduced motion; tidak ada penundaan membuka konten.
- PASS validasi sumber: pilihan induk dibatasi ke tipe yang sama dan dua tingkat; field budget memiliki label, aria-invalid, pesan batas alokasi, dan tombol simpan dinonaktifkan saat alokasi tidak valid.
- PASS verifikasi kode: build produksi, TypeScript, dua skrip pengujian kategori/aktivitas, dan lint file yang diubah.

Audit belum mencakup click-through form dan laporan pada akun terautentikasi setelah migration, viewport perangkat penuh, serta uji trigger SQL pada database. Delivery Gate menyeluruh belum dinyatakan lolos; pratinjau komponen tidak menggantikan pengujian integrasi tersebut. Lint seluruh repo masih memiliki error lama pada tiga skrip Timemark CommonJS.

## Grafik dan saran catatan (10 Oktober 2026)

Grafik kategori, perbandingan, dan tren memakai Recharts. Tooltip menampilkan rupiah; rincian angka dapat dibuka tanpa bergantung pada grafik. Animasi mengikuti prefers-reduced-motion. Palet mengikuti tema FinTrack.

Saran catatan muncul setelah tiga karakter, berdasarkan riwayat transaksi terakhir yang tersedia pada bootstrap (maksimal 60 transaksi). Maksimal lima bubble, tanpa duplikasi huruf besar/kecil, diurutkan berdasarkan frekuensi. Memilih bubble mengisi catatan dan mengembalikan fokus ke input; Escape menutup saran. Transaksi tetap perlu disimpan pengguna.

Dompet yang terhubung ke Goals diberi is_goal oleh bootstrap dan disembunyikan dari daftar dompet beranda; tetap tersedia pada alur transaksi dan tetap termasuk perhitungan aset. Tidak ada migration tambahan untuk perubahan ini; migration Goals sebelumnya tetap dibutuhkan.

Verifikasi lokal: TypeScript, lint file perubahan, test-fintrack-categories, test-fintrack-activity (termasuk ambang saran, normalisasi, deduplikasi, batas lima saran), dan production build lolos. Build memerlukan akses Google Fonts. Interaksi chart dan autofill pada akun terautentikasi belum diperiksa di browser.
