# Satu pintu Office Tools

Tanggal: 30 Oktober 2026. Empat kartu suite pada `/menu` digabung menjadi satu kartu **Office Tools** menuju `/office`. Dari sana, menu kiri membuka pekerjaan Office, Documents, Change Tracker, Health Dashboard dan pengelolaan sesuai hak akun. Alias `/document` tetap menuju `/documents` di dalam kerangka yang sama.

Katalog utama kini berisi tujuh aplikasi; jumlah tetap dihitung dari daftar aktual. Pengelompokan ini menggantikan keputusan empat kartu terpisah pada brief awal. Tautan langsung, akses PIN dokumen, login, role, desain sidebar dan enam tools lainnya tetap berlaku.

Perubahan terbatas pada entri dan metadata menu serta panduan/PRD/UX/kontrak navigasi. Render komponen tanpa browser mengonfirmasi satu kartu Office Tools, tujuh aplikasi, penghapusan tiga kartu suite terpisah, dan redirect `/office` serta `/document` yang tetap benar. Regresi navigasi suite, TypeScript dan lint halaman menu lolos. Build penuh tidak diulang untuk perubahan daftar ini. Tidak melakukan deployment atau perubahan database.
