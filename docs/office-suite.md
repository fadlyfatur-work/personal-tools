# Office Suite: penggunaan, penyiapan, dan verifikasi

Pembaruan: 30 Oktober 2026. Dokumen ini menjelaskan kode yang ditambahkan untuk [PRD](office-suite-prd.md). Penerapan SQL pada Supabase, akun admin, PIN organisasi, dan penjadwal worker tidak dijalankan otomatis.

## Aplikasi

Di `/menu`, satu entri **Office Tools** (`/office`) mengelompokkan Office Workspace, Documents (`/documents`, alias `/document`), Deployment & Change Tracker (`/deployments`), dan Health Dashboard (`/monitoring`). Setelah dibuka, pilih fitur melalui menu kiri. Office memiliki empat submenu: pekerjaan, follow-up, rapat, dan pengetahuan. Task dan FollowUp memakai domain pekerjaan yang sama.

Akun bersama menggunakan `/tools/login`, dengan pendaftaran email/kata sandi tanpa verifikasi email, pemulihan kata sandi, ruang kerja pribadi/tim dan undangan. Pendaftaran hanya meminta email dan kata sandi minimal delapan karakter, lalu langsung membuka sesi. `/tools/workspaces` mengelola ruang kerja serta anggota. Login FinTrack tetap memakai cookie sendiri; sign-out Supabase pada jalur FinTrack menggunakan scope lokal agar tidak mencabut sesi suite lain.

Pengunjung Documents tidak wajib memiliki akun. PIN membuka semua template terbit pada satu tag akses instansi/lembaga/divisi. Akun biasa tidak otomatis membuka koleksi. Admin template yang ditetapkan operator dapat mengelola tag/PIN, metadata, file, konfigurasi isian, versi, pengujian Word, dan publikasi melalui `/documents/admin`.

## Penyiapan database dan akun

1. Cadangkan data yang relevan dan tinjau SQL. Gunakan lingkungan uji sebelum data kantor nyata.
2. Terapkan migration berikut melalui Supabase SQL Editor, berurutan:
   - [001: akun/workspace](../supabase/migrations/202610260001_tools.sql)
   - [002: Documents](../supabase/migrations/202610260002_documents.sql)
   - [003: Office](../supabase/migrations/202610260003_office.sql)
   - [004: operasi TI](../supabase/migrations/202610260004_operations.sql)
   - [005: admin dan akses pengguna](../supabase/migrations/202610280001_tools_admin.sql)
3. Migration Documents menutup pembacaan anonim tabel `templates` lama. Koordinasikan dengan peluncuran aplikasi baru; generator lama tidak boleh tetap menjadi jalan masuk anonim.
4. Aktifkan metode email/kata sandi Supabase Auth. Pendaftaran suite memakai Admin API hanya di server dengan `email_confirm: true`, lalu login melalui klien cookie suite. Tidak mengirim verifikasi, tidak memerlukan SMTP untuk daftar/login, dan tidak mengubah pengaturan konfirmasi proyek secara global. Pemulihan kata sandi tetap membutuhkan pengiriman email; untuk fitur itu, siapkan pengirim dan izinkan redirect `/tools/auth/callback` pada origin yang dipakai.
5. Pasang environment server berikut, masing-masing secret terpisah minimal 32 karakter:
   - `DOCUMENTS_PIN_LOOKUP_SECRET`: HMAC pencarian dan keunikan PIN. Jangan menggantinya tanpa prosedur reset/rekey tag.
   - `DOCUMENTS_SESSION_SECRET`: tanda tangan sesi akses Documents.
   - `TOOLS_WORKER_SECRET`: autentikasi worker terjadwal.
   - Variabel Supabase yang sudah dipakai proyek tetap diperlukan. Tidak ada secret di atas yang memakai `NEXT_PUBLIC_`.
6. Restart aplikasi sesudah environment berubah. Daftarkan akun pengelola; setelah sesi terbuka, akses salah satu halaman suite untuk membuat profil.
7. Gunakan skrip setup lokal untuk memberikan hak admin kepada akun yang dimaksud. Skrip tidak memberikan hak admin dari formulir pendaftaran.

```powershell
node scripts/setup-office-suite.mjs
node scripts/setup-office-suite.mjs check
node scripts/setup-office-suite.mjs admin --email "alamat-akun-admin"
node scripts/setup-office-suite.mjs admin --email "alamat-akun-admin" --apply
```

Ganti `alamat-akun-admin` dengan email akun yang telah masuk dan memiliki profil suite. Perintah tanpa `--apply` adalah dry run. `check` hanya memeriksa kesiapan dan tidak menampilkan secret. CLI admin adalah operasi operator dengan service-role; simpan akses ke mesin/environment itu dengan benar. Daftar/login tidak membuktikan kepemilikan kotak email dan tidak memberi hak admin. Akun lama yang telanjur belum dikonfirmasi harus diperiksa operator di Supabase; endpoint login tidak mengonfirmasi atau mengganti akun lama secara otomatis.

Untuk mengaktifkan seluruh schema dan role dua akun awal yang diminta pengguna, `node scripts/prepare-office-suite-sql.mjs` menyusun `.next/office-suite-activation.sql`. Tinjau dan jalankan file tersebut pada SQL Editor proyek yang dimaksud. Skrip persiapan tidak menghubungi database dan tidak memuat kata sandi. Build dapat menghapus `.next`; jalankan persiapan lagi bila perlu. Jangan memakai migration reset FinTrack untuk menyiapkan Office.

## Pengguna dan tampilan

Admin aplikasi membuka `/tools/users` atau tautan **Pengguna** pada menu kiri. Halaman menyediakan pencarian email, daftar berpaginasi, tambah akun, perubahan nama, hak admin aplikasi, hak admin template, serta aktif/nonaktif akses suite. Pengguna baru selalu dibuat sebagai pengguna biasa; haknya diubah melalui panel Kelola. Tidak ada penghapusan permanen atau perubahan kata sandi/email akun lain pada halaman ini.

Admin aplikasi (`is_suite_admin`) berbeda dari admin template dan peran workspace. Admin template saja tidak dapat mengelola pengguna. Admin aplikasi tidak memperoleh akses implisit ke catatan pribadi pengguna lain. Menonaktifkan akun membatalkan hak suite pada pemeriksaan server berikutnya, tanpa ban Supabase global atau perubahan login FinTrack. SQL mencegah admin menonaktifkan atau mencabut haknya sendiri dan memeriksa revisi sebelum menyimpan.

Pilihan **Tampilan** tersedia pada shell akun, Office, Change Tracker, Health Dashboard, serta katalog/editor Documents. Pilih Sistem, Terang, atau Gelap. Preferensi disimpan sebagai `tools:theme` pada perangkat; jika penyimpanan diblokir, pilihan tetap bekerja selama halaman aktif. Tema mengikuti preferensi sistem otomatis melalui CSS dan tidak mengubah tema FinTrack. Warna editor Quill, status, isian, daftar terpilih, dan panel menggunakan token yang sama.

Office, Documents, Change Tracker, Health Dashboard dan halaman pengelola memakai menu bersama: kelompok Office, Dokumen & layanan, serta Pengelolaan sesuai hak akun. Di desktop, klik menu membuka komponen fitur di panel kanan menggunakan rute yang sama. Di layar sempit, tombol **Menu** membuka navigasi di atas isi; memilih fitur atau menekan Escape menutupnya. Escape mengembalikan fokus ke tombol Menu. Katalog dan editor Documents tetap dapat dibuka dengan PIN tanpa akun.

Redesain 1 November 2026 memakai sidebar datar beridentitas **Office Tools**, pilihan workspace dekat judul, daftar catatan yang terhubung, dan satu sistem kontrol/panel pada kedua tema. Katalog Documents memakai lebar penuh dengan petunjuk singkat dan tombol **Hapus filter**; koleksi tanpa template dibedakan dari pencarian tanpa hasil. Admin template menempatkan kelompok/daftar di kiri dan editor/uji/penerbitan di kanan pada layar lebar, lalu menumpuknya pada layar sempit. Dasar audit dan kontrak UX tercatat dalam [audit dan rencana redesain](superpowers/plans/2026-11-01-office-tools-redesign.md).

Pada 28 Oktober 2026, setelah pengguna menjalankan SQL aktivasi, API Supabase mengonfirmasi kedua profil aktif, akun pengelola memiliki admin aplikasi/template dan akun biasa tidak memilikinya; pembacaan Office berhasil. Jika error `OFFICE_SETUP_REQUIRED` muncul lagi, jalankan pemeriksaan setup sebelum mengubah UI atau memakai data contoh.

## Memindahkan dua generator lama

1. Masuk `/documents/admin`; buat tag akses dan PIN pilihan pengelola. Tidak ada PIN contoh yang otomatis dibuat.
2. Salin ID tag dari panel pengelola atau hasil API admin untuk penggunaan operator. Pengguna biasa tidak perlu mengetahui ID.
3. Jalankan import dry run, lalu import sebenarnya dengan ID tag tersebut:

```powershell
node scripts/setup-office-suite.mjs import --email "alamat-akun-admin" --tag "id-tag-akses"
node scripts/setup-office-suite.mjs import --email "alamat-akun-admin" --tag "id-tag-akses" --apply
```

Importer memindahkan Surat Tugas dan konfigurasi Perjadin lama ke katalog baru sebagai draft. File dan baris lama dipertahankan. Code yang sudah diimpor tidak ditimpa; Perjadin harus memiliki konfigurasi yang benar di tabel lama, bukan field rekaan.

Uji draft di admin, buka hasil Word untuk memeriksa tata letak, tandai sudah diperiksa, lalu terbitkan. Tautan `/documents/surat_tugas` dan `/documents/perjadin_2026` tetap ada, tetapi membutuhkan hak tag/admin. Alias `/document` tetap menuju `/documents`. Kegagalan penyiapan menghasilkan penolakan atau pesan layanan belum siap, bukan fallback template publik.

## Worker dan monitoring

Jadwalkan `POST /api/monitoring/worker` setiap menit pada scheduler hosting yang diizinkan, dengan header `Authorization: Bearer <TOOLS_WORKER_SECRET>`. Jangan menaruh token di URL. Alternatif runner untuk scheduler yang menyediakan Node:

```powershell
node scripts/run-operations-worker.mjs
```

Runner membaca `NEXT_PUBLIC_SITE_URL` dan `TOOLS_WORKER_SECRET` dari environment. Worker juga menjalankan reminder Office. Sekali panggil mengambil paling banyak delapan slot pemeriksaan, dua serentak, dan maksimal 500 reminder Office. Endpoint worker tidak memakai sesi browser.

Monitoring awal hanya untuk target HTTP/HTTPS publik pada port standar, tanpa query/kredensial. DNS/IP dan redirect diperiksa; target privat/metadata ditolak. Runtime worker harus menyediakan Node DNS/TCP/TLS. Interval minimal lima menit dan timeout maksimal sepuluh detik. Notifikasi tersimpan dalam aplikasi, bukan WhatsApp/email/push. Tidak ada deployment atau rollback infrastruktur yang dijalankan oleh Change Tracker.

## Penyimpanan dan batas sesi

- Bucket `documents-private` menyimpan DOCX admin; `office-private` menyimpan lampiran pekerjaan/rapat/KB. Keduanya privat.
- PIN disimpan sebagai verifier hash dan HMAC lookup, tidak dapat dibaca ulang admin. PIN lama dapat diganti/dicabut.
- Grant PIN berlaku delapan jam; pergantian PIN/tag membatalkan akses pada permintaan protected berikutnya. Byte yang telah diunduh tidak bisa ditarik kembali.
- Template terbit mengacu pada pasangan file dan konfigurasi versi yang sama. Penggantian tetap draft sampai diuji dan diterbitkan. Penghapusan template adalah penghapusan logis.
- Tentukan kebijakan backup, retensi versi, audit dan pembersihan orphan sebelum data nyata. Tidak ada purge fisik otomatis yang diam-diam menghapus versi lama.
- Tanpa Vercel, limiter jaringan menggabungkan sumber sebagai `direct`; atur pengendalian trafik tepercaya pada hosting agar pengguna di kantor bersama tidak terkena pembatasan yang tidak sesuai. Header IP dari klien tidak dianggap bukti identitas.

## Verifikasi

Pemeriksaan fungsi dapat dijalankan tanpa menulis ke Supabase:

```powershell
node scripts/test-tools-suite.mjs
node scripts/test-tools-auth.mjs
node scripts/test-tools-admin.mjs
node scripts/test-tools-theme.mjs
node scripts/test-tools-ui.mjs
node scripts/test-documents-access.mjs
node scripts/test-documents-api.mjs
node scripts/test-documents-ui.mjs
node scripts/test-office-domain.mjs
node scripts/test-office-api.mjs
node scripts/test-office-session.mjs
node scripts/test-operations.mjs
npm run typecheck
npm run lint
npm run build
```

Tes API menggunakan adapter penyimpanan uji; tes Operations mencakup koneksi HTTP lokal. Tes itu tidak membuktikan konfigurasi Auth, RLS, Storage, email, scheduler atau jangkauan jaringan Supabase production. Hasil pemeriksaan aktual dan batas yang belum diuji dicatat pada [rekaman implementasi](implementation-timeline/office-suite/2026-10-27-office-suite.md).

Pemeriksaan SQL terisolasi menggunakan PostgreSQL/WASM di memori; tidak menghubungi Supabase. Pasang runtime uji sementara sesudah build karena build dapat membersihkan `.next`:

```powershell
npm install --prefix .next/office-db-check --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.12
node scripts/test-office-migrations.mjs
node scripts/test-tools-admin-sql.mjs
```

Tes langsung `scripts/test-documents.mjs` dan `scripts/test-surat-tugas.mjs` memerlukan aplikasi aktif, database yang sudah disiapkan, template terbit, serta `DOCUMENTS_TEST_PIN` dari koleksi uji. Keduanya memakai cookie PIN dan versi protected; bukan akses anonim tabel lama. Tes ini tidak membuat admin atau PIN baru. Permintaan dapat mencatat percobaan PIN dan memakai kuota limiter.
