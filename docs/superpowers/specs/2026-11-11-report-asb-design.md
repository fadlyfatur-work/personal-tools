# Rancangan /report: monitoring harian ASB provinsi

Tanggal: 11 November 2026. Status: disetujui untuk eksekusi melalui percakapan; implementasi mengikuti rencana 2026-11-11-report-asb.md.

Pemeriksaan pembangun: reviewer independen telah membaca rancangan dan menyatakan tidak ada pertanyaan penting yang tersisa untuk menyusun rencana implementasi. Keputusan usulan tetap memerlukan persetujuan pengguna di bawah.

Tambahan pengguna sesudah pemeriksaan: sel status Selesai memakai hijau dan status belum selesai memakai biru pucat; provinsi diurutkan berdasarkan banyaknya tahap selesai dan awal progres. Aturan pengurutan rinci di bawah adalah interpretasi pembangun untuk dikonfirmasi.

## Tujuan dan keputusan pengguna

Satu rute `/report` berbahasa Indonesia untuk monitoring ASB 38 provinsi. Struktur mengikuti PDF `Monitoring ASB Provinsi - 10 November 2026 (1).pdf`: identitas, tahap 1-3 akun, tahap 4 proses paket, tahap 5 integrasi SIPD, ringkasan dan keterangan.

Pengguna meminta riwayat harian, grafik perkembangan, edit langsung pada tabel dengan checklist, rincian akun lewat hover/klik dan ikon edit, nama serta total paket dengan waktu pencatatan, template dan impor Excel, serta unduh PDF. Data PDF tanggal 10 November 2026 menjadi laporan awal. Tahap 4 memakai `Selesai`, `Proses`, dan `-`. Persentase integrasi = jumlah paket terintegrasi / total paket x 100%.

Akses memakai dua PIN yang sudah diberikan dalam percakapan: admin dan penginput. Atas instruksi eksplisit pengguna, PIN tersimpan sebagai teks biasa di database, tanpa hash. Jangan salin nilai PIN ke dokumen, kode sumber, log, contoh, workbook, hasil PDF, payload pembacaan, atau migration yang dikomit. Mode antislop `during` dipilih pengguna untuk sesi ini.

## Pendekatan

Pakai Supabase yang sudah tersedia, route handler Next.js, serta pustaka PizZip, jsPDF, Recharts, Zod dan jose yang sudah dipasang. Tidak perlu layanan atau dependensi runtime baru.

Pilihan pembangun: satu dokumen JSON tervalidasi untuk setiap tanggal laporan, ditambah tabel riwayat perubahan dan tabel akses. Snapshot harian cocok untuk 38 provinsi dan satu penginput: menyimpan keseluruhan kondisi tanggal itu secara atomik, mudah disalin untuk tanggal berikutnya dan diimpor. Identitas paket/akun stabil di dalam snapshot. Validasi yang sama dipakai input tabel, Excel dan server. Tabel rinci terpisah per entitas/tanggal menambah join dan kompleksitas snapshot tanpa kebutuhan pencarian lintas jutaan catatan. Penyimpanan browser tidak memenuhi kebutuhan penyimpanan lintas perangkat dan kontrol PIN oleh admin.

Implementasi rinci, nama fungsi dan pemecahan komponen diserahkan kepada pembangun. Jangan membuat framework laporan generik atau event sourcing.

## Akses dan peran

- `/report` mula-mula hanya menampilkan formulir PIN. PIN menentukan peran; tidak perlu login akun Office Tools tambahan.
- Admin: seluruh kemampuan penginput, mengatur/mengganti PIN kedua peran dan melihat metadata riwayat perubahan. Penginput: membaca seluruh laporan, membuat tanggal baru, mengubah data, impor Excel dan unduh PDF. Penginput tidak boleh membaca atau mengganti PIN.
- PIN admin tidak memberikan hak admin aplikasi Office Tools atau akses ke modul lain.
- PIN teks biasa disimpan pada tabel khusus `report_access`, tertutup untuk role anon/authenticated melalui RLS dan pencabutan grant. Pembacaan dan perubahan hanya dilakukan server dengan service role. API admin hanya mengembalikan status konfigurasi, tidak pernah nilai PIN lama.
- Penyediaan dua PIN awal melalui skrip setup lokal yang menerima input tersembunyi atau environment, bukan literal dalam migration. Migration membuat schema; setup setelah migration menulis nilai yang diberikan pengguna. Tidak ada PIN cadangan atau akses tanpa konfigurasi.
- Sesi khusus report berupa JWT HttpOnly, SameSite=Lax, Secure di production, masa berlaku 8 jam, issuer/audience khusus report. Secret server `REPORT_SESSION_SECRET` minimal 32 karakter. Klaim role, versi akses dan masa berlaku diverifikasi server setiap request; versi disandingkan dengan database supaya pergantian PIN membatalkan sesi terkait.
- Pembatasan percobaan PIN memakai limiter Supabase yang sudah tersedia, dengan batas global dan sumber tepercaya, sehingga tidak hanya mengandalkan cookie yang bisa dihapus. Bandingkan PIN di server tanpa mencatat nilainya. Mutasi wajib same-origin; semua respons protected private/no-store. PIN tidak dimasukkan ke query URL atau browser storage.
- Setelah login admin, pengaturan PIN tersedia dalam halaman yang sama. Admin harus tetap memiliki sesi valid saat mengganti PIN. PIN baru kedua peran harus berbeda dan 6-12 digit. Keluar menghapus cookie.

## Tanggal laporan dan penyimpanan

- `report_daily`: tanggal ISO unik, revisi integer, dokumen JSON, waktu dibuat/diubah, peran pembuat/pengubah. `report_changes`: revisi, tanggal laporan, waktu server, peran, sumber perubahan manual/import/seed, serta ringkasan bagian yang berubah. Tidak menyimpan PIN atau sesi.
- Seluruh tabel report server-only dengan RLS/grant yang menolak akses langsung browser. Fungsi simpan hanya service role, membandingkan revisi dan menyimpan snapshot + audit dalam transaksi yang sama. Konflik revisi menghasilkan pesan muat ulang; tidak menimpa diam-diam.
- Tanggal laporan memakai kalender Asia/Jakarta. Timestamp disimpan UTC dan ditampilkan WIB. Tanggal sumber tidak dianggap sebagai timestamp asli input.
- Laporan awal bertanggal 2026-11-10, dengan metadata sumber PDF. Seed idempoten: tidak menimpa laporan atau revisi yang sudah ada.
- Memilih tanggal yang sudah ada memuat snapshot itu. Membuat tanggal baru menyalin snapshot terakhir sebelum tanggal terpilih setelah tindakan eksplisit `Buat laporan`; membuka halaman tidak membuat data.
- Tanggal tanpa laporan ditandai belum dibuat; tidak otomatis diisi nol atau dianggap ada pembaruan. Tidak membuat laporan masa depan.
- Laporan lama dapat dikoreksi dengan menyimpan revisi baru pada tanggal tersebut dan alasan koreksi; perubahan tidak mengubah snapshot tanggal sesudahnya. Riwayat audit mempertahankan perubahan. Tidak menyediakan hapus permanen laporan/paket pada versi awal; paket dapat ditandai tidak aktif dengan alasan.
- Satu kali `Simpan perubahan` menyimpan seluruh draft tanggal terpilih secara atomik. Batal membuang draft. Pindah tanggal, impor, ekspor, atau keluar saat ada draft memberi pilihan simpan atau buang; ekspor selalu dari revisi tersimpan.

## Struktur data dan makna nilai

- Daftar dan urutan acuan 38 provinsi berasal dari PDF, termasuk label DKI Jakarta pada sumber; tidak menambah kabupaten. Tampilan memakai urutan progres di bawah; urutan sumber menjadi pemecah seri terakhir. Nama provinsi sumber dinormalisasi ke ID stabil, termasuk Bangka Belitung ke Kepulauan Bangka Belitung.
- Tahap akun: Admin SKPD/Sekda; Kepala Dinas, Kepala BPKAD, APIP; Penyusun Harga dan Penyusun ASB.
- Setiap peran punya status `Ada`, `T/C`, atau `Tidak ada` yang dikonfirmasi, jumlah akun integer nullable, rincian akun opsional, catatan dan waktu perubahan. Checklist mengubah status Ada; mengosongkannya meminta pilihan tidak tercatat atau dikonfirmasi tidak ada, sehingga tidak menyamakan keduanya.
- `Ada` boleh jumlah belum diketahui, dengan jumlah minimal satu. `T/C` adalah tidak tercatat, bukan nol. `Tidak ada` berarti sudah dikonfirmasi nol. Jumlah tidak boleh lebih kecil daripada banyak rincian akun yang diisi. Detail opsional: nama/label, instansi, email opsional, keterangan. Jangan meminta password akun SIPASTI.
- PDF tidak berisi nama/email akun. Seed hanya status yang terlihat, tanpa identitas atau detail rekaan. Jumlah per peran tetap tidak diketahui bila tidak dapat dibuktikan dari sumber.
- Metadata awal menyimpan 20 akun provinsi dari sumber dan 15 provinsi memiliki akun tercatat, dengan label sumber awal. Angka 20 tidak dijumlahkan lagi dengan hasil input. Total akun hasil input hanya dianggap lengkap bila seluruh jumlah peran sudah diketahui; jika tidak, tampilkan jumlah diketahui dengan penanda sebagian. Jumlah provinsi per peran selalu dapat diturunkan dari status Ada.
- Tiap provinsi memiliki total paket nullable yang dapat diisi, daftar nama paket opsional, jumlah terintegrasi nullable, catatan analisis/kendala dan tindak lanjut. Ini mengakomodasi rekap jumlah ketika rincian nama belum lengkap.
- Paket memiliki ID stabil, nama, empat status tahap 4, tanggal/jam dibuat, tanggal/jam perubahan nama/status, catatan dan keaktifan. Total provinsi punya timestamp tersendiri saat nilainya berubah. Membawa paket ke tanggal berikutnya tidak mengubah timestamp pencatatan aslinya.
- Total dan jumlah terintegrasi integer nonnegatif. Jumlah nama paket aktif tidak boleh melebihi total diketahui; jika belum semua nama diisi, beri label rincian belum lengkap. Total tidak otomatis dianggap sama dengan banyak nama yang sudah diisi.
- Jumlah terintegrasi diisi per provinsi. Jangan mengasumsikan status individual terintegrasi jika hanya total yang tersedia. Jumlah terintegrasi tidak boleh melebihi total. Persentase dihitung, bukan diinput. Jika pembilang/pembagi belum diketahui atau total nol, tampilkan `-`, bukan 0% palsu. Jika total > 0 dan terintegrasi diketahui nol, hasilnya 0%.

## Tahap 4 dan ringkasan

- Kolom tahap 4 tetap PU, BPKAD, APIP dan Perbaikan, tetapi isinya proses paket, bukan empat jumlah yang dijumlahkan.
- Usulan pembangun untuk disetujui: alur utama PU -> BPKAD -> APIP. Perbaikan adalah penanda proses revisi yang dapat terjadi selama alur, bukan otomatis jenjang persetujuan keempat. Simpan status keempatnya per paket. Selesai berarti tahap itu selesai, Proses berarti sedang dikerjakan, `-` berarti belum ada informasi/belum dimulai. Jangan menulis status Selesai di tahap sebelumnya secara otomatis ketika tahap berikutnya diubah.
- Pada baris provinsi, tampilkan ringkasan jumlah paket yang Selesai/Proses per kolom; klik nama/total paket membuka rincian baris per paket yang dapat diedit. Tanpa rincian proses, tampilkan N/D. Ringkasan status hanya mencakup rincian yang sudah diisi, dengan penanda bila belum lengkap.
- Posisi akun tetap berarti tahap akun tertinggi yang tercatat, bukan kelengkapan seluruh peran dan bukan persentase penyelesaian. Seed: 13 provinsi akun tahap 1, 2 provinsi akun tahap 3, 23 provinsi T/C.
- Tidak ada formula resmi untuk progres keseluruhan lintas lima tahap. Jangan menciptakan bobot 20% per tahap atau memakai keberadaan akun sebagai bukti tahap selesai. Kolom progres keseluruhan pada PDF tetap N/D dengan keterangan; indikator terukur yang digunakan aplikasi ialah persentase integrasi.

## Urutan provinsi

- Interpretasi pembangun atas permintaan pengguna: provinsi dengan jumlah langkah paket berstatus Selesai terbanyak didahulukan; jika sama, provinsi yang mulai memiliki progres lebih awal didahulukan. Ini urutan kerja, bukan persentase progres keseluruhan.
- Jumlah langkah selesai dihitung dari status PU, BPKAD dan APIP pada paket aktif yang rinciannya tersedia. Perbaikan tidak menambah skor supaya banyaknya revisi tidak menaikkan peringkat. Jangan menganggap data N/D sebagai langkah selesai. Tampilkan bahwa skor hanya berdasarkan rincian tercatat jika daftar paket belum lengkap.
- Saat jumlah langkah selesai sama, tahap akun tertinggi yang benar-benar tercatat menjadi prioritas berikutnya agar laporan awal tetap menempatkan provinsi dengan data tahap 3 di atas tahap 1 dan T/C. Ini tidak mengubah tahap akun menjadi bukti penyelesaian paket.
- Sesudah kedua ukuran tersebut sama, gunakan tanggal pertama progres yang terbukti di riwayat laporan. Jika tanggal sama dan waktu pertama tercatat benar-benar diketahui, gunakan waktu tersebut; jika seluruhnya sama atau tidak diketahui, gunakan urutan acuan PDF. Jangan memakai waktu seed/impor sebagai waktu mulai progres historis.
- Pakai urutan yang sama pada tabel web dan rekap PDF. Nomor baris mengikuti posisi tampil, sedangkan ID provinsi tetap stabil untuk edit/impor. Urutan dihitung dari snapshot tanggal yang dipilih. Selama mode edit aktif, baris tidak meloncat ketika checklist diubah; urutkan kembali sesudah simpan atau batal.

## Satu halaman dan arah visual

Design Read: alat pencatatan kantor untuk admin dan penginput, berbahasa tabel laporan pemerintah sesuai PDF, dengan token dan kontrol Office Tools yang sudah ada. ENERGY 1 / RHYTHM 1 / MOTION 1. Antislop during aktif dari pilihan pengguna.

- Rute tunggal `/report` mencakup login PIN, laporan, grafik, edit, detail akun/paket, impor dan pengaturan admin. Pengaturan/detail melalui dialog atau panel dalam halaman, bukan aplikasi baru.
- Tabel adalah isi utama: header kolom bertingkat, tanggal posisi data dan jumlah rekap, 38 provinsi, total serta legenda. Warna kelompok tahap mengikuti referensi hanya untuk membedakan kelompok data; teks status tetap menyampaikan maknanya. Tidak ada hero, metrik rekaan, dekorasi AI atau gambar baru.
- Sesuai permintaan pengguna, isi sel status Selesai berwarna hijau; Proses dan `-` berwarna biru pucat karena belum selesai. Warna ini berlaku pada sel/rincian tahap dan rekap PDF, bukan mengganti seluruh warna header kelompok tahap. Jika satu sel rekap memuat beberapa paket, hijau hanya ketika seluruh paket yang tercakup sudah selesai dan cakupan rinciannya lengkap; keadaan campuran tetap biru pucat dengan jumlah Selesai/Proses tertulis.
- Nilai T/C dan N/D tetap menampilkan teks/keterangan ketidakpastiannya; biru pucat tidak mengubah makna menjadi terkonfirmasi belum dibuat. Sel akun Ada dapat memakai hijau sebagai penanda keberadaan akun, dengan legenda yang membedakannya dari penyelesaian langkah paket. Integrasi hijau hanya ketika total diketahui > 0 dan seluruh total telah terintegrasi; selain itu biru pucat dengan angka/persentase atau penanda data belum tersedia.
- Pada tema gelap, pakai pasangan latar hijau/biru redup dan teks terang dengan kontras terverifikasi; pada tema terang dan PDF pakai hijau lembut serta biru pucat dengan teks gelap. Status tetap terbaca sebagai teks dan checklist, tanpa mengandalkan warna saja.
- Header ringkas: tanggal laporan dan tindakan edit/simpan/batal, template Excel, impor serta unduh PDF. Tambahkan tautan `/report` berlabel Laporan ASB di `/menu`; tidak mengubah login atau navigasi modul lain.
- Mode baca tidak memunculkan seluruh kontrol isian. Mode edit menampilkan checklist akun, pengatur status tiga pilihan, ikon edit dan nama/total paket. Klik atau fokus pada status akun membuka informasi jumlah/detail; hover hanya pelengkap, tidak satu-satunya akses.
- Kolom provinsi dan header tabel sticky di area scroll tabel yang diberi label. Pada layar sempit, halaman tetap reflow dan tabel boleh scroll horizontal; rincian memakai panel lebar layar. Kontrol sentuh minimal 44px. Keyboard dapat membuka detail, mengubah nilai, menutup dialog dengan Escape dan mengembalikan fokus.
- Reuse SuiteSurface/ThemePicker dan token Office Tools agar tema terang/gelap/sistem konsisten, tanpa mengharuskan sesi Office. Animasi hanya untuk umpan balik buka/tutup dan reduced-motion dihormati.
- Loading, kosong, layanan belum siap, PIN salah/terlalu sering, gagal simpan, konflik revisi dan validasi impor punya pesan serta tindakan pemulihan yang nyata. Tidak ada fallback data contoh bila database belum siap.

## Grafik dan perbandingan

- Riwayat grafik dari snapshot tersimpan, dengan rentang tanggal dan pilihan seluruh provinsi atau satu provinsi. Ukuran: provinsi dengan akun, total paket diketahui, jumlah terintegrasi diketahui, persentase integrasi. Pisahkan skala jumlah dan persen.
- Nilai tidak diketahui menjadi gap dengan keterangan, bukan nol. Agregat paket/integrasi nasional harus diberi label sebagian jika ada provinsi tanpa data; jangan menampilkan persentase nasional lengkap dari pembagi yang belum lengkap.
- Perubahan dibanding laporan sebelumnya yang benar-benar tersimpan, dengan tanggal pembanding eksplisit. Tidak menganggap tanggal yang hilang sebagai perubahan nol. Nilai parsial tidak dibandingkan seolah cakupannya sama.
- Sediakan tabel data ringkas grafik supaya nilai dapat dibaca tanpa hover atau persepsi warna.

## Excel

- Unduh `.xlsx` dengan sheet Petunjuk, Provinsi, Akun dan Paket. Gunakan nama provinsi/ID, tanggal laporan dan ID paket stabil untuk round-trip. File dapat memuat data laporan tersimpan terpilih sehingga pengguna cukup memperbaruinya. Tidak ada PIN atau token di workbook.
- Provinsi memuat jumlah total dan terintegrasi, catatan serta tindak lanjut. Akun memuat peran, status, jumlah dan rincian opsional. Paket memuat nama serta empat status tahap 4. Timestamp hasil ekspor informatif; server mengatur timestamp perubahan, tidak memercayai waktu buatan Excel.
- Parser mendukung workbook XLSX normal, shared/inline strings dan sel angka, menggunakan PizZip yang tersedia; XML diproses lewat parser yang tersedia di browser, menolak DTD. Tidak mendukung XLS/XLSM/CSV atau rumus sebagai sumber data. Batasi ukuran upload dan total hasil dekompresi, jumlah sheet/row dan panjang sel.
- Impor mengubah tanggal yang dipilih saja. Tanggal campuran/tidak cocok, provinsi/peran/status asing, ID duplikat, ID paket milik provinsi lain, angka negatif/pecahan dan terintegrasi melebihi total ditolak dengan lokasi sheet/baris. ID baru hanya untuk paket baru. Baris yang tidak dicantumkan tidak menghapus data lama.
- Alur: pilih file, validasi, tampilkan pratinjau perubahan, terapkan ke draft, kemudian Simpan perubahan. Tidak menyimpan sebagian atau menjalankan rumus Excel. Sel kosong pada baris lengkap berarti belum diketahui; baris yang tidak ada berarti tidak diubah. Versi format template ditandai agar perubahan format mendatang bisa ditolak dengan pesan jelas.

## PDF

- Unduh laporan dari revisi tersimpan dan tanggal terpilih, A3 lanskap dengan judul, struktur tahap, 38 provinsi, ringkasan serta keterangan seperti sumber. Warna kelompok tahap dipertahankan untuk orientasi pembaca.
- Tahap 4 menggunakan ringkasan status, bukan total empat kolom. Nama paket panjang diringkas pada rekap dan seluruh nama/rincian tersedia di lampiran PDF jika diperlukan. Satu halaman web tidak membatasi jumlah halaman PDF; halaman rekap utama diikuti lampiran bila isi terlalu panjang.
- Cantumkan sumber awal/posisi data, waktu cetak WIB dan nomor halaman bila lebih dari satu. Tidak memasukkan PIN, token atau informasi admin. PDF tidak menebak data yang tidak ada.
- Verifikasi hasil render dengan 38 provinsi, nama panjang, angka besar dan data N/D; tidak boleh ada kolom tertimpa, teks terpotong tanpa akses ke rincian, atau header terlepas dari datanya.

## Batas pekerjaan dan penerapan

- Tambahan schema memakai prefix report_, migration manual berurutan melalui Supabase SQL Editor sesuai aturan repo. Jangan menjalankan migration production secara otomatis. Skrip penyiapan boleh menyusun file lokal untuk operator; tidak mengubah fitur lama atau menghapus data.
- Aplikasi melaporkan penyiapan belum lengkap sampai migration, secret dan dua PIN tersedia. Build bukan bukti database production sudah siap.
- Baca panduan Next.js lokal sebelum menulis kode. Routes protected memakai force-dynamic dan await cookies/params sesuai versi terpasang.
- Semua perubahan pengguna lain yang sudah ada di checkout dipertahankan. Jangan reset/stash/commit perubahan lain. Nilai PIN diberikan ke setup melalui jalur lokal, tidak masuk artefak yang dikomit.
- Di luar lingkup: sinkronisasi otomatis SIPASTI/SIPD, pengambilan akun asli dari layanan eksternal, login Google baru, publikasi laporan tanpa PIN, serta rumus progres keseluruhan yang belum disetujui.

## Verifikasi yang diwajibkan

- Tes domain: nilai nullable vs nol, seed tepat 38 provinsi/15 Ada tahap 1/rekap peran 15-1-2-0-2-0, formula integrasi dan batas jumlah, timestamp perubahan, carry-forward, snapshot lama tidak berubah, konflik revisi.
- Tes pengurutan: banyak langkah selesai, seri tahap akun/tanggal awal/urutan sumber, rincian parsial, Perbaikan tidak menaikkan skor, urutan PDF sama dengan web, dan baris tetap saat draft diedit. Verifikasi hijau hanya untuk selesai/keberadaan akun sesuai legenda; status campuran, Proses, `-`, T/C dan N/D tetap dibedakan dengan teks.
- Tes akses: peran admin/penginput, penginput ditolak mengubah PIN, sesi kedaluwarsa/dicabut, API tanpa sesi, same-origin dan limiter. Pastikan tidak ada nilai PIN dalam respons/log/ekspor.
- Tes Excel round-trip dan file Excel biasa, baris salah dengan lokasi, impor tidak menghapus baris yang hilang, preview tanpa tulis, serta batas ZIP.
- Verifikasi UI desktop/ponsel, kedua tema, keyboard, hover/klik detail, simpan/batal, grafik nullable, ekspor PDF dan PDF render. Uji lint/typecheck/build sesuai perubahan.
- Catat hasil dan keterbatasan aktual di dokumentasi fitur. Jangan mengklaim setup database/PIN live selesai jika belum dilakukan dan diverifikasi.

## Keputusan yang dibawa ke eksekusi

Pengguna sudah menentukan fitur dan PIN. Keputusan pembangun yang perlu terlihat saat persetujuan: snapshot harian di Supabase; sesi PIN khusus laporan; total paket boleh diisi sebelum seluruh nama tersedia; timestamp mengikuti pencatatan server; PU -> BPKAD -> APIP sebagai alur utama dan Perbaikan sebagai proses revisi; progres keseluruhan tetap N/D karena tidak ada bobot resmi; PDF boleh memiliki lampiran untuk rincian panjang.
