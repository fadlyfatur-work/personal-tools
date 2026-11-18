# Pembacaan AI untuk pencocokan RAB

Implementasi: 25 Oktober 2026. Jalur Excel tetap menggunakan parser workbook. PDF/gambar menambahkan pembacaan, pratinjau dan konfirmasi sebelum masuk ke mesin pencocokan yang sama.

## Aktivasi

1. Jalankan `node scripts/setup-ahsp-rab-ai.mjs` dari root proyek. Script menambahkan dua secret server ke `.env.local` yang diabaikan Git; secret yang sudah tersedia tidak diganti dan nilainya tidak dicetak.
2. Terapkan **hanya** `supabase/migrations/202610250002_ahsp_ai_profiles.sql` melalui Supabase SQL Editor, sesuai prosedur migrasi manual proyek. Tidak memerlukan reset atau penghapusan tabel lain.
3. Restart dev server. Untuk produksi, pasang dua variabel yang sama pada konfigurasi environment deployment:
   - `AHSP_AI_ADMIN_TOKEN`: kunci akses pengelola, minimal 32 karakter. Nilai ini dimasukkan pada halaman RAB dan hanya berada dalam memori tab.
   - `AHSP_AI_ENCRYPTION_KEY`: 32 byte acak dalam base64, untuk AES-256-GCM. Pertahankan key ini; menggantinya membuat kredensial tersimpan tidak dapat didekripsi sampai profil diperbarui.
4. Buka `/ahsp/rab`, buka Akses pengelola, masukkan `AHSP_AI_ADMIN_TOKEN`, lalu tambah profil pada Pengaturan AI.
5. Isi URL, model, key penyedia, headers, prompt/template kedua tahap dan pemetaan respons. Simpan profil; pilih profil OCR dan Teks → JSON. Keduanya boleh berbeda.

API key penyedia bukan kunci akses pengelola. Key penyedia dimasukkan hanya pada field API key dan disimpan terenkripsi. Field key kosong saat memperbarui profil mempertahankan kredensial sebelumnya. Gunakan `{{api_key}}` pada template/header, bukan literal kredensial.

## Profil dan kontrak API

Profil mendukung endpoint **POST JSON** sinkron pada HTTPS publik port 443. Disediakan template awal Chat Completions/kompatibel, Gemini dan Claude; model/parameter dapat disesuaikan dengan dokumentasi penyedia. Ini bukan jaminan kompatibilitas semua model. Multipart upload, streaming/SSE, job asynchronous, serta API lokal/private belum didukung.

- URL mendukung `{{model}}`, di-URL-encode oleh server.
- Headers mendukung `{{api_key}}` dan `{{model}}`.
- Body mendukung `{{model}}`, `{{prompt}}`, `{{page}}`, `{{pages}}`, `{{ocr_text}}`, `{{image_mime}}`, `{{image_base64}}`, `{{image_data_url}}`, dan `{{api_key}}`.
- Placeholder yang menjadi nilai utuh mempertahankan tipe JSON. Penyisipan objek/array ke tengah string ditolak.
- Jalur respons memakai bentuk `choices[0].message.content`, `content[0].text`, atau `candidates[0].content.parts[0].text`. Jalur kosong mengambil respons utuh. Tidak ada evaluasi JavaScript atau JSONPath script.
- Hasil struktur harus memuat array pekerjaan sesuai `itemsPath`. Pemetaan field contoh: `{"name":"description","volume":"quantity","source_page":"page"}`.

Contoh isi hasil model:

```json
{
  "schema_version": "1",
  "items": [{
    "code": "A.01", "name": "Galian tanah", "unit": "m3",
    "volume": 2, "price": 100000, "total": 200000,
    "source_page": 1,
    "raw": {"volume":"2", "price":"100.000,00", "total":"200.000,00"},
    "issues": []
  }]
}
```

Nomor halaman harus berasal dari halaman terpilih. Angka harus number JSON atau null. String angka tidak ditebak/dikonversi otomatis; teksnya dipertahankan dan nilainya null dengan catatan pemeriksaan. Uraian kosong, keluaran tanpa items, halaman tidak sah, atau >1.000 item ditolak. Respons terpotong karena batas token juga ditolak.

## Alur dokumen

- Satu file `.xlsx`, `.pdf`, `.png`, `.jpg/.jpeg`, atau `.webp`, maksimal 10 MB. Signature file diperiksa di jalur masing-masing.
- Excel: aturan 1–3 sheet dan baris Excel 1–1.000 tetap berlaku.
- PDF: maksimum 500 halaman dalam file, 1–10 halaman dipilih per impor (misalnya `1-3, 5`). Gambar maksimum 24 megapiksel.
- PDF.js berjalan di browser dan merender halaman maksimal 2.000 piksel pada sisi terpanjang. Worker serta font/CMap/WASM berasal dari aplikasi sendiri, tanpa CDN tambahan.
- Teks digital dibaca lokal. Halaman dengan teks sangat sedikit atau opsi Pakai OCR dikirim sebagai JPEG ke profil OCR. Pratinjau membuka representasi halaman yang dipakai.
- Hasil teks dapat diperiksa/dikoreksi sebelum dikirim ke profil Teks → JSON. Maksimum gabungan teks 120.000 karakter.
- Item ditampilkan per 10 baris sebagai kartu yang dapat dibuka untuk koreksi atau pengecualian. Pengguna wajib mengonfirmasi seluruh pembacaan sebelum pencocokan.
- Hasil memakai pencocokan, pengelompokan, rekonsiliasi, rekap MPTK dan penyimpanan browser yang sudah ada. File biner sumber tidak ikut disimpan. Referensi halaman dan teks/angka sumber dipertahankan pada baris; ekspor memakai Cakupan Halaman Sumber.

## Akses, batas dan aktivitas

Konfigurasi dan semua panggilan AI dibatasi untuk pengelola. Excel dan katalog tetap publik. Ini default implementasi karena kepemilikan konfigurasi belum ditentukan lebih lanjut.

Tabel/RPC baru hanya dapat diakses service role. Pemilihan profil default dilakukan dalam transaksi dengan advisory lock. Maksimal 20 profil. Kuota database bersama maksimal 120 panggilan/jam, ditambah dua panggilan aktif per instance dan pembatasan percobaan akses per IP.

Server memvalidasi DNS publik dan memasang alamat hasil resolusi pada koneksi HTTPS. Redirect tidak diikuti. Batas respons 2 MB dan waktu panggilan 120 detik; deployment perlu mengizinkan durasi hingga 150 detik. Pembatalan browser diteruskan ke server ketika koneksi memungkinkan; penyedia dapat tetap mengenakan biaya untuk permintaan yang sudah diterima.

Panel Aktivitas API AI memuat tahap, profil/model, waktu, durasi, status HTTP, request tersamarkan, respons, hasil/validasi dan penggunaan jika disediakan. Tersedia filter, bungkus baris, salin JSON dan unduh log. Log dibatasi 30 aktivitas dan **hanya berada di memori halaman**, tidak pada database atau simpanan IndexedDB. Key/header sensitif dan base64 disamarkan; teks dokumen masih dapat terlihat dalam log yang diunduh.

Tombol Uji koneksi mengirim teks contoh melalui tahap Teks → JSON memakai draft editor dan key yang diisi atau key profil tersimpan. Ini panggilan nyata yang memakai kuota API, dijalankan hanya bila pengguna menekan tombol. Kesalahan pemetaan/JSON ditampilkan pada aktivitas, bukan dianggap hasil berhasil.

Saat panggilan contoh menunggu respons, tersedia tombol Batalkan panggilan. Aktivitas yang dibatalkan tetap tercatat dengan status Dibatalkan. Pemrosesan dokumen juga menyediakan pembatalan tanpa menghapus hasil halaman yang sudah diterima.

## Batas verifikasi pada perubahan ini

Sesuai instruksi pengguna, pengujian fungsional dihentikan selama pengerjaan. Setelah instruksi itu, tidak dilakukan pengujian OCR, penyimpanan profil, panggilan model, pencocokan maupun ekspor. Migrasi remote dan kredensial penyedia belum diterapkan.

Audit UI/UX memakai `node scripts/audit-ahsp-rab-ai-ui.cjs`, yang memblokir endpoint pemanggilan model dan operasi profil. Cakupan: halaman awal, modal editor OCR/JSON, aktivitas kosong, Escape, layout 320/390/768/1440px dan mode terang/gelap. Pengujian manual fungsi menjadi tanggung jawab pengguna setelah aktivasi. Pemeriksaan TypeScript/ESLint/build hanya memastikan kode dapat dikompilasi.

TypeScript dan ESLint berkas terkait selesai tanpa error. `npm run build -- --webpack` berhasil dan aset CMap/font/WASM PDF.js tercakup dalam build trace. `npm run build` dengan Turbopack terhenti dua kali pada error internal saat membuat proses CSS `app/globals.css`; gunakan perintah Webpack untuk kompilasi pada lingkungan ini. Script build default tidak diubah.
