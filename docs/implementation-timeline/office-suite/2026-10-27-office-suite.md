# Empat aplikasi dan akses Documents per tag

Tanggal: 27 Oktober 2026. Status: implementasi lokal; aktivasi Supabase belum siap. [Panduan operasi](../../office-suite.md), [PRD](../../office-suite-prd.md).

## Perubahan

- Tambah empat menu aplikasi dengan empat submenu Office, satu domain task/follow-up, aktivitas/checklist/laporan, notulensi/action item, serta KB/revisi/rujukan.
- Tambah akun/workspace suite, login/daftar/reset, keanggotaan dan undangan. Cookie suite terpisah dari FinTrack; operasi sign-out FinTrack sekarang scope lokal.
- Documents memakai PIN per tag organisasi, katalog/formulir/API protected, admin tag/PIN/metadata/file/config, serta draft/uji/review/publish versi DOCX. Dua generator lama dapat diimpor tanpa fallback anonim.
- Tambah catatan deployment/rollback, inventaris layanan/environment bersama Monitoring, pemeriksa HTTP/TLS, insiden/coverage, dan notifikasi dalam aplikasi.
- Siapkan empat migration tambahan, bucket privat, script setup admin/import, serta worker reminder/monitoring. Tidak menjalankan migration pada proyek pengguna.

## Pemeriksaan dan perbaikan

Tes suite, PIN/token, API generator nyata dengan adapter penyimpanan uji, Documents UI, domain/API/OOXML/session Office, dan Operations disiapkan serta dijalankan. Pemeriksaan menemukan dan memperbaiki:

- Draft Office hilang saat pemeriksaan sesi latar belakang; editor kini tetap mounted jika akun sama.
- Data privat tertinggal setelah identitas akun berganti pada workspace sama; state kini dikunci ke userId+workspace.
- Token undangan hilang saat login/pendaftaran; tujuan lengkap diteruskan secara tervalidasi.
- Reminder masih ke PIC lama; worker memakai penanggung jawab terkini dan menguji haknya lagi.
- Identitas POST/GET grant PIN berbeda; respons kini konsisten agar formulir tidak ter-remount saat fokus kembali.
- Versi Word historis tidak dapat ditinjau untuk terbit ulang; test/review kini mengikuti versi yang dipilih.
- Adapter HTTP Node 24 gagal karena lookup family; koneksi tetap dipin ke IP yang telah diperiksa.
- Kasus IPv6, riwayat coverage sesudah perubahan interval, hasil terlambat, dan konkurensi penerimaan slot diperjelas pada worker/tes.

Walkthrough browser dengan respons API uji memeriksa enam halaman Office/operasi, empat submenu, empat kartu tambahan, lebar desktop 1366 dan ponsel 375, draft yang dipertahankan, serta tujuan undangan. Ini tidak sama dengan tes transaksi pada Supabase nyata.

Verifikasi ulang 27 Oktober 2026:

- Lolos: delapan skrip suite/account UI, Documents akses/API/UI, dan Office domain/API/session; tes Operations juga lolos termasuk koneksi HTTP lokal.
- Lolos: keempat migration dijalankan pada PostgreSQL 18.6 melalui PGlite 0.5.12 di memori. Uji mengeksekusi bootstrap idempoten, keunikan PIN, retry versi, validasi sebelum publikasi, penolakan anonim, privasi/penutupan task/PIC reminder/conversion Office, serta deduplikasi hasil dan insiden monitoring. Ini bukan simulasi semua layanan Supabase atau bukti konkurensi lintas koneksi.
- Lolos: lint pada area implementasi baru dan build production `npm run build -- --webpack`, termasuk pemeriksaan TypeScript serta pembuatan 51 halaman statis.
- Belum lolos: `npm run build` standar mengalami panic Turbopack ketika proses transformasi CSS `app/globals.css` berakhir sebelum koneksi. Hasil sama saat diulang dengan izin proses lokal penuh. Build Webpack membuktikan jalur pembanding berhasil; penyebab panic Turbopack belum dipastikan. Tidak mengubah konfigurasi bundler proyek.
- Lint seluruh repositori masih memiliki 12 error CommonJS pada tiga skrip Timemark lama di luar cakupan perubahan ini. Lint area Office Suite tidak memiliki error.
- Pemeriksaan Documents browser sebelumnya mencapai alur PIN/editor/versi berubah dan pengujian Word admin dengan respons API uji. Konfirmasi publikasi pada browser belum dituntaskan; tes komponen publikasi dan versi historis lolos. Jangan menyamakan tes tersebut dengan transaksi admin pada Supabase nyata.

Panduan Documents lama disinkronkan; dua skrip uji langsung kini memakai cookie PIN serta `version_id` API. Uji langsung membutuhkan koleksi uji terbit dan `DOCUMENTS_TEST_PIN`, sehingga belum dijalankan terhadap Supabase pengguna. Tidak membuat kredensial contoh untuk melewati prasyarat itu.

Pemeriksaan baca-saja pada Supabase yang dikonfigurasi mengembalikan HTTP 404/PGRST205 untuk `tools_profiles`, `documents_access_tags`, `office_tasks`, dan `operations_monitors`: tabel belum tersedia pada API/schema cache tersebut. Ketiga secret baru juga belum tersedia pada environment lokal. Pemeriksaan awal HEAD memberi hasil siap yang keliru; skrip setup dikoreksi memakai GET tanpa baris, timeout delapan detik, dan exit nonzero jika ada prasyarat belum siap. Tidak menjalankan migration atau mengubah data untuk pemeriksaan ini.

## Aktivasi dan batas bukti

Admin, PIN organisasi dan secret tidak dibuat dengan nilai contoh. Operator harus meninjau/menerapkan SQL, memasang secret, memverifikasi email/redirect, menyiapkan admin, mengimpor/memeriksa/menerbitkan generator, lalu menjadwalkan worker. Prosedur di panduan operasi.

Tidak ada deployment, commit, reset database, atau perubahan data produksi. Perubahan AHSP yang sudah ada dalam checkout bukan hasil pekerjaan Office Suite.
