# PRD: Office Workspace dan tiga aplikasi pendamping

Tanggal: 25 Oktober 2026, Asia/Jakarta. Disetujui pengguna untuk implementasi 26 Oktober 2026. Status kode, aktivasi, dan verifikasi terbaru: [panduan Office Suite](office-suite.md).

Dokumen ini mencakup empat aplikasi Office Tools di Personal Tools. Aturan pengguna dalam percakapan menjadi acuan tertinggi; brief awal menjadi latar belakang. Alur ada di [UX](office-suite-ux.md), kontrak perilaku ada di [logika](office-suite-logic.md). Perubahan aturan harus memperbarui ketiganya.

## 1. Tujuan dan masalah

Menyediakan pencatatan pekerjaan, tindak lanjut, notulensi, pengetahuan, pembuatan dokumen, histori perubahan, dan monitoring layanan untuk individu serta rekan kantor. Pekerjaan tidak perlu direkap ulang, action item dapat ditelusuri, dan template lembaga hanya dibuka oleh pemegang PIN kelompok tersebut.

MVP harus bisa digunakan bertahap. Modul yang belum dirilis tidak tampil sebagai menu yang dapat diklik. Implementasi tidak termasuk dalam permintaan pembuatan PRD ini.

## 2. Keputusan pengguna yang sudah tetap

| ID | Keputusan |
| --- | --- |
| D-01 | Sesuai perubahan pengguna 30 Oktober 2026, `/menu` memiliki satu kartu Office Tools yang mengelompokkan Office Workspace, Smart Template Factory/Documents (termasuk alias `/document`), Deployment & Change Tracker, dan Health Dashboard. Keempat aplikasi dipilih melalui menu di dalam suite. |
| D-02 | Office memiliki tepat empat submenu: Task & Activity Logger, FollowUp Radar, Quick Meeting Notes, dan Personal Knowledge Base. |
| D-03 | Task Logger dan FollowUp adalah satu modul pekerjaan dengan dua tampilan. Task tidak diduplikasi. Rapat dan Knowledge Base merupakan modul terpisah di Office. |
| D-04 | Template Factory, Change Tracker, dan Health Dashboard tetap merupakan aplikasi/domain terpisah dari empat submenu Office Workspace, tetapi dikelompokkan dalam pintu masuk Office Tools. |
| D-05 | Akun bersama berlaku untuk keempat aplikasi. Masuk sekali cukup untuk berpindah aplikasi; hak terhadap data tetap diperiksa. FinTrack mempunyai login dan sesi sendiri. |
| D-06 | Documents memiliki pengecualian: pengguna biasa dapat membuka template menggunakan PIN tanpa akun. Admin menggunakan login akun bersama dan hak admin khusus. |
| D-07 | PIN diberikan kepada tag akses instansi/lembaga/divisi. Satu PIN menampilkan semua dokumen pada tag itu, bukan satu PIN per dokumen atau PIN global katalog. |
| D-08 | Admin mengelola tag dan PIN, menambah/mengganti/menghapus file template, serta mengatur nama, jenis, dan organisasi dokumen. |
| D-09 | Generator Perjalanan Dinas dan Surat Tugas yang sudah ada ikut berada di belakang akses PIN berdasarkan tag. |

Contoh konseptual D-07: Dokumen A dan B bertag Kemen PU, Dokumen C bertag IT. PIN tag Kemen PU membuka A dan B; tidak membuka C. Angka PIN yang dicontohkan dalam percakapan adalah ilustrasi, bukan kredensial untuk disimpan dalam repositori atau seed.

## 3. Fakta proyek yang diperiksa

| Bukti | Kondisi saat penyusunan |
| --- | --- |
| [Katalog Documents](../app/documents/page.tsx) dan [formulir](../app/documents/[code]/page.tsx) | Membaca template melalui klien Supabase anonim dan konfigurasi bawaan. Belum ada gerbang PIN. |
| [Generator](../app/api/generate/route.ts) | Memvalidasi data dan merender DOCX dengan Docxtemplater/PizZip. File dibaca dari `storage/data`; belum memeriksa akses PIN atau admin. |
| [Konfigurasi bawaan](../lib/documentTemplates.ts), [tipe isian](../types/templateSurat.ts) | Mendukung field tunggal, grup, baris berulang, dan tanggal otomatis. Surat Tugas diprioritaskan terhadap kode database yang sama. |
| [Panduan Documents](documents.md), `storage/data/` | Dua file lama: `surat_tugas.docx` dan `perjadin_2026_fixed.docx`. Konfigurasi Perjadin berasal dari database; isinya pada database aktif belum diperiksa. |
| [Callback saat ini](../app/auth/callback/route.ts) | Membuat profil dan cookie PIN FinTrack, lalu memanggil `signOut()` Supabase. Belum menjadi autentikasi umum suite. |
| [Health endpoint](../app/api/health/route.ts) | Respons dasar `ok`, bukan monitoring berkala, riwayat uptime, atau pemeriksaan dependensi. |
| [Menu](../app/menu/page.tsx) | Katalog aplikasi memakai satu kartu Office Tools sebagai pintu suite; tools lain tetap memiliki kartu masing-masing. |

Belum ada pengujian aplikasi baru, wawancara pengguna, audit database aktif, atau verifikasi jaringan kantor. Manfaat produk di dokumen ini adalah sasaran, bukan hasil pengukuran.

## 4. Pilihan penerapan dan rekomendasi

| Pendekatan | Dampak |
| --- | --- |
| Empat aplikasi dalam repo Next.js yang sama dengan layanan akun bersama | Memakai fondasi saat ini; login lintas aplikasi lebih sederhana. Pemisahan akses dan proses worker harus eksplisit. Direkomendasikan. |
| Empat deployment terpisah dengan akun bersama | Dapat mengisolasi operasi TI dan kebutuhan hosting, tetapi menambah urusan cookie, origin, deployment, dan komunikasi antarlayanan. Belum diperlukan oleh brief. |
| Aplikasi terpisah sepenuhnya beserta login masing-masing | Menambah akun dan mengulang login; bertentangan dengan D-05. Tidak dipilih. |

Pilihan repo dan layanan bersama di atas adalah rekomendasi rancangan. Tidak mengizinkan pemindahan data kantor ke hosting publik secara otomatis. Worker monitoring boleh berjalan terpisah dari web bila perlu menjangkau jaringan yang berbeda.

## 5. Aktor dan akses

| Aktor | Kemampuan |
| --- | --- |
| Pengunjung belum membuka PIN | Melihat formulir PIN Documents dan pintu login. Tidak menerima daftar tag, nama template, atau konfigurasi template. |
| Pemegang PIN tag | Melihat template terbit pada satu tag yang sedang terbuka, mengisi, dan mengunduh hasil. Tidak dapat mengelola template atau masuk Office dengan PIN. |
| Pengguna akun bersama | Mengakses aplikasi berbasis akun dan data yang diizinkan oleh keanggotaan workspace. Login saja tidak otomatis membuka koleksi Documents. |
| Anggota workspace | Mengakses konten bersama sesuai peran owner, admin, member, atau viewer. Konten pribadi tetap dibatasi pembuatnya. |
| Admin template | Memakai akun bersama dengan peran admin template yang ditetapkan server; dapat mengelola semua tag dan template pada MVP. |
| Worker | Menjalankan pengingat dan pemeriksaan layanan dengan identitas layanan terbatas. Bukan sesi pengguna. |

Admin workspace tidak otomatis menjadi admin template. Pendaftaran akun biasa tidak dapat memberikan hak admin template. Akun admin pertama ditetapkan melalui prosedur operator yang diaudit, bukan endpoint pendaftaran umum.

## 6. Struktur produk

Rute baru berikut adalah usulan; `/documents`, alias `/document`, dan tautan generator lama dipertahankan dengan pemeriksaan akses baru.

| Menu | Rute | Isi |
| --- | --- | --- |
| Office Workspace | `/office` | Mengarah ke pekerjaan; submenu `/office/tasks`, `/office/followups`, `/office/meetings`, `/office/knowledge`. |
| Smart Template Factory | `/documents` | Gerbang PIN, katalog tag aktif, formulir, hasil DOCX; admin di `/documents/admin`. |
| Deployment & Change Tracker | `/deployments` | Aplikasi, environment, release, perubahan, dan catatan rollback. |
| Health Dashboard | `/monitoring` | Monitor, kondisi layanan, insiden, histori, dan penanda deployment. |
| Login akun bersama | `/tools/login` | Login dan kembali ke tujuan semula. Bukan kartu aplikasi kelima di `/menu`. |

Workspace adalah batas kepemilikan bersama dan dapat dipakai Change Tracker/Monitoring tanpa membuka Office terlebih dahulu. Tag akses Documents adalah batas koleksi tersendiri, tidak otomatis menjadi workspace atau keanggotaan kantor.

## 7. Kebutuhan fungsional

### AUTH: akun bersama

- AUTH-01: Satu sesi akun untuk Office, admin Documents, Change Tracker, dan Health Dashboard.
- AUTH-02: Login dan pendaftaran cukup dengan email/kata sandi tanpa verifikasi email, sesuai perubahan pengguna 28 Oktober 2026. Pendaftaran langsung membuka sesi; hak admin tetap ditetapkan operator. Reset kata sandi dan keluar tetap tersedia; reset memerlukan pengiriman email. Login Google ditunda.
- AUTH-03: Login sukses kembali ke rute internal yang diminta. Pengguna aktif tidak diminta login ulang ketika berpindah aplikasi.
- AUTH-04: Keluar akun mengakhiri akses akun ke empat aplikasi pada sesi perangkat tersebut. Pada perangkat yang sama, akses PIN Documents juga dikunci untuk mencegah kesan bahwa pengguna sudah keluar tetapi koleksi masih terbuka. Tombol khusus kunci Documents hanya mengakhiri akses PIN.
- AUTH-05: Masuk/keluar FinTrack tidak menghapus sesi akun suite atau grant PIN, dan sebaliknya. Reset kata sandi pada identitas Supabase yang sama dapat memiliki dampak tingkat penyedia; batas ini harus dijelaskan, bukan dijanjikan terisolasi tanpa bukti.
- AUTH-06: Workspace pribadi dibuat satu kali; pengguna dapat bergabung ke workspace tim melalui undangan yang diverifikasi.

### WORK: Task & Activity Logger dan FollowUp Radar

- WORK-01: Task mempunyai judul, deskripsi, penanggung jawab, status, prioritas, kategori, tenggat, checklist, dan lingkup pribadi/bersama.
- WORK-02: Aktivitas bertanggal mencatat progres, kendala, hasil, dan bukti file/URL; satu task dapat memiliki banyak aktivitas.
- WORK-03: Satu task dapat memiliki banyak follow-up untuk pihak berbeda. Catat tanggal permintaan, target respons, PIC/pihak luar, status, komunikasi, pengingat, dan hasil.
- WORK-04: FollowUp Radar adalah tampilan data follow-up yang terkait task. Pembaruan task terlihat konsisten pada kedua tampilan.
- WORK-05: Filter tanggal, pemilik/PIC, status, kategori, dan keterlambatan hanya mencakup data yang diizinkan.
- WORK-06: Laporan mingguan/bulanan dibuat dari aktivitas dan riwayat, dapat diekspor DOCX; Excel menyusul pada iterasi berikutnya. Pilihan urutan format ini merupakan usulan MVP.
- WORK-07: Notifikasi dalam aplikasi untuk pengingat dan keterlambatan. Pengiriman email/WhatsApp/push ditunda sampai kanal dipilih.

### MEET: Quick Meeting Notes

- MEET-01: Identitas rapat, waktu, lokasi/media, pimpinan, notulis, peserta, agenda, pembahasan, keputusan, dan action item.
- MEET-02: Rapat dapat disimpan tanpa task; action item dapat dikonversi menjadi task dengan PIC dan tenggat.
- MEET-03: Satu action item hanya membentuk satu task. Perubahan notulensi tidak diam-diam menimpa task yang sudah berjalan.
- MEET-04: Ringkasan dapat disunting manual; notulensi mempunyai draft, final, revisi, serta ekspor DOCX. AI bukan syarat fitur.

### KB: Personal Knowledge Base

- KB-01: Artikel, snippet, kategori, tag pencarian, lampiran, pencarian teks, waktu pembaruan, dan catatan revisi.
- KB-02: Akses pribadi atau workspace; riwayat versi dan pemulihan versi yang menghasilkan revisi baru.
- KB-03: Tautkan artikel ke task, rapat, atau template yang dapat diakses. Tautan tidak memberikan hak akses baru.

### DOC: Smart Template Factory

- DOC-01: Formulir PIN tanpa akun. PIN valid membuka semua template terbit pada satu tag akses aktif.
- DOC-02: Tag akses dibuat admin dengan nama dan kategori organisasi: instansi, lembaga, divisi, atau kelompok lain yang diberi label jelas. PIN berbeda untuk setiap tag.
- DOC-03: Metadata template: nama, jenis dokumen, instansi/lembaga, divisi opsional, deskripsi opsional, dan satu tag akses wajib pada MVP.
- DOC-04: Nama/jenis adalah metadata pencarian; hanya tag akses yang memberikan akses. Pencarian tidak menggabungkan data dari tag lain.
- DOC-05: Admin menambah DOCX, mengatur formulir variabel, menguji hasil, lalu menerbitkan. Unggah file saja tidak berarti seluruh formulir otomatis benar.
- DOC-06: Admin mengganti file dan konfigurasi sebagai satu versi; versi aktif lama tetap dapat digunakan sampai versi pengganti terbit.
- DOC-07: Admin dapat menonaktifkan, memindahkan tag, atau menghapus template. Penghapusan mengeluarkan template dari katalog dan akses baru; pembersihan file mengikuti retensi.
- DOC-08: Admin mengganti/mencabut PIN. Sesi tag lama tidak berlaku untuk permintaan terlindungi berikutnya.
- DOC-09: PIN lama tidak dapat ditampilkan kembali. Admin dapat menetapkan PIN baru. PIN tidak dicatat sebagai teks biasa, log, URL, atau seed.
- DOC-10: Generator Surat Tugas dan Perjadin menjadi template terkelola dengan fitur lama tetap tersedia sesudah PIN. Tidak ada fallback bawaan yang melewati penghapusan atau akses tag.
- DOC-11: Keluaran DOCX diunduh tanpa menyimpan isian atau hasil pengguna secara permanen pada MVP. PDF dan pratinjau halaman Word ditunda.
- DOC-12: Login akun biasa tidak otomatis membuka Documents. Admin template dapat mengelola/menguji template tanpa PIN; pengguna lain tetap memasukkan PIN.

### CHANGE: Deployment & Change Tracker

- CHANGE-01: Daftar layanan/aplikasi dan environment bersama dengan Monitoring.
- CHANGE-02: Catat versi, waktu, pelaksana, status deployment, changelog, konfigurasi tanpa secret, bukti, dan rencana rollback.
- CHANGE-03: Riwayat pelaksanaan rollback terpisah dari status deployment. Pencatatan tidak menjalankan deployment atau rollback nyata.
- CHANGE-04: Filter dan timeline; penanda deployment muncul di monitor layanan dan environment yang sama. Kedekatan waktu tidak dinyatakan sebagai bukti penyebab insiden.

### HEALTH: Health Dashboard

- HEALTH-01: Pemeriksaan HTTP/HTTPS berkala dengan status HTTP yang diharapkan, timeout, waktu respons, waktu pemeriksaan, dan riwayat.
- HEALTH-02: Periksa kedaluwarsa sertifikat HTTPS; tidak menyamakan respons HTTP sukses dengan sertifikat selalu valid.
- HEALTH-03: Kondisi belum diperiksa, sehat, gagal, data kedaluwarsa, dijeda, dan pemeliharaan dibedakan. Insiden terbuka setelah ambang kegagalan; notifikasi pemulihan terjadi sekali.
- HEALTH-04: Uptime dihitung dalam rentang yang jelas, disertai cakupan data. Pemeriksaan yang hilang tidak dianggap sukses.
- HEALTH-05: Worker berjalan ketika browser ditutup. Monitor dinonaktifkan secara aman bila target tidak diizinkan atau konfigurasi tidak lengkap.
- HEALTH-06: Notifikasi insiden/pemulihan dalam aplikasi. Kanal eksternal, metrik agen, log aplikasi, dan endpoint yang membutuhkan secret ditunda.

## 8. Usulan batas MVP yang belum merupakan keputusan pengguna

| ID | Usulan | Alasan dan batas |
| --- | --- | --- |
| P-01 | Satu tag akses per template; satu tag aktif per sesi PIN browser | Menghindari aturan gabungan PIN yang ambigu. Memasukkan PIN baru mengganti koleksi aktif setelah verifikasi berhasil. |
| P-02 | PIN numerik 5–12 digit sebagai string, termasuk nol di depan | Mengakomodasi contoh PIN lima dan enam digit. Panjang minimum bukan ukuran keamanan; pembatasan percobaan tetap wajib. |
| P-03 | Grant PIN kedaluwarsa mutlak setelah 8 jam tanpa perpanjangan otomatis | Mengurangi sesi tertinggal di komputer bersama. |
| P-04 | Login email/kata sandi dan peran owner/admin/member/viewer per workspace | Memakai layanan identitas yang ada; admin template merupakan peran terpisah. |
| P-05 | Satu PIC akun utama per task; pihak luar dapat ditulis sebagai kontak follow-up | Menjaga pertanggungjawaban dan formulir sederhana. |
| P-06 | DOCX maksimal 10 MiB, ukuran ZIP setelah ekstraksi dibatasi, tanpa macro | Batas awal perlu dicocokkan dengan hosting dan file nyata sebelum rilis. |
| P-07 | Perubahan pengelompokan mengakhiri akses lama pada permintaan berikutnya; byte yang sudah diunduh tidak dapat ditarik kembali | Menetapkan batas pencabutan yang dapat dibuktikan. |
| P-08 | Tag dapat diarsipkan; dihapus hanya bila tidak memiliki template nonhapus | Menghindari dokumen kehilangan kelompok tanpa disengaja. |
| P-09 | Monitoring publik lebih dahulu; interval 5 menit, timeout 10 detik, 3 kegagalan membuka insiden, 2 sukses memulihkan | Usulan konfigurasi awal; worker internal dan penyesuaian kapasitas dibahas sebelum aktivasi. |
| P-10 | Cadangan/retensi dan lokasi hosting ditetapkan sebelum data kantor nyata masuk | Tidak mengasumsikan izin organisasi atau fasilitas backup penyedia sudah aktif. |

## 9. Kebutuhan nonfungsional

- Semua antarmuka pengguna berbahasa Indonesia; waktu ditampilkan dalam zona workspace, default Asia/Jakarta. Waktu kejadian tersimpan sebagai timestamp, tenggat berupa tanggal diperlakukan sebagai tanggal.
- Semua API memeriksa identitas/izin di server. Cache publik, service worker, atau bundle klien tidak menyimpan koleksi privat dan PIN.
- File berada di penyimpanan privat. Isi laporan, catatan kantor, kredensial, dan hasil formulir tidak masuk log diagnostik.
- Formulir mendukung label, fokus keyboard, pesan kesalahan terkait field, layar kecil, dan umpan balik proses. Persyaratan ini belum merupakan hasil audit aksesibilitas.
- API memiliki paginasi, batas unggahan/ekspor, timeout, pembatasan percobaan PIN, dan konflik perubahan yang dapat dipulihkan.
- Simpan audit perubahan admin dan operasi akun penting. Grant PIN menunjukkan kelompok akses, bukan identitas pegawai; jangan mengklaim audit individu dari PIN bersama.
- Login/logout FinTrack serta seluruh fitur lama harus diuji sebagai regresi sebelum cutover.

## 10. Tahap pengembangan

1. Fondasi akun suite, workspace, peran, isolasi FinTrack, dan penyimpanan privat.
2. Documents: tag/PIN, admin, versi template, migrasi dua generator, dan proteksi seluruh jalur lama.
3. Office: Task dan FollowUp, laporan dasar, kemudian Rapat dan Knowledge Base.
4. Change Tracker dengan inventaris layanan/environment bersama.
5. Monitoring beserta worker, penyimpanan hasil, notifikasi dalam aplikasi, dan pengujian jangkauan jaringan.

Urutan Documents dinaikkan karena kebutuhan admin/PIN telah diperinci pengguna. Setiap tahap memiliki gerbang penerimaan sendiri; tidak perlu menunggu seluruh platform untuk dipakai. Modul tak siap tidak dipromosikan sebagai fitur aktif.

## 11. Penerimaan produk

| ID | Skenario penerimaan |
| --- | --- |
| AC-01 | Satu kartu Office Tools di `/menu` membuka suite dengan empat aplikasi sesuai D-01 dan empat submenu Office sesuai D-02. Aplikasi pendamping memiliki rute/domain masing-masing, dengan Documents tetap memiliki akses PIN dan alias `/document`. |
| AC-02 | Login suite sekali membuka rute akun lintas empat aplikasi; keluar perangkat mengakhiri sesi suite dan mengunci grant PIN lokal. FinTrack tetap aktif dan sebaliknya. |
| AC-03 | PIN Kemen PU hanya memperlihatkan A/B; PIN IT hanya C. Belum membuka PIN tidak dapat membaca nama, field, file, atau menghasilkan dokumen lewat URL/API langsung. |
| AC-04 | Mengganti/mencabut PIN atau menonaktifkan tag menolak grant lama pada permintaan terlindungi berikutnya. PIN lain yang gagal tidak mengganti koleksi aktif. |
| AC-05 | Akun biasa tidak dapat membuat tag, mengganti file, mengubah role sendiri, atau mengakses admin dengan request langsung. |
| AC-06 | Admin menambah, menguji, menerbitkan, mengganti, mengelompokkan ulang, dan menghapus template; operasi gagal tidak merusak versi aktif. |
| AC-07 | Surat Tugas 1/20 pegawai, pilihan transportasi, dan rentang tanggal tetap bekerja; aturan Perjadin tetap bekerja dengan konfigurasi database yang sudah diverifikasi. |
| AC-08 | Satu task dan beberapa follow-up terlihat konsisten; laporan periode mengikuti histori aktivitas, bukan hanya status terkini. |
| AC-09 | Konversi ulang action item tidak membuat task kedua; revisi rapat tidak menimpa task tanpa tindakan eksplisit. |
| AC-10 | Konten pribadi tidak terlihat oleh anggota/admin workspace lain; pencarian KB mematuhi izin yang sama. |
| AC-11 | Change Tracker hanya mencatat deployment/rollback; timeline monitor menampilkan penanda dari layanan/environment yang cocok. |
| AC-12 | Worker memeriksa saat browser ditutup; hasil terlambat/hilang tidak ditampilkan sebagai sehat; insiden/pemulihan tidak menghasilkan notifikasi ganda. |
| AC-13 | Gangguan database/storage/auth mempertahankan input yang aman, menawarkan retry, dan tidak memberikan akses tanpa verifikasi. |

Daftar ini adalah rencana penerimaan, bukan hasil tes yang sudah lulus. Rincian skenario ada di UX dan logika.

## 12. Di luar MVP dan keputusan peluncuran

Di luar MVP: AI, transkripsi rapat, PDF server, editor visual DOCX bebas, eksekusi command/deployment/rollback, agen server, WhatsApp/push, serta pencatatan permanen dokumen hasil pengguna.

Sebelum peluncuran perlu keputusan operator tentang identitas admin awal, kebijakan akun kantor, hosting/data residency, backup/retensi termasuk versi file, kuota, dan jangkauan monitoring. Tidak diperlukan untuk menulis PRD ini, tetapi wajib diselesaikan sebelum pemakaian data nyata. Usulan P-01 sampai P-10 dapat direvisi saat PRD ditinjau.

## 13. Sumber teknis dan batas bukti

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): model identitas dan batas `service_role`.
- [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals): penyimpanan privat.
- [Supabase sign-out](https://supabase.com/docs/guides/auth/signout): scope keluar harus ditentukan agar sesi lain tidak ikut dihentikan.
- [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): batas pemeriksa URL monitoring.

Sumber dan kode lokal diperiksa 25 Oktober 2026. Rancangan ini tidak menyatakan kontrol tersebut telah diimplementasikan atau diverifikasi pada production.
