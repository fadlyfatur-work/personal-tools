# Laporan ASB Provinsi

Pembaruan: 18 November 2026. `/report` memuat 38 provinsi sumber dan mendukung provinsi tambahan per laporan. Implementasi lokal tersedia; database harus diaktifkan manual sebelum dipakai.

## Akses dan penyiapan

Laporan memiliki PIN admin dan penginput sendiri, terpisah dari akun Office Tools. Kedua peran dapat membaca, mengisi, mengimpor Excel dan mengunduh laporan PDF atau Word. Admin dapat mengganti PIN dan melihat 50 revisi terakhir dari snapshot terbaru. Sesuai instruksi pemilik, PIN tersimpan sebagai teks biasa pada `report_access`; RLS/grant menolak akses browser. API tidak mengembalikan PIN lama.

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
- **Edit tabel** menampilkan checklist akun, input nama paket, serta aksi tambah provinsi. Total paket dan siap integrasi dihitung otomatis dari paket aktif terkonfirmasi dan status prosesnya. Ringkasan akun per peran, total ASB terkonfirmasi, dan paket integrasi SIPD tersedia dalam bagian yang dapat dibuka di atas filter. Setiap angka memperlihatkan perubahan dibanding rekap sebelumnya dalam teks kecil di samping nilai. Seluruh edit tabel dan progres Tahap 4 disimpan lewat satu tombol Submit perubahan; **Batal** membuang draft setelah konfirmasi bila ada perubahan. Submit dan Batal tampil berdampingan. Saat menyimpan, tabel tetap terlihat dan overlay menunjukkan prosesnya; snapshot diperbarui di halaman tanpa memuat ulang seluruh laporan. Penonaktifan paket dan penghapusan data akun, rincian akun, provinsi, atau progres Tahap 4 meminta konfirmasi.
- Klik nama provinsi/nama paket untuk membuka nama, proses paket, timestamp, analisis/kendala dan tindak lanjut. Klik status akun untuk jumlah dan identitas akun opsional. Hover menyediakan ringkasan tambahan.
- Catatan analisis/kendala dan tindak lanjut ditambahkan dari modal provinsi. **Simpan catatan** membuat entri riwayat baru bertimestamp server, tanpa menimpa entri sebelumnya. Status Perbaikan tidak mewajibkan catatan paket.
- Checklist tercentang berarti akun Ada. Jika hendak mengosongkan, pilih T/C atau Tidak ada melalui panel supaya tidak menyamakan belum tercatat dan terkonfirmasi nol.
- Kartu peran menampilkan jumlah akun tercatat dan selisihnya dari rekap sebelumnya. Jika jumlah belum diisi, rincian akun yang sudah diberi nama ikut dihitung. Jumlah provinsi dengan akun tampil terpisah.
- **Submit perubahan** menyimpan satu revisi utuh. Simpan rekap membuat catatan sumber `recap` pada riwayat revisi. Impor, ekspor dan keluar dengan draft menampilkan pilihan simpan/buang/kembali. Tab yang ditutup dengan draft mendapat peringatan browser.
- Koreksi pada laporan tanggal terbaru tidak mewajibkan catatan alasan. Konflik revisi tidak menimpa data sesi lain; draft tetap tersedia untuk diperiksa.

Tanggal laporan dan tampilan waktu menggunakan WIB; timestamp database UTC. Waktu pencatatan asli dipertahankan ketika laporan disalin. Perubahan nama, total, status dan integrasi memperoleh timestamp server tersendiri. Timestamp sumber historis yang tidak ada tidak dibuat-buat.

## Makna status dan perhitungan

Hijau lembut berarti Selesai pada proses paket atau Ada pada akun; biru lembut berarti Proses/belum selesai. T/C memakai kuning peringatan dan N/D abu-abu. Ikon dan label selalu menyertai warna. Sel rekap beberapa paket baru hijau jika seluruh rincian lengkap dan semuanya selesai. Filter cepat tersedia menurut tahap dan status. Integrasi memiliki progress bar; progres keseluruhan tetap N/D karena belum ada rumus resmi.

Paket baru berstatus Belum dikonfirmasi. Catatan wajib diisi selama paket aktif belum dikonfirmasi. Centang Terkonfirmasi untuk memulai proses PU. Saat centang dilepas, progres aktif dikosongkan dan riwayatnya tetap tersimpan. Paket lama dianggap terkonfirmasi agar progres yang sudah tercatat tetap berlaku. Tahap 4 adalah alur paket: Penyusunan ASB oleh PU → Diperiksa oleh BPKAD → Diperiksa oleh APIP → Siap Integrasi SIPD → Sudah diterima SIPD. Tombol kembali ke PU tersedia saat BPKAD berstatus Proses/Selesai atau APIP berstatus Proses; tidak tersedia saat PU masih Proses atau APIP sudah Selesai. Pengembalian langsung mengubah status ke PU, mengaktifkan Perbaikan, dan menyediakan catatan opsional. Kolom Perbaikan membuka rincian asal/tujuan, catatan, dan waktu. Setiap perpindahan status tersimpan dalam timeline yang dapat dibuka pada kartu paket. Menghapus progres Tahap 4 meminta konfirmasi, mengembalikan status paket aktif ke PU, serta menghapus riwayat perpindahan dan catatan perbaikan. Paket siap integrasi dan diterima SIPD tidak dapat dikembalikan. Status tiap paket dan Perbaikan memakai Selesai/Proses/`-`. Tabel dan ringkasan hanya menghitung paket aktif terkonfirmasi, sedangkan siap integrasi menghitung paket berstatus Siap Integrasi SIPD atau Sudah diterima SIPD. Paket belum dikonfirmasi dan paket nonaktif tersedia dari modal provinsi. Paket nonaktif ada di bagian arsip yang dibuka terpisah dan detail status serta catatan paketnya disembunyikan. Paket lama dinonaktifkan dengan alasan agar riwayat namanya tidak hilang.

Persentase integrasi = terintegrasi / total paket x 100%. Total nol atau data belum diketahui menghasilkan `-`. Warna selesai menggunakan kesamaan jumlah yang tepat, sehingga pembulatan persen tidak membuat paket yang masih tersisa dianggap selesai. Belum ada formula resmi untuk progres keseluruhan; kolomnya tetap N/D.

Provinsi dengan paket aktif terkonfirmasi di Aplikasi Utama berada di atas dan berposisi Tahap 4. Paket Aplikasi Utama berada di awal daftar paket provinsi. Berikutnya, provinsi diurutkan berdasarkan jumlah peran berstatus Ada. Jika sama, provinsi dengan paket terkonfirmasi didahulukan. Pembanding berikutnya adalah jumlah langkah PU/BPKAD/APIP yang selesai, tahap akun tertinggi, waktu mulai progres yang paling awal, lalu urutan sumber. Urutan tetap selama mengedit dan dihitung ulang setelah disimpan.

Sumber awal membuktikan 20 akun provinsi pada 15 provinsi, dengan rekap keberadaan peran 15/1/2/0/2/0. PDF tidak memuat identitas dan jumlah rinci per peran, nama paket maupun integrasi; isian tersebut tetap belum diketahui. Jumlah akun hasil input dan angka sumber awal tidak dijumlahkan ulang.

## Excel, PDF, Word dan grafik

Template `.xlsx` versi 6 memuat Petunjuk, Provinsi, Akun dan Paket, termasuk bukti dukung, URL, nama PIC, nomor kontak, status konfirmasi, dan lingkungan paket. Pertahankan header/ID. Kosongkan ID untuk rincian akun atau paket baru. Kolom total paket dan siap integrasi dihitung otomatis. Template versi 3 hingga 5 tetap bisa dibaca. Paket baru dari template lama mengikuti status awal belum dikonfirmasi dan membutuhkan catatan.

Checklist bukti dukung dan URL dapat diisi secara terpisah di modal paket atau modal provinsi. Keduanya opsional. URL yang diisi harus berupa tautan HTTP/HTTPS yang valid. PIC opsional. Jika diisi, nama dan nomor kontak harus diisi bersama.

Impor menerima Excel serta hierarki akun JSON SIPASTI Pemda melalui file `.json`/`.txt` atau teks yang ditempel. Admin SKPD Provinsi dipetakan ke Sekda, dan Kepala Dinas PU ke Kepala Dinas. Impor JSON hanya mengisi akun provinsi yang sesuai dengan enam peran laporan. Akun Stranas PK, Testing, wilayah latihan, dan kabupaten/kota dilewati. Akun dicocokkan melalui ID atau email dalam provinsi dan peran yang sama. Data yang tidak tercantum di file dipertahankan.

Pratinjau menandai sel yang berubah dan menyediakan checkbox per provinsi serta **Pilih semua**. **Simpan** langsung mencatat provinsi yang dipilih sebagai satu revisi dan memberi rincian jumlah provinsi, akun, serta paket yang masuk. Tombol unduh template Excel tersedia di tab Excel. Ikon **Unduh laporan** menawarkan PDF atau Word (.docx). Template Excel tersedia melalui ikon Excel.

Batas impor 8 MB. Excel mendukung 150 bagian ZIP, maksimal 16 MB per bagian XML/32 MB keseluruhan saat benar-benar didekompresi, dan 10.000 baris per sheet. DTD, rumus, ID ganda dan jumlah tidak valid ditolak. Penguraian XML dan dekompresi memakai fitur bawaan browser. Gunakan Chrome atau Edge modern.

PDF A3 lanskap menggunakan data tersimpan. Ringkasan mendatar memuat jumlah provinsi yang memiliki akun per peran, total ASB terkonfirmasi, dan paket integrasi SIPD. Tabel PDF menampilkan satu baris per paket terkonfirmasi, dengan kolom Status Aplikasi Penyusunan, bukti dukung manual berdasarkan checklist, dan progres Tahap 4 per paket. Akun dan ringkasan digabung per provinsi. Progres keseluruhan memakai bobot: Tahap 1-3 sebesar 30% (dibagi rata di enam peran akun), Tahap 4 sebesar 60% (dibagi rata pada PU/BPKAD/APIP untuk tiap paket terkonfirmasi), integrasi sebesar 5% (paket berstatus diterima SIPD), dan indikator lainnya sebesar 5% (status aplikasi, checklist bukti dukung, dan URL bukti dukung valid dibagi rata). Jika belum ada paket terkonfirmasi, bobot Tahap 4, integrasi, dan indikator paket bernilai 0%; persentase tetap dapat berasal dari status akun. Di web, membuka daftar paket menampilkan baris per paket, sedangkan daftar tertutup merangkum jumlah status Tahap 4; paket belum terkonfirmasi terlihat setelah daftar dibuka dan ditandai dengan latar merah lembut serta label Belum terkonfirmasi. Lampiran menempatkan provinsi dengan paket terkonfirmasi di awal. Setiap kartu menampilkan total paket, tanggal pencatatan tanpa jam, tanggal status PU/BPKAD/APIP yang sudah berjalan, dan catatan paket jika diisi. Label dan nilai rincian paket disejajarkan; isi catatan paket dimulai pada baris setelah labelnya. Tanggal tahap mengikuti riwayat paket dalam siklus berjalan. Catatan provinsi tersedia di modal dan tidak disertakan dalam PDF. Lingkungan paket bersifat opsional. Jika diisi, badge Aplikasi Latihan atau Aplikasi Utama tampil di tabel utama dan modal paket aktif. Di PDF, badge tampil di kolom Status Aplikasi Penyusunan dan di halaman rincian. Word memuat tabel progres yang dapat diedit dan rincian per provinsi. Rincian di kedua format menampilkan paket terkonfirmasi lebih dulu, dengan nomor PIC disamarkan serta bukti dukung berlabel Terkumpul atau Belum ada. Paket yang belum dikonfirmasi hanya memuat nama, tanggal tercatat, dan catatan.

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
