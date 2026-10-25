# Tambah tema gelap dan pilihan tema POS

> Date: 2026-10-25
> Status: verified
> Change type: feature
> Scope: /aplikasi-pos, lib/pos/theme.ts

## Hasil

Header POS menyediakan Sistem, Terang, dan Gelap. Sistem mengikuti preferensi perangkat; pilihan manual bertahan setelah refresh. Seluruh permukaan aplikasi memakai tema yang sama, sedangkan struk mempertahankan representasi kertas putih.

## Implementasi dan keputusan

Warna literal UI dipusatkan pada token CSS Modules yang mencakup canvas, panel, teks, aksen, input, border, status, focus, dan backdrop. Root `data-theme` memilih override manual; media query menangani Sistem tanpa menunggu JavaScript untuk membaca preferensi perangkat. Tema memakai useSyncExternalStore dan localStorage terpisah dari model transaksi, dengan event storage untuk sinkronisasi. Storage gagal tetap mengizinkan perubahan sesi dan menampilkan pesan.

Pengguna meminta design-taste-frontend menentukan warna. Prinsip palet, kontras, theme lock, dan preservation diterapkan; aturan marketing/landing di luar cakupan POS tidak dipaksakan. Arah mempertahankan desain asal: arang bernuansa hijau dengan panel bertingkat, aksen hijau lebih terang, dan teks tombol gelap. Dials 3/1/6; tidak menambah library atau motion. Header ponsel tetap muat dengan menghilangkan tombol panduan yang duplikat; Panduan halaman tetap tersedia.

## Verifikasi

- Red/green tes preferensi: default sistem, persistensi/reload, sinkronisasi tab, input tersimpan invalid, event tak terkait, cleanup listener dan storage diblokir lulus.
- 18 pasangan token teks dua tema lulus AA, minimum 4,86:1.
- `npm run test:pos`, scoped ESLint, `npx tsc --noEmit`, dan `npm run build -- --webpack` lulus.
- Browser: mode Terang/Gelap/Sistem, Gelap setelah refresh, pembayaran Rp5.000 dengan tunai Rp10.000 dan kembalian Rp5.000, struk tetap putih/hitam, form produk, dan laporan gelap.
- Viewport kasir 320/390/768/1440 px tidak melebar; header dan pemilih tema ponsel diperiksa visual.

## Batas

Belum deployment. Tidak mengubah alur bisnis, backend, source POS asal, atau tema aplikasi lain. Tema manual tersimpan di browser, bukan lintas perangkat. Build menggunakan Webpack karena batas Turbopack pada lingkungan Windows yang dicatat pada implementasi awal. Tidak melakukan audit performa/Lighthouse baru untuk perubahan warna ini.

## Tautan

- [Panduan POS](../../aplikasi-pos.md)
- [Store preferensi](../../../lib/pos/theme.ts)
- [Pengujian tema](../../../scripts/test-pos-theme.mjs)
