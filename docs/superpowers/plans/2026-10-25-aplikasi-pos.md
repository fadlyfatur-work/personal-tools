# Aplikasi POS implementation plan

**Goal:** Pasang showcase POS di `/aplikasi-pos`, perbaiki lima kelompok temuan audit, dan simpan data hanya di browser.

**Architecture:** Halaman Next.js membungkus aplikasi client. Model bertipe menjadi satu sumber perhitungan dan validasi, store localStorage menyimpan snapshot berversi, dan seluruh mutasi dilakukan lokal. Struk mengikuti layout PDF 80 mm yang disetujui; tampilan operasional mempertahankan hijau dan susunan katalog/keranjang POS asal.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, CSS Modules, Zod, jsPDF untuk ekspor di browser.

**Spec:** Instruksi pengguna pada 25 Oktober 2026; `anti-slop/audit-002-2026-10-25-pos.md`; desain `output/pdf/struk-pos-80mm.pdf`.

## Constraints dan keputusan

- Semua copy Indonesia. Tidak membuat API, tabel server, koneksi Go/Postgres, autentikasi baru, atau pembayaran sungguhan.
- Instruksi terbaru mengganti penyimpanan sesi: data localStorage bertahan setelah refresh sampai Reset demo.
- Data contoh diberi label. Peran hanya simulasi tampilan. Integrasi/provider hanya penjelasan simulasi.
- Mempertahankan sumber `D:/code/project-pos` tanpa perubahan; implementasi showcase dimiliki repository Personal Tools.
- Mempertahankan perubahan pengguna yang sudah ada. Checkout ini dipakai sesuai lokasi integrasi yang diminta; tidak membuat commit, mengubah branch, atau membawa perubahan lain.
- Isolasi UI melalui CSS Modules. Akses localStorage setelah hydration; kegagalan/isi rusak diberi pesan, bukan diklaim berhasil disimpan.
- Maksimum 500 produk, 1.000 transaksi tersimpan, dan input rupiah bilangan bulat dalam batas angka aman. Batas terlihat jika tercapai.
- Harga, nama, dan identitas toko disalin ke transaksi agar perubahan master tidak mengganti struk lama.

## Task 1: Model dan penyimpanan lokal

Files: `lib/pos/model.ts`, `lib/pos/store.ts`, `scripts/test-pos.mjs`.

- [x] Tulis dan jalankan pengujian gagal untuk pembayaran, stok, input invalid, snapshot, duplikasi pembayaran, data browser rusak, serta isolasi produk/kategori.
- [x] Implementasikan model dan satu snapshot localStorage khusus POS; penghapusan kategori yang masih dipakai ditolak.
- [x] Simpan stok, riwayat, shift, pengguna contoh, pengaturan toko, dan aktivitas lokal pada sumber yang sama; periksa perbaruan tab lain sebelum menulis.
- [x] Jalankan tes sampai lolos.

## Task 2: Aplikasi dan struk

Files: `app/aplikasi-pos/page.tsx`, `pos-app.tsx`, `pos.module.css`, komponen form/dialog/view setempat; `lib/pos/pdf.ts`.

- [x] Implementasikan alur kasir, pencarian/kategori/barcode SKU, keranjang, pembayaran, sukses, struk dan unduh ulang dari riwayat.
- [x] Implementasikan produk/kategori/pengguna CRUD lokal tervalidasi, stok/opname/persetujuan, shift, dashboard, laporan dan pengaturan toko.
- [x] Monitor/integrasi memberi informasi browser dan batas simulasi, tanpa status layanan palsu atau tombol mati.
- [x] Terapkan dialog keyboard, error dekat tindakan, empty state, langkah yang konsisten, dan layout 320/390/768/1440 px.
- [x] Verifikasi PDF hasil transaksi, termasuk nama panjang, hasil hitung, dan lebar 80 mm.

## Task 3: Showcase, verifikasi, dan dokumentasi

Files: `app/menu/page.tsx`, komponen/data portofolio, screenshot runtime di `public/portfolio`, `docs/aplikasi-pos.md`, catatan implementasi.

- [x] Tambahkan menu dan proyek POS tanpa mengganti proyek pengguna yang ada; CTA menuju `/aplikasi-pos` dan kontak penerapan.
- [x] Gunakan screenshot aplikasi yang benar-benar berjalan sebagai preview portofolio.
- [x] Jalankan tes domain, lint file terdampak, typecheck, build, serta browser walkthrough (simpan sesudah refresh, tanpa API POS, reset, CRUD, pembayaran, unduh PDF, layout sempit).
- [x] Review perubahan dan perbaiki temuan penting; dokumentasikan hasil serta batasannya.

## Review focus

- LocalStorage rusak/diblokir: tidak crash atau diam-diam mengklaim data tersimpan.
- Klik pembayaran berulang: hanya satu transaksi dan satu pengurangan stok.
- Stok/produk berubah di tab lain: baca snapshot terbaru dan validasi kembali sebelum membayar.
- Mengubah master toko/produk: transaksi lama tetap mempunyai snapshot struk awal.
- Daftar panjang dan nama panjang: tabel bisa scroll lokal, halaman dan modal tetap muat pada ponsel.

## Progress

- Perencanaan: diselesaikan dari instruksi implementasi eksplisit; tidak meminta persetujuan ulang untuk cakupan yang sudah dipilih pengguna.

- Implementasi dan verifikasi: selesai 25 Oktober 2026. Store memakai satu penulis Web Locks; browser tanpa dukungan memakai sesi sementara. Font PDF Inconsolata tertanam dengan OFL. Build produksi lulus dengan Webpack, Turbopack default masih terkendala proses CSS Windows. Lihat docs/aplikasi-pos.md dan catatan timeline.
