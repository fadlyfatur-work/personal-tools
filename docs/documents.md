# Template surat

Menu membuka `/documents`, yang menggabungkan template bawaan dari `lib/documentTemplates.ts` dan tabel Supabase `templates`, diurutkan berdasarkan nama. Kode bawaan diprioritaskan jika duplikat. `/document` mengarah ke katalog yang sama. Tautan lama `/documents/[code]` tetap tersedia.

Surat Tugas (`/documents/surat_tugas`) disertakan bersama file `storage/data/surat_tugas.docx`, tanpa perubahan database. Template ini mendukung 1–20 pegawai, dua poin Menimbang yang diisi pengguna (poin kedua opsional), Dasar, dropdown transportasi darat/udara/air, nomor manual dan periode tanggal. Kop, penandatangan dan paraf mengikuti contoh. `repeatRows` pada grup menghasilkan baris Word dinamis, sedangkan template lama tetap memakai placeholder bernomor tetap.

Pengguna memilih template yang disediakan, mengisi field sesuai konfigurasi, lalu mengunduh Word. Fitur ini tidak mencakup unggah template oleh pengguna.

## Menambahkan pilihan template

1. Simpan file `.docx` di `storage/data/` dan pastikan file ikut tersedia saat deployment.
2. Tambahkan record pada tabel `templates`: `code` unik, `name` untuk tampilan, `file_path` sesuai nama file, dan `fields` sesuai `TemplateConfig` pada `types/templateSurat.ts`.
3. Gunakan placeholder `{{nama_field}}` untuk field tunggal. Field grup memakai `{{nama_field_1}}`, `{{nama_field_2}}`, dan seterusnya hingga `maxItems`.
4. Pastikan kebijakan SELECT Supabase yang berlaku mengizinkan pengguna aplikasi membaca template tersebut. Katalog memakai klien yang sama dengan editor lama.

Contoh struktur `fields` untuk template surat sederhana:

```json
{
  "single": [
    { "key": "nomor_surat", "label": "Nomor surat", "type": "text" },
    { "key": "tanggal_surat", "label": "Tanggal surat", "type": "date" },
    { "key": "isi_surat", "label": "Isi surat", "type": "textarea" }
  ],
  "groups": []
}
```

Pilihan baru otomatis tampil; tidak perlu menambahkan tautan atau field pada kode frontend. Format khusus Perjadin (editor keterangan dan batas kegiatan hari kedua) hanya diterapkan pada kode `perjadin_2026`.

## Verifikasi

Jalankan `npm run dev`, lalu `node scripts/test-documents.mjs`. Pemeriksaan memakai `.env.local`, membaca konfigurasi template yang tersedia, dan membuat dokumen dengan data uji tanpa menulis ke database. Periksa juga pencarian katalog, tampilan ponsel, fokus keyboard, dan pergantian template melalui browser.

Jalankan `node scripts/test-surat-tugas.mjs` untuk menguji 1 dan 20 pegawai, periode satu hari/rentang/lintas bulan, pilihan transportasi, serta penolakan jumlah dan isian tidak valid. Dokumen uji disimpan di `.next/surat-tugas-check/`. Verifikasi struktural tidak menggantikan pemeriksaan halaman hasil render di Word/LibreOffice.
