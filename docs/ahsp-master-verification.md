# Rekonsiliasi master AHSP

Pembaruan 19 November 2026: [impor master tanpa rincian analisis](ahsp-master-list.md) menambahkan 233 SPTJM dan 20 versi pekerjaan berlabel SE dengan status Need re-verified. Angka Oktober di bawah merupakan hasil historis rekonsiliasi komponen; penambahan master terbaru tidak mengubah komponen atau status versi lama.

Diperiksa 27 Oktober 2026. Katalog menggunakan dua status: **Verified** (hijau) dan **Need re-verified** (merah). Status berlaku per versi pekerjaan, bukan seluruh nama yang dikelompokkan. Nilai asal `sipasti_status` lama tetap tersimpan sebagai riwayat internal; UI dan filter memakai `verification_status`.

## Sumber dan kontrak

Ekspor `202610272119_master item pekerjaan dan komponen.json` memiliki SHA-256 `304924e65d97cf4474bfe6dc3ccc6a70d9696c7518f0f364c21512f5b9e5d55d`: 103.626 baris, 8.202 pekerjaan sumber, dan 51.076 komponen. ID pekerjaan/komponen/variabel ekspor hanya mengelompokkan baris. Pencocokan terhadap katalog memakai bidang, edisi regulasi, kode, nama, dan satuan yang dinormalisasi konservatif. Satuan setara seperti m³/m3, M1/meter panjang, dan bh/buah dapat cocok; tidak ada fuzzy matching atau penggabungan spesifikasi yang hanya mirip.

Keanggotaan regulasi gabungan dipecah per edisi. Katalog tetap mencakup SE 47/2026, Permen 08/2023, dan arsip SE 182/2025. SPTJM dan regulasi kosong dilaporkan terpisah. Item tanpa komponen sah untuk SMKK. Rumus `0` berarti tidak ada rumus, tetapi koefisien numerik nol dipertahankan. Harga dasar tidak diimpor.

Verified membutuhkan pasangan identitas tunggal atau duplikat semantik identik, regulasi yang sesuai, satuan hasil tersedia, serta komponen dengan nama/satuan dan koefisien valid atau ekspresi sumber. Rumus tidak dieksekusi. Perbedaan koefisien/komponen lama, metadata berbeda, kandidat ambigu, basis kuantitas bukan satu yang tidak terbukti oleh JSON, atau rincian tidak lengkap menghasilkan Need re-verified dengan alasan. Status ini adalah kelulusan rekonsiliasi snapshot, bukan pengesahan teknis regulasi.

## Penerapan

Terapkan manual melalui Supabase SQL Editor, dalam urutan:

1. `supabase/migrations/202610270001_ahsp_master_verification.sql`.
2. `supabase/migrations/202610270002_ahsp_master_mptk_units.sql`.

Migrasi pertama menambah status, catatan, asal analisis, provenance, cadangan per item, dan RPC batch service-role. Migrasi kedua mengizinkan satuan `jam` untuk tenaga yang berasal dari SIPASTI, tetap menyimpan satuan asli, dan membatasi proyeksi rekap agar variabel rumus tidak disalin ke agregasi. Validasi PDF tetap memakai aturan lama. Dilarang memakai status lama `both` sebagai bukti Verified baru.

Alat persiapan dan penerapan:

```text
node --env-file=.env.local scripts/snapshot-ahsp-master.mjs
node scripts/reconcile-ahsp-master.mjs <master.json> <snapshot.json> <folder-laporan>
node --env-file=.env.local scripts/apply-ahsp-master.mjs <folder-laporan>/plan.json
node --env-file=.env.local scripts/apply-ahsp-master.mjs <folder-laporan>/plan.json --apply
node --env-file=.env.local scripts/apply-ahsp-master.mjs <folder-laporan>/plan.json --verify
node --env-file=.env.local scripts/verify-ahsp-master-live.mjs
```

Tanpa flag, alat penerapan memeriksa prasyarat tanpa menulis. Flag `--apply` menulis batch 25 item dan dapat dilanjutkan dengan rencana sama setelah koneksi terputus. RPC menyimpan baris sebelum/sesudah di `ahsp_master_changes`. Item yang telah diterapkan tetapi berubah lagi ditolak. Snapshot lokal dan rencana disimpan di `anti-slop/ahsp-master-2026-10-27/` (diabaikan Git), bukan `.next` agar tidak hilang saat build. Jangan memakai importer lama setelah penerapan ini tanpa audit ulang.

Data JSON mengganti rincian langsung hanya untuk pasangan identitas yang pasti. Rincian yang berbeda dari ekstraksi lama dapat disimpan, tetapi tetap merah. SMKK mempertahankan komponen biaya sebelumnya bila ada. Identitas pekerjaan, regulasi, basis kuantitas, dan rujukan PDF tidak ditimpa. Rujukan analisis lintas item dilepas hanya ketika rincian langsung JSON tersedia; cadangan menyimpan rujukan lama.

Pemulihan menggunakan `before_row` pada run terkait atau snapshot lokal. Sebelum memulihkan, cocokkan kondisi kini dengan `after_row` untuk menghindari penimpaan perubahan berikutnya. Pulihkan hanya kolom yang ditulis run ini, melalui SQL Editor dalam batch; jangan menghapus pekerjaan, sumber, atau schema. Pemulihan produksi belum dijalankan karena tidak dibutuhkan.

## Hasil terverifikasi

Pembacaan ulang seluruh 11.541 versi membuktikan 8.763 Verified dan 2.778 Need re-verified. Rincian dilengkapi pada 10.189 versi non-SMKK. Katalog sesudah penerapan memiliki 67.813 baris komponen dan 72.477 variabel sumber. Jumlah ini mencakup versi regulasi terpisah, bukan jumlah master komponen unik. Terdapat 26 kandidat versi sumber yang belum dapat dipilih otomatis; semuanya tersedia dalam laporan sumber belum terpasangkan, termasuk konflik analisis dan variasi kode.

Laporan lokal: `reconciliation/reconciliation.csv`, `regulations.csv`, `unmatched-source.csv`, `excluded-source.csv`, `applied-verification.json`, dan hasil pemeriksaan langsung `live-checks.json` jika seluruh pemeriksaan berhasil. Hash run: `5fd10df768e5dc61b2f02ed60d8eda75ca5e42c8f1ca07d3c4361fc71450b87e`.

Pemeriksaan langsung sesudah migrasi MPTK terbaru lulus: kedua filter status mengembalikan hanya versi berstatus sesuai, pencarian tenaga kerja Bina Marga berhasil, dan unit tenaga `jam` dipertahankan. `live-checks.json` menyimpan buktinya. Empat pasangan warna status terang/gelap memiliki rasio kontras 6,74–8,80:1. Alur filter, modal, pagination, dan salin diuji melalui harness komponen; pemeriksaan visual browser langsung belum dijalankan.

Uji: `node scripts/test-ahsp-master.mjs`, `node scripts/test-ahsp-master-sql.mjs`, `node scripts/test-ahsp.mjs`, `node scripts/test-ahsp-search-trigger.mjs`, `node scripts/test-ahsp-rab.mjs`, dan `node scripts/test-ahsp-rab-usage.mjs`. SQL diuji dengan PGlite lokal sementara pada `.tools/ahsp-sql-test/`, bukan database produksi. Typecheck lulus. Build `npm run build -- --webpack` lulus; build Turbopack gagal internal pada proses CSS di lingkungan Windows ini.
