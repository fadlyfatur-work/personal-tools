# Logika dan kontrak: Office Workspace dan tiga aplikasi pendamping

Tanggal: 25 Oktober 2026. Status: kontrak implementasi yang disetujui. API dan berkas migration telah ditambahkan secara lokal; penerapan database dan hasil verifikasi tercatat pada [panduan Office Suite](office-suite.md).

[PRD](office-suite-prd.md) memiliki kebutuhan dan keputusan produk. [UX](office-suite-ux.md) memiliki urutan dan pemulihan pengguna. Dokumen ini memiliki invariant, pemilik state, kontrak API yang diusulkan, efek samping, dan rencana verifikasi. Nama entitas/API adalah usulan, bukan klaim isi database saat ini.

## 1. Batas sistem dan tanggung jawab

- Next.js tetap menangani antarmuka serta route handler. Supabase menangani identitas akun, Postgres, dan file privat; tidak menambah ORM.
- Layanan akun/workspace suite dibagikan oleh empat aplikasi. Data Office memakai domain sendiri, bukan tabel pengguna atau guard FinTrack.
- Navigasi 30 Oktober 2026: `/menu` mengelompokkan empat aplikasi pada satu kartu Office Tools menuju `/office`. Sidebar suite membuka rute asli masing-masing fitur; `/document` tetap alias `/documents`. Pengelompokan tampilan ini tidak mengubah domain, syarat sesi atau grant PIN.
- Module pekerjaan memiliki task, activity, dan follow-up. UI Task dan Radar mengonsumsi domain yang sama.
- Domain template memiliki tag akses dan versi template. Grant PIN tidak menjadi akun atau anggota workspace.
- Change Tracker dan Monitoring memakai identitas layanan/environment yang sama; masing-masing mempunyai state dan API sendiri.
- Worker mempunyai pekerjaan pengingat dan pemeriksaan; sesi request browser tidak menjadi pemilik jadwal.

Validasi Zod/shared type, keputusan akses, pembacaan/pembaruan data, dan respons transport dipisahkan sesuai pola repo. Halaman dan API tidak membuat rumus izin sendiri-sendiri.

## 2. Input terpercaya dan tidak terpercaya

| Input | Perlakuan |
| --- | --- |
| Session Supabase | Verifikasi server melalui mekanisme penyedia; jangan percaya objek user dari state klien. |
| Cookie grant PIN | Verifikasi tanda tangan, tujuan, expiry, dan versi akses tag di database. |
| Role, owner, workspace, tag dari body atau URL | Tidak terpercaya; role/actor berasal dari sesi server dan hubungan diperiksa ulang. |
| File, nama file, placeholder, isian formulir, HTML/Markdown | Tidak terpercaya; validasi format, ukuran, batas ekspansi, field, dan sanitasi output sebelum rendering. |
| URL monitor, redirect, DNS, status/isi upstream | Tidak terpercaya; worker memiliki kebijakan tujuan dan batas kerja sendiri. |
| Konfigurasi deployment dari secret manager | Dapat dipakai sebagai konfigurasi server; tidak dikirim ke klien atau log. |
| State worker terlambat atau duplikat | Bukan urutan kebenaran; gunakan identitas job/slot dan waktu hasil yang jelas. |

## 3. Invariant

| ID | Aturan yang wajib ditegakkan |
| --- | --- |
| INV-01 | Sesi akun suite, grant PIN Documents, dan sesi FinTrack adalah tiga konteks berbeda. PIN tidak memberi hak admin/Office. |
| INV-02 | Akun tanpa keanggotaan/role tidak mendapat akses hanya karena sudah login. Admin template berbeda dari admin workspace. |
| INV-03 | Setiap template nonhapus memiliki tepat satu tag akses pada MVP. Template terbit tanpa tag valid tidak dapat ditampilkan. |
| INV-04 | PIN hanya dimiliki tag akses. Nama/jenis/tag pencarian artikel bukan kredensial atau aturan izin. |
| INV-05 | PIN unik antar tag yang masih dipertahankan, termasuk tag diarsipkan. Jangan menggunakan kembali PIN lama pada tag lain selama riwayat digest masih disimpan. |
| INV-06 | Setiap akses katalog/detail/render memeriksa tag aktif, versi PIN, status template, dan tag template saat permintaan. Tidak ada akses anonim langsung ke tabel/file privat. |
| INV-07 | Mengganti/mencabut PIN atau menonaktifkan tag menaikkan versi akses. Grant versi lama gagal pada permintaan berikutnya. |
| INV-08 | File dan konfigurasi form yang dipakai render berasal dari versi template yang sama. Draft tidak mengganti versi aktif sebelum publikasi berhasil. |
| INV-09 | Pengguna biasa hanya mengisi/mengunduh; CRUD template dan PIN hanya oleh admin template yang aktif. |
| INV-10 | Satu action item rapat dapat merujuk maksimal satu task; retry konversi tidak membuat task baru. |
| INV-11 | Follow-up mengacu pada task dalam workspace yang sama dan tidak boleh memperluas visibility task. |
| INV-12 | Laporan periode menggunakan aktivitas/riwayat yang dapat dibaca pemohon; status saat ini tidak diperlakukan sebagai status historis. |
| INV-13 | Pencatatan deployment/rollback tidak menjalankan perubahan pada server tujuan. |
| INV-14 | Hasil monitor duplikat/tidak berurutan tidak boleh menggandakan insiden atau mengembalikan status terbaru ke masa lalu. |
| INV-15 | Ketiadaan hasil monitor tidak dianggap hasil sukses. Private content tidak muncul dalam search/count/preview yang melampaui izin. |

## 4. Entitas konseptual

Bagian ini bukan DDL final. Semua foreign key, constraint, dan indeks harus dirancang serta diverifikasi sebelum migration dibuat.

| Domain | Entitas dan hubungan utama |
| --- | --- |
| Akun bersama | `tools_profiles` → identitas Supabase; `tools_workspaces`; `tools_workspace_members`; undangan workspace yang kedaluwarsa dan sekali konsumsi. |
| Akses admin template | Assignment role admin template oleh operator; tidak disalin dari metadata user yang dapat disunting sendiri. |
| Pekerjaan | `office_tasks`; checklist; `office_activities`; `office_task_events`; `office_followups`; event komunikasi; reminder/notification. |
| Rapat | `office_meetings`; revisi/agenda/keputusan; `office_action_items` dengan relasi unik ke task. |
| Pengetahuan | `office_articles`; revisi; kategori/tag pencarian; lampiran privat; tautan referensi. |
| Dokumen | `documents_access_tags`; PIN verifier/digest dan histori digest terpisah; `documents_templates`; `documents_template_versions`; audit admin. |
| Operasi TI | `tools_services`; `tools_environments`; `change_deployments`; `change_rollbacks`; `health_monitors`; hasil per slot; insiden; notifikasi. |

Kolom lintas domain: ID server, created/updated timestamps, actor bila ada, workspace/owner untuk data akun, revision number untuk konflik, status arsip/hapus yang jelas. Tag PIN tidak dimasukkan dalam hierarki workspace hanya karena namanya serupa instansi.

Dokumen: template menyimpan code stabil, nama, jenis, metadata organisasi, access_tag_id, active_version_id, status dan revision. Versi menyimpan file key privat, checksum, konfigurasi `TemplateConfig`, hasil validasi, pembuat, dan waktu. Access tag menyimpan nama normalisasi, tipe organisasi, status, access_version, serta referensi verifier PIN; respons biasa tidak pernah menyertakan verifier atau digest.

## 5. Identitas bersama dan isolasi FinTrack

### Akun suite

Gunakan Supabase Auth untuk metode email/kata sandi yang diusulkan P-04. Identitas akun yang sama dipakai lintas empat aplikasi; workspace dan role diperiksa setiap operasi. Callback/reset/refresh suite mempunyai rute dan namespace penyimpanan sesi sendiri, terpisah dari alur sementara OAuth FinTrack.

Perubahan 28 Oktober 2026: daftar/login hanya meminta email dan kata sandi. Server membuat akun melalui `auth.admin.createUser` dengan `email_confirm: true`, tanpa mengirim verifikasi atau menerima role dari body, lalu `signInWithPassword` melalui klien cookie suite. Respons sukses memakai `authenticated: true`, bukan klaim verifikasi kepemilikan email. Akun duplikat tidak ditimpa/dikonfirmasi otomatis; kegagalan sesi setelah pembuatan akun meminta pengguna mencoba login. Tidak mengubah setelan Auth global atau menghapus akun yang sudah berhasil dibuat hanya karena sesi gagal. Reset kata sandi tetap memakai email.

Rute usulan: `/tools/login`, `/tools/register`, `/tools/reset-password`, `/tools/auth/callback`. Return URL hanya path internal yang diizinkan; menolak URL absolut, protocol-relative, encoding berbahaya, dan tujuan FinTrack yang tidak sesuai konteks suite. Pendaftaran tidak menerima role/admin flag dari klien.

Kebijakan RLS berbasis identitas Supabase dan keanggotaan digunakan untuk data akun yang diakses langsung melalui klien. Operasi admin/service-role tetap wajib memeriksa hak di server karena service role melewati RLS. Konten pribadi tidak terbuka bagi admin workspace secara implisit.

### FinTrack

Callback saat ini membuat sesi PIN FinTrack lalu `supabase.auth.signOut()` tanpa scope. Pustaka terpasang mendokumentasikan default global. Membuat nama cookie berbeda saja tidak cukup bila sign-out global masih mencabut sesi penyedia yang lain.

Rencana kompatibilitas: isolasi klien/cookie untuk pertukaran OAuth FinTrack dari klien suite, tentukan sign-out sesi sementara secara lokal, dan uji bahwa refresh token suite tetap aktif. FinTrack tetap mempunyai cookie/guard/data sendiri. Jangan mengubah semantik keuangan atau mewajibkan migrasi akun FinTrack untuk memakai suite.

Jaminan produk adalah isolasi operasi masuk/keluar biasa. Bila identitas yang sama memakai fitur reset password/ban pengguna pada penyedia yang sama, efek pencabutan tingkat penyedia harus diuji dan dijelaskan; bila organisasi membutuhkan isolasi akun penuh, gunakan proyek/penyedia terpisah sebagai keputusan berikutnya.

### Logout

- Logout suite pada perangkat: keluar sesi suite lokal dan hapus grant PIN Documents lokal. Tidak memanggil logout global FinTrack.
- Kunci Documents: hapus grant PIN saja; akun suite tetap aktif.
- Logout admin sebagai akun: mengikuti logout suite, bukan hanya menyembunyikan menu admin.
- Logout FinTrack: hanya cookie PIN dan konteks auth FinTrack sendiri.
- Pencabutan role admin berlaku pada request admin berikutnya; jangan hanya membaca role dari token yang bisa lama.

## 6. Kontrak PIN per tag

### Penyimpanan dan pencarian

PIN adalah string digit sesuai P-02; tidak dikonversi menjadi number. Pangkas whitespace di tepi, tetapi jangan menghapus spasi di tengah, mengubah digit, atau menerima bentuk yang ambigu. Batas diperiksa sebelum pekerjaan hash.

Karena pengguna hanya memasukkan PIN tanpa nama tag, server memerlukan lookup yang terindeks dan deteksi PIN duplikat. Usulan: indeks digest HMAC berkey server terpisah untuk lookup/keunikan, ditambah verifier salted memakai pustaka hash password yang dipelihara. Gunakan primitive standar; jangan membuat algoritme enkripsi, token, atau protokol kripto sendiri. Key digest tidak memakai secret FinTrack dan tidak diberi prefix publik. PIN pendek tetap perlu rate limiting meskipun hashed.

Admin tidak membaca PIN lama. Penggantian menerima PIN baru; digest lama dicatat tanpa plaintext untuk mencegah PIN pernah dicabut diberikan ke kelompok lain. Set PIN sama yang masih aktif pada tag yang sama diperlakukan idempotent, bukan rotasi; admin dapat memakai tindakan eksplisit cabut sesi untuk menaikkan access_version. Key rotation memerlukan prosedur rekey/reset tag terkontrol, bukan penggantian secret tanpa migrasi.

### Verifikasi dan grant

1. Validasi ukuran dan format request, origin, serta batas percobaan bersama antar instance.
2. Lookup menggunakan digest server; verifikasi PIN dan tag aktif. Hasil tidak cocok/nonaktif memakai respons penolakan umum yang sama, dengan pekerjaan pembanding dummy untuk mengurangi perbedaan mencolok.
3. Terbitkan cookie grant baru menggunakan JWT terverifikasi melalui `jose`, algoritme yang ditentukan konfigurasi, issuer/audience khusus Documents, tag_id, access_version, issued_at, expiry, dan identifier grant. Secret terpisah dari sesi FinTrack dan key lookup PIN.
4. Cookie HttpOnly, Secure pada HTTPS production, SameSite sesuai alur same-origin, lifetime absolut P-03. Tidak menyimpan PIN dalam cookie atau localStorage.
5. Grant baru mengganti tag aktif hanya setelah verifikasi sukses. PIN salah tidak menghapus grant lama yang masih valid. Mutasi grant dalam tab yang berbeda berlaku pada browser yang berbagi cookie.
6. Semua API protected memverifikasi token dan tag di database. Signature sah saja tidak cukup setelah PIN dicabut.

Nama cookie usulan `documents_tag_access`; bukan `fintrack_pin_session`. Signer menggunakan format/library standar. Penerbitan cookie bukan pemberian identitas pegawai atau membership tim.

### Penggantian dan pencabutan

Update verifier/digest, status, access_version dan audit terkait dimasukkan satu transaksi database. Gunakan revision untuk menolak perubahan admin yang telah usang. Update tanpa perubahan role/otorisasi tidak dipercaya dari body.

Revokasi efektif untuk permintaan yang pemeriksaan otorisasinya berlangsung setelah transaksi perubahan commit. Request render yang sudah diotorisasi dan berjalan dapat selesai; file yang sudah diterima pengguna tidak dapat ditarik. Hindari URL download file sumber yang tetap bisa dibuka sesudah revokasi: sumber template hanya diambil server, hasil di-stream dengan cache privat/no-store.

Perubahan tag sebuah template diperiksa dari data template terkini; grant tag lama tidak dapat memakai ID/kode tersebut lagi. PIN kelompok tujuan tidak diumumkan. Tag arsip tidak menerima grant baru dan membatalkan grant lama.

### Pembatasan awal yang diusulkan

| Operasi | Batas awal | Penyimpanan dan kegagalan |
| --- | --- | --- |
| Verifikasi PIN | 10 percobaan/15 menit per browser/session anonim, 100/15 menit per sumber jaringan terpercaya, 30/15 menit per digest PIN; 4 hash serentak per instance sebagai batas kerja lokal | Counter keamanan dibagikan melalui Postgres/gateway. Browser cookie dapat diganti sehingga bukan batas tunggal. Counter gagal: 503, bukan akses terbuka. |
| Render DOCX | 20/menit per grant/account dan 100/menit per tag; satu render aktif per grant | Batas shared untuk kuota; limiter lokal lama tidak cukup. Retry sesudah timeout tidak menyimpan hasil baru permanen. |
| Upload admin | Maksimal 10 MiB/file, 10 upload/menit/admin; 2 validasi arsip serentak per worker | Ukuran terdekompresi, jumlah entry, waktu dan memori diperiksa sebelum render. |

Batas ini adalah usulan yang harus ditinjau terhadap jaringan NAT kantor dan kapasitas hosting, bukan angka hasil load test. Rate rejection: 429 dengan `Retry-After`. Kegagalan counter: 503 dengan pesan layanan bermasalah. Jangan mengunci seluruh tag hanya karena penyerang mencoba PIN; tidak ada IP yang dianggap identitas pegawai. Sumber proxy hanya dipercaya bila deployment membuang header spoof. Tidak ada bypass untuk request publik. Telemetri menyimpan operasi, penolakan dan korelasi request, bukan PIN/digest/token mentah.

## 7. Hak akses

| Operasi | Pengunjung | Grant tag | Akun biasa | Admin template | Role workspace |
| --- | --- | --- | --- | --- | --- |
| Formulir PIN | Ya | Ya | Ya | Ya | Tidak relevan |
| Katalog/detail/render Documents | Tidak | Tag yang cocok dan template terbit | Tetap perlu grant tag | Semua template untuk kelola/uji | Tidak relevan |
| Mutasi tag/PIN/template | Tidak | Tidak | Tidak | Ya, role aktif dari server | Tidak relevan |
| Baca konten bersama workspace | Tidak | Tidak | Hanya jika anggota | Tidak otomatis | Viewer ke atas |
| Buat/ubah konten workspace | Tidak | Tidak | Hanya jika anggota berhak | Tidak otomatis | Member milik sendiri; admin/owner konten bersama |
| Konten pribadi | Tidak | Tidak | Pemilik yang masih berhak pada workspace | Tidak otomatis | Admin/owner tidak otomatis bisa membaca |
| Anggota/invite/konfigurasi workspace | Tidak | Tidak | Tidak otomatis | Tidak otomatis | Admin/owner; transfer owner hanya owner |
| Hapus owner terakhir | Tidak | Tidak | Tidak | Tidak | Ditolak sampai owner pengganti ada |

PIC/assignee bukan otomatis editor task pribadi orang lain. Konten pribadi yang perlu ditugaskan ke orang lain harus diubah menjadi konten bersama melalui tindakan pembuat yang eksplisit. Saat anggota dikeluarkan, akses workspace berhenti; kebijakan pemindahan kepemilikan konten pribadi harus diselesaikan pemilik/organisasi sebelum penghapusan akun, bukan melalui kebocoran admin otomatis.

## 8. State dan transisi

| Objek | State dan aturan |
| --- | --- |
| Tag akses | Aktif/diarsipkan; pencabutan PIN dapat membuat aktif tetapi tidak menerima grant sampai PIN baru ditetapkan. Hapus hanya jika seluruh template telah dihapus/dipindah; histori tidak hilang selama retensi. |
| Template | Draft → terbit → nonaktif → terbit; dari state nonhapus dapat menjadi dihapus secara logis. Terbit perlu tag aktif, file/config valid, dan uji yang lulus. |
| Versi template | Draft → tervalidasi → aktif; versi aktif lama menjadi riwayat ketika versi baru dipublikasikan. Ubah file/config membatalkan validasi sebelumnya. |
| Task | Belum mulai → berjalan/menunggu → selesai; dapat dibatalkan. Membuka kembali selesai/batal adalah tindakan eksplisit tercatat. |
| Follow-up | Menunggu → perlu tindak lanjut → selesai/dibatalkan. Overdue adalah turunan target respons dan waktu, bukan status permanen yang diperbarui scheduler. |
| Rapat | Draft → final; revisi final membuat draft revisi baru, lalu final baru. Task terhubung tidak disalin pada revisi. |
| Artikel | Draft → terbit → arsip; sunting dan restore membuat revisi baru. Riwayat tetap mengikuti izin artikel saat ini. |
| Deployment | Direncanakan → berlangsung → berhasil/gagal/dibatalkan. Catatan historis boleh langsung memakai status terminal dengan waktu/pelaksana yang wajib. |
| Rollback | Dicatat sebagai event direncanakan/berlangsung/berhasil/gagal, terkait deployment. Tidak mengubah versi deployment historis secara destruktif. |
| Monitor | Aktif/dijeda/pemeliharaan adalah konfigurasi; belum diperiksa/sehat/gagal/kedaluwarsa adalah hasil turunan, bukan satu enum yang saling menimpa. |
| Insiden | Terbuka → pulih; pengakuan operator dan catatan tidak mengubah bukti hasil pemeriksaan. |

Task selesai/batal ditolak bila follow-up nonterminal masih terbuka. Pengguna terlebih dahulu menyelesaikan/membatalkan follow-up; sistem tidak menebak hasil komunikasinya. Subtask/checklist belum selesai memerlukan konfirmasi eksplisit sebelum task selesai dan keputusan itu diaudit.

## 9. Kontrak API yang diusulkan

Kode endpoint final boleh disesuaikan implementer selama kontrak akses dan kompatibilitas dipertahankan. Request/response memakai schema eksplisit, pagination berbatas, dan mengabaikan input role/actor yang tidak diizinkan dengan penolakan validasi.

| Permukaan | Caller dan operasi | Kontrak |
| --- | --- | --- |
| `/api/tools/auth/*` | Akun: daftar/login/reset/logout | Supabase Auth, origin protection, rate control, role server-owned, tujuan kembali tervalidasi. |
| `/api/tools/workspaces/*` | Akun dan role workspace | Bootstrap pribadi idempotent, undangan sekali konsumsi, peran terotorisasi. |
| `POST /api/documents/access` | Publik, body PIN | Sukses set grant, respons hanya tag yang terbuka; tidak mengembalikan PIN/token di body. |
| `DELETE /api/documents/access` | Browser | Kunci grant lokal; dapat diulang. |
| `GET /api/documents/templates` | Grant/admin | Filter/pagination hanya lingkup sah; tidak membawa file key, PIN verifier, atau draft kepada pemegang PIN. |
| `GET /api/documents/templates/[code]` | Grant/admin | Form config dan versi sah; kode tak berhak/hilang/nonaktif memakai 404 umum. |
| `POST /api/generate` | Grant/admin, endpoint lama dipertahankan | Input lama code/single/groups dipertahankan, ditambah versi yang diwajibkan klien baru; auth dulu, template current + version check, DOCX no-store. |
| `/api/documents/admin/tags/*` | Admin template | CRUD metadata, set/reset/revoke PIN, revision, keunikan, dan audit. |
| `/api/documents/admin/templates/*` | Admin template | Draft upload/config, test render, publish, replace, retag, nonaktif/hapus/restore. Bukan path file dari body. |
| `/api/office/tasks/*`, `/activities/*`, `/followups/*` | Akun + izin objek | Parent task/workspace scoped; event perubahan dan reminder terkait. |
| `/api/office/meetings/*` dan konversi action item | Akun + izin rapat/task | Validasi workspace/visibility; retry mengembalikan task yang sama. |
| `/api/office/knowledge/*` | Akun + izin artikel | Search dan revision scoped; HTML/Markdown tidak dieksekusi sebagai script. |
| `/api/office/reports/*` | Akun + izin sumber | Batas periode/data, snapshot isi laporan, ekspor tanpa memperluas izin. Tidak memerlukan PIN Factory. |
| `/api/deployments/*` | Akun + workspace/layanan | Catatan perubahan dan rollback manual; tidak menerima command/secret untuk dijalankan. |
| `/api/monitoring/*` | Akun + workspace/layanan | Konfigurasi target dan pembacaan hasil; target melewati kebijakan worker. |
| Endpoint internal worker | Identitas layanan yang diautentikasi | Bukan trigger publik; claim job/slot, batas durasi dan request unik, output tervalidasi. |

Error API: `{ error: pesanAman, code: kodeStabil, request_id, field_errors? }`. Gunakan 400 input invalid, 401 konteks akses hilang/kedaluwarsa, 403 fungsi terlarang, 404 objek tidak ada/tidak berhak, 409 revisi/konfigurasi konflik, 413 terlalu besar, 429 limit, 503 dependensi tidak tersedia. PIN salah: 401 dengan pesan umum. Login gagal menampilkan pesan kredensial umum tanpa membocorkan profil lain. Akun lama yang belum dikonfirmasi menjadi tanggung jawab pemeriksaan operator, bukan dikonfirmasi berdasarkan email yang dikirim ke endpoint publik.

Efek samping berbasis cookie memeriksa origin/CSRF sesuai arsitektur. Katalog/detail/render dan data akun memakai `Cache-Control: private, no-store`; tidak masuk cache publik atau service worker. Tidak memuat konfigurasi template terlindungi sebagai import klien.

## 10. Upload, publikasi dan konkurensi template

Storage dan Postgres tidak dianggap satu transaksi. Alur yang diusulkan:

1. Server membuat identitas operasi/draft idempotent bagi admin yang berhak, lalu menerima upload ke file key privat yang dihasilkan server.
2. Periksa ZIP/DOCX, ukuran compressed/decompressed, jumlah entry, tipe, macro/external relationship berbahaya, dan batas waktu parsing. File hasil tidak dimuat melalui path/URL arbitrer dari klien.
3. Parse/compile template tanpa mengeksekusi JavaScript atau expression bebas. Cocokkan placeholder dengan `TemplateConfig`, group loop, opsi dan batas baris. Perubahan file/config menghasilkan fingerprint validasi baru.
4. Admin menjalankan uji isi serta memeriksa output Word. Validasi struktur bukan bukti tata letak Word selalu benar.
5. Publikasi memakai transaksi database untuk memastikan revision parent cocok, draft tervalidasi, tag aktif, file/config berpasangan, pointer versi aktif dan audit berubah bersama.
6. Upload/validasi/publish gagal: versi aktif lama tetap sah. Draft/orphan dibersihkan job terjadwal setelah masa aman, tidak menghapus file yang direferensikan versi aktif.
7. Timeout publish: klien memeriksa status operasi/draft; retry menggunakan identitas operasi yang sama. Dua admin dengan revision lama mendapat 409.
8. Hapus logis menghentikan katalog/render baru dan dicatat. Purge fisik hanya setelah retensi disetujui dan tidak ada referensi versi yang perlu dipertahankan.

Render pengguna mengirim expected_version. Versi telah berubah: 409 `TEMPLATE_UPDATED`, minta review ulang. Klien lama tanpa expected_version ditolak dengan petunjuk muat ulang setelah cutover, bukan merender data usang diam-diam. Uji admin dapat menyasar draft tetapi tetap membutuhkan role admin dan tidak mengubah versi aktif.

## 11. Pekerjaan, rapat, laporan dan KB

Task dan follow-up memiliki ID/parent yang tegas. Activity mencatat waktu kerja yang dimaksud pengguna, penulis, waktu pencatatan, hasil/kendala dan bukti. Event status mencatat perubahan agar laporan historis tidak direkonstruksi dari state kini saja. Pengeditan aktivitas tercatat sebagai koreksi, bukan pemalsuan riwayat diam-diam.

Tenggat task dan target respons follow-up terpisah. Tanggal tanpa jam memakai akhir hari workspace; timestamp menyimpan waktu absolut dan ditampilkan sesuai zona. Overdue hanya berlaku untuk item nonterminal dengan target yang sudah lewat. Reminder memiliki kunci unik objek + jenis + jadwal; update jadwal membatalkan job lama. Hak penerima diperiksa lagi saat worker mengirim notifikasi.

Konversi action item memverifikasi rapat, workspace, PIC, dan visibility. Dalam transaksi DB, buat task dan hubungan dengan constraint unik action_item_id; request ulang membaca hubungan yang ada. Revisi rapat mempertahankan ID action item yang sama bila masih merujuk pekerjaan yang sama; item baru mempunyai ID baru. Sinkronisasi perubahan task merupakan tindakan eksplisit dengan pemeriksaan revision.

Laporan memilih periode dan aktivitas yang terlihat, mencatat batas waktu snapshot untuk konsistensi, lalu merender. Penggunaan helper DOCX yang sama tidak mengizinkan API laporan melewati tag Factory: template laporan sistem adalah artefak ekspor Office tersendiri; template Factory hanya bisa dipakai setelah grant/admin yang sesuai diverifikasi.

KB memeriksa visibility pada query daftar, full-text, cuplikan, riwayat dan lampiran. Revisi tidak memberi akses terhadap data lama setelah izin dicabut. Restore menghasilkan revisi baru dan audit. Tautan lintas modul dicek pada kedua sisi; label/judul objek privat tidak dibocorkan ketika tujuan tidak lagi dapat dibaca.

## 12. Change Tracker dan Monitoring

Layanan dan environment menjadi pasangan identitas bersama. Deployment marker pada monitoring dibaca lewat relasi pasangan itu, bukan pencocokan nama teks. Catatan rollback merujuk deployment asal dan menyimpan target versi/rencana/hasil; tidak menjalankan command atau mengganti fakta release awal.

Monitor menyimpan target terverifikasi, interval, timeout, expected HTTP status, active flag, konfigurasi failure/recovery dan revision. Worker mengambil slot terjadwal dengan lease berbatas; identitas unik monitor + scheduled_at mencegah hasil/notifikasi ganda. Jika lease habis, job dapat diambil ulang; hasil pertama yang diterima menjadi hasil slot dan duplikat diabaikan.

Hasil terlambat disimpan dengan waktu jadwal dan waktu pemeriksaan. Status terkini serta rangkaian ambang insiden hanya diproses menurut urutan slot menggunakan watermark; hasil yang sudah melewati watermark tidak membalik status/notifikasi. Slot yang tetap hilang setelah grace menjadi unknown, memutus rangkaian berturut-turut, dan bukan sukses/gagal target. Uptime dihitung berbobot durasi slot yang diketahui, maintenance dikecualikan secara eksplisit, dan persentase cakupan/unknown selalu ditampilkan. Angka merupakan estimasi berbasis sampling, bukan uptime pasti sepanjang interval.

Default P-09: stale bila belum ada hasil selama dua interval ditambah timeout. Maintenance/jeda ditampilkan terpisah dan tidak menimbulkan notifikasi outage baru. Insiden yang sudah terbuka tetap memiliki riwayat; operator menjelaskan maintenance yang dimulai ketika insiden masih berjalan.

SSRF: target publik hanya HTTP/HTTPS dan port yang diizinkan; blok loopback, link-local, metadata, private ranges dan bentuk IP alternatif. Validasi DNS saat koneksi, cegah DNS rebinding, dan nonaktifkan atau validasi ulang setiap redirect. Endpoint internal baru dapat diaktifkan pada worker jaringan kantor dengan allowlist eksplisit, bukan dengan menonaktifkan filter untuk seluruh aplikasi. Batasi jumlah target, koneksi, response body, total waktu, dan concurrent jobs. Rahasia endpoint tidak dikirim ke browser/log; endpoint bersecret ditunda pada MVP.

Pemeriksaan sertifikat membutuhkan runtime yang dapat menginspeksi TLS handshake. Jangan mengasumsikan API fetch web selalu memberikan tanggal expiry. Pilihan runtime/worker dan jangkauan jaringan wajib dibuktikan sebelum modul dirilis. Pemeriksaan TLS dan HTTP memiliki histori sendiri.

Notifikasi memakai kunci unik incident_id + jenis(open/recovery) + penerima agar retry tidak menggandakan. MVP menyimpan notifikasi dalam aplikasi, tidak menjanjikan pengguna menerima email saat aplikasi ditutup. Matinya sistem monitoring sendiri memerlukan pengawas eksternal bila organisasi menuntut alert tersebut; belum termasuk implementasi MVP.

## 13. Kompatibilitas dan cutover Documents

1. Inventarisasi konfigurasi tabel `templates` aktif, dua file lama, izin SELECT anon, storage, dan pemakai tabel; jangan mengasumsikan schema remote dari berkas lokal saja.
2. Buat migration tambahan yang tidak menyentuh tabel FinTrack/clipboard/AHSP. Perubahan diterapkan manual sesuai [prosedur Supabase](../supabase/README.md); tidak ada reset schema.
3. Tambah katalog/version/tag baru, import dua template beserta konfigurasi dan checksum, lalu admin menetapkan tag serta PIN di luar source control. Import idempotent berdasarkan code/source version.
4. Lakukan uji render legacy, uji admin, dan penolakan akses anonim pada lingkungan uji sebelum enforcement produksi.
5. Cutover terkoordinasi: semua pembacaan katalog/editor pindah ke API protected; `/api/generate` memakai guard yang sama; fallback import bawaan dihapus dari jalur akses. Proteksi database/anon diterapkan pada jendela yang sama agar endpoint lama atau tabel anon tidak menjadi bypass.
6. `/document` tetap alias `/documents`; `/documents/surat_tugas` dan kode Perjadin tetap dapat dituju tetapi memerlukan grant yang sesuai. Tidak menghapus template lokal sebelum migrasi terbukti.
7. Halaman/tab lama yang tidak mengirim grant atau expected_version menerima penolakan dan petunjuk buka ulang. Tidak ada masa transisi yang tetap membiarkan generator anonim.
8. Bila gagal, gunakan mode pemeliharaan tertutup dan pulihkan pasangan kode/schema protected yang diketahui kompatibel. Rollback tidak membuka lagi katalog/generator publik. File lama dapat dipakai server sebagai sumber privat hanya bila tetap melewati katalog/izin/version aktif.

Jangan mengubah [panduan saat ini](documents.md) menjadi seolah sudah diimplementasikan. Setelah implementasi terverifikasi, sinkronkan panduan dan catat rollout aktual.

## 14. Rencana verifikasi perilaku

Semua baris adalah tes yang akan ditulis/dijalankan saat implementasi; belum merupakan bukti lulus. Gunakan skrip Node ad-hoc seperti proyek saat ini, ditambah walkthrough browser bila fitur tersedia.

| ID | Kondisi | Hasil yang wajib |
| --- | --- | --- |
| LOG-01 | Sesi suite/FinTrack/grant PIN dibuat dan dikeluarkan dalam berbagai urutan | Batas logout sesuai AUTH-04/05; token suite tetap bisa refresh setelah login FinTrack. |
| LOG-02 | PIN lima digit, enam digit, nol awal, whitespace tepi/tengah, terlalu panjang | Normalisasi dan penolakan konsisten; tidak mengubah string PIN. |
| LOG-03 | PIN duplikat untuk tag lain atau PIN lama yang dicabut dipakai ulang | Ditolak secara konsisten, termasuk request admin bersamaan. |
| LOG-04 | PIN salah/nonaktif, direct URL, API detail/generate, dan query anon Supabase | Tidak ada metadata/file/hasil bocor; error publik tidak mengungkap kelompok lain. |
| LOG-05 | Grant expired/forged/wrong audience, role diubah, tag dicabut atau template dipindah | Semua jalur protected menolak pada pemeriksaan berikutnya. |
| LOG-06 | Limiter melewati batas, banyak instance, spoof proxy, counter down | 429/Retry-After atau 503 sesuai kontrak; tidak fail open atau mengunci tag secara global. |
| LOG-07 | Akun biasa mengirim admin flag, file key, owner_id, template tag lain | Validasi/otorisasi menolak; field server-owned tidak diterima. |
| LOG-08 | File salah, ZIP bomb, external relationship, placeholder tidak cocok | Draft invalid; versi aktif tidak berubah dan input admin dapat diperbaiki. |
| LOG-09 | Upload selesai tetapi DB gagal, publish timeout, retry, dua editor | Tidak ada publish setengah jadi, duplikat versi aktif, atau overwrite revisi diam-diam. Orphan dapat dibersihkan. |
| LOG-10 | Render berjalan bersamaan PIN dicabut atau versi terbit diganti | Semantik titik otorisasi/revision sesuai kontrak; request baru tidak memakai akses lama. |
| LOG-11 | Dua generator lama setelah migrasi: baris, tanggal, transportasi dan rich text | Kemampuan lama tetap benar, akses tanpa PIN tetap ditolak. |
| LOG-12 | Beberapa follow-up, target berbeda, task selesai dengan follow-up terbuka | Tidak ada task duplikat; penyelesaian task ditolak sampai follow-up ditutup eksplisit. |
| LOG-13 | Retry konversi action item dan revisi rapat | Tepat satu hubungan task/action item melalui constraint, bukan sekadar tombol disabled. |
| LOG-14 | Periode laporan lintas bulan/zona, koreksi aktivitas, izin penerima dicabut | Histori dan cakupan tepat; laporan/notifikasi tidak melampaui izin sekarang. |
| LOG-15 | Pencarian/riwayat/lampiran KB pribadi oleh pihak lain | Judul, cuplikan, count dan file tidak bocor. |
| LOG-16 | Deployment environment berbeda dan rollback dicatat | Marker terhubung benar; tidak ada operasi server eksternal. |
| LOG-17 | Worker duplikat/out-of-order/hilang, maintenance, kegagalan/pemulihan berulang | Slot, status, insiden, notifikasi dan coverage sesuai aturan; stale bukan sehat. |
| LOG-18 | Monitor URL privat, redirect ke metadata, DNS berubah, response besar, TLS expired | Target terlarang ditolak dan resource dibatasi; expiry dibuktikan pada runtime yang dipilih. |
| LOG-19 | Logout/izin berubah ketika draft sensitif masih ada | Tampilan/input sensitif dibersihkan atau dipulihkan hanya kepada identitas dan lingkup yang sama. |
| LOG-20 | Cutover dan rollback disimulasikan dengan klien lama | Tidak ada celah katalog, generator, tabel anon, file source atau cache publik. |

Pemeriksaan implementasi kelak: lint/typecheck/build sesuai perubahan; sesuaikan `scripts/test-documents.mjs` dan `scripts/test-surat-tugas.mjs` untuk grant/version. Runtime/DB/secrets tidak diuji pada pekerjaan dokumentasi ini. Keputusan P-01–P-10 dan konfigurasi peluncuran harus ditinjau sebelum kode produksi ditulis.

## 15. Referensi

- [Supabase Auth sign-out](https://supabase.com/docs/guides/auth/signout): scope sesi.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): identitas dan batas service role.
- [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/fundamentals): bucket privat.
- [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): validasi target monitoring.
- [Generator saat ini](../app/api/generate/route.ts), [katalog](../app/documents/page.tsx), [editor](../app/documents/[code]/page.tsx), [tipe konfigurasi](../types/templateSurat.ts), [callback FinTrack](../app/auth/callback/route.ts), dan [limiter lokal](../lib/rateLimit.ts).
