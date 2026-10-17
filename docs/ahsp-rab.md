# Pencocokan RAB

Halaman `/ahsp/rab` diakses melalui tombol **Pencocokan RAB** di sebelah
**Rekapitulasi MPTK** pada katalog `/ahsp`. Fitur mencocokkan nama pekerjaan;
pemilihan pasangan tidak menghitung ulang harga AHSP atau mengonversi satuan.

## Ringkasan, grup, dan penyimpanan

Seluruh halaman AHSP mengikuti referensi Swiss Red yang dipilih pengguna pada 17 Oktober
2026 (`https://21st.dev/community/themes/editor?from=swiss-red`). Lingkup tema
mencakup `/ahsp`, `/ahsp/mptk`, dan `/ahsp/rab`, termasuk filter, modal,
pemetaan, simpanan, dan rekap komponen. Ketiganya menggunakan stylesheet bersama
`app/ahsp/swiss-red.module.css`. Warna semantik ekspor Excel dipertahankan.
Token pratinjau: latar putih/hitam, kartu gelap #0a0a0a, teks hitam/putih,
muted #666/#b2b2b2, primary terang #db0000, aksen gelap #ff0000, radius kontrol
0px dan panel 12px. Tombol merah tetap memakai #db0000 dengan tulisan putih
agar kontras minimal 4,5:1 terpenuhi pada kedua tema. Lebar konten maksimal
1.200px; panel bersela 16–24px dan kontrol 36px pada desktop/44px pada ponsel.
Unggah dan simpanan berdampingan pada desktop, bertumpuk pada ponsel; simpanan
disembunyikan selama pemetaan/pencocokan agar fokus tetap pada tahap aktif.

- Ringkasan menonjolkan Total item cocok (utama + tambahan) dan persentasenya.
  Item diperiksa, rincian kecocokan, dan status pemeriksaan tersusun dalam grid
  tiga kolom pada desktop dan dua pada ponsel. Total harga (Rp) berada di bagian
  bawah. Persentase dan harga ditampilkan dengan tepat dua angka desimal;
  presisi angka sumber tetap disimpan.
- Tabel mengelompokkan **nama dan kode yang sama persis**, tanpa mengabaikan
  kapitalisasi, spasi, atau perbedaan kode. Baris dikecualikan tidak ikut grup.
  Uraian kosong/placeholder yang belum terbaca tetap dipisahkan per baris.
  Kemunculan lintas sheet tetap satu grup. Grup dengan keputusan berbeda
  ditampilkan pada Tidak cocok dengan penjelasan untuk pemeriksaan ulang.
- Kemunculan membuka modal dengan lokasi, status, satuan, dan angka masing-masing
  baris, maksimal 25 per halaman. Pemilihan pasangan, pembatalan, tag tidak ada
  kecocokan, dan pembukaan pemeriksaan ulang berlaku untuk semua anggota grup.
  Konfirmasi menampilkan jumlah kemunculan serta perbedaan semua satuannya.
  Semua anggota harus sudah dikonfirmasi pembacaannya sebelum memilih pasangan.
- Koreksi pembacaan tetap berlaku per kemunculan. Checkbox opsional dapat
  menerapkan uraian, kode, dan konfirmasi ke grup. Satuan/angka kemunculan lain
  dipertahankan. Pengecualian tidak ikut diterapkan massal melalui checkbox ini.
  Rekap, denominator persentase, Final RAB, dan penggunaan MPTK selalu memakai
  seluruh baris sumber, bukan jumlah grup yang tampil.
- **Simpan perhitungan** memakai IndexedDB lokal, database `ahsp-rab`, store
  `sessions`, versi 1. Tidak memerlukan login atau perubahan database server.
  Beberapa perhitungan dapat diberi nama, dibuka, diperbarui, dan dihapus.
  Data mencakup sheet terpilih/pemetaan/sel sumber, hasil pembacaan, koreksi,
  keputusan dan riwayat, batas yang dikonfirmasi, serta rekap MPTK yang dimuat.
  Katalog lengkap dan file biner Excel tidak disimpan.
- Simpanan hanya berlaku pada browser, profil, origin, dan perangkat yang sama.
  Menghapus data situs juga menghapus simpanan. Menutup tab lalu membuka kembali
  tidak menghapusnya. Penyimpanan baru dinyatakan berhasil setelah transaksi
  IndexedDB selesai. Jika gagal, data di halaman dan simpanan lama tetap ada.
- Saat membuka simpanan, katalog dimuat kembali. Pasangan yang identitasnya
  berubah/hilang dipindahkan untuk ditinjau dan rekap komponen lama dibatalkan.
  Jika katalog gagal dimuat, hasil simpanan tetap dapat dilihat dan diunduh.

Ekspor terbaru:

- Rekapitulasi: jumlah cocok dan persentase digabung seperti `90 (14,00%)`;
  Total item cocok ditambahkan. Ringkasan nilai per kelompok hanya memuat
  Kelompok/Jumlah item. Total harga (Rp) tetap angka dengan format dua desimal.
- Regulasi Utama, Regulasi Tambahan, Belum Cocok, dan Dikecualikan memuat 15
  kolom yang relevan untuk pemeriksaan. Sheet/baris/sel asal, uraian asli
  terpisah, sel angka, angka asli, dan riwayat tindakan dihapus dari sheet ini.
  Uraian sumber berwarna biru muda; hasil rekonsiliasi hijau muda.
- Final RAB: Kode, Uraian sumber, Uraian hasil rekonsiliasi, Satuan, Harga satuan
  (Rupiah), Volume/Kuantitas, Jumlah Harga, Regulasi. Baris regulasi tambahan
  berwarna kuning muda. Semua kemunculan dan angka sumber dipertahankan.
- Rekapitulasi MPTK menggabungkan tiga kelompok dalam bagian terpisah. Enam
  sheet dasar tetap ada; dengan rekap komponen, jumlahnya menjadi sembilan.

`node scripts/check-ahsp-rab-sessions.cjs` memeriksa pengelompokan, keputusan
massal dan perbedaan satuan, angka setiap kemunculan, persentase/harga, warna
ekspor, simpan–tutup tab–buka ulang, pembaruan tanpa duplikasi, penghapusan,
serta tema terang/gelap di 320–1440 px. Butuh dev server dan browser Chrome.

`node scripts/check-ahsp-theme.cjs` memeriksa tema bersama di ketiga halaman,
mode terang/gelap/sistem, lebar 320–1440 px, kontras teks/tombol, ukuran modal,
koefisien, serta kalkulator AHSP menggunakan katalog uji. Swiss Red menjadi
tema default; pemilih **Tema** juga menyediakan Pastel Dreams dan Indigo Frost.
Palet dan radius keduanya mengikuti referensi pengguna:
`https://21st.dev/@serafimcloud/themes/pastel-dreams` dan
`https://21st.dev/@serafimcloud/themes/indigo-frost`. Warna teks aksi, tautan,
dan batas kontrol disesuaikan agar tetap terbaca pada tampilan data.
Pengaturan berada di kanan atas baris navigasi pada seluruh halaman AHSP.
Tombol palet membuka panel kecil berisi tiga tema, cuplikan warna, dan tanda
pilihan aktif. Nama tema tampil pada desktop; ponsel memakai ikon dengan label
aksesibel. Tombol ikon matahari/bulan di sebelahnya langsung mengganti mode
terang/gelap. Opsi **Ikuti mode perangkat** berada di panel tema. Target sentuh
44px, panel mengikuti posisi tombol dan dibatasi tepi viewport, Escape/klik
di luar menutup panel. Pergantian tidak memindahkan area filter atau data.
Preferensi disimpan di localStorage `ahsp-appearance`, dibaca seluruh halaman
AHSP dan disinkronkan antartab. Data tidak valid kembali ke Swiss Red/mode
sistem. Jika penyimpanan diblokir, pilihan tetap berlaku pada tab aktif.
Pengujian mencakup panel di tepi layar, fokus setelah Escape, muat ulang,
lintas halaman/tab, dan penyimpanan rusak/diblokir.

## Pembacaan

- File harus `.xlsx` dengan struktur Open XML yang valid; maksimal 10 MB.
- Pengguna memilih minimal satu, maksimal tiga sheet. Sheet tersembunyi diberi label.
- Batas setiap sheet adalah baris Excel 1–1.000, termasuk header dan baris kosong.
  Jika ada isi setelah baris 1.000, persetujuan diperlukan sebelum pencocokan.
  Cakupan terbatas tetap tercantum di rekap layar dan unduhan.
- Dimensi worksheet tidak dipercaya sebagai jumlah data. Baris terakhir ditentukan
  dari sel yang berisi nilai atau rumus, termasuk sel di luar batas pemrosesan.
- Kolom uraian, kode, satuan, volume, Harga Satuan (Rupiah), total, dan awal data
  dideteksi lalu dapat dikoreksi. Satu kolom tidak boleh dipakai untuk dua bidang.
- Sel gabungan dengan beberapa uraian dipisahkan berdasarkan baris teks dan
  baris angka pendukung. Subtotal tidak ikut dipasangkan. Hasil pemisahan
  memerlukan konfirmasi. Jika jumlahnya berbeda, angka dibiarkan kosong.
- Angka dalam sel gabungan vertikal tidak diteruskan ke semua pekerjaan.
  Sel asal dan isi asli dipertahankan agar pengguna bisa memperbaiki pasangan.
- Judul/subtotal dikecualikan. Baris tanpa satuan/angka pendukung yang mungkin
  berupa kelompok berkode memerlukan pemeriksaan pengecualian. Pengguna dapat
  mengembalikan baris tersebut menjadi pekerjaan.
- Nol dibedakan dari kosong. Teks angka yang ambigu tidak ditebak. Hasil
  tersimpan rumus dibaca tanpa menjalankan atau menghitung ulang rumus.
- Pembacaan memakai DOMParser browser dan PizZip yang sudah tersedia, tanpa
  dependency baru. Isi file tidak dikirim ke server. XML eksternal ditolak;
  batas metadata ZIP 40 MB, 2.000 entri, 100 sheet, dan 256 kolom/100.000 sel
  terisi pada 1.000 baris pertama tiap sheet membatasi ukuran pemrosesan.

## Pencocokan dan keputusan pengguna

### Pratinjau dan pemetaan interaktif

Tahap awal menampilkan lima pekerjaan hasil pembacaan per halaman, termasuk
hasil pemisahan sel gabungan. Header Kode/Uraian/Satuan/Volume/Harga/Total dapat
ditekan untuk mengganti kolom sumber melalui panel yang muncul di dekat header.
Panel menampilkan huruf kolom, header Excel, dan dua contoh isi; pencarian
mencakup ketiganya. Tidak ada kumpulan dropdown huruf tanpa konteks.

Jika kolom pilihan sudah dipakai bidang lain, sumber kedua bidang ditukar dan
perubahan dijelaskan. Urungkan memulihkan satu perubahan terakhir. Deteksi
ulang tersedia. Kolom opsional dapat ditandai Tidak tersedia; uraian wajib.
Jumlah pekerjaan pada rekap langsung mengikuti perubahan pemetaan.

Tampilan Sel Excel asli mempertahankan urutan fisik kolom, membatasi cuplikan
menjadi lima baris, dan memungkinkan klik nomor baris untuk menetapkan awal
data. Teks panjang dibatasi pada cuplikan, tetapi seluruh isi tetap dapat dibuka
dalam dialog. Baris dikecualikan juga bisa dilihat pada pratinjau hasil baca.

Panel pemetaan memakai native popover, mendukung Escape/klik di luar,
pengembalian fokus, posisi dalam viewport, dan reduced motion. Pratinjau hasil
menumpuk pada ponsel. Tabel hasil rekonsiliasi memiliki aturan lebar terpisah
agar tidak memengaruhi tabel pratinjau.

`GET /api/ahsp/rab` hanya mengembalikan identitas/nama/kode/satuan/regulasi
katalog pekerjaan. Server membaca semua halaman Supabase, berurutan berdasarkan
ID, bukan hanya 1.000 hasil pertama. Cache lima menit dan penggabungan permintaan
bersamaan menghindari pembacaan berulang. Kegagalan tidak menghasilkan katalog
parsial yang dianggap lengkap. Rate limit menggunakan helper proyek.

SE 47/2026 dan Permen 08/2023 dipakai otomatis. Referensi tambahan yang tersedia
saat ini adalah arsip SE 182/2025. Menambah regulasi lain memerlukan pembaruan
katalog; fitur ini tidak mencari regulasi di internet. Tidak ada migrasi baru.

Like-match mencari substring literal nama. Gabungan frasa memakai parser AHSP
yang sudah tersedia, minimal dua frasa berbeda pada satu nama. Rekomendasi
tambahan disertakan jika belum ada nama sama dengan satuan kompatibel pada
sumber utama. Urutan kandidat mempertimbangkan nama sama, kelompok regulasi,
jumlah frasa ditemukan, lalu prioritas edisi. Tidak ada persentase kemiripan
per item yang direkayasa dari jumlah kata.

Penetapan otomatis hanya untuk nama ternormalisasi sama, satuan kompatibel,
dan pembacaan yang tidak menunggu konfirmasi. Angka spesifikasi tidak dibuang.
Kandidat lain memerlukan pilihan pengguna. Perbedaan uraian, angka spesifikasi,
metode, dan satuan ditampilkan. Alasan penyelesaian bersifat opsional dan tidak
menghalangi konfirmasi. Perbedaan tetap dicatat pada rincian hasil dan ekspor.

Modal Cari pasangan menampilkan spinner ketika rekomendasi disiapkan. Filter
satuan langsung menyaring hasil, menyamakan alias seperti m³/m3 dan bh/buah,
serta kembali ke halaman pertama. Menutup modal membatalkan pembaruan pencarian
yang belum selesai. Metode Like-match dan Gabungan frasa tetap tersedia.

Kamus alias satuan yang dipakai bersama oleh pencocokan, peringatan perbedaan,
prioritas regulasi utama, dan filter kandidat:

| Kelompok | Penulisan yang dianggap sama |
| --- | --- |
| Lumpsum | LS, Ls, ls, Lumsum, Lumpsum, Lump Sum, Lumsun (alias salah ketik eksplisit) |
| Meter kubik | M3, m3, M³, Meter Kubik |
| Meter persegi | M2, m2, M², Meter Persegi |
| Meter panjang | M1, m', m, Meter, Meter Panjang |
| Kilogram | Kg, kg, Kilogram |
| Buah | Bh, bh, Buah, buah |
| Orang-bulan | Org / Bln, org-bln, OB, org/bln, Orang-Bulan, Orang Bulan |
| Orang | org, Orang |
| Pasang | Psg, Pasang |

Normalisasi hanya membandingkan istilah; satuan asli dan seluruh angka tetap
disimpan serta diekspor. Set/Buah, Pasang/Buah, LS/Paket, Dos/Buah, Roll/Meter,
dan Alat/Kend/Unit tetap terpisah. Kg/Ton, Liter/m3, panjang/luas/volume,
Orang/Orang-Bulan/Orang-Jam, dan satuan gabungan tidak disamakan. Satuan kosong
atau `-` tetap memerlukan pemeriksaan. Tidak ada konversi angka atau pencocokan
ejaan secara fuzzy; hanya alias yang tercantum yang diterima.

Dua kelompok hasil adalah **Cocok** dan **Tidak cocok**. Tab Cocok memisahkan
tabel regulasi utama dan tambahan. Pengguna dapat memeriksa data, memulihkan
isian dari sumber, mengecualikan/mengembalikan baris, mencari kandidat lain,
memakai kandidat melalui modal konfirmasi, dan membatalkan pasangan.
Pemilihan pasangan menyimpan uraian hasil rekonsiliasi terpisah dari uraian asli.
Perpindahan ke kelompok Cocok, Tidak cocok, atau Dikecualikan menampilkan
notifikasi mengambang selama enam detik, yang dapat ditutup pengguna.

Pengubahan pembacaan membatalkan pasangan lama sebelum dicocokkan ulang.
Mengganti file/pemetaan juga mengosongkan hasil setelah konfirmasi. Penghentian
proses mempertahankan hasil sementara; item tertunda dapat dicocokkan kembali.

## Rekap dan ekspor

Rekap terlihat sejak workbook dibaca, mengikuti pilihan sheet/pemetaan, proses
pencocokan, dan keputusan manual. Persentase utama menggunakan jumlah pasangan
utama dibagi seluruh item yang diikutkan; persentase tambahan dihitung terpisah.
Item tertunda/perlu ditinjau/belum ditemukan tetap masuk penyebut. Pengecualian
beserta jumlah yang belum dikonfirmasi terlihat jelas. Total uang hanya
menjumlahkan total sumber yang tersedia, disertai jumlah item tanpa total.
Ikon ? menjelaskan setiap ukuran rekap dan dasar persentasenya. Spinner
menandai pembacaan workbook, pencocokan, pencarian pasangan, dan penyiapan Excel;
pengaturan reduced motion mempertahankan indikator statis beserta teksnya.

Unduhan berisi Rekapitulasi, Regulasi Utama, Regulasi Tambahan, Belum Cocok,
Dikecualikan, dan Final RAB. Rekapitulasi memisahkan informasi dokumen, cakupan
sheet, hasil pencocokan, nilai per kelompok, dan catatan dalam section dengan
header serta jarak terpisah. Bilangan bulat memakai format tanpa desimal;
nilai uang memiliki dua tempat desimal. Kolom dan tinggi baris mengakomodasi
teks yang dibungkus. Setiap rincian mencantumkan uraian asli/diperiksa/hasil,
identitas pasangan, sumber regulasi, satuan, volume, Harga Satuan (Rupiah),
total sumber, keputusan manual/otomatis, penyelesaian perbedaan, sel asal,
nilai mentah, dan riwayat tindakan. Semua halaman hasil diekspor. Teks sumber
ditulis sebagai string Excel, sehingga teks yang diawali `=` tidak menjadi rumus.
Total yang berbeda dari volume × harga satuan diberi catatan tanpa ditimpa.

Final RAB memuat Kode, Uraian, Satuan, Harga satuan (Rupiah), Volume/Kuantitas,
Jumlah Harga, dan Regulasi. Kode serta uraian mengambil pasangan yang telah
ditetapkan cocok; item tanpa pasangan menggunakan data sumber yang diperiksa
dan regulasinya kosong. Satuan serta angka tetap menggunakan sumber, termasuk
bila satuan kandidat berbeda. Baris dikecualikan tidak masuk. Urutan sumber,
nol, nilai kosong, dan jumlah total sumber dipertahankan. Filter, header beku,
judul, jumlah harga, serta status hasil sementara tersedia pada sheet ini.

Sesi berlangsung di memori browser, tanpa riwayat RAB di database. Peringatan
ditampilkan sebelum menutup/memuat ulang atau kembali ke katalog setelah
perubahan yang belum diunduh. Unduh hasil sebelum meninggalkan halaman.

## Rekap penggunaan komponen (opsional)

Sesudah pencocokan, pengguna dapat memilih **Selesai dan unduh Excel** atau
**Lanjut ke rekap penggunaan komponen**. Rekap membutuhkan minimal satu baris
yang ditetapkan cocok. Pekerjaan yang belum cocok dan baris dikecualikan tidak
diikutkan. Hasil sementara tetap dapat diunduh tanpa membuka rekap lanjutan.

Tiga kelompok ditampilkan: Tenaga kerja, Material, dan Peralatan. Total dipakai
menghitung jumlah baris RAB yang memakai komponen, bukan volume fisik. Kolom
Item pekerjaan/AHSP menghitung ID AHSP pasangan yang unik, termasuk versi
regulasinya. Komponen yang muncul berulang dalam satu AHSP dihitung sekali
untuk setiap baris RAB. Dua baris RAB dengan pasangan AHSP sama menghasilkan
dua penggunaan dan satu AHSP unik. Identitas komponen menggunakan kode dalam
sumber/regulasi/bidang yang sama jika tersedia; sisanya memakai nama lengkap.
Kategori dan satuan berbeda tetap terpisah.
Normalisasi satuan hanya memakai alias yang telah disetujui di atas.

Daftar pekerjaan dibuka dalam modal yang menampilkan kode, uraian, regulasi,
jumlah baris pemakai, dan lokasi sheet/sel/baris. Pengguna dapat mencari nama
atau kode komponen. Tabel, daftar pekerjaan, dan cakupan masing-masing memiliki
pagination 20 entri. Modal mendukung Escape dan pengembalian fokus ke pemicu.

`POST /api/ahsp/rab/components` menerima hanya UUID pasangan terpilih, maksimal
100 ID per permintaan. Browser mengirim batch berurutan dan menampilkan spinner
serta kemajuan. Workbook, volume, harga, dan baris RAB tetap di browser. Handler
membaca regulasi katalog utama/arsip dan view `ahsp_mptk_validation` yang sudah
ada, dengan pagination agar batas default 1.000 record tidak memotong komponen.
Kategori yang dikoreksi view digunakan, dan komponen dengan masalah identitas
tidak dihitung. Tidak diperlukan migrasi baru. Rujukan analisis hanya diikuti
jika `canUseAhspReference` memverifikasi target dan fingerprint sumber/target.
Identitas pasangan serta acuan analisis disimpan terpisah dalam rincian.

Koefisien kosong tidak menghalangi rekap identitas komponen. Tidak ada perkalian
koefisien, volume, harga, atau perhitungan biaya MPTK. Rincian yang belum tersedia
ditandai sebagai belum tersedia, bukan penggunaan nol. Analisis sebagian atau
perlu ditinjau diberi keterangan. Cakupan menampilkan setiap baris cocok dan
alasan rincian tidak tersedia. Perubahan identitas katalog sejak pencocokan
memerlukan rekonsiliasi ulang. Kegagalan salah satu batch membatalkan rekap
sementara; pengguna dapat memuat ulang atau kembali ke rekonsiliasi.

Setelah rekap berhasil, unduhan menambahkan Rekapitulasi MPTK (tiga bagian:
tenaga kerja, material, peralatan), Rincian Penggunaan, dan Cakupan Komponen. Ringkasan
cakupan dan definisi hitungan ditambahkan ke Rekapitulasi. Enam sheet sebelumnya,
termasuk satuan dan angka Final RAB, dipertahankan. Rincian penggunaan mencatat
setiap komponen/pasangan/baris RAB, termasuk regulasi pasangan dan acuan analisis.
Perubahan keputusan atau pembacaan RAB membatalkan rekap lama; unduhan kembali
berisi enam sheet sampai rekap dihitung ulang. Menutup tahap saat masih memuat
membatalkan permintaan klien. Rekap dapat dipertahankan lewat Simpan perhitungan.

## Verifikasi

### Pembaruan pemeriksaan baris dan rincian Bina Marga

- Harga satuan yang terisi sebagai angka, termasuk nol, mengalahkan deteksi
  judul/subtotal saat membaca baris. Teks angka dengan pemisah ambigu tetap
  diikutkan dan memerlukan pemeriksaan angka. Baris berharga tanpa uraian/kode/
  satuan juga dipertahankan sebagai Uraian belum terbaca. Nomor kolom berurutan
  pada baris header dikenali saat deteksi awal data, sehingga angka legenda
  kolom tidak dipakai sebagai harga. Pengguna tetap dapat mengecualikan baris
  secara manual setelah memeriksa sumber.
- Panel pengecualian menyediakan checklist per baris, pilih semua dengan
  keadaan sebagian terpilih, dan pemasukan kembali banyak baris sekaligus.
  Tindakan Ubah pengecualian membuka modal dengan Kecualikan dari daftar
  pekerjaan tidak dicentang. Perubahan berlaku setelah disimpan; membatalkan
  modal mempertahankan keputusan semula. Pembacaan ambigu tidak dikonfirmasi
  otomatis oleh pemasukan massal.
- Tidak ada kecocokan menyimpan keputusan manual tersendiri pada baris tidak
  cocok. Baris diberi latar dan tag, dipindahkan ke bagian akhir kelompok, dan
  dapat disembunyikan. Periksa kembali membuka peninjauan ulang. Keputusan
  bertahan saat pencocokan dilanjutkan, dihitung dalam penyebut persentase,
  dan diekspor pada Belum Cocok serta riwayat tindakan. Final RAB tetap memakai
  data sumber. Menyimpan koreksi atau memilih pasangan baru menghapus tag lama.
- Badge Tenaga kerja, Material, dan Peralatan menunjukkan kelompok komponen
  yang benar-benar dimuat untuk pasangan/kandidat tersebut, tanpa menggandakan
  identitas berulang. Modal Periksa data menampilkan daftar komponen per jenis.
  Jika belum ada pasangan, kandidat pertama diberi keterangan belum ditetapkan.
  Permintaan metadata dibatasi ke item pada halaman/modal dan disimpan di memori
  selama sesi; spinner, kegagalan, serta muat ulang tersedia.
- `readAhspNativeComponents` membaca identitas pada tabel akhir A. Tenaga,
  B. Bahan, C. Peralatan dari `source_text` Bina Marga ketika view tidak memuat
  komponen terstruktur. Kode judul harus sama dengan item. Pembacaan berhenti
  pada akhir tabel atau judul pekerjaan berikutnya, memerlukan tiga penanda
  kategori, serta menahan baris rusak/tidak sesuai kategori. Koefisien nol
  tidak dihitung sebagai penggunaan. Harga contoh nol tidak menghapus
  komponen berkoefisien positif; tidak ada perhitungan kuantitas atau biaya.
  Satuan Jam pada tenaga kerja diterima dari tabel kategori eksplisit tersebut.
  Pembacaan runtime tidak mengubah metadata/fingerprint atau komponen database.
- Hasil teks diberi catatan untuk memeriksa kelengkapan lampiran. Keterangan
  membedakan biaya SMKK, sumber belum diimpor, teks belum terpetakan, dan
  komponen yang ditahan. Halaman daftar judul tanpa tabel tidak diperlakukan
  sebagai rincian. Arsip tidak mengambil komponen dari edisi lain secara diam-diam.
- Verifikasi pasangan ekspor Banten: dari 41 AHSP unik, empat tabel teks
  menghasilkan 33 hubungan komponen (Galian Perkerasan Beton 6, Timbunan
  Pilihan Kasar 9, Kereb Tegak 11, Perkerasan Bata Beton 7). Hubungan tersebut
  tersedia melalui endpoint rekap. Ini bukan klaim seluruh katalog telah
  memiliki rincian MPTK; 28 pasangan SMKK tetap di luar kelompok MPTK.
- Dua paragraf panjang yang diminta dihapus sudah dihilangkan dari halaman.
  Definisi tetap tersedia dalam bantuan ?. Lebar bantuan menjadi maksimal
  720px dan menyesuaikan viewport, dengan posisi terpusat pada tablet/ponsel.

`node scripts/test-ahsp-rab-usage.mjs` menguji hitungan baris/AHSP, duplikasi,
pemisahan regulasi/spesifikasi/satuan, cakupan, data sumber, ekspor sembilan sheet,
validasi API, pagination komponen, rujukan terverifikasi, dan kegagalan koneksi.
`node scripts/check-ahsp-rab-usage.cjs` menguji alur opsional, spinner, reduced
motion, permintaan hanya ID, modal, pencarian, tiga pagination, cakupan, ekspor,
pembatalan, invalidasi, muat ulang, serta tema terang/gelap pada 320–1440 px.
Script browser juga memeriksa 100 ID katalog nyata melalui endpoint komponen.
`node scripts/render-rab-export.mjs .next/rab-tests/usage-ui-export.xlsx --usage`
merender sheet rekap lanjutan untuk pemeriksaan visual.

`node scripts/test-ahsp-rab.mjs` memeriksa ekstraksi, batas baris, angka,
spesifikasi/satuan, arsip, denominator rekap, ekspor, pagination katalog,
cache/concurrency, rate limit, dan kegagalan koneksi tanpa mengakses database.
Pemeriksaan alias mencakup sembilan kelompok (37 variasi uji), 17 pasangan
satuan berbeda/kontekstual, prioritas sumber utama, dan satuan/angka asli
hingga Final RAB. Pencocokan spesifikasi dan konfirmasi pembacaan tetap diuji.

`node scripts/check-ahsp-rab-ui.cjs` membutuhkan dev server, Chrome,
Playwright runtime, katalog Supabase yang tersedia, serta enam contoh pengguna.
Lokasi dapat diubah melalui `RAB_ORIGIN`, `RAB_SAMPLES`, `PLAYWRIGHT_MODULE`.
Script tidak menulis ke database atau mengubah workbook sumber. Hasil uji
dan workbook sementara berada di `.next/rab-tests/`.
Filter modal diuji agar setiap kelompok alias hanya memiliki satu pilihan.

Audit khusus pratinjau: `playwright-cli -s=rab-audit run-code
--filename=scripts/check-ahsp-rab-mapping.js` setelah membuka `/ahsp/rab` pada
sesi tersebut. Pemeriksaan mencakup pemetaan, pertukaran/undo, pencarian kolom,
sel lengkap, lima ukuran viewport, tema, reduced motion, dan keenam workbook.

### Koreksi dan verifikasi Gorontalo

- Pengelompokan menggunakan kategori, kode komponen, dan satuan dalam sumber,
  bidang, serta regulasi yang sama. API memasok `identity_scope` dari identitas
  sumber analisis. Kode L/M/E harus sesuai kategori. Nama seperti Semen dan
  Semen (PC), atau Tukang dan Tukang Batu, dapat menyatu berdasarkan kode
  sumbernya; kode/satuan/sumber berbeda tetap terpisah. Tanpa kode yang memenuhi
  aturan tersebut, identitas tetap menggunakan nama dan satuan, termasuk Alat Bantu.
- Koefisien nol disaring baik dari view komponen terstruktur maupun tabel teks.
  Koefisien belum tersedia tidak diasumsikan nol. Harga contoh tidak menentukan
  ada/tidaknya pemakaian komponen.
- `ahsp-bm-pages.py` membaca kode pembayaran pada judul analisis PDF asli,
  mengabaikan daftar isi dan menahan kode dengan lebih dari satu judul.
  Pemetaan ini digunakan pada inventarisasi dan enrichment, termasuk untuk
  membetulkan pemetaan lama yang sudah memiliki `source_id` tetapi berisi TOC.
  Halaman awal judul dapat berbeda dari halaman tabel komponen terakhir.
- Delapan koreksi yang diterapkan pada sumber 10903: 2.1.(1), 2.2.(1),
  3.1.(1), 6.1.(1), 6.1.(2a), 7.1.(6a), 7.1.(8), dan 7.1.(10).
  `ahsp-repair-bm-pages.mjs` memeriksa SHA-256 PDF terhadap katalog, keadaan
  record saat ini, dan ketiadaan rujukan analisis yang akan terdampak.
  Mode awal hanya verifikasi; `--apply` membuat cadangan terlebih dahulu lalu
  memperbarui lokasi halaman, halaman cetak, dan teks sumber dengan pengaman
  perubahan bersamaan. Nama, satuan, komponen, status, dan angka tidak ditimpa.
- `node scripts/check-ahsp-gorontalo.mjs <folder-bukti> --live` membandingkan
  rincian manual dengan hasil API dan fungsi ekspor yang dipakai aplikasi.
  Folder memuat hasil pembacaan workbook `rab-compare.json`, snapshot analisis
  `gorontalo-ahsp.json`, dan rencana `page-repairs.json`; data ini hanya bukti uji,
  bukan dependensi aplikasi. Semua 122 hubungan komponen–AHSP dan hitungan
  masing-masing dari 44 komponen cocok: 3 tenaga kerja, 19 material, 22 alat.
  Seluruh 14 AHSP utama memiliki rincian, dari sebelumnya hanya 6.
- Pemeriksaan seluruh 52 pasangan ekspor tetap mencatat 38 tanpa rincian MPTK:
  30 SMKK, 7 arsip, dan 1 Mobilisasi. Daftar contoh alat Mobilisasi tidak
  dipindahkan menjadi pemakaian proyek. Dua baris Paku M18 berkoefisien nol
  tidak dihitung. RAB akhir mempertahankan angka dan satuan sumber.
- Hasil kasus ini tidak menyatakan seluruh katalog sudah lengkap. Tabel teks
  tetap diberi penanda perlu ditinjau, terutama analisis yang memiliki baris
  tidak terbaca. Verifikasi manual menguji inventaris komponen, bukan volume
  kebutuhan atau biaya material, tenaga kerja, dan peralatan proyek.
