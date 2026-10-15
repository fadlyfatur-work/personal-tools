# Katalog AHSP 2026

## Rekapitulasi MPTK

Halaman `/ahsp/mptk`, ditautkan dari katalog AHSP, mencari komponen tenaga kerja, material, dan peralatan sebagai hasil utama. Setiap komponen menampilkan pekerjaan penggunanya, koefisien atau ekspresi asli, basis analisis, status ekstraksi, regulasi, serta tautan halaman sumber. Pencarian nama/kode memakai substring literal tanpa membedakan kapitalisasi; filter jenis, bidang, satuan komponen, regulasi, dan status analisis diterapkan sebelum pengelompokan/pagination. Kolom pencarian diterapkan dengan Cari/Enter; perubahan filter juga menerapkan kata kunci yang sedang diisi. Daftar komponen dan daftar penggunaan masing-masing berhalaman 30 baris.

Rincian penggunaan dibuka sebagai modal native `<dialog>`, dengan tombol Tutup, Escape, pemulihan fokus ke baris pemicu, serta penguncian scroll latar. Modal menggunakan tema yang dipilih dan pagination penggunaan tetap berada di dalam modal. Navigasi ke MPTK dari AHSP berbentuk tombol tautan.

Setiap baris komponen menampilkan ringkasan koefisien menurut pekerjaan: sampai dua contoh nilai atau rumus, satuan komponen, basis analisis (kuantitas dan satuan output), kode/nama pekerjaan, serta regulasi. Bila ada beberapa variasi, jumlahnya ditampilkan dan seluruh kemunculan dapat dilihat dalam modal. Nilai nol dibedakan dari koefisien kosong. Rumus ditampilkan sebagai ekspresi sumber, bukan dihitung otomatis. Nilai yang sama pada basis berbeda dihitung sebagai variasi terpisah; koefisien tidak dirata-ratakan atau dianggap satu nilai global komponen.

Jalankan `202610150003_ahsp_mptk_coefficients.sql` melalui Supabase SQL Editor setelah migrasi MPTK 01 dan 02. RPC `ahsp_mptk_coefficients` membaca view tervalidasi, menerapkan filter yang sama dengan katalog, dan merangkum seluruh kemunculan untuk maksimal 30 komponen pada halaman hasil. Contoh dipilih stabil, memprioritaskan regulasi terbaru dan analisis terekstrak. API memperkaya baris hasil serta header komponen pada detail, termasuk ketika pagination penggunaan sudah melewati halaman pertama. Tidak ada perubahan pada nilai atau tabel sumber. Uji `scripts/test-ahsp-mptk.mjs` mencakup ringkasan, basis berbeda, nol/kosong/rumus, filter, API, serta penolakan akses anon/authenticated.

Aktifkan dengan menjalankan seluruh `supabase/migrations/202610150001_ahsp_mptk_catalog.sql` melalui Supabase SQL Editor setelah migrasi AHSP sebelumnya, khususnya `202610140003`. Migrasi menambahkan view `ahsp_mptk_occurrences` dan RPC `ahsp_search_mptk`, tanpa menyalin atau mengubah komponen sumber. View memakai security invoker; view dan RPC hanya dapat diakses service_role melalui API server `/api/ahsp/mptk`. Tidak ada database baru, impor ulang, atau dependency aplikasi tambahan.

Identitas katalog menggunakan jenis + nama ternormalisasi NFKC/spasi/kapitalisasi + satuan, dengan alias `bh`, `bh.`, `buah` mengikuti helper AHSP. Satuan berbeda dan nama yang hanya mirip tetap terpisah. Kode sumber bukan identitas unik, dapat kosong atau dipakai beberapa jenis tukang. Pengelompokan menyatukan pencarian identitas, bukan menyatakan spesifikasi teknis seluruh sumber setara. Kode, nama dan satuan asli, koefisien, serta regulasi dipertahankan pada setiap kemunculan; dua baris komponen dalam satu pekerjaan tetap ditampilkan terpisah. Tidak ada konversi satuan otomatis atau satu koefisien global.

Jumlah pekerjaan pada komponen menghitung ID versi pekerjaan, bukan nama pekerjaan unik seperti katalog utama. Jumlah kemunculan menghitung baris komponen. Hitungan tombol jenis mengikuti kata kunci/filter lain sebelum pilihan jenis; cakupan menghitung versi pekerjaan pada bidang/regulasi terpilih sebelum filter lain dan mengecualikan bidang SMKK. Hanya komponen dengan kelompok MPTK, nama, dan satuan terisi yang ditampilkan. Arsip dipilih eksplisit. Pekerjaan tanpa rincian komponen, termasuk Bina Marga pada snapshot awal, tidak direkayasa menjadi komponen; komponen biaya SMKK tidak masuk. Struktur terekstrak bukan pengesahan teknis. Harga wilayah/periode dan rekap kebutuhan proyek berbasis volume belum termasuk.

Uji SQL/API: `node scripts/test-ahsp-mptk.mjs`; tambahkan `--snapshot` untuk memeriksa snapshot lokal 14 Oktober 2026 dan menulis data pemeriksaan browser di `.next/mptk-test/`. Menggunakan PGlite sementara yang sudah dijelaskan pada pengujian Gabungan frasa, tanpa menyentuh Supabase. Build membersihkan `.next`, sehingga paket uji mungkin perlu diinstal ulang sesudah build. Uji mencakup normalisasi, kode bertumpang tindih/kosong, koefisien per sumber, basis analisis, rumus, filter, cakupan, arsip, kedua pagination, validasi API, dan penolakan akses anon/authenticated.

### Perbaikan kategori dan validasi 15 Oktober 2026

Jalankan migrasi tambahan `202610150002_ahsp_mptk_validation.sql` melalui Supabase SQL Editor setelah migrasi MPTK 01. API membutuhkan fungsi statistik validasi baru sehingga data tanpa perbaikan ini tidak disajikan sebagai hasil yang telah diperiksa.

Penyebab: ekstraksi beberapa tabel PDF menyatukan penanda kelompok dan nomor komponen dalam sel seperti `B 1`, serta nama seperti `Bahan Semen`. Parser lama hanya mengenali sel bernilai tepat `B` atau `C`, sehingga kelompok sebelumnya terbawa ke material/peralatan. Parser kini menangani penanda gabungan tanpa membuang komponen yang berada pada baris yang sama. Judul kelompok dipisahkan dari nama. Baris berisi beberapa satuan/koefisien gabungan ditandai tidak lengkap dan tidak dimasukkan sebagai satu komponen.

Untuk data yang sudah diimpor, view validasi mengoreksi kategori hanya bila penanda A/B/C pada `sourceLine` selaras dengan judul kelompok pada nama. Nama saja, kode saja, atau perkiraan berdasarkan satuan tidak cukup untuk memindahkan kategori. Grup/nama asli dipertahankan untuk audit. Kategori tenaga dengan satuan bukan OH/OJ/OB (atau padanan orang hari/jam/bulan), kategori non-tenaga dengan satuan tenaga, identitas kosong, serta komponen gabungan ditahan dari hasil. Angka penahanan/koreksi mengikuti bidang dan regulasi sebelum filter lain. Data `ahsp_items.components` tidak ditimpa, sehingga sumber dan fingerprint referensi tetap utuh.

Contoh `PC: Portland Cement` benar berada pada Bahan dan bersatuan Buah pada halaman PDF 418 Lampiran IV. Satuan itu dipertahankan, bukan diubah menjadi kg berdasarkan perkiraan. PDF resmi telah dibandingkan SHA-256 dengan inventaris dan halaman aslinya diperiksa. Penanda kategori yang sudah diperbaiki tetap mengikuti status analisis sumber; ini tidak mengesahkan koefisien atau menyelesaikan kejanggalan dokumen.

Audit read-only database terbaru: `node --env-file=.env.local scripts/audit-ahsp-mptk.mjs`. Validasi snapshot baru: `node scripts/test-ahsp-mptk.mjs --snapshot --input=anti-slop/ahsp-mptk/validation-2026-10-15/snapshot.json`. Laporan ringkasan, daftar nama tenaga, dan rincian baris yang ditahan (beserta kode/halaman sumber) ditulis ke `.next/mptk-test/`. Tidak ada perubahan Supabase oleh skrip audit/uji.

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

### Arsip SE 182/2025

Pada 14 Oktober 2026 pengguna menambahkan ekspor SIPASTI edisi SE 182/2025. Nama berkas sumber menyebut SE 147/2025, tetapi query ekspor dan seluruh 5.164 baris menyebut SE 182/2025; pengguna mengonfirmasi untuk mengikuti isi JSON. Penambahan ini memperluas cakupan awal di atas khusus untuk arsip. Jumlah item unik: SDA 1.512, Bina Marga 1.133, Cipta Karya/Perumahan 2.519. Ada 3.509 baris yang juga mencantumkan SE 47/2026 dan 1.655 yang hanya mencantumkan edisi 2025. Seluruh item disimpan sebagai identitas edisi 2025 yang terpisah, bukan menimpa atau mengganti metadata item edisi aktif.

Tag **Digantikan oleh SE 47/2026** menjelaskan status regulasinya, bukan pernyataan bahwa setiap pekerjaan dihapus pada edisi terbaru. Tag tampil pada kolom regulasi dan header modal, serta disimpan di `regulation_status`. Data ini hanya master pekerjaan dari SIPASTI: komponen, koefisien, sumber lampiran, dan halaman tidak disalin dari edisi terbaru. Status analisisnya `unavailable`; tag asal `Hanya ada di SIPASTI` tetap terpisah.

Modal arsip tanpa `source_id` tidak memakai fallback PDF SE 47/2026. Lampiran edisi terbaru tidak ditampilkan sebagai rujukan edisi arsip.

Jalankan migrasi `202610140002_ahsp_archived_regulations.sql` melalui Supabase SQL Editor setelah migrasi sebelumnya. Pilihan **SE 182/2025 (arsip)** menampilkan edisi lama; pilihan bawaan **Semua regulasi aktif** tetap mengecualikannya. Pencarian, termasuk Gabungan frasa, statistik, dan pagination memakai cakupan regulasi yang dipilih. Total database, jenis katalog, pilihan filter, serta jumlah tombol bidang mencakup aktif dan arsip; bantuan tombol menjelaskan bahwa hitungan tersebut sebelum filter.

Persiapan/impor data memakai skrip khusus agar rekonsiliasi edisi aktif tidak mengubah tag item lain:

```sh
node --env-file=.env.local scripts/prepare-ahsp-legacy.mjs <ekspor.json> .next/ahsp-se182-2025/import.sql
node --env-file=.env.local scripts/prepare-ahsp-legacy.mjs <ekspor.json> .next/ahsp-se182-2025/import.sql --apply
node scripts/test-ahsp-legacy.mjs
```

Tanpa `--apply`, skrip hanya membaca daftar bidang dan menulis SQL/laporan persiapan. SQL dapat dijalankan secara atomik melalui SQL Editor setelah migrasi. `--apply` menyimpan snapshot sumber dan menambahkan item secara bertahap melalui Supabase; semua identitas diperiksa sebelum menulis. Tidak ada update/delete pada item lama. Bila jaringan gagal di tengah batch, impor dapat dilanjutkan dengan perintah yang sama tanpa duplikasi. Nomor baris sumber dan SHA-256 dipertahankan, sementara ID deterministik memisahkan edisi arsip dari edisi aktif. Argumen ketiga opsional menyediakan JSON dengan properti `fields` untuk persiapan offline.

Impor telah diterapkan dan diverifikasi langsung pada 14 Oktober 2026: 5.164 item arsip, 6.377 item edisi aktif, total 11.541 item. Impor ulang menemukan 5.164 item yang sudah ada dan tidak menambah duplikasi. `node --env-file=.env.local scripts/test-ahsp-legacy-live.mjs <ekspor.json>` memeriksa identitas, seluruh tag penggantian, status analisis, nomor baris sumber, dan SHA-256. Laporan lokal berada di `anti-slop/ahsp-se182-2025/`; migrasi fungsi katalog/pencarian tetap perlu dijalankan manual agar arsip tampil lewat filter.

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
npx tsc --noEmit
npm run build
```

Gunakan filter, pagination, modal, navigasi keyboard/Escape, serta perubahan harga/volume untuk pemeriksaan browser. Periksa layar sempit, tema sistem gelap, kondisi kosong, koneksi gagal, dan analisis yang belum tersedia.

Desain mengikuti palet navy Personal Tools dan font aplikasi yang telah tersedia. ENERGY 2 / RHYTHM 2 / MOTION 1. Daftar berkode menjadi fokus halaman; kelompok komponen, subtotal, dan rujukan menjadi urutan baca modal. Border kiri menandai konteks regulasi dan status, tanpa warna dekoratif tambahan. Modal saja diberi bayangan untuk membedakan lapisan. Animasi terbatas pada umpan balik tombol dan mengikuti pengaturan reduced motion.

Snapshot 12 Oktober 2026 memuat 6.129 item dari 6.001 baris master yang masuk cakupan. Bidang: SDA 1.605, Bina Marga 1.278, Cipta Karya/Perumahan 2.848, SMKK 149, Umum 249. Ini hasil inventarisasi dan rekonsiliasi, bukan klaim bahwa semua koefisien telah disahkan. Dokumen diperiksa pada tanggal tersebut; pembaruan otomatis belum tersedia.

## Pencarian dan ringkasan hasil

Pencarian dasar memakai nama/kode item pekerjaan, regulasi, dan pilihan bidang. Panel lanjutan menerima banyak istilah, divisi, satuan, serta mode Exact-match atau Like-match; nama/kode komponen yang sudah diekstrak ikut dicari. Daftar dipisahkan dengan baris baru, titik koma, atau backslash. Koma selalu menjadi bagian teks pencarian, termasuk koma di akhir baris; contoh input memakai baris baru tanpa koma tambahan. Titik koma di dalam tanda kurung dipertahankan. Istilah ganda yang hanya berbeda kapitalisasi dihitung sekali.

Filter Bidang dipindahkan dari dropdown advanced ke tombol pilihan pada pencarian utama. Tombol menampilkan jumlah item dalam katalog aktif sebelum filter pencarian/regulasi, termasuk tombol Semua. Jumlah diambil melalui exact count PostgreSQL ketika options dimuat, bukan angka pada gambar contoh. Klik bidang langsung menyaring snapshot pencarian yang telah diterapkan dan mereset divisi/page; draft istilah advanced tidak ikut diterapkan. Bidang tetap dipertahankan saat single search berubah. Tombol membungkus ke baris berikutnya pada layar sempit dan memperlihatkan aria-pressed untuk pilihan aktif.

Pencarian tunggal otomatis setelah jeda mengetik 200 ms; timer dan permintaan sebelumnya dibatalkan saat input berubah. Advanced search menyimpan perubahan istilah, bidang, divisi, satuan, regulasi, serta mode sebagai draft. Draft baru diterapkan melalui tombol Cari/submit form, tanpa debounce tambahan. Hasil dan pagination tetap memakai snapshot filter yang terakhir diterapkan. UI memberi keterangan bila ada perubahan advanced yang belum diterapkan. Mengubah input pencarian tunggal kembali memakai scope pekerjaan dan mengabaikan filter advanced. Pengujian pemicu pencarian: `node scripts/test-ahsp-search-trigger.mjs`.

Migrasi `202610120003` menambahkan pencarian, `202610120004` menambahkan mode, dan `202610120005` menambahkan ringkasan serta statistik tipe. Jalankan berurutan melalui SQL Editor. Fungsi baca memakai parameter RPC; teks pencarian tidak digabungkan ke SQL. Tidak ada perubahan izin baca langsung untuk anon/authenticated.

Migrasi `202610130006` memperbaiki timeout pencarian: hasil kecocokan diagregasi sekali per ID, lalu digabungkan dengan kandidat; daftar komponen yang cocok hanya disusun untuk halaman hasil. Struktur respons, statistik, filter, dan data katalog tetap sama. API membedakan timeout (`SEARCH_TIMEOUT`), kegagalan koneksi (`DATABASE_CONNECTION_FAILED`), dan fungsi database yang tidak tersedia (`SEARCH_FUNCTION_UNAVAILABLE`). Respons gagal menyertakan referensi acak yang sama dengan log `[AHSP]` di terminal server. Log memuat kode dan jumlah istilah, tanpa isi pencarian, kredensial, atau pesan mentah database.

Migrasi `202610130007` menghilangkan konfigurasi per pemanggilan pada pembanding teks agar PostgreSQL dapat melakukan SQL inlining. Fungsi hanya memakai operasi bawaan yang disebut eksplisit dengan namespace `pg_catalog`; tetap immutable, security invoker, dan hanya dapat dijalankan service_role. Perbandingan exact tetap tidak peka kapitalisasi dan mengabaikan spasi di ujung, sedangkan like memakai pencarian substring literal.

### Gabungan frasa

Mode ketiga, **Gabungan frasa**, mencari minimal 2 frasa berbeda dalam satu nama pekerjaan. Contoh: `"Mobilisasi dan Demobilisasi" "Alat Berat" "Excavator"`. Tanda kutip lurus atau melengkung mengelompokkan frasa; kata tanpa tanda kutip dihitung terpisah. Urutan antarfrasa bebas, kata dalam frasa berurutan, kapitalisasi diabaikan, spasi berulang dinormalisasi, dan frasa duplikat dihitung sekali. Kode pekerjaan maupun nama/kode komponen tidak ikut dihitung. Tanda kutip belum ditutup atau kurang dari 2 frasa berbeda ditolak sebelum permintaan database. Like-match dan Exact-match mempertahankan aturan input sebelumnya.

Jalankan `supabase/migrations/202610140001_ahsp_phrase_search.sql` melalui Supabase SQL Editor setelah migrasi AHSP sebelumnya, sebelum memakai mode baru. Migrasi mengganti fungsi baca tanpa mengubah data katalog atau hak akses. API menolak respons fungsi lama untuk mode Gabungan frasa agar hasil Like-match tidak dianggap hasil gabungan.

Database menyaring kecocokan sebelum menghitung total, tipe item, dan pagination. Urutan utama adalah jumlah frasa cocok terbanyak, lalu kode dan ID untuk urutan stabil. Ringkasan per frasa hanya menghitung pekerjaan yang lolos minimal 2 frasa. Filter bidang, divisi, satuan, regulasi, analisis, dan SIPASTI tetap berlaku; pagination memakai filter yang terakhir diterapkan.

Pengujian parser/API/UI: `node scripts/test-ahsp.mjs` dan `node scripts/test-ahsp-search-trigger.mjs`. Pengujian fungsi SQL memakai PostgreSQL sementara dalam memori, tanpa menyentuh Supabase atau menambah dependency aplikasi:

```sh
npm install --prefix .next/ahsp-sql-test --no-save --package-lock=false @electric-sql/pglite
node scripts/test-ahsp-phrase-sql.mjs
```

Total hasil menghitung ID item pekerjaan unik. Ringkasan menghitung jumlah istilah yang mempunyai hasil, kecocokan exact seluruh istilah terhadap item dalam cakupan filter, dan jumlah exact/like untuk setiap istilah. Statistik tidak dibatasi halaman saat ini. Istilah yang bertumpang tindih dapat membuat jumlah baris statistik lebih besar daripada total item unik.

### Satu baris per nama pekerjaan

Migrasi `202610140003_ahsp_unique_work_names.sql` mengelompokkan nama pekerjaan yang sama sebelum pagination. Nama dinormalisasi dengan Unicode NFKC, huruf kecil, trim, dan pemadatan spasi. Perbedaan kode, bidang, satuan, jenis item, atau regulasi tidak menambah baris utama bila nama sama. Nama yang hanya mirip tetap terpisah. Ini menggantikan hitungan per ID pada bagian sebelumnya: total hasil, statistik per istilah, tipe hasil, dan hitungan bidang kini memakai nama unik.

Versi utama dipilih dari versi yang lolos pencarian dan filter, dengan prioritas SE 47/2026, Permen 8/2023, lalu arsip SE 182/2025. Pada edisi yang sama, rincian analisis/sumber yang tersedia diprioritaskan, lalu kode dan ID untuk urutan stabil. Filter regulasi, bidang, satuan, divisi, analisis, atau SIPASTI tetap menentukan versi yang boleh menjadi baris utama. Satuan `bh`, `bh.`, dan `Buah` diperlakukan setara pada filter; penulisan asli tetap disimpan.

Disclosure **Versi dan sumber lainnya** menampilkan semua sumber bernama sama, termasuk arsip, beserta kode, bidang, satuan asli, dan jenisnya. Tombol Buka versi memakai ID asli dan memuat komponen/kalkulator/lampiran versi tersebut. Pengelompokan tidak menyamakan koefisien antarversi, tidak mengubah metadata, dan tidak menghapus data asal. Penyalinan baris utama tetap menggunakan versi yang ditampilkan.

Options menampilkan jumlah pekerjaan unik dan `version_total` secara terpisah. Jumlah per bidang dapat bertumpang tindih karena nama yang sama boleh tercatat pada beberapa bidang. Semua hitungan dihasilkan oleh SQL; API tidak menggantinya dengan jumlah baris fisik. Fungsi lama yang belum mengelompokkan nama ditolak agar duplikat tidak kembali ditampilkan.

Jalankan migrasi 03 melalui Supabase SQL Editor setelah migrasi sebelumnya. View memakai `security_invoker`, helper/index hanya membaca identitas nama/satuan, dan akses tetap terbatas pada service_role. Uji: `node scripts/test-ahsp-name-groups.mjs` (memakai PGlite sementara sesuai petunjuk instalasi sebelumnya), `node scripts/test-ahsp.mjs`, dan `node scripts/test-ahsp-search-trigger.mjs`.

Audit snapshot langsung 14 Oktober 2026 membaca 11.541 versi/sumber, 7.925 nama unik di seluruh katalog, dan 6.209 nama unik pada regulasi aktif. Ada 3.581 kelompok dengan lebih dari satu versi/sumber. Pasangan Papan Informasi Keselamatan Konstruksi pada screenshot tepat terdiri dari Permen 8/2023 (`bh`, tanpa kode, Normatif) dan SE 47/2026 (`Buah`, kode `1.22.(2l)`, Informatif). Snapshot/laporan lokal berada di `anti-slop/ahsp-name-groups/`. Audit read-only: `node --env-file=.env.local scripts/audit-ahsp-name-groups.mjs`; uji seluruh snapshot: `node scripts/test-ahsp-name-groups.mjs anti-slop/ahsp-name-groups/snapshot.json`.

Setiap baris pekerjaan memiliki tombol ikon Salin yang terpisah dari pembuka modal. Clipboard berisi satu baris TSV tanpa header, dengan urutan kolom: kode, nama pekerjaan, bidang, divisi, satuan, jenis item, regulasi, lampiran, halaman PDF. Tab/baris baru di dalam nilai diganti spasi agar hasil tetap menjadi satu baris saat ditempel ke spreadsheet. Ikon centang dan status yang diumumkan pembaca layar menandai keberhasilan; kegagalan clipboard ditampilkan sebagai pesan. Tidak ada perubahan data PostgreSQL.

Klik teks kode menyalin kode saja; klik teks nama pekerjaan menyalin nama saja. Keduanya memakai tombol teks yang dapat difokuskan dengan keyboard dan tidak bersarang dalam tombol pembuka analisis. Area baris lainnya tetap membuka modal. Ikon Salin di ujung baris tetap menyalin seluruh data TSV.

Status sukses/gagal salin tampil sebagai floating alert di kanan bawah selama 3 detik, tanpa menggeser tabel atau mengambil fokus. Menyalin lagi memulai ulang durasinya, termasuk untuk teks yang sama. Indikator centang baris kembali normal setelah expiry. Alert memakai aria-live polite, mengikuti tema dan safe area, tidak menangkap pointer, serta menonaktifkan animasi entrance ketika reduced motion aktif.

Ringkasan pencarian lanjutan berada di sidebar kanan selebar 320 piksel pada viewport minimal 1280 piksel. Di layar lebih sempit, ringkasan menjadi disclosure yang tertutup secara default sebelum tabel. Pengguna dapat membuka/menutup ringkasan pada kedua layout; jumlah hasil tetap ditampilkan pada header pekerjaan. Kecocokan per istilah memakai daftar dengan nilai Exact/Like, sehingga nama panjang dapat membungkus tanpa tabel statistik yang sempit. Sidebar tidak sticky, tidak menutupi tabel, dan memakai gulir halaman. Saat pencarian diperbarui, panel mempertahankan posisinya dan menampilkan status memuat agar statistik lama tidak dianggap hasil baru.

Pencarian berada di atas tabel dalam layout bertumpuk pada semua ukuran layar. Baris utama berisi pencarian tunggal dan regulasi. Tombol Cari berada di dalam panel lanjutan, dalam kelompok yang sama dengan textarea: di sampingnya mulai lebar 900 piksel dan tepat di bawahnya pada layar kecil. Pencarian tunggal tetap otomatis dengan debounce tanpa tombol tambahan. Panel lanjutan dapat dibuka dari baris kontrol di bawahnya; pilihan Like-match/Exact-match berdekatan dengan isian banyak istilah. Bidang, divisi, dan satuan dikelompokkan di sebelahnya pada desktop dan mengalir ke bawah pada ponsel. Tombol Cari menutup panel lanjutan dan memindahkan fokus ke hasil pada semua ukuran layar; Ubah pencarian mengembalikan fokus ke isian. Membuka/menutup panel tidak membuang hasil atau filter aktif. Mengubah pencarian dasar kembali memakai mode pencarian satu item. Panel tidak sticky dan tidak mempunyai area gulir sendiri.

Jenis Normatif/Informatif diambil dari daftar lampiran. SMKK mengikuti label Informatif untuk kelompok A.7 dalam daftar isi Lampiran V (halaman PDF 4). Pada snapshot ini ada 2.868 Normatif, 2.339 Informatif, dan 922 yang belum teridentifikasi. Label terakhir menunjukkan data jenis yang belum terpetakan.

Pratinjau modal menggunakan 3.638 cuplikan halaman PDF yang dirender tanpa mengubah isinya. JPEG disimpan di bucket khusus dokumen pemerintah; PDF asli dan SHA-256 tetap disimpan. Pembuatan ulang:

```text
python scripts/ahsp-page-previews.py --corpus <direktori-PDF> --inventory <inventory.json> --output <direktori-preview>
node --env-file=.env.local scripts/ahsp-upload-previews.mjs <manifest-preview.json>
node --env-file=.env.local scripts/test-ahsp-search-live.mjs
```

Uji live tersebut hanya membaca PostgreSQL dan menguji jumlah per istilah, exact/like, hasil bertumpang tindih, tipe, pagination, dan pencarian 50 istilah.

## Rekonsiliasi SIPASTI PU

Migrasi `202610130008_ahsp_sipasti_reconciliation.sql` menambahkan `sipasti_status`, asal item, hash sumber dan nomor baris JSON. Ekspor JSON disimpan pada tabel `ahsp_sipasti_imports` yang hanya dapat diakses service_role. Aplikasi tidak menampilkan data mentah sumber tersebut.

```text
node --env-file=.env.local scripts/reconcile-ahsp-sipasti.mjs <json-SIPASTI> <direktori-laporan>
node --env-file=.env.local scripts/reconcile-ahsp-sipasti.mjs <json-SIPASTI> <direktori-laporan> --apply
node scripts/test-ahsp-sipasti.mjs
```

Tanpa `--apply`, skrip hanya membaca database dan menghasilkan laporan. Dengan `--apply`, RPC melakukan pemeriksaan snapshot, pembaruan tag, dan penambahan item dalam satu transaksi. Jika identitas/jumlah katalog berubah, seluruh transaksi dibatalkan. Nama, satuan, koefisien, dan halaman item lama tidak ditimpa. Item baru dari SIPASTI belum memiliki rincian komponen lampiran dan diberi `analysis_status = unavailable`.

Pencocokan memakai kode yang dinormalisasi spasi/kapitalisasi, bidang, dan regulasi aktif. Sufiks huruf, angka tambahan, dan tanda kurung tetap dibedakan. Untuk kode yang mewakili beberapa nama database berbeda, nama juga harus cocok setelah normalisasi spasi/kapitalisasi. Baris JSON ganda tidak menambah item ganda; referensi semua baris dipertahankan. Nama/satuan yang berbeda pada kode tunggal dilaporkan terpisah.

Tag `Verfied` mengikuti ejaan permintaan pengguna dan berarti keberadaan item pada kedua sumber, bukan validasi kelengkapan analisis atau kesamaan seluruh metadata. Item yang ditambahkan hanya dari SIPASTI mempertahankan asal tersebut ketika proses dijalankan ulang. Ekspor hanya memuat SE 47/2026; tidak munculnya item Umum Permen 8/2023 berarti di luar cakupan ekspor, bukan item tidak sah.

Pengguna mengoreksi kode `2.3.(25a)1` dan nama `1Saluran U Pracetak Tipe DS 5` menjadi `2.3.(25a)` / `Saluran U Pracetak Tipe DS 5`. Importer mengenali pasangan salah tersebut secara khusus pada bidang Bina Marga dan regulasi SE 47/2026. Duplikat kosong telah digabungkan ke item asli setelah backup, dan referensi baris 2.862 dipindahkan. Hasil terkini: 6.129 item, terdiri dari 5.718 Verfied, 411 Hanya ada di Database, dan 0 Hanya ada di SIPASTI.

Tiga tombol status berada dalam pencarian lanjutan, menggunakan satu pilihan aktif dan hanya diterapkan setelah klik Cari. Klik tombol aktif lagi menghapus pilihan. Tag tampil tepat di bawah nama pekerjaan. Filter status diterapkan sebelum pencocokan dan penghitungan ringkasan, sehingga total/statistik/pagination tetap memakai cakupan yang sama.

Rekonsiliasi berikutnya memakai ekspor gabungan SE 47/2026 dan Permen 8/2023. Importer kini mengenali kedua regulasi, memprioritaskan SE 47/2026 jika satu baris menyebut keduanya, dan mempertahankan referensi nomor baris JSON asli. SMKK Permen 8/2023 dikecualikan secara default sesuai permintaan versi terbaru; `--include-permen-smkk` hanya digunakan jika pengguna memilih memasukkan versi tersebut. Pekerjaan tanpa kode menggunakan identitas nama/satuan bersama bidang/regulasi. Laporan pengecualian dihasilkan bersama CSV rekonsiliasi.

Penerapan ekspor gabungan 6.250 baris mengubah 249 item Umum menjadi Verfied. Pengguna kemudian memilih memasukkan SMKK Permen 8/2023: 249 baris menjadi 248 item unik tanpa kode, memakai nama dan satuan sebagai identitas bersama bidang/regulasi. Cakupan ini diimpor dengan `--include-permen-smkk`, dan impor ulang harus memakai pilihan yang sama. Total terbaru 6.377, Verfied 5.967, Hanya ada di Database 162, Hanya ada di SIPASTI 248. SMKK berjumlah 397: 149 SE 47/2026 dan 248 Permen 8/2023. Tidak diperlukan migrasi baru; RPC migrasi 08 digunakan kembali. Sumber fallback modal mengikuti regulasi Permen untuk item yang belum terpetakan; metadata dan analisis lama tidak ditimpa.

## Preloader awal

Komponen `initial-preloader.tsx` menutupi viewport pada pemuatan pertama. Indikator tiga baris memakai transform/opacity, latar inert, dan gulir dikunci sementara. Respons pertama yang sukses maupun gagal memulai fade 180 ms; reduced motion memakai indikator statis dan exit segera. Tidak ada persentase atau durasi pemuatan minimum buatan. Kembali ke menu tetap tersedia. Pencarian, filter, pagination, dan retry berikutnya tidak mengaktifkan preloader lagi. Verifikasi: `node scripts/test-ahsp-preloader.mjs` dan `node scripts/test-ahsp-search-trigger.mjs`.

## Rujukan analisis

Migrasi 09 menambahkan foreign key `analysis_target_id` dan metadata `analysis_reference`. Audit memetakan kutipan Permen pada judul item SE berdasarkan kode masing-masing, bukan seluruh teks halaman. Sebanyak 103 relasi tersimpan: 2 terverifikasi dan 101 perlu tinjauan. Dua relasi siap adalah 1.1.1.3 → U.1.1.3 (c), serta 1.3.1.5 → U.3.5.1.e (a). Kekosongan metadata batas biaya umum, analisis belum lengkap dan perbedaan nama/satuan/komponen dilaporkan, bukan diasumsikan setara.

Label rujukan tampil di bawah nama dan sumber analisis pada kolom regulasi. Modal tetap mempertahankan identitas item asal; kalkulator dan komponen menggunakan item tujuan hanya ketika `reference_ready` dari API bernilai true. Sidik data asal/tujuan diperiksa setiap kali detail dimuat sehingga perubahan analisis membatalkan kesiapan lama. Relasi belum siap membatasi perhitungan otomatis dan menampilkan catatan pemeriksaan. Tombol terpisah membuka item tujuan, halaman rujukan SE, atau lampiran Permen. Kutipan rujukan tersedia dalam disclosure.

```text
node --env-file=.env.local scripts/import-ahsp-references.mjs <audit.json> <snapshot.json> <hasil-audit.json>
node --env-file=.env.local scripts/test-ahsp-references-live.mjs
```

Importer menolak perubahan analisis sejak snapshot dan menerapkan relasi melalui RPC atomik tanpa menyalin/menimpa komponen. Uji live menjalankan handler API asli terhadap PostgreSQL; tidak memerlukan server Next.js.
