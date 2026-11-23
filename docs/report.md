# Laporan ASB Provinsi

Pembaruan: 18 November 2026. `/report` memuat 38 provinsi sumber dan mendukung provinsi tambahan per laporan. Implementasi lokal tersedia; database harus diaktifkan manual sebelum dipakai.

## Akses dan penyiapan

Laporan memiliki PIN admin dan penginput sendiri, terpisah dari akun Office Tools. Kedua peran dapat membaca, mengisi, mengimpor Excel dan mengunduh PDF. Admin dapat mengganti PIN dan melihat 50 revisi terakhir dari snapshot terbaru. Sesuai instruksi pemilik, PIN tersimpan sebagai teks biasa pada `report_access`; RLS/grant menolak akses browser. API tidak mengembalikan PIN lama.

1. Terapkan migration [report](../supabase/migrations/202611110001_report.sql), [koreksi opsional](../supabase/migrations/202611170001_report_optional_correction.sql), [rekap harian](../supabase/migrations/202611180001_report_recaps.sql), lalu [hitung ulang ringkasan paket](../supabase/migrations/202611180002_report_derived_package_counts.sql) lewat Supabase SQL Editor dalam urutan filename. Migration terakhir memperbarui ringkasan snapshot lama agar jumlah paket dan integrasi mengikuti daftar paket.
2. Untuk menyiapkan schema sekaligus dua PIN dan data sumber pertama, gunakan file lokal `.next/report-activation.sql` yang disiapkan pada sesi implementasi. File ini mengandung PIN privat dan tidak boleh dibagikan/dikomit. Jalankan seluruh isi file sekali melalui SQL Editor. Pengulangan tidak menimpa PIN atau laporan yang sudah ada.
3. Pastikan `REPORT_SESSION_SECRET` server minimal 32 karakter di `.env.local`, lalu restart server. Jangan gunakan prefix `NEXT_PUBLIC_`.
4. Buka `/report`, atau pilih Laporan ASB dari `/menu`. Masukkan salah satu PIN yang ditetapkan pemilik.

Membuat ulang file aktivasi:

```powershell
node scripts/setup-report.mjs prepare
```

Skrip membaca `REPORT_ADMIN_PIN` dan `REPORT_USER_PIN` dari environment atau file lokal yang diabaikan Git, `.env.report.local`. Nilai tidak diterima melalui argumen CLI dan tidak dicetak. Jika belum tersedia, skrip menambahkan secret sesi acak ke `.env.local`; konfigurasi yang sudah ada dipertahankan. Build dapat membersihkan `.next`; jalankan `prepare` kembali sesudah build bila perlu.

Pemeriksaan kesiapan database tanpa mengubahnya:

```powershell
node scripts/setup-report.mjs check
```

Sesi berlaku delapan jam dalam cookie HttpOnly. Mengganti PIN membatalkan sesi lama peran tersebut. Percobaan login dibatasi memakai limiter Supabase suite yang sudah ada. Tidak ada akses cadangan bila schema, limiter, secret atau PIN belum siap.

## Pengisian harian

- Halaman selalu membuka snapshot terbaru. Label di bagian atas menunjukkan tanggal rekap dan waktu pembaruan terakhir. **Simpan rekap** mencatat posisi data pada tanggal hari ini sebagai riwayat perkembangan dan disembunyikan setelah rekap hari ini tersimpan. Akses snapshot lengkap melalui tab **Perkembangan** → **Lihat data grafik dan rekap tersimpan** → **Buka rekap**; snapshot yang dibuka bersifat baca saja. Laporan pertama memakai sumber PDF yang sudah dimasukkan melalui setup.
- **Edit tabel** menampilkan checklist akun, input nama paket, serta aksi tambah provinsi. Total paket dan siap integrasi dihitung otomatis dari nama paket aktif dan status prosesnya. Ringkasan akun per peran, total ASB aktif, dan paket integrasi SIPD tersedia dalam bagian yang dapat dibuka di atas filter. Setiap angka memperlihatkan perubahan dibanding rekap sebelumnya dalam teks kecil di samping nilai. Seluruh edit tabel dan progres Tahap 4 disimpan lewat satu tombol Submit perubahan; **Batal** membuang draft setelah konfirmasi bila ada perubahan. Submit dan Batal tampil berdampingan. Saat menyimpan, tabel tetap terlihat dan overlay menunjukkan prosesnya; snapshot diperbarui di halaman tanpa memuat ulang seluruh laporan. Penonaktifan paket dan penghapusan data akun, rincian akun, provinsi, atau progres Tahap 4 meminta konfirmasi.
- Klik nama provinsi/nama paket untuk membuka nama, proses paket, timestamp, analisis/kendala dan tindak lanjut. Klik status akun untuk jumlah dan identitas akun opsional. Hover menyediakan ringkasan tambahan.
- Catatan analisis/kendala dan tindak lanjut ditambahkan dari modal provinsi. **Simpan catatan** membuat entri riwayat baru bertimestamp server, tanpa menimpa entri sebelumnya. Status Perbaikan tidak mewajibkan catatan paket.
- Checklist tercentang berarti akun Ada. Jika hendak mengosongkan, pilih T/C atau Tidak ada melalui panel supaya tidak menyamakan belum tercatat dan terkonfirmasi nol.
- Kartu peran menampilkan jumlah akun tercatat dan selisihnya dari rekap sebelumnya. Jika jumlah belum diisi, rincian akun yang sudah diberi nama ikut dihitung. Jumlah provinsi dengan akun tampil terpisah.
- **Submit perubahan** menyimpan satu revisi utuh. Simpan rekap membuat catatan sumber `recap` pada riwayat revisi. Impor, ekspor dan keluar dengan draft menampilkan pilihan simpan/buang/kembali. Tab yang ditutup dengan draft mendapat peringatan browser.
- Koreksi pada laporan tanggal terbaru tidak mewajibkan catatan alasan. Konflik revisi tidak menimpa data sesi lain; draft tetap tersedia untuk diperiksa.

Tanggal laporan dan tampilan waktu menggunakan WIB; timestamp database UTC. Waktu pencatatan asli dipertahankan ketika laporan disalin. Perubahan nama, total, status dan integrasi memperoleh timestamp server tersendiri. Timestamp sumber historis yang tidak ada tidak dibuat-buat.

## Makna status dan perhitungan

Hijau lembut berarti Selesai pada proses paket atau Ada pada akun; biru lembut berarti Proses/belum selesai. T/C memakai kuning peringatan dan N/D abu-abu. Ikon dan label selalu menyertai warna. Sel rekap beberapa paket baru hijau jika seluruh rincian lengkap dan semuanya selesai. Filter cepat tersedia menurut tahap dan status. Integrasi memiliki progress bar; progres keseluruhan tetap N/D karena belum ada rumus resmi.

Tahap 4 adalah alur paket: Penyusunan ASB oleh PU → Diperiksa oleh BPKAD → Diperiksa oleh APIP → Siap Integrasi SIPD → Sudah diterima SIPD. Paket bernama baru otomatis memulai proses PU. Tombol kembali ke PU tersedia saat BPKAD berstatus Proses/Selesai atau APIP berstatus Proses; tidak tersedia saat PU masih Proses atau APIP sudah Selesai. Pengembalian langsung mengubah status ke PU, mengaktifkan Perbaikan, dan menyediakan catatan opsional. Kolom Perbaikan membuka rincian asal/tujuan, catatan, dan waktu. Setiap perpindahan status tersimpan dalam timeline yang dapat dibuka pada kartu paket. Menghapus progres Tahap 4 meminta konfirmasi, mengembalikan status paket aktif ke PU, serta menghapus riwayat perpindahan dan catatan perbaikan. Paket siap integrasi dan diterima SIPD tidak dapat dikembalikan. Status tiap paket dan Perbaikan memakai Selesai/Proses/`-`. Total paket menghitung paket aktif dengan nama, sedangkan siap integrasi menghitung paket berstatus Siap Integrasi SIPD atau Sudah diterima SIPD. Paket aktif ditampilkan lebih dahulu; paket nonaktif ada di bagian arsip yang dibuka terpisah dan detail status serta catatan paketnya disembunyikan. Paket lama dinonaktifkan dengan alasan agar riwayat namanya tidak hilang.

Persentase integrasi = terintegrasi / total paket x 100%. Total nol atau data belum diketahui menghasilkan `-`. Warna selesai menggunakan kesamaan jumlah yang tepat, sehingga pembulatan persen tidak membuat paket yang masih tersisa dianggap selesai. Belum ada formula resmi untuk progres keseluruhan; kolomnya tetap N/D.

Provinsi dengan peran berstatus Ada terbanyak berada di atas. Jika sama, provinsi dengan paket aktif bernama didahulukan. Pembanding berikutnya adalah jumlah langkah PU/BPKAD/APIP yang selesai, tahap akun tertinggi, waktu mulai progres yang paling awal, lalu urutan sumber. Urutan tetap selama mengedit dan dihitung ulang setelah disimpan.

Sumber awal membuktikan 20 akun provinsi pada 15 provinsi, dengan rekap keberadaan peran 15/1/2/0/2/0. PDF tidak memuat identitas dan jumlah rinci per peran, nama paket maupun integrasi; isian tersebut tetap belum diketahui. Jumlah akun hasil input dan angka sumber awal tidak dijumlahkan ulang.

## Excel, PDF dan grafik

Template `.xlsx` versi 4 memuat Petunjuk, Provinsi, Akun dan Paket, termasuk checklist bukti dukung, URL, nama PIC dan nomor kontak. Pertahankan header/ID. Kosongkan ID untuk rincian akun/paket baru. Kolom total paket dan siap integrasi dihitung otomatis. Template versi 3 tetap bisa dibaca untuk perubahan data yang sudah ada. Paket baru memerlukan template versi 4.

Lengkapi checklist bukti dukung, URL, dan PIC di modal paket atau modal provinsi. Paket baru, paket yang diaktifkan kembali, dan perubahan nama paket memerlukan checklist bukti dukung serta URL HTTP/HTTPS. Jika bukti pada paket aktif sudah diisi, checklist dan URL harus tetap lengkap. Paket lama tanpa bukti ditandai **Belum lengkap** di modal. PIC opsional. Jika diisi, nama dan nomor kontak harus diisi bersama. Tautan bukti dan PIC yang tersedia tercantum di rincian PDF.

Impor menerima Excel serta hierarki akun JSON SIPASTI Pemda melalui file `.json`/`.txt` atau teks yang ditempel. Admin SKPD Provinsi dipetakan ke Sekda, dan Kepala Dinas PU ke Kepala Dinas. Impor JSON hanya mengisi akun provinsi yang sesuai dengan enam peran laporan. Akun Stranas PK, Testing, wilayah latihan, dan kabupaten/kota dilewati. Akun dicocokkan melalui ID atau email dalam provinsi dan peran yang sama. Data yang tidak tercantum di file dipertahankan.

Pratinjau menandai sel yang berubah dan menyediakan checkbox per provinsi serta **Pilih semua**. **Simpan** langsung mencatat provinsi yang dipilih sebagai satu revisi dan memberi rincian jumlah provinsi, akun, serta paket yang masuk. Tombol unduh template Excel tersedia di tab Excel. PDF dan Excel tetap menjadi format unduhan.

Batas impor 8 MB. Excel mendukung 150 bagian ZIP, maksimal 16 MB per bagian XML/32 MB keseluruhan saat benar-benar didekompresi, dan 10.000 baris per sheet. DTD, rumus, ID ganda dan jumlah tidak valid ditolak. Penguraian XML dan dekompresi memakai fitur bawaan browser. Gunakan Chrome atau Edge modern.

PDF A3 lanskap menggunakan data tersimpan. Ringkasan mendatar memuat jumlah provinsi yang memiliki akun per peran, total ASB aktif, dan paket integrasi SIPD. Tabel mengikuti kolom dan warna status Tahap 4 di web. Lampiran menampilkan kartu provinsi berisi total paket, tanggal pencatatan, tanggal status PU/BPKAD/APIP yang sudah berjalan, serta riwayat catatan. Tanggal tahap mengikuti riwayat paket dalam siklus berjalan.

Grafik memakai ringkasan snapshot, bukan data rekaan harian. Rentang dapat dipilih, maksimal 2.000 laporan per permintaan. Data belum tersedia menjadi gap; nilai nasional dengan cakupan provinsi belum lengkap tidak diplot sebagai total lengkap. Tabel data grafik menjelaskan cakupannya. Pilih satu provinsi untuk melihat perkembangannya meski cakupan nasional belum lengkap.

## Verifikasi

```powershell
node scripts/test-report.mjs
node scripts/test-report-api.mjs
node scripts/test-report-files.mjs
node scripts/test-report-sql.mjs
node scripts/prepare-report-ui-check.mjs
node scripts/test-report-ui.cjs
npx eslint app/report app/api/report lib/report scripts/test-report*.mjs scripts/setup-report.mjs scripts/prepare-report-ui-check.mjs
npm run typecheck
npm run build
```

Pada lingkungan implementasi, build default Turbopack terhenti saat membuka proses PostCSS. Build alternatif `npm run build -- --webpack` berhasil. Script build proyek tidak diubah.

SQL test menggunakan PGlite lokal `.tools/ahsp-sql-test` yang sudah tersedia, tanpa koneksi Supabase. UI test memakai Playwright bundel Codex dan server localhost:3000, dengan API dicegat hanya dalam konteks browser uji. Itu membuktikan alur UI, bukan penyiapan database live. Berkas/screenshot uji tersimpan di `.next/report-work/` dan tidak dikomit.

Implementasi ini tidak mengambil data otomatis dari SIPASTI/SIPD, tidak memublikasikan laporan tanpa PIN, dan tidak menerapkan migration production secara otomatis. [Riwayat implementasi](implementation-timeline/report/README.md).
