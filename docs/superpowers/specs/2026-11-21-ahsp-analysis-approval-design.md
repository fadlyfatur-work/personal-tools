# Usulan Analisis dan Approval AHSP

## Maksud

Pengguna tanpa akun dapat mengusulkan rincian analisis untuk item katalog berstatus Need re-verified. Admin membuka antrean dengan PIN dan menjadi satu-satunya pihak yang dapat menerapkan usulan ke katalog.

## Perilaku

- Pengguna memilih komponen tenaga, bahan, atau alat yang sudah tercatat atau memasukkan komponen baru.
- Identitas komponen memerlukan kelompok, nama, dan satuan. Kode dan deskripsi bersifat opsional.
- Setiap kemunculan komponen pada analisis memerlukan koefisien numerik atau rumus sumber. Koefisien 0 valid; rumus `0` dianggap belum tersedia.
- Sumber dan lokasi halaman/baris menjadi rujukan admin. SMKK tidak memerlukan komponen dan tidak memakai formulir usulan ini.
- Usulan disimpan terpisah dengan status pending; tidak mengubah item katalog sampai approval.
- Admin dapat menolak dengan alasan atau menyetujui setelah memeriksa analisis serta mencentang bahwa identitas dan regulasi sudah cocok.
- Approval memvalidasi bahwa item katalog belum berubah sejak pengajuan, menerapkan komponen secara atomik, menyimpan provenance, dan menandai item Verified.
- Komponen yang disetujui muncul pada pencarian MPTK; nilai harga tidak menjadi bagian identitas komponen atau hitungan approval.

## Akses

- Endpoint publik hanya dapat membuat usulan tervalidasi; semua pembacaan dan penulisan database tetap melalui server `service_role`.
- Antrean approval hanya terlihat setelah PIN diverifikasi. PIN disimpan sebagai bcrypt hash di konfigurasi server.
- PIN membuka sesi approval singkat pada cookie HttpOnly, Secure di produksi, dan SameSite Strict. API tetap memverifikasi sesi, Origin, status usulan, dan item sasaran.
- Percobaan PIN dibatasi; PIN dan payload autentikasi tidak dicatat.

## Data dan kompatibilitas

- Tabel usulan menyimpan snapshot identitas/analisis saat dibuat, payload komponen, sumber, status keputusan, dan catatan admin.
- Approval ditangani RPC transaksional yang membandingkan snapshot agar usulan kedaluwarsa tidak menimpa perubahan baru.
- `analysis_origin` mendapat nilai `manual` dengan constraint provenance submission yang disetujui.
- Komponen tetap tersimpan pada `ahsp_items.components`; agregasi MPTK yang sudah ada dipakai untuk daftar master dan memasukkan SPTJM yang kini memiliki komponen disetujui.
- Migrasi dijalankan manual melalui Supabase SQL Editor sesuai prosedur proyek.

## Batas

Tidak ada login pengguna, unggahan file, perubahan identitas pekerjaan oleh pengusul, perhitungan harga, atau total biaya. Pengajuan tidak langsung menjadi data resmi.
