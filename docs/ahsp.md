# Katalog AHSP 2026

Halaman `/ahsp` menampilkan pekerjaan dari SE 47/SE/Dk/2026 dan bidang Umum dari Permen PUPR 8/2023. Data disimpan di PostgreSQL Supabase yang sudah digunakan proyek. Master spreadsheet tidak dijadikan bukti regulasi: data asli, hasil inventarisasi, dan hasil rekonsiliasi disimpan terpisah.

## Memasang database

Jalankan `supabase/migrations/202610120001_ahsp_catalog.sql` melalui Supabase SQL Editor. Jika versi pertama fungsi katalog telah terpasang, jalankan juga `202610120002_ahsp_active_regulations.sql` untuk mengaktifkan bidang Umum dalam agregasi dan filter. Migrasi hanya menambahkan tabel dan fungsi `ahsp_*`; tidak menghapus tabel lain. Tabel mempunyai RLS tanpa akses langsung untuk anon/authenticated. API baca memakai service-role di server. Tidak ada endpoint publik untuk mengubah hasil inventarisasi.

Environment yang sudah digunakan proyek:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Jangan menaruh service-role key pada variabel `NEXT_PUBLIC_*` atau pada browser.

## Inventarisasi dan impor

Unduh delapan PDF SE dan satu PDF Permen dari halaman resmi DJBK, lalu ekstrak tabel dan rekonsiliasi master. Instal `openpyxl` dan `pymupdf` dalam lingkungan Python terpisah untuk alat inventarisasi; aplikasi web tidak memerlukan Python.

```text
python scripts/ahsp-download.py <direktori-PDF>
python scripts/ahsp-inventory.py --corpus <direktori-PDF> --master <master.xlsx> --output <inventory.json>
python scripts/ahsp-enrich.py --corpus <direktori-PDF> --inventory <inventory.json>
python scripts/ahsp-baseline.py --corpus <direktori-PDF> --inventory <inventory.json>
python scripts/ahsp-audit.py --corpus <direktori-PDF> --inventory <inventory.json>
python scripts/ahsp-mirrors.py --corpus <direktori-PDF> --output <direktori-mirror>
node --env-file=.env.local scripts/ahsp-import.mjs <inventory.json> [manifest-mirror.json]
```

Workbook menggunakan nama sheet `Master_Items` dan `Master_Fields`. Dimensi worksheet dari berkas ini tidak akurat; pembaca mengabaikan dimensi tersebut sebelum mengiterasi baris. ID bidang dipertahankan sebagai teks karena sebagian ID asal bukan UUID valid. ID item asal dapat dipakai pada beberapa regulasi, sehingga baris sumber diberi identitas tersendiri.

Sesuai cakupan yang disetujui, hanya SE 47/2026 dan bidang Umum Permen 8/2023 yang diimpor. SE 182/2025, SMKK lama, dan SPTJM tidak diimpor. Importer menolak snapshot yang memuat versi di luar cakupan ini. Master asal tetap utuh. Lima kode Umum berulang digabung per kode, semua nomor baris asal dipertahankan, dan statusnya memerlukan tinjauan. Baris master yang belum mendapat padanan tetap tampil dengan status yang menjelaskan keterbatasannya. Pekerjaan resmi yang belum ada dalam master juga ditambahkan ke katalog.

Pencocokan memakai bidang dan kode. Nama dan satuan dibandingkan setelah normalisasi tanda, spasi, notasi pangkat, dan beberapa singkatan satuan. Kandidat ganda memerlukan tinjauan. `Cocok` menjelaskan kecocokan identitas pekerjaan, bukan pengesahan seluruh koefisien. Divisi pada Cipta Karya dan Bina Marga mengikuti kelompok kode; sumber yang tidak memakai divisi tidak diberi divisi buatan.

Status analisis terpisah:

- `extracted`: tabel mempunyai kelompok A/B/C, baris jumlah akhir, dan komponen yang dapat dipetakan. Ini merupakan pemeriksaan struktur ekstraksi, bukan pengesahan teknis.
- `needs_review`: tabel atau koefisien belum dapat dipastikan lengkap.
- `unavailable`: rincian komponen belum berhasil dipetakan.

Tabel gambar Bina Marga memerlukan OCR dan pemeriksaan terhadap halaman asli. Hasil OCR percobaan tidak dimasukkan sebagai koefisien resmi. PDF asli tetap menjadi rujukan, termasuk asumsi, rumus produktivitas, dan catatan yang tidak dapat diubah menjadi tabel.

Opsional: manifest mirror berisi `source_id`, `source_sha256`, `page_start`, `page_end`, dan `file`. Impor mengunggah PDF publik pemerintah ke bucket khusus `ahsp-regulations`, memeriksa sidik berkas asal, dan tidak mengubah izin bucket yang sudah ada. Potongan PDF mempertahankan pemetaan halaman asli. `url` pada sumber tetap menunjuk ke situs resmi; `assets` dipakai untuk pratinjau PDF dalam modal.

Impor dapat diulang untuk snapshot yang sama. Untuk snapshot baru, periksa kode dan baris yang dihapus atau diganti sebelum mengaktifkannya. Importer tidak menghapus data lama otomatis, dan menolak menyatakan berhasil jika jumlah katalog berbeda dari snapshot. Tidak ada klaim bahwa pembaruan regulasi berjalan otomatis; tanggal pemeriksaan sumber ditampilkan.

## Kalkulator

Koefisien tetap diambil dari tabel. Koefisien yang berupa ekspresi memerlukan nilai hasil rumus dari pengguna; aplikasi tidak menjalankan ekspresi dokumen sebagai kode. Modal menyediakan rumus dan lampiran untuk pemeriksaan. Harga dasar tidak diisi dengan harga contoh pada PDF karena memerlukan wilayah dan periode tersendiri.

Biaya langsung merupakan jumlah koefisien × harga dasar seluruh komponen. Biaya umum dan keuntungan mengikuti persentase pengguna dalam batas tabel sumber bila tercantum. Harga satuan dibagi basis kuantitas analisis dan dikalikan volume pekerjaan. PPN belum ditambahkan. Item biaya SMKK terbaru mempunyai kalkulator tersendiri: kuantitas pengguna × harga per unit pengguna, tanpa persentase biaya umum AHSP. Sumbernya Lampiran V, tabel A.7, SE 47/2026; harga serta kuantitas contoh tidak diimpor sebagai harga proyek. Angka desimal menerima koma atau titik; pemisah ribuan tidak diterima agar input tidak ambigu. Harga kosong berbeda dari harga nol.

Analisis hasil ekstraksi yang belum lengkap tidak menghasilkan total. Untuk tabel gambar atau analisis yang perlu tinjauan, tersedia simulasi manual dari lampiran. Pengguna mengisi seluruh komponen, koefisien, satuan, basis analisis, volume, serta persentase dan mengonfirmasi kecocokan dengan lampiran. Perubahan komponen atau basis mereset konfirmasi. Simulasi tidak mengubah status maupun data PostgreSQL. Teks sumber ditampilkan bersama halaman PDF dan nomor tercetak. Satu halaman dapat memuat beberapa pekerjaan; kode pada modal menentukan tabel yang digunakan kalkulator.

## Pemeriksaan

```text
node scripts/test-ahsp.mjs
python scripts/test-ahsp-inventory.py
npm run typecheck
npm run build
```

Gunakan filter, pagination, modal, navigasi keyboard/Escape, serta perubahan harga/volume untuk pemeriksaan browser. Periksa layar sempit, tema sistem gelap, kondisi kosong, koneksi gagal, dan analisis yang belum tersedia.

Desain mengikuti palet navy Personal Tools dan font aplikasi yang telah tersedia. ENERGY 2 / RHYTHM 2 / MOTION 1. Daftar berkode menjadi fokus halaman; kelompok komponen, subtotal, dan rujukan menjadi urutan baca modal. Border kiri menandai konteks regulasi dan status, tanpa warna dekoratif tambahan. Modal saja diberi bayangan untuk membedakan lapisan. Animasi terbatas pada umpan balik tombol dan mengikuti pengaturan reduced motion.

Snapshot 12 Oktober 2026 memuat 6.129 item dari 6.001 baris master yang masuk cakupan. Bidang: SDA 1.605, Bina Marga 1.278, Cipta Karya/Perumahan 2.848, SMKK 149, Umum 249. Ini hasil inventarisasi dan rekonsiliasi, bukan klaim bahwa semua koefisien telah disahkan. Dokumen diperiksa pada tanggal tersebut; pembaruan otomatis belum tersedia.

## Pencarian dan ringkasan hasil

Pencarian dasar memakai nama/kode item pekerjaan dan regulasi. Panel lanjutan menerima banyak istilah, bidang, divisi, satuan, serta mode Exact-match atau Like-match; nama/kode komponen yang sudah diekstrak ikut dicari. Daftar dipisahkan dengan baris baru, koma, titik koma, atau backslash. Koma desimal dan koma di dalam tanda kurung dipertahankan. Istilah ganda yang hanya berbeda kapitalisasi dihitung sekali.

Migrasi `202610120003` menambahkan pencarian, `202610120004` menambahkan mode, dan `202610120005` menambahkan ringkasan serta statistik tipe. Jalankan berurutan melalui SQL Editor. Fungsi baca memakai parameter RPC; teks pencarian tidak digabungkan ke SQL. Tidak ada perubahan izin baca langsung untuk anon/authenticated.

Total hasil menghitung ID item pekerjaan unik. Ringkasan menghitung jumlah istilah yang mempunyai hasil, kecocokan exact seluruh istilah terhadap item dalam cakupan filter, dan jumlah exact/like untuk setiap istilah. Statistik tidak dibatasi halaman saat ini. Istilah yang bertumpang tindih dapat membuat jumlah baris statistik lebih besar daripada total item unik.

Pada desktop, pencarian ditempatkan pada kolom samping yang dapat digulir, sementara hasil tetap terlihat di sebelahnya. Pada layar kecil, tombol Tampilkan hasil menutup panel panjang dan memindahkan fokus ke hasil; Ubah pencarian mengembalikan fokus ke isian. Membuka/menutup panel tidak membuang hasil atau filter aktif. Mengubah pencarian dasar kembali memakai mode pencarian satu item.

Jenis Normatif/Informatif diambil dari daftar lampiran. SMKK mengikuti label Informatif untuk kelompok A.7 dalam daftar isi Lampiran V (halaman PDF 4). Pada snapshot ini ada 2.868 Normatif, 2.339 Informatif, dan 922 yang belum teridentifikasi. Label terakhir menunjukkan data jenis yang belum terpetakan.

Pratinjau modal menggunakan 3.638 cuplikan halaman PDF yang dirender tanpa mengubah isinya. JPEG disimpan di bucket khusus dokumen pemerintah; PDF asli dan SHA-256 tetap disimpan. Pembuatan ulang:

```text
python scripts/ahsp-page-previews.py --corpus <direktori-PDF> --inventory <inventory.json> --output <direktori-preview>
node --env-file=.env.local scripts/ahsp-upload-previews.mjs <manifest-preview.json>
node --env-file=.env.local scripts/test-ahsp-search-live.mjs
```

Uji live tersebut hanya membaca PostgreSQL dan menguji jumlah per istilah, exact/like, hasil bertumpang tindih, tipe, dan pagination.
