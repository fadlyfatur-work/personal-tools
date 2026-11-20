# Impor master pekerjaan tanpa rincian analisis

Penerapan terverifikasi 19 November 2026. Sumber: `202611191151_master_item_pekerjaan_bidang.xlsx`, SHA-256 `b9bc28f663e5294df609cf27c604f8c1f7fb2032944bc2c2bc150b96ddecd60b`.

## Data yang diterapkan

Ekspor memiliki 9.655 baris dengan bidang pekerjaan. Seluruh baris disimpan sebagai snapshot sumber pada `ahsp_sipasti_imports`. Katalog bertambah 253 versi tanpa mengubah 11.541 versi sebelumnya:

| Label sumber | Tambahan |
|---|---:|
| SPTJM | 233 |
| SE 47/2026 | 17 |
| SE 182/2025 | 3 |
| **Total** | **253** |

Total sesudah penerapan: 11.794 versi. SPTJM terdiri dari 90 pekerjaan Bina Marga dan 143 Sumber Daya Air. Tiga baris SPTJM berulang dikelompokkan berdasarkan metadata dan nomor barisnya tetap dipertahankan. Dua belas satuan kosong dipertahankan dengan alasan pemeriksaan; satuan dari edisi lain tidak disalin.

Semua tambahan berstatus `verification_status = needs_review` dan `analysis_status = unavailable`, dengan `components = []`, tanpa rujukan analisis atau halaman PDF. Persentase biaya umum/keuntungan sumber disimpan dalam provenance, tidak diubah menjadi batas persentase regulasi. Pekerjaan dengan pasangan kode/nama berbeda metadata ditahan dalam laporan tinjauan. Sebanyak 1.441 baris tanpa label regulasi yang dapat dipakai disimpan dalam snapshot sumber, bukan sebagai versi katalog berlabel `null` atau `-`.

## Katalog dan API

Migrasi `202611190001_ahsp_sptjm_catalog.sql` memperluas view `ahsp_catalog_versions` dengan SPTJM. Filter SPTJM dipilih eksplisit; pencarian bawaan tetap memakai SE 47/2026 dan Permen 08/2023. SPTJM tidak diperlakukan sebagai pengganti edisi lain. API daftar/detail dan katalog pencocokan RAB menerima SPTJM. Tidak ada rekap MPTK buatan untuk master yang belum memiliki komponen.

Modal tidak memakai fallback PDF SE 47/2026 untuk SPTJM. Tanggal pemeriksaan hanya ditampilkan bila memang tersimpan, sehingga master baru tidak menghasilkan tanggal tidak valid. Tidak ada deploy hosting dalam pekerjaan ini.

## Alat dan pemeriksaan

`scripts/import-ahsp-master-list.mjs` membaca manifest JSON hasil pembacaan workbook. Manifest memuat `source_name`, `sha256`, dan `rows` dengan kolom sumber beserta nomor baris. Persiapan memvalidasi bidang, nama, dan jenis pekerjaan. Identitas deterministik memakai bidang, regulasi, kode, serta nama, tanpa menggunakan ID sistem ekspor.

```text
node --env-file=.env.local scripts/import-ahsp-master-list.mjs <source.json> <folder-laporan>
node --env-file=.env.local scripts/import-ahsp-master-list.mjs <source.json> <folder-laporan> --apply
node --env-file=.env.local scripts/verify-ahsp-master-list-live.mjs
```

Tanpa `--apply` hanya membaca database dan menulis rencana/snapshot lokal. Penerapan menyimpan snapshot sumber lalu menambah maksimal 500 baris dalam satu permintaan insert transaksional. Benturan ID membatalkan insert, bukan menimpa. Arsip sumber yang sudah tersimpan tetap dapat dipakai untuk mengulang persiapan. Sebelum dan sesudah insert, seluruh baris katalog dibaca dan dibandingkan; importer memastikan semua baris lama identik, seluruh tambahan sesuai rencana, dan persiapan ulang menghasilkan nol tambahan.

Bukti penerapan lokal berada di `anti-slop/ahsp-master-2026-11-19/import/`: `source.json`, snapshot `*-catalog-before.json`, `*-catalog-after.json`, `*-plan.json`, `applied.json`, dan `live-checks.json`. Folder diabaikan Git dan tidak dibersihkan oleh build. Jika perlu pemulihan, gunakan ID tambahan dalam rencana dan periksa seluruh nilai kini terhadap snapshot sesudah impor sebelum tindakan apa pun; jangan menimpa versi yang sudah dilengkapi kemudian. Pemulihan produksi tidak dijalankan.

Pemeriksaan langsung membuktikan 233 SPTJM terlihat di view dan pencarian, semuanya merah dengan analisis kosong, 12 satuan kosong tetap utuh, serta filter Verified menghasilkan nol SPTJM. Uji persiapan, SQL/PGlite, API AHSP, alur filter/modal, pencocokan RAB, dan rekap penggunaan lulus. Typecheck, lint berkas terkait, serta `npm run build -- --webpack` lulus. Tidak ada pemeriksaan visual browser langsung.
