# Audit dan redesain Office Tools

Tanggal: 1 November 2026. Dasar: checkout d970d8f beserta perubahan lokal yang sudah ada. Audit berdasarkan jalur komponen dan CSS, bukan inspeksi browser atau riset pengguna.

## Audit scope
- Surface: Office empat submenu, Documents/PIN/editor/admin, Change Tracker, Health Dashboard, akun dan pengelolaan pengguna.
- Governing evidence: permintaan menu ringkas/panel samping, referensi navy dari pengguna, PRD dan UX Office Suite. DESIGN.md hanya mengatur portofolio dan /menu; bukan palet yang wajib diwariskan ke tools.
- Runtime owners: SuiteFrame -> ToolsShell -> OfficeWorkspace / Operations; Documents publik langsung memakai SuiteFrame; admin Documents memakai ToolsShell dan documents.module.css.
- Explicit exceptions: FinTrack, AHSP, POS, halaman portofolio dan /menu tidak diubah. PIN kelompok, sesi akun, role, API dan penerbitan Word dipertahankan. Tanpa tes browser sesuai instruksi pengguna.

## Findings
| # | Observed problem | Evidence and connection | Required correction | Reach | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Pengguna masuk lewat Office Tools, tetapi identitas shell kembali menjadi Personal Tools dengan blok sambutan panjang. | app/menu/page.tsx menamai pintu masuk Office Tools; SuiteFrame dipakai seluruh aplikasi tetapi menampilkan Personal Tools. | Identitas Office Tools ringkas, hierarki aplikasi dan halaman aktif jelas; Personal Tools sebagai induk dan tautan kembali. | Seluruh suite | Tinggi, sumber |
| 2 | Kelompok navigasi dibungkus kartu masing-masing dan blok sambutan mengambil ruang di atasnya. | SuiteFrame .welcome + .group mengatur gradient, padding dan border pada setiap kelompok; permintaan pengguna mengutamakan menu simple/compact. | Sidebar datar, kelompok lewat jarak dan label, indikator pilihan tunggal; panel kanan mendapat ruang lebih besar. | Seluruh suite | Tinggi, sumber |
| 3 | Katalog menyisihkan 250px dan gap untuk petunjuk yang tidak mempunyai interaksi. | DocumentsPage -> Catalog -> .workspace/.aside; petunjuk hanya mengulang pilih, isi, unduh. | Petunjuk satu paragraf di atas filter; katalog memakai lebar area kerja. | Documents | Tinggi, sumber |
| 4 | Daftar template, kelompok/PIN, dan editor admin ditampilkan berurutan sepanjang halaman. Pilihan template terpisah vertikal dari hasil pemilihannya. | AdminWorkspace mengembalikan details kelompok, panel daftar, lalu form dan penerbitan dalam satu kolom. | Daftar dan kelompok di kiri, editor/uji/terbit di kanan; satu kolom berurutan pada layar sempit. | Admin Documents | Tinggi, sumber |
| 5 | Editor Word menyisipkan stylesheet dengan fokus biru dan warna terang sendiri di luar token suite. | documents/[code]/page.tsx memuat QuillEditor; stylesheet di dalam komponen mengatur #1a73e8 pada :focus-within dan bersaing dengan CSS Documents. Kontrak tema bersama mencakup editor. | Pindahkan geometri editor ke CSS Documents dan gunakan token permukaan, teks, kontrol dan fokus yang sama. | Editor Word | Tinggi, sumber |

## Highest-leverage change
Perbaiki SuiteFrame sebagai satu pemilik navigasi dan orientasi. Tidak menambah framework UI atau sistem navigasi kedua.

## Kontrak UX dan arah desain
Tujuan: pekerja memilih fitur dan mencatat pekerjaan; pemegang PIN membuka koleksi dan membuat Word; admin mengelola akses dan versi. Keberhasilan tetap ditentukan respons server dan unduhan, bukan dekorasi.

Pilihan desain pelaksana: aplikasi operasional datar dengan aksen navy, Geist yang sudah terpasang, permukaan netral, kontrol 8px dan panel 12px. DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 6. Dipilih dibanding kartu bertingkat karena aktivitas utama memerlukan ruang isi; gaya editorial/hero tidak cocok untuk formulir dan riwayat.

Alur:
- /menu -> Office Tools -> pilih fitur di sidebar -> ruang kerja aktif -> daftar/detail. Di layar sempit menu dibuka lewat tombol, Escape menutup dan mengembalikan fokus.
- Documents -> PIN kelompok -> nama kelompok dan kontrol kunci/ganti -> pencarian/jenis -> template -> isi -> unduh. PIN salah saat berganti tetap mempertahankan koleksi lama.
- Pencarian Documents kosong dibedakan dari koleksi tanpa template; Hapus filter mengembalikan seluruh koleksi yang diizinkan.
- Admin -> kelompok/PIN dan daftar -> editor bersebelahan -> simpan draf -> uji -> tinjau -> terbit. Riwayat dan pemeriksaan hak tetap sama.

## Implementation plan
1. SuiteFrame dan CSS: hapus blok sambutan/kartu menu, perjelas identitas, pindahkan workspace ke heading; pertahankan tautan, role, satu main, disclosure.
2. tools.module.css dan office.module.css: satukan aturan visual yang sebelumnya ditimpa berulang, buat daftar catatan terhubung, pertahankan label/field/urutan data.
3. Documents: rapikan PIN, status kelompok, filter dua kolom, katalog penuh, empty state dan reset filter; admin dua panel tanpa melepas state saat memilih.
4. Validasi: skrip Frame, tools UI/theme/auth/admin, Documents UI dan Office session; typecheck, scoped ESLint, build webpack. Tidak mengklaim pixel fidelity, viewport hasil render, Lighthouse atau CWV karena browser tidak dipakai.

## Batas dan pemeriksaan
Tidak menambah dependensi, aset dekoratif, endpoint, migrasi, atau data contoh. Breakpoint shell 960px, heading 1200px, form 760/800px, Documents admin 1200px. Grid minmax dan min-width:0 menjaga konten panjang; tabel tetap dapat digulir lokal. Kontras dihitung dari token untuk terang/gelap, bukan pengukuran setiap piksel. Validasi aktual dicatat setelah pemeriksaan selesai.

## Hasil verifikasi akhir
Delapan skrip interaksi/regresi lulus, typecheck dan scoped ESLint lulus. Build akhir webpack sesudah penyatuan CSS Quill selesai dengan exit 0 dan menghasilkan 52 halaman statis. Pemeriksaan pasangan token teks/aksi minimum 5.26:1. Pre-flight yang relevan diperiksa dari struktur, source dan tes: identitas/rute, satu main, role navigation, PIN, selected state, tema, kontrol, bentuk, grid adaptif, empty/error recovery dan reduced motion. Pemeriksaan browser, Lighthouse, pengukuran viewport serta CWV tidak dijalankan; hasil visual setiap breakpoint masih belum diverifikasi. Checklist pemasaran seperti hero, foto, bento, logo wall dan scroll story tidak berlaku pada aplikasi kerja ini.
