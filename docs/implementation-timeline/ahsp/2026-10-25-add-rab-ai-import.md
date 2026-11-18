# Tambahkan impor AI pada pencocokan RAB

Tanggal: 25 Oktober 2026. Status: implementasi kode dan audit UI/UX; aktivasi database/kredensial serta pengujian fungsional diserahkan kepada pengguna.

## Hasil

Halaman RAB menerima Excel, PDF dan gambar. Jalur baru menyediakan pemilihan halaman, teks digital/OCR, editor teks, penyusunan JSON, koreksi/pengucualian item, serta konfirmasi sebelum menggunakan mesin pencocokan yang sudah ada. Profil API mendukung URL/model/key, headers, dua body/prompt dan pemetaan respons. Profil tersimpan melalui tabel privat dengan key terenkripsi.

Aktivitas request/response ditampilkan per panggilan dalam memori halaman, termasuk status, waktu, penggunaan, hasil atau kesalahan. Kredensial dan base64 disamarkan. Referensi halaman sumber ikut dalam simpanan dan keterangan ekspor.

## Keputusan

- Akses AI khusus pengelola memakai secret server, karena AHSP tidak mempunyai akun khusus dan model berpotensi berbiaya.
- Log tidak disimpan ke database; ini default yang diumumkan selama implementasi karena retensi belum dipilih.
- PDF.js menjadi satu dependensi baru untuk parser/renderer browser. Aset pendukung dilayani aplikasi sendiri.
- Tidak ada migrasi remote atau pemanggilan penyedia AI yang dilakukan pada perubahan ini.
- Pengguna meminta menghentikan pengujian fungsional saat pengerjaan. Verifikasi sesudahnya dibatasi UI/UX dan kompilasi statis.

## Verifikasi dan aktivasi

Audit UI/UX halaman awal, editor OCR/JSON dan aktivitas kosong: 320/390/768/1440px, terang/gelap, modal dalam viewport, tidak ada overflow halaman, dan penutupan Escape. Endpoint model/profil diblokir pada audit. Temuan pemotongan select ponsel dan redaksi Excel-only sudah diperbaiki. TypeScript dan ESLint berkas terkait selesai tanpa error. Build Webpack berhasil; build Turbopack mengalami error internal proses CSS global, dicatat pada panduan.

Untuk aktivasi, ikuti [panduan pembacaan AI](../../ahsp-rab-ai.md). Script setup menyediakan secret lokal; migrasi profil diterapkan manual melalui Supabase SQL Editor. Pengujian OCR, konfigurasi penyedia, database, rekonsiliasi, dan ekspor perlu dilakukan pengguna setelah aktivasi.

Sumber utama: `app/ahsp/rab/ai-import.tsx`, `ai-settings.tsx`, `ai-activity.tsx`, `lib/ahspRabAi*.ts`, dan `supabase/migrations/202610250002_ahsp_ai_profiles.sql`.
