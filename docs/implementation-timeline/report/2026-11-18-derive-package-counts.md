# Hitung otomatis paket aktif dan paket siap integrasi

> Date: 2026-11-18
> Status: verified
> Change type: feature
> Scope: `/report`, ringkasan laporan dan migrasi snapshot

## Outcome

Total paket sekarang dihitung dari paket aktif bernama. Jumlah siap integrasi menghitung paket berstatus Siap Integrasi SIPD atau Sudah diterima SIPD. Paket baru bernama memulai alur PU; daftar aktif tampil lebih dahulu dan arsip nonaktif dibuka terpisah. Nama paket membuka panel detail, dan riwayat catatan menampilkan tanggal serta waktu.

## Implementation

Aturan hitung berada di model laporan dan dipakai konsisten oleh tabel, filter, grafik, Excel, serta PDF. Template Excel versi 3 memperlakukan kedua jumlah sebagai hasil hitung. Migration `202611180002_report_derived_package_counts.sql` memperbarui ringkasan snapshot lama agar grafik historis menggunakan definisi yang sama. Status alur paket tetap diubah lewat aksi modal Tahap 4.

Panduan penggunaan diperbarui di [panduan laporan](../../report.md).

## Verification

- `npx tsc --noEmit` — selesai tanpa error.
- ESLint berkas fitur laporan — selesai tanpa error.
- `npm run build -- --webpack` — berhasil.
- Build Turbopack default gagal saat membuat proses PostCSS; build Webpack menyelesaikan kompilasi, TypeScript dan pembuatan halaman.

## Limitations and follow-up

Migration harus dijalankan manual melalui Supabase SQL Editor sesuai urutan filename sebelum ringkasan snapshot lama di production memakai angka hitung baru. Status penerapan di Supabase live belum diverifikasi.
