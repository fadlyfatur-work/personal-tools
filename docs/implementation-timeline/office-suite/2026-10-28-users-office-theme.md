# Pengguna, pemulihan Office, dan tema terang/gelap

Tanggal: 28 Oktober 2026. Status: kode lokal diperbarui dan aktivasi SQL oleh pengguna telah diverifikasi melalui API; bukan klaim deployment aplikasi production.

## Perubahan

- Tambah `/tools/users` dan API admin untuk daftar/cari/tambah akun, ubah nama, peran aplikasi/template terpisah, dan aktif/nonaktif akses suite. Akun baru tidak otomatis mendapat role admin. Tidak ada penghapusan permanen atau perubahan email/kata sandi akun lain.
- Migration `202610280001_tools_admin.sql` menambah flag admin suite, status aktif dan revisi profil. RPC perubahan pengguna mengunci mutasi izin, memeriksa actor/revisi, menolak self-lockout dan menjaga admin aktif. Sesi akun nonaktif ditolak server; FinTrack tidak diban/dicabut secara global.
- Penyebab error Office terbukti dari PGRST205 pada tabel Office dan PGRST202 pada RPC yang belum dipasang. Pengguna menjalankan file aktivasi. Verifikasi Supabase berikutnya menunjukkan bootstrap kedua akun berhasil, role admin/normal sesuai, dan `office_read` berhasil. Pemetaan error kini membedakan setup belum siap dari gangguan layanan lain.
- Tambah tema Sistem/Terang/Gelap pada kedua shell, penyimpanan preferensi lokal dengan fallback tanpa storage, serta token status/kontrol/permukaan. Office dan Documents termasuk Quill memakai token tema. FinTrack dan portofolio tidak ikut diubah.
- Rapikan kelompok kontrol akun/workspace, navigasi Office menjadi empat label Indonesia yang ringkas, tautan admin, skip link, pending/error logout, umpan balik tekan dan pengurangan gerak/transparansi.

## Audit dan bukti

Audit superior-ui-audit berbasis jalur source, dengan apple-design sebagai arahan pengguna, menghasilkan lima koreksi yang dicatat pada [rencana dan bukti audit](../../superpowers/plans/2026-10-28-suite-admin-theme-repair.md). CSS portofolio pada DESIGN.md merupakan pengecualian yang memang tidak mengatur tools. Tidak mengklaim temuan visual dari screenshot yang tidak diperiksa.

Tes auth/suite/admin/theme, shell/Documents UI, Office API/session dan SQL lokal lolos. Pengujian admin SQL mencakup pemisahan hak, self-lockout, konflik revisi, akun nonaktif, dan RPC hanya service-role. Review tambahan baca-saja tidak menemukan defect penting yang terkonfirmasi pada cakupan ini. Pasangan token teks utama pada kedua tema diukur antara 6,25:1 dan 16,83:1, melampaui 4,5:1; ini bukan audit kontras setiap piksel hasil render.

Build production `npm run build -- --webpack` lolos, termasuk TypeScript serta 52 halaman statis. Lint area perubahan lolos. API pengelolaan pengguna yang sebenarnya, dengan sesi Supabase melalui klien tanpa browser, mengembalikan 200 untuk admin dan 403 untuk pengguna biasa. Kelima pembacaan Office (tasks, followups, meetings, knowledge, notifications) berhasil untuk kedua akun. Tes tidak membuat akun atau data pekerjaan tambahan.

Sesuai permintaan pengguna, tidak menjalankan tes browser. Tata letak mobile/desktop, clipping, focus scrolling, hasil render Quill dan tampilan asli masih memerlukan pemeriksaan pengguna. Build memakai Webpack; tidak mengklaim masalah Turbopack yang tercatat sebelumnya telah diperbaiki.

## Antislop dan Apple design

- Arah PASS: alat kerja berbahasa Indonesia, tipografi sistem, aksen biru yang telah digunakan; ENERGY 1 / RHYTHM 2 / MOTION 1.
- Hierarki/purpose PASS pada source: header akun, konteks workspace, navigasi, lalu pekerjaan utama; panel berdasarkan isi dan tidak menambah statistik/aset rekaan. Material toolbar terbatas pada kelompok kontrol, dengan fallback solid.
- Kontrol/status PASS melalui tes komponen/API: pemilih tema, navigasi admin, dua-field auth, status pending/error, validasi serta penolakan role. Umpan balik tekan dan reduced-motion ada pada CSS; tidak menambah dependensi animasi atau gestur yang tidak diminta.
- Token warna PASS melalui perhitungan kontras pada pasangan normal/status/selected; fokus dan reflow diperiksa pada source. R-03/R-35 dibatasi instruksi pengguna tanpa browser, sehingga tidak mengklaim seluruh kontrol telah diklik atau layout terverifikasi secara visual.

Panduan aktif: [Office Suite](../../office-suite.md). Generator SQL dapat dijalankan ulang setelah build; tidak memasukkan kata sandi/PIN ke source atau SQL. Perubahan AHSP yang sudah ada pada checkout berada di luar cakupan ini.
