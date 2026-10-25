# Showcase Aplikasi POS

Terakhir diverifikasi: 25 Oktober 2026. Demo berada di `/aplikasi-pos`, ditautkan dari `/menu` dan proyek pertama pada portofolio. Implementasi ini dimiliki Personal Tools; sumber `D:/code/project-pos` tidak diubah.

## Cara mencoba

Jalankan situs dengan `npm run dev`, lalu buka `/aplikasi-pos`. Mode Kasir menyediakan katalog, pencarian nama/SKU, filter kategori, input scanner keyboard melalui Scan SKU, keranjang, pembayaran tunai simulasi, kembalian, struk PDF 80 mm, riwayat, dan buka/tutup shift. F2 memfokuskan pencarian; F8 membuka pembayaran.

Ganti Mode tampilan untuk menjelajahi fungsi berikut:

| Mode | Fungsi lokal |
|---|---|
| Supervisor | Dashboard, riwayat, shift, opname, persetujuan penyesuaian stok |
| Staff Gudang | Inventory, pergerakan stok, pengajuan opname |
| Admin | Produk/gambar, kategori, pengguna/peran contoh, laporan, pengaturan toko |
| Owner | Ringkasan, laporan, master, persediaan, performa kasir |
| Super Admin | Penyimpanan browser, aktivitas lokal, penjelasan integrasi, monitor kosong |

Pemilihan peran adalah simulasi navigasi, bukan autentikasi. Scan SKU menerima input scanner yang bertindak seperti keyboard atau pengetikan manual; tidak meminta akses kamera. Kontak penerapan memakai alamat email portofolio yang sudah ada.

## Data dan batas implementasi

Seluruh operasi POS berjalan di frontend. Tidak ada endpoint POS, pemasangan Go, Postgres, tabel Supabase, layanan pembayaran, atau printer. Halaman memakai Next.js yang sudah dimiliki situs; ini tidak menambahkan backend operasional POS.

[`lib/pos/model.ts`](../lib/pos/model.ts) memiliki kontrak dan perhitungan immutable. [`lib/pos/store.ts`](../lib/pos/store.ts) menyimpan snapshot berversi di localStorage dengan key `personal-tools-pos-v1`. Produk, kategori, transaksi, stok, shift, pengguna contoh, opname, pengaturan toko, dan aktivitas memakai sumber yang sama. Keranjang yang belum dibayar berada di memori halaman.

- Data bertahan setelah refresh pada browser dan origin yang sama. Browser/perangkat/domain lain mempunyai data berbeda. Reset demo mengembalikan data contoh setelah konfirmasi.
- Satu tab menjadi penulis melalui Web Locks; tab kedua membaca perubahan dan dapat diaktifkan setelah tab penulis ditutup. Browser tanpa dukungan penguncian memakai sesi sementara agar tidak menimpa data tersimpan.
- Storage rusak, diblokir, atau penuh menghasilkan pesan dan sesi sementara. Data rusak tidak ditimpa otomatis. Ini bukan penyimpanan produksi atau cadangan data.
- Batas koleksi: 500 produk, 100 kategori, 1.000 transaksi, 100 shift, 500 pergerakan stok, 100 opname, 100 pengguna, dan 250 aktivitas. Opname menunggu dipertahankan saat merapikan histori selesai.
- Checkout menolak uang kurang, jumlah invalid, produk nonaktif, dan stok tidak cukup. Kunci pembayaran mencegah transaksi ganda. Form produk lama tidak dapat mengembalikan stok yang sudah berubah.
- Transaksi menyimpan nama/harga barang dan identitas toko saat pembayaran. Mengubah master tidak mengubah struk lama. Riwayat dan laporan diurutkan berdasarkan waktu terbaru, bukan posisi array.
- Pembayaran tunai dan data identitas pengguna hanya contoh. Tidak ada kredensial pengguna. QRIS, provider, webhook, failed jobs, printer, refund, pajak, dan diskon operasional belum terhubung. Diskon pada struk adalah nol.

## PDF dan tampilan

[`lib/pos/pdf.ts`](../lib/pos/pdf.ts) dimuat saat ekspor diperlukan. jsPDF menghasilkan struk hitam putih selebar 80 mm dan laporan A4 dari transaksi lokal. Nama panjang dibungkus dan transaksi panjang dibagi halaman tanpa mengubah lebar kertas. Font Inconsolata regular/bold tertanam, tersedia lokal beserta lisensi OFL di `public/fonts/pos/`.

Struk mengikuti desain thermal yang disetujui: identitas toko rata tengah, metadata, garis putus, nama barang di atas kuantitas × harga, nominal rata kanan, total tegas, tunai/kembali, dan penanda demo. Tidak memakai foto struk referensi sebagai hasil transaksi.

UI di [`app/aplikasi-pos/`](../app/aplikasi-pos/) memakai CSS Modules untuk menjaga isolasi. Hijau POS asal dipertahankan. Tabel menggulir di dalam panel, dialog memakai elemen native, dan halaman kasir diperiksa pada lebar 320, 390, 768, dan 1440 px. Preview portofolio `public/portfolio/pos.webp` berasal dari screenshot aplikasi berjalan.

## Verifikasi

- `npm run test:pos`: lulus; menguji checkout, stok, validasi, idempotensi, snapshot, relasi master, shift/opname, penyimpanan rusak/penuh, antartab, dan PDF panjang.
- `npx tsc --noEmit` dan ESLint pada berkas terdampak: lulus.
- Walkthrough browser: transaksi tunai, kembalian, unduhan struk, data setelah refresh, filter/pencarian kosong, SKU, CRUD, validasi duplikat, rekonsiliasi shift, persetujuan opname, pengaturan toko, laporan, dua tab, serta tautan menu/portofolio.
- PDF struk/laporan dirender dan diperiksa visual; pengujian juga memeriksa setiap halaman struk panjang tetap 80 mm.
- Build produksi tersedia melalui `npm run build -- --webpack`. Build Turbopack default gagal membuat proses CSS pada lingkungan Windows ini, termasuk pada CSS global yang sudah ada; script build umum tidak diubah.

Skrip pemeriksaan menu dan motion portofolio diperbarui untuk enam aplikasi/tujuh proyek; keseluruhan skrip lama tersebut tidak dijalankan pada tugas ini. Navigasi dan preview POS diperiksa langsung di browser. Belum dilakukan deployment atau pengujian printer/perangkat/provider nyata.

Lihat [catatan implementasi](implementation-timeline/aplikasi-pos/2026-10-25-tambah-showcase-pos-lokal.md) dan [rencana](superpowers/plans/2026-10-25-aplikasi-pos.md).
