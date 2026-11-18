# Ganti JPG pratinjau dengan PDF langsung

> Date: 2026-11-18
> Status: partial
> Change type: feature
> Scope: katalog AHSP, pratinjau sumber

## Outcome

Modal AHSP menampilkan PDF sumber pada halaman yang dirujuk dan tidak lagi memuat JPG pratinjau. Penghapusan objek JPG lama dari Supabase Storage masih perlu dilakukan setelah deployment.

## Implementation

`SourcePages` memilih aset PDF sesuai rentang halaman, menambahkan nomor halaman relatif terhadap PDF tersebut, dan menyediakan tautan untuk membuka PDF di tab baru. Bila aset halaman tidak tersedia, komponen mencoba URL sumber dan nomor halaman global. Kontrak sumber AHSP tidak lagi menyertakan `preview_base_url`.

## Decisions and tradeoffs

Browser PDF viewer menggantikan raster JPG tersimpan. Dukungan untuk menampilkan PDF di dalam `iframe` bergantung pada browser dan kebijakan server penyedia PDF.

## Verification

`npx tsc --noEmit` selesai tanpa error. `npm run build` gagal karena Turbopack berhenti saat memproses `app/globals.css` dengan `Failed to write app endpoint /page`; percobaan `npx next build --webpack` juga gagal saat membuat direktori output `.next` dengan `EPERM`. Pratinjau belum diuji langsung di browser.

## Limitations and follow-up

- Deploy perubahan dan pastikan pratinjau PDF berfungsi.
- Hapus objek dalam bucket `ahsp-source-pages` melalui Supabase Storage. Bucket kosong dapat dihapus setelah tidak dibutuhkan lagi.
- Jangan jalankan `scripts/ahsp-page-previews.py` atau `scripts/ahsp-upload-previews.mjs`; keduanya adalah alur lama.

## Related documentation

- [Panduan katalog AHSP](../../ahsp.md)
- [Komponen pratinjau sumber](../../../app/ahsp/source-pages.tsx)
