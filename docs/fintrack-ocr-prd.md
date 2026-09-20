# PRD: FinTrack OCR Struk Belanja

## Status

- Tahap: backlog untuk pengembangan berikutnya
- Prioritas saat ini: setelah stabilisasi proses pembukaan aplikasi dan bootstrap data
- Target pengguna: pemakaian pribadi, keluarga, dan kolaborator dompet

## Ringkasan

FinTrack akan menyediakan pencatatan pengeluaran dari foto struk. Sistem membaca teks pada struk, mengekstrak merchant, tanggal, subtotal, pajak, biaya layanan, diskon, dan total pembayaran, lalu menyarankan kategori berdasarkan merchant serta isi struk. Hasil OCR selalu menjadi draft yang harus diperiksa pengguna sebelum transaksi disimpan.

## Tujuan

1. Mengurangi waktu pencatatan transaksi belanja.
2. Mengurangi kesalahan input nominal dan tanggal.
3. Menampilkan pajak dan komponen pembayaran secara terpisah tanpa menghitung pengeluaran dua kali.
4. Menyarankan kategori yang semakin relevan berdasarkan koreksi pengguna.
5. Tetap menggunakan RPC transaksi FinTrack agar pembaruan saldo bersifat atomik.

## Bukan Tujuan MVP

- Membuat transaksi tanpa konfirmasi pengguna.
- Membagi setiap barang ke kategori berbeda.
- Mendukung PDF multi-halaman.
- Menyimpan foto struk tanpa batas waktu.
- Menggunakan hasil OCR sebagai sumber kebenaran tanpa validasi.

## Pengalaman Pengguna

1. Pengguna menekan tombol **Catat**.
2. Pengguna memilih **Catat manual** atau **Scan struk**.
3. Pengguna mengambil foto dengan kamera belakang atau memilih gambar dari galeri.
4. FinTrack mengompres, memperbaiki orientasi, dan memeriksa kualitas gambar.
5. FinTrack mengirim gambar ke layanan OCR melalui endpoint server yang terautentikasi.
6. FinTrack menampilkan halaman review dengan:
   - Nama merchant
   - Tanggal transaksi
   - Subtotal
   - Pajak
   - Biaya layanan
   - Diskon
   - Total dibayar
   - Dompet pembayaran
   - Kategori yang disarankan
   - Catatan
7. Pengguna memperbaiki hasil bila perlu.
8. Pengguna menekan **Simpan transaksi**.
9. FinTrack menyimpan transaksi melalui RPC yang sudah ada dan menghubungkan draft OCR dengan transaksi tersebut.

## Aturan Bisnis

- `transaction.amount` menggunakan grand total yang benar-benar dibayar.
- Pajak, biaya layanan, dan diskon disimpan sebagai metadata struk, bukan transaksi tambahan.
- Transfer tidak dapat dibuat dari hasil scan struk.
- Kategori yang disarankan harus berasal dari plan dompet yang dipilih.
- Dompet dengan akses `viewer` tidak dapat digunakan untuk menyimpan transaksi.
- Jika hasil OCR atau perhitungan tidak meyakinkan, kategori dan nominal tidak boleh dikonfirmasi otomatis.
- Sistem memeriksa pendekatan rumus: `subtotal + pajak + biaya layanan - diskon = total` dengan toleransi pembulatan.

## Strategi OCR

### Rekomendasi utama

Gunakan Google Cloud Vision `DOCUMENT_TEXT_DETECTION` dengan language hint Bahasa Indonesia (`id`). Cloud Vision membaca teks dan posisi kata, sedangkan FinTrack bertanggung jawab menginterpretasikan struktur struk Indonesia.

Alasan:

- Mendukung Bahasa Indonesia.
- Lebih sesuai untuk teks padat daripada OCR teks umum.
- Seribu unit pertama per bulan saat dokumen ini dibuat tersedia tanpa biaya pemakaian, tetapi project Google Cloud tetap memerlukan billing account.
- Untuk 50 pengguna dengan 10 sampai 20 struk per bulan per pengguna, pemakaian diperkirakan berada pada atau di bawah 1.000 gambar per bulan.

### Alternatif tanpa layanan cloud

Tesseract.js dapat dijalankan di browser menggunakan WebAssembly. Alternatif ini tidak memerlukan biaya API, tetapi lebih berat pada perangkat mobile dan berpotensi kurang akurat untuk struk termal, foto miring, pantulan cahaya, serta teks pudar.

### Tidak direkomendasikan untuk MVP

Google Document AI Expense Parser belum mencantumkan Bahasa Indonesia sebagai bahasa resmi Expense Parser. Karena itu, processor tersebut tidak menjadi pilihan utama untuk struk Indonesia.

## Parser Struk Indonesia

Parser harus mengenali label yang umum:

- `TOTAL`
- `GRAND TOTAL`
- `TOTAL BAYAR`
- `JUMLAH`
- `SUBTOTAL`
- `PPN`
- `PB1`
- `SERVICE`
- `DISKON`
- `TUNAI`
- `KEMBALI`

Prioritas kandidat total:

1. Grand total atau total bayar.
2. Total yang posisinya dekat bagian akhir daftar barang.
3. Nominal yang memenuhi persamaan subtotal, pajak, biaya, dan diskon.
4. Jangan menggunakan nilai tunai atau kembalian sebagai total jika labelnya terdeteksi.

Setiap field mempunyai confidence tersendiri. Field dengan confidence rendah diberi penanda **Perlu diperiksa**.

## Saran Kategori

Urutan penentuan kategori:

1. Riwayat pasangan merchant dan kategori pada plan yang sama.
2. Pencocokan kata kunci merchant dan line item.
3. Frekuensi kategori yang terakhir dipilih pengguna untuk merchant tersebut.
4. Tanpa kategori jika confidence tidak memenuhi ambang batas.

Contoh aturan awal:

- Pertamina, Pertalite, Pertamax: Transportasi
- Apotek, obat, vitamin: Kesehatan
- Restoran, kopi, nasi: Makanan
- Pulsa, paket data: Komunikasi atau Tagihan
- Minimarket dan supermarket: Belanja harian

Koreksi pengguna memperbarui aturan merchant, tetapi tidak mengubah kategori transaksi lama.

## Model Data yang Diusulkan

### `fintrack_receipt_scans`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `plan_id` | uuid | Plan dari dompet yang dipilih |
| `created_by` | uuid | Pengguna yang melakukan scan |
| `transaction_id` | uuid nullable | Transaksi setelah dikonfirmasi |
| `merchant_name` | text nullable | Nama merchant hasil parsing |
| `receipt_date` | date nullable | Tanggal struk |
| `subtotal` | numeric nullable | Subtotal |
| `tax_amount` | numeric nullable | Pajak |
| `service_amount` | numeric nullable | Biaya layanan |
| `discount_amount` | numeric nullable | Diskon |
| `total_amount` | numeric nullable | Total pembayaran |
| `currency` | text | Default `IDR` |
| `raw_text` | text nullable | Hasil OCR mentah |
| `parsed_data` | jsonb | Kandidat field dan line item |
| `confidence` | numeric nullable | Confidence keseluruhan |
| `status` | text | `processing`, `review`, `confirmed`, atau `failed` |
| `image_path` | text nullable | Lokasi gambar pada storage private |
| `created_at` | timestamptz | Waktu dibuat |
| `updated_at` | timestamptz | Waktu diperbarui |

### `fintrack_merchant_category_rules`

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `plan_id` | uuid | Batas kepemilikan aturan |
| `normalized_merchant` | text | Nama merchant yang dinormalisasi |
| `category_id` | uuid | Kategori yang disarankan |
| `usage_count` | integer | Jumlah konfirmasi pengguna |
| `updated_at` | timestamptz | Waktu pembaruan terakhir |

Gunakan unique constraint pada `(plan_id, normalized_merchant)` agar aturan tidak terduplikasi.

Tabel `fintrack_receipt_items` ditunda sampai ada kebutuhan pembagian kategori per barang. Pada MVP, detail barang disimpan di `parsed_data`.

## API yang Diusulkan

- `POST /api/fintrack/receipts/scan`
  - Memvalidasi sesi dan akses dompet.
  - Menerima gambar yang sudah dikompres.
  - Memanggil provider OCR dari server.
  - Menyimpan hasil sebagai draft.
- `PUT /api/fintrack/receipts/[id]`
  - Memperbarui hasil review.
- `POST /api/fintrack/receipts/[id]/confirm`
  - Memvalidasi draft.
  - Menjalankan RPC transaksi yang sudah ada.
  - Menghubungkan receipt dengan transaction secara atomik jika memungkinkan.
- `DELETE /api/fintrack/receipts/[id]`
  - Menghapus draft serta gambar sesuai hak akses.

Provider OCR ditempatkan di balik interface internal agar dapat diganti tanpa mengubah UI dan parser.

## Penyimpanan dan Privasi

- Jangan menyimpan base64 gambar di PostgreSQL.
- Jika gambar perlu disimpan, gunakan Supabase Storage bucket private.
- Credential OCR hanya tersedia pada server dan tidak menggunakan prefix `NEXT_PUBLIC_`.
- Kompres gambar di browser dengan batas target 1 sampai 2 MB dan dimensi panjang maksimal sekitar 2.000 piksel.
- Default retensi gambar: 30 hari.
- Pengguna dapat memilih menghapus gambar segera setelah konfirmasi.
- `raw_text` dan `parsed_data` ikut dihapus ketika receipt dihapus.

## Environment Variables yang Diusulkan

- `FINTRACK_OCR_PROVIDER=google-vision`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_CLIENT_EMAIL`
- `GOOGLE_CLOUD_PRIVATE_KEY`
- `FINTRACK_RECEIPT_RETENTION_DAYS=30`

Semua variabel tersebut bersifat server-only.

## Batas dan Validasi Upload

- Format MVP: JPEG, PNG, dan WebP.
- Satu gambar untuk satu struk.
- Validasi MIME berdasarkan isi file, bukan hanya ekstensi.
- Tolak file yang terlalu besar setelah kompresi.
- Batasi jumlah scan per pengguna per menit untuk mencegah penyalahgunaan.
- Jangan menyimpan transaksi jika total tidak valid atau dompet tidak dapat dikelola pengguna.

## Observability

Catat metrik tanpa menyimpan isi struk di log:

- Durasi upload, OCR, parsing, dan penyimpanan.
- Provider dan status OCR.
- Confidence setiap field.
- Persentase hasil yang dikoreksi pengguna.
- Penyebab gagal, seperti gambar buram, timeout, rate limit, atau provider error.
- Pemakaian OCR bulanan untuk menjaga biaya.

## Tahapan Pengembangan

### Fase 1: MVP scan dan review

- Kamera dan galeri.
- Preprocessing dasar.
- Ekstraksi merchant, tanggal, subtotal, pajak, diskon, service, dan total.
- Satu kategori untuk satu struk.
- Review wajib.
- Simpan melalui RPC transaksi yang ada.

### Fase 2: Pembelajaran kategori

- Aturan merchant per plan.
- Confidence suggestion.
- Koreksi pengguna memperkuat aturan.
- Kelola dan reset aturan merchant.

### Fase 3: Line item

- Ekstraksi barang, kuantitas, harga satuan, dan total item.
- Pembagian satu struk ke beberapa kategori.
- Validasi jumlah item terhadap grand total.

## Acceptance Criteria MVP

- Pengguna dapat mengambil atau memilih satu foto struk.
- Proses OCR tidak mengekspos credential ke browser.
- Hasil review menampilkan total, pajak, merchant, tanggal, dompet, dan kategori.
- Semua field dapat diperbaiki sebelum penyimpanan.
- Tidak ada saldo yang berubah sebelum pengguna menekan tombol simpan.
- Transaksi akhir tetap dibuat melalui RPC atomik FinTrack.
- Kategori yang disarankan berasal dari plan dompet terkait.
- Kegagalan OCR tidak menghapus foto sebelum pengguna memilih mencoba kembali atau membatalkan.
- Total pengeluaran hanya menghitung grand total sekali.

## Risiko Utama

1. Format struk sangat bervariasi dan label total tidak konsisten.
2. Struk termal pudar, terlipat, miring, atau terkena pantulan cahaya menurunkan akurasi.
3. Nilai tunai dan kembalian dapat salah dianggap sebagai total.
4. Merchant yang menjual banyak jenis barang tidak selalu cocok dengan satu kategori.
5. Credential provider atau gambar struk dapat bocor jika upload dan storage tidak dikonfigurasi dengan benar.
6. Biaya dapat meningkat jika tidak ada limit per pengguna dan monitoring kuota.

## Referensi

- Google Cloud Vision OCR: https://docs.cloud.google.com/vision/docs/ocr
- Dukungan bahasa OCR: https://docs.cloud.google.com/vision/docs/languages
- Harga Cloud Vision: https://cloud.google.com/vision/pricing
- Setup dan billing Vision: https://docs.cloud.google.com/vision/docs/setup
- Daftar processor Document AI: https://docs.cloud.google.com/document-ai/docs/processors-list
- Tesseract.js: https://github.com/naptha/tesseract.js/
