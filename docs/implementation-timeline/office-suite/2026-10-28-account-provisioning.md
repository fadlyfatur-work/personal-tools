# Dua akun awal Office Suite

Tanggal: 28 Oktober 2026. Status: akun Auth dibuat; role aplikasi menunggu penyiapan database.

Atas permintaan pengguna, dua akun awal dibuat melalui Supabase Admin API dengan konfirmasi email otomatis. Keduanya berhasil login menggunakan email/kata sandi yang diminta, melalui API tanpa browser. Sesi pemeriksaan diakhiri dengan scope lokal. Kata sandi dan token tidak disimpan pada source, SQL, atau dokumen ini.

Pemberian role aplikasi belum berhasil: RPC `tools_bootstrap` mengembalikan PGRST202 dan tabel profil belum tersedia pada API. Tidak mengklaim akun pengelola sudah memperoleh hak admin. Tidak menerapkan migration remote karena akses SQL database tidak tersedia dalam sesi.

Operator perlu menjalankan [migration akun](../../../supabase/migrations/202610260001_tools.sql), lalu [penetapan role dua akun](../../../supabase/setup-office-accounts.sql) melalui SQL Editor. Skrip kedua menyiapkan profil/workspace pribadi dan menetapkan admin template hanya pada akun admin yang diminta; akun pengguna tetap `is_template_admin = false`. Tidak mengubah akses FinTrack dan tidak memuat kata sandi.
