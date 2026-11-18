# Template surat dan akses koleksi

Pembaruan: 27 Oktober 2026. `/documents` menampilkan katalog setelah pengunjung memasukkan PIN kelompok instansi/lembaga/divisi. Semua template terbit dengan tag akses tersebut muncul. `/document` tetap menjadi alias; tautan `/documents/[code]` dan `/api/generate` memeriksa akses yang sama.

Pengguna tidak perlu akun. Login akun biasa tidak membuka koleksi. Pengelola dengan peran admin template masuk melalui `/documents/admin` untuk membuat tag/PIN, mengelola nama, jenis, instansi dan divisi, serta menambah, mengganti atau menghapus template secara logis. PIN tidak dapat dibaca kembali; admin dapat mengganti atau mencabutnya.

## Mengelola template

1. Buat kelompok akses dan PIN pada panel admin.
2. Buat metadata template, pilih kelompok, unggah DOCX, lalu atur variabel isian melalui formulir konfigurasi.
3. Uji versi yang dipilih, buka hasil Word, dan tandai sudah diperiksa sebelum menerbitkan.
4. File pengganti menjadi draf; versi terbit sebelumnya tetap dipakai sampai penggantinya diterbitkan. Versi historis dapat diuji dan diterbitkan kembali.

File berada di bucket privat. Katalog dan editor membaca API protected, bukan tabel `templates` lama. Jika versi berubah saat pengguna mengisi, generator meminta memuat versi terbaru. Ganti PIN yang gagal atau dibatalkan mempertahankan koleksi dan isian sebelumnya; pergantian berhasil mengganti cakupan akses.

## Dua generator sebelumnya

Surat Tugas dan Perjadin lama perlu diimpor menjadi draf pada katalog baru, diuji, lalu diterbitkan pada kelompok akses yang dipilih. Prosedur SQL, secret, admin, dan import ada di [panduan Office Suite](office-suite.md). Tidak ada fallback generator publik.

Surat Tugas mempertahankan 1–20 pegawai, Menimbang, Dasar, transportasi darat/udara/air, nomor manual, periode tanggal, kop, penandatangan dan paraf. Isian khusus Perjadin tetap mengikuti kode `perjadin_2026`. Konfigurasi isian bertipe `TemplateConfig` di `types/templateSurat.ts`; file dan konfigurasi selalu mengikuti versi yang sama.

## Verifikasi

Tes tanpa Supabase: `node scripts/test-documents-access.mjs`, `node scripts/test-documents-api.mjs`, dan `node scripts/test-documents-ui.mjs`. Tes API menjalankan renderer DOCX serta batas akses menggunakan adapter penyimpanan uji.

Tes langsung: jalankan aplikasi yang sudah disiapkan, pasang `DOCUMENTS_TEST_PIN` untuk koleksi uji, lalu `node scripts/test-documents.mjs` atau `node scripts/test-surat-tugas.mjs`. Jangan masukkan PIN pada kode atau commit. Tes memakai cookie akses dan versi template terbit. Hasil uji Surat Tugas berada di `.next/surat-tugas-check/`. Pemeriksaan struktur DOCX tidak menggantikan pemeriksaan tata letak halaman di Word/LibreOffice.
