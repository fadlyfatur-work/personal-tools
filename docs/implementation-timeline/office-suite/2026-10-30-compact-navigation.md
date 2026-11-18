# Menu ringkas dan panel fitur

Tanggal: 30 Oktober 2026. Cakupan: Office, Documents, Change Tracker, Health Dashboard serta halaman akun/admin. Mengikuti referensi gambar pengguna dan pilihan cakupan yang dikonfirmasi. Implementasi lokal; tidak melakukan deployment atau perubahan database.

## Hasil

`SuiteFrame` menyatukan navigasi kelompok di kiri dan fitur aktif di kanan. Navigasi memakai Next Link dan rute asli, sehingga deep link serta riwayat browser tetap tersedia. Empat bagian Office dan tiga aplikasi pendamping tampil sebagai menu ringkas; pengelolaan ruang kerja/template/pengguna mengikuti role yang sudah ada. Katalog dan editor Documents memakai kerangka yang sama tanpa menambahkan syarat login akun pada akses PIN.

Palet terang memakai kanvas sejuk, kartu hampir putih, teks/aksen navy, serta blok identitas biru tua dengan aksen emas lembut dari referensi. Tema gelap mempertahankan hierarki yang sama. Spasi, judul dan kontrol dipadatkan; isian tetap berukuran terbaca dan target sentuh dipertahankan. Tidak menyalin angka kredit, generator AI, atau fitur penyimpanan yang tidak dimiliki produk.

Pada lebar di bawah 960px, tombol Menu membuka navigasi yang sama dalam alur dokumen. Pemilihan rute menutup menu; Escape menutup dan mengembalikan fokus. Tidak membuat salinan form atau iframe. Panel bertingkat/list-detail menyesuaikan ruang setelah sidebar ditambahkan. Root tema bukan landmark main tambahan; setiap halaman memiliki satu main untuk fitur aktif.

## Bukti pemeriksaan

Tes komponen memeriksa tujuh tujuan fitur, penanda rute aktif termasuk editor/admin Documents, pemisahan tautan admin, landmark, buka/tutup menu, Escape dan fokus kembali, serta konten draf yang tidak terlepas saat pemeriksaan sesi. Regresi Documents memeriksa PIN, pergantian kelompok, versi berubah, sesi berakhir, uji/publikasi admin. Regresi tema dan isolasi identitas Office juga lolos.

Kontras pasangan teks utama, kontrol, status dan pilihan pada kedua tema, termasuk warna pada blok navy, dihitung: nilai terendah 5,35:1. Pemeriksaan ini membuktikan pasangan token tersebut, bukan seluruh piksel pada hasil render. Tes tujuh skrip terkait navigasi, shell, Documents, tema, isolasi sesi Office, auth dan admin lolos. Lint file yang diubah bersih dan pemeriksaan TypeScript lolos. Build production `npm run build -- --webpack` berhasil dengan 52 halaman statis, termasuk seluruh rute terkait. Tidak mengklaim masalah Turbopack sebelumnya telah diperbaiki.

## Pre-flight design-taste-frontend

| Pemeriksaan | Hasil dan bukti |
| --- | --- |
| Brief dan audit sebelum edit | PASS: [rencana](../../superpowers/plans/2026-10-29-suite-compact-navigation.md) mencatat owner, struktur sebelumnya, scope serta arah referensi. DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 6. |
| Warna dan bentuk | PASS pada source: satu keluarga navy, tema di root, kelompok radius 14px, blok identitas 16px, kontrol ringkas 8-10px. Navy identitas merupakan blok warna eksplisit dari referensi, bukan pergantian tema antarbagian. |
| Konten dan fungsi | PASS melalui tes: komponen fitur asli, tautan nyata, state PIN/akun, menu aktif dan role tetap berlaku; tidak ada data contoh yang diklaim nyata. Copy UI diperiksa; pemisah em/en dash pada Office diperbaiki. |
| Kontras dan input | PASS untuk pasangan token yang diukur, minimum 5,35:1. Focus-visible, target sentuh dan fallback gerak ada pada source. |
| Responsif dan gerak | PASS pada logika disclosure dan aturan source: satu menu, satu form, breakpoint eksplisit; gerak hanya respons tombol/hover singkat dengan reduced-motion. Tidak mengklaim hasil ukuran layar telah dirender. |
| Aturan marketing | Tidak berlaku: ini antarmuka kerja, bukan landing page. Foto hero, logo pelanggan, testimonial, marquee dan visual metrik tidak ditambahkan. |
| Browser, Lighthouse, Core Web Vitals | Tidak dijalankan sesuai arahan pengguna tanpa tes browser. Tidak ada klaim ukuran/performa terukur atau kesamaan piksel dengan referensi. |

Panduan aktif: [Office Suite](../../office-suite.md). Perubahan `/menu`, portofolio, FinTrack dan AHSP yang sudah ada pada checkout tidak menjadi bagian redesain ini.
