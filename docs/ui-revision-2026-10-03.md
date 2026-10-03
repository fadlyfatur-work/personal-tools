# Revisi portofolio dan FinTrack

## Perilaku

- Portofolio: animasi mengikuti posisi scroll, dengan hero bergeser/mengecil dan konten bagian masuk bertahap. Adaptasi gerak dari https://onoera.com/?ref=minimal.gallery; tidak menyalin konten atau aset. ENERGY 1 / RHYTHM 2 / MOTION 2. Gerakan mengarahkan pergantian bagian. CSS view timeline tanpa library; reduced motion dan browser tanpa dukungan tetap menampilkan konten statis. Fokus keyboard menonaktifkan efek pada konten yang sedang dipakai.
- Budget: urutan berdasarkan rasio pemakaian menurun, sebelum pembulatan label persentase. Nominal digunakan sebagai pembanding bila rasio sama.
- Aktivitas: pencarian keterangan di kiri tombol filter. Tombol membuka/menutup dompet dan kategori pada tab Transaksi; tab Laporan menampilkan dropdown dompet langsung. Jumlah filter aktif tetap terlihat ketika panel Transaksi ditutup. Pencarian tidak peka huruf besar/kecil, maksimal 100 karakter, dan dilakukan sebelum pagination di server.
- Pengeluaran bulan ini menampilkan ringkasan seluruh dompet yang dapat diakses, terpisah dari hasil pencarian. Rentang mengikuti periode laporan/cutoff pengguna dan ditampilkan agar makna bulan jelas.
- Kategori pencatatan: frekuensi seluruh transaksi posted yang dapat diakses pengguna, bukan nominal maupun 60 transaksi terakhir. Kategori seri diurutkan berdasarkan nama. Pembacaan ID kategori dipaginasi 1.000 baris; tidak perlu migrasi database. Frekuensi dimuat ulang bersama bootstrap setelah perubahan transaksi.

## Implementasi

Aktivitas memakai React Query yang sudah terpasang untuk key gabungan periode, dompet, kategori, jenis, pencarian dan halaman. Respons lama terikat pada key lamanya sehingga tidak mengganti hasil pilihan baru. Perubahan filter mengembalikan halaman ke 1; search memakai debounce 300ms. Cache dalam memori segar selama lima menit; kembali ke tab atau filter yang sudah dikunjungi memakai hasil itu tanpa request baru. Setelah lima menit, membuka tab atau memfokuskan jendela memuat data baru sambil menampilkan hasil tersimpan. Refresh setelah transaksi menginvalidasi query aktivitas. Cache dipisah per pengguna dan dibersihkan saat keluar. Gagal memuat menampilkan pesan dan retry.

## Verifikasi

- PASS: npm run build, termasuk TypeScript dan generasi halaman.
- PASS: npm run lint.
- PASS: node scripts/test-fintrack-activity.mjs; mencakup urutan rasio, tie kategori, pencarian keterangan di luar halaman pertama, kombinasi kategori/jenis, pagination hasil, kategori kosong, pencarian kosong dan validasi input.
- PASS: browser portofolio desktop dan lebar 375px. Transform hero berubah dari scale(1)/translateY(0) menjadi scale(.94)/translateY(45px) mengikuti scroll; halaman proyek tetap terbaca pada mobile.

Pengguna memilih melanjutkan tanpa uji sesi login. Interaksi UI FinTrack serta query frekuensi terhadap database langsung belum diverifikasi dalam sesi masuk; tidak diklaim lulus uji end-to-end. Tidak ada data keuangan atau akun yang dibuat saat pengujian. Tes route memakai fixture terisolasi.
