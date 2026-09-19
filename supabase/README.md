# Reset database FinTrack

Migration `202609180001_fintrack_reset.sql` bersifat destruktif untuk modul FinTrack. Semua data FinTrack lama dihapus dan schema dibuat ulang dengan prefix `fintrack_`.

Migration tidak menyentuh tabel modul lain seperti `clipboard` atau `templates`. Jangan mengganti script menjadi `drop schema public cascade` karena itu akan menghapus seluruh fitur dalam project Supabase.

## Tabel baru

```text
fintrack_users
fintrack_plans
fintrack_plan_members
fintrack_accounts
fintrack_categories
fintrack_transactions
fintrack_transaction_entries
fintrack_account_collaborators
fintrack_account_invites
fintrack_account_join_requests
fintrack_account_activity_logs
```

Semua fungsi database juga memakai prefix `fintrack_`.

## Yang dihapus

Migration menghapus tabel FinTrack lama berikut jika tersedia:

```text
users
financial_plans
plan_members
accounts
categories
transactions
transaction_entries
account_collaborators
account_invites
account_join_requests
account_activity_logs
login_attempts
```

`auth.users` tidak dihapus. Akun Google yang sudah pernah dibuat di Supabase Auth akan tetap ada, tetapi profil dan data FinTrack-nya dibuat ulang saat login berikutnya.

## Urutan penerapan

1. Pastikan data FinTrack lama memang boleh dihapus.
2. Export data dummy yang masih ingin disimpan, jika ada.
3. Buka Supabase SQL Editor.
4. Salin seluruh isi `migrations/202609180001_fintrack_reset.sql`.
5. Jalankan script satu kali.
6. Jalankan `202609190001_fintrack_pin_login.sql` dan `202609190002_fintrack_cache_categories_reports.sql` agar urutan migration lokal dan remote tetap sama. Keduanya aman dijalankan setelah reset.
7. Periksa daftar tabel menggunakan query verifikasi.
8. Aktifkan Google OAuth dan callback URL.
9. Deploy aplikasi setelah migration berhasil.
10. Login Google. Sistem otomatis membuat profil, personal plan, tiga dompet awal, dan kategori awal.

Jangan deploy aplikasi baru sebelum migration dijalankan. Query aplikasi sudah menggunakan tabel `fintrack_*` dan akan gagal bila schema baru belum tersedia.

## Query verifikasi

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'fintrack_%'
order by table_name;
```

Hasilnya harus berisi sebelas tabel yang tercantum di atas.

Periksa bahwa tabel fitur lain tetap ada:

```sql
select to_regclass('public.clipboard') as clipboard,
       to_regclass('public.templates') as templates;
```

## Konfigurasi Google OAuth

- Supabase Dashboard → Authentication → Providers → Google: isi Client ID dan Client Secret.
- Google Cloud OAuth Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Supabase Authentication URL Configuration → Redirect URLs:
  - Lokal: `http://localhost:3000/auth/callback`
  - Deploy: `https://<domain-aplikasi>/auth/callback`

Environment aplikasi:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FINTRACK_SESSION_SECRET
```

`FINTRACK_SESSION_SECRET` dipakai untuk menandatangani cookie login email + PIN dan wajib berisi minimal 32 karakter acak. Buat nilai baru dengan `openssl rand -base64 32`, lalu pasang nilai yang sama di `.env.local` dan Vercel. Jangan memakai prefix `NEXT_PUBLIC_`.

`JWT_SECRET` lama tidak lagi digunakan oleh FinTrack.

## Mengaktifkan login email + PIN pada database lama

Jika migration reset sudah pernah dijalankan, jangan drop database lagi. Jalankan migration tambahan berikut melalui Supabase SQL Editor:

```text
migrations/202609190001_fintrack_pin_login.sql
```

Migration ini tidak menghapus data. Migration hanya menambahkan versi PIN, penghitung percobaan gagal, waktu lockout, dan waktu login PIN terakhir pada `fintrack_users`.

Untuk mengaktifkan cache bootstrap, CRUD kategori, dan opsi mengeluarkan dompet dari kekayaan bersih pada database prefixed yang sudah ada, jalankan juga:

```text
migrations/202609190002_fintrack_cache_categories_reports.sql
```

Migration kedua tidak menghapus data. Dompet lama otomatis memiliki `include_in_net_worth = true`, sedangkan kategori lama tetap aktif.

Setelah migration dan environment variable diterapkan:

1. Login satu kali dengan Google.
2. Buka Pengaturan dan aktifkan atau ganti PIN.
3. Logout.
4. Login berikutnya dapat memakai email dan PIN.

Lima percobaan PIN yang gagal akan mengunci login PIN selama 15 menit. Mengganti PIN menaikkan versi PIN sehingga cookie sesi PIN lama otomatis tidak berlaku. Google tetap menjadi jalur pemulihan bila PIN terlupa.

## Catatan pemulihan

Migration reset tidak menyediakan rollback data karena seluruh data FinTrack lama sengaja dihapus. Pemulihan hanya dapat dilakukan dari backup atau export yang dibuat sebelum migration dijalankan.
