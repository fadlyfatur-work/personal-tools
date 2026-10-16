# Pencocokan RAB

Halaman `/ahsp/rab` diakses melalui tombol **Pencocokan RAB** di sebelah
**Rekapitulasi MPTK** pada katalog `/ahsp`. Fitur mencocokkan nama pekerjaan;
pemilihan pasangan tidak menghitung ulang harga AHSP atau mengonversi satuan.

## Pembacaan

- File harus `.xlsx` dengan struktur Open XML yang valid; maksimal 10 MB.
- Pengguna memilih minimal satu, maksimal tiga sheet. Sheet tersembunyi diberi label.
- Batas setiap sheet adalah baris Excel 1–1.000, termasuk header dan baris kosong.
  Jika ada isi setelah baris 1.000, persetujuan diperlukan sebelum pencocokan.
  Cakupan terbatas tetap tercantum di rekap layar dan unduhan.
- Dimensi worksheet tidak dipercaya sebagai jumlah data. Baris terakhir ditentukan
  dari sel yang berisi nilai atau rumus, termasuk sel di luar batas pemrosesan.
- Kolom uraian, kode, satuan, volume, Harga Satuan (Rupiah), total, dan awal data
  dideteksi lalu dapat dikoreksi. Satu kolom tidak boleh dipakai untuk dua bidang.
- Sel gabungan dengan beberapa uraian dipisahkan berdasarkan baris teks dan
  baris angka pendukung. Subtotal tidak ikut dipasangkan. Hasil pemisahan
  memerlukan konfirmasi. Jika jumlahnya berbeda, angka dibiarkan kosong.
- Angka dalam sel gabungan vertikal tidak diteruskan ke semua pekerjaan.
  Sel asal dan isi asli dipertahankan agar pengguna bisa memperbaiki pasangan.
- Judul/subtotal dikecualikan. Baris tanpa satuan/angka pendukung yang mungkin
  berupa kelompok berkode memerlukan pemeriksaan pengecualian. Pengguna dapat
  mengembalikan baris tersebut menjadi pekerjaan.
- Nol dibedakan dari kosong. Teks angka yang ambigu tidak ditebak. Hasil
  tersimpan rumus dibaca tanpa menjalankan atau menghitung ulang rumus.
- Pembacaan memakai DOMParser browser dan PizZip yang sudah tersedia, tanpa
  dependency baru. Isi file tidak dikirim ke server. XML eksternal ditolak;
  batas metadata ZIP 40 MB, 2.000 entri, 100 sheet, dan 256 kolom/100.000 sel
  terisi pada 1.000 baris pertama tiap sheet membatasi ukuran pemrosesan.

## Pencocokan dan keputusan pengguna

### Pratinjau dan pemetaan interaktif

Tahap awal menampilkan lima pekerjaan hasil pembacaan per halaman, termasuk
hasil pemisahan sel gabungan. Header Kode/Uraian/Satuan/Volume/Harga/Total dapat
ditekan untuk mengganti kolom sumber melalui panel yang muncul di dekat header.
Panel menampilkan huruf kolom, header Excel, dan dua contoh isi; pencarian
mencakup ketiganya. Tidak ada kumpulan dropdown huruf tanpa konteks.

Jika kolom pilihan sudah dipakai bidang lain, sumber kedua bidang ditukar dan
perubahan dijelaskan. Urungkan memulihkan satu perubahan terakhir. Deteksi
ulang tersedia. Kolom opsional dapat ditandai Tidak tersedia; uraian wajib.
Jumlah pekerjaan pada rekap langsung mengikuti perubahan pemetaan.

Tampilan Sel Excel asli mempertahankan urutan fisik kolom, membatasi cuplikan
menjadi lima baris, dan memungkinkan klik nomor baris untuk menetapkan awal
data. Teks panjang dibatasi pada cuplikan, tetapi seluruh isi tetap dapat dibuka
dalam dialog. Baris dikecualikan juga bisa dilihat pada pratinjau hasil baca.

Panel pemetaan memakai native popover, mendukung Escape/klik di luar,
pengembalian fokus, posisi dalam viewport, dan reduced motion. Pratinjau hasil
menumpuk pada ponsel. Tabel hasil rekonsiliasi memiliki aturan lebar terpisah
agar tidak memengaruhi tabel pratinjau.

`GET /api/ahsp/rab` hanya mengembalikan identitas/nama/kode/satuan/regulasi
katalog pekerjaan. Server membaca semua halaman Supabase, berurutan berdasarkan
ID, bukan hanya 1.000 hasil pertama. Cache lima menit dan penggabungan permintaan
bersamaan menghindari pembacaan berulang. Kegagalan tidak menghasilkan katalog
parsial yang dianggap lengkap. Rate limit menggunakan helper proyek.

SE 47/2026 dan Permen 08/2023 dipakai otomatis. Referensi tambahan yang tersedia
saat ini adalah arsip SE 182/2025. Menambah regulasi lain memerlukan pembaruan
katalog; fitur ini tidak mencari regulasi di internet. Tidak ada migrasi baru.

Like-match mencari substring literal nama. Gabungan frasa memakai parser AHSP
yang sudah tersedia, minimal dua frasa berbeda pada satu nama. Rekomendasi
tambahan disertakan jika belum ada nama sama dengan satuan kompatibel pada
sumber utama. Urutan kandidat mempertimbangkan nama sama, kelompok regulasi,
jumlah frasa ditemukan, lalu prioritas edisi. Tidak ada persentase kemiripan
per item yang direkayasa dari jumlah kata.

Penetapan otomatis hanya untuk nama ternormalisasi sama, satuan kompatibel,
dan pembacaan yang tidak menunggu konfirmasi. Angka spesifikasi tidak dibuang.
Kandidat lain memerlukan pilihan pengguna. Perbedaan uraian, angka spesifikasi,
metode, dan satuan ditampilkan; alasan penyelesaian wajib sebelum konfirmasi.

Dua kelompok hasil adalah **Cocok** dan **Tidak cocok**. Tab Cocok memisahkan
tabel regulasi utama dan tambahan. Pengguna dapat memeriksa data, memulihkan
isian dari sumber, mengecualikan/mengembalikan baris, mencari kandidat lain,
memakai kandidat melalui modal konfirmasi, dan membatalkan pasangan.
Pemilihan pasangan menyimpan uraian hasil rekonsiliasi terpisah dari uraian asli.

Pengubahan pembacaan membatalkan pasangan lama sebelum dicocokkan ulang.
Mengganti file/pemetaan juga mengosongkan hasil setelah konfirmasi. Penghentian
proses mempertahankan hasil sementara; item tertunda dapat dicocokkan kembali.

## Rekap dan ekspor

Rekap terlihat sejak workbook dibaca, mengikuti pilihan sheet/pemetaan, proses
pencocokan, dan keputusan manual. Persentase utama menggunakan jumlah pasangan
utama dibagi seluruh item yang diikutkan; persentase tambahan dihitung terpisah.
Item tertunda/perlu ditinjau/belum ditemukan tetap masuk penyebut. Pengecualian
beserta jumlah yang belum dikonfirmasi terlihat jelas. Total uang hanya
menjumlahkan total sumber yang tersedia, disertai jumlah item tanpa total.

Unduhan berisi Rekapitulasi, Regulasi Utama, Regulasi Tambahan, Belum Cocok,
dan Dikecualikan. Setiap rincian mencantumkan uraian asli/diperiksa/hasil,
identitas pasangan, sumber regulasi, satuan, volume, Harga Satuan (Rupiah),
total sumber, keputusan manual/otomatis, penyelesaian perbedaan, sel asal,
nilai mentah, dan riwayat tindakan. Semua halaman hasil diekspor. Teks sumber
ditulis sebagai string Excel, sehingga teks yang diawali `=` tidak menjadi rumus.
Total yang berbeda dari volume × harga satuan diberi catatan tanpa ditimpa.

Sesi berlangsung di memori browser, tanpa riwayat RAB di database. Peringatan
ditampilkan sebelum menutup/memuat ulang atau kembali ke katalog setelah
perubahan yang belum diunduh. Unduh hasil sebelum meninggalkan halaman.

## Verifikasi

`node scripts/test-ahsp-rab.mjs` memeriksa ekstraksi, batas baris, angka,
spesifikasi/satuan, arsip, denominator rekap, ekspor, pagination katalog,
cache/concurrency, rate limit, dan kegagalan koneksi tanpa mengakses database.

`node scripts/check-ahsp-rab-ui.cjs` membutuhkan dev server, Chrome,
Playwright runtime, katalog Supabase yang tersedia, serta enam contoh pengguna.
Lokasi dapat diubah melalui `RAB_ORIGIN`, `RAB_SAMPLES`, `PLAYWRIGHT_MODULE`.
Script tidak menulis ke database atau mengubah workbook sumber. Hasil uji
dan workbook sementara berada di `.next/rab-tests/`.

Audit khusus pratinjau: `playwright-cli -s=rab-audit run-code
--filename=scripts/check-ahsp-rab-mapping.js` setelah membuka `/ahsp/rab` pada
sesi tersebut. Pemeriksaan mencakup pemetaan, pertukaran/undo, pencarian kolom,
sel lengkap, lima ukuran viewport, tema, reduced motion, dan keenam workbook.
