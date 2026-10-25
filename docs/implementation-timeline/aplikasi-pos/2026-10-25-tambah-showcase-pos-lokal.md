# Tambah showcase POS dengan data lokal browser

> Date: 2026-10-25
> Status: verified
> Change type: feature
> Scope: /aplikasi-pos, menu, portofolio, lib/pos

## Hasil

Pengunjung dapat mencoba kasir, persediaan, master data, shift, laporan, dan struk tanpa memasang backend POS atau database. Menu menambahkan Aplikasi POS, sementara portofolio menampilkan screenshot runtime dan tombol Coba demo POS. Proyek dan tautan yang sebelumnya tersedia tetap dipertahankan.

## Implementasi

Model bertipe memusatkan transaksi serta validasi. Store localStorage berversi melayani semua halaman dan menangani kegagalan storage secara terlihat. Web Locks membatasi penulisan pada satu tab. Snapshot transaksi menjaga struk lama, kunci idempotensi mencegah pembayaran berulang, dan persetujuan opname memeriksa stok awal sebelum menerapkan penyesuaian.

Lima kelompok perbaikan audit diterapkan: alur transaksi sampai struk tanpa API; master/data antarlayar konsisten; kontrol dan shift berfungsi; validasi harga/stok/SKU; kebijakan stok dengan validasi ulang saat bayar. Temuan UI terkait diperbaiki melalui layout sempit, label simulasi, tahap transaksi, pesan gagal dalam dialog, dan empty state.

Review tambahan menemukan dan memperbaiki lebar halaman terakhir PDF, penulisan antartab, form produk basi yang dapat memulihkan stok lama, penghapusan opname menunggu saat histori penuh, dan tombol pengurangan keranjang pada stok berubah. Riwayat/laporan juga diurutkan menurut timestamp.

## Keputusan

- Instruksi terbaru pengguna memilih localStorage persisten, menggantikan rencana awal data sesi sementara.
- Implementasi di Personal Tools, tanpa mengedit sumber POS asal. Perubahan lain pada checkout bersama tidak termasuk tugas ini.
- Inconsolata berlisensi OFL dipakai sebagai font monospace tertanam agar desain struk portable di browser dan PDF.
- Peran/integrasi hanya simulasi yang diberi label; tidak membuat autentikasi atau layanan provider.

## Verifikasi

Tes domain/store/PDF, typecheck, dan lint terdampak lulus. Build produksi Webpack lulus. Browser membuktikan pembayaran/kembalian, struk terunduh, data setelah refresh, master/kategori terpisah, SKU, pencarian kosong, shift, opname, pengaturan, laporan, tab kedua mode baca dan perpindahan penulis, serta navigasi portofolio/menu. Kasir diperiksa pada 320/390/768/1440 px. PDF diperiksa melalui render dan pengukuran lebar halaman otomatis.

## Batas

Belum dipublikasikan. Data lokal dapat hilang saat data situs dihapus; tidak ada sinkronisasi perangkat atau pembayaran riil. Build Turbopack default pada Windows ini gagal saat membuat proses CSS; build dengan Webpack berhasil tanpa mengubah script umum. Skrip UI lama diperbarui jumlah itemnya, tetapi tidak dijalankan penuh; integrasi POS diperiksa langsung.

## Tautan

- [Panduan dan kontrak POS](../../aplikasi-pos.md)
- [Rencana implementasi](../../superpowers/plans/2026-10-25-aplikasi-pos.md)
- [Model domain](../../../lib/pos/model.ts)
- [Tes regresi](../../../scripts/test-pos.mjs)
