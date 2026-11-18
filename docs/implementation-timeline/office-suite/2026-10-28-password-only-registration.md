# Pendaftaran email dan kata sandi tanpa verifikasi

Tanggal: 28 Oktober 2026. Status: perubahan lokal; tidak mengubah akun atau pengaturan Supabase jarak jauh. Mengikuti permintaan pengguna untuk pendaftaran sederhana tanpa verifikasi email.

Formulir daftar kini hanya meminta email dan kata sandi minimal delapan karakter. Endpoint server membuat akun melalui Supabase Admin API dengan konfirmasi otomatis, lalu membuka sesi menggunakan klien cookie suite. Tidak memanggil pengiriman email pendaftaran. Klien membaca `authenticated` untuk langsung melanjutkan ke tujuan internal yang tervalidasi. Nama profil awal diturunkan dari email; hak admin tetap ditetapkan operator.

Penolakan origin, validasi ukuran/isian, limiter bersama, isolasi cookie FinTrack, dan pemeriksaan role tetap berlaku. Akun duplikat tidak ditimpa; jika akun berhasil dibuat tetapi pembukaan sesi gagal, pesan meminta login ulang. Endpoint tidak mengonfirmasi akun lama berdasarkan email dari klien. Pemulihan kata sandi tetap membutuhkan pengiriman email dan callback yang benar.

Tes baru `scripts/test-tools-auth.mjs` dijalankan sebelum perubahan dan gagal pada alur lama yang memanggil pengiriman verifikasi. Setelah perubahan, tes lolos untuk pendaftaran tanpa email, login langsung, akun duplikat, kegagalan sesi parsial, penolakan role injection, validasi, origin, limiter, serta formulir dua isian. Tes suite dan UI lama, `npm run typecheck`, serta lint file yang diubah lolos. Build penuh tidak diulang untuk perubahan terbatas ini. Tidak menguji pembuatan akun pada Supabase pengguna dan tidak mengklaim prasyarat database sebelumnya sudah diaktifkan.

Panduan aktif: [Office Suite](../../office-suite.md). API yang dipakai mengikuti [Supabase createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
