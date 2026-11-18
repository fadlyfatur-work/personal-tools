# Rekonsiliasi master AHSP 27 Oktober 2026

## Kontrak

Permintaan pengguna menjadi spesifikasi: cocokkan seluruh katalog Supabase dengan JSON master item/komponen, abaikan ID sumber sebagai identitas pencocokan, periksa regulasi, lengkapi analisis, ganti tiga label asal dengan Verified (hijau) dan Need re-verified (merah). SMKK tanpa komponen sah, rumus `0` dianggap tidak ada, harga diabaikan.

Pendekatan: simpan snapshot sebelum perubahan, kelompokkan ekspor pekerjaan/komponen/variabel dengan ID sumber hanya sebagai pengelompokan, cocokkan bidang + regulasi + kode + nama + satuan yang dinormalisasi konservatif. Jangan gunakan fuzzy matching untuk meluluskan. Regulasi gabungan dipecah menjadi keanggotaan edisi. Metadata berbeda, kandidat ambigu, komponen tidak lengkap, dan basis analisis tidak terbukti ditahan dengan alasan. Data PDF dan asal lama tetap disimpan. Cakupan katalog tetap SE 47/2026, Permen 08/2023, dan arsip SE 182/2025; SPTJM dan regulasi kosong dilaporkan terpisah.

Alternatif mengganti seluruh katalog ditolak karena menghilangkan rujukan PDF dan versi. Mengubah label tiga status lama saja ditolak karena keberadaan dua sumber belum membuktikan kelengkapan analisis.

## Pelaksanaan

- [x] Snapshot seluruh `ahsp_items` dan sumber ke folder audit lokal yang diabaikan Git.
- [x] Uji pengelompokan, pencocokan, regulasi, SMKK, rumus nol, nilai kosong, konflik, idempotensi, serta perubahan snapshot.
- [x] Implementasi normalisasi dan laporan per pekerjaan/per komponen serta rencana perubahan dengan snapshot pemulihan.
- [x] Tambahkan status verifikasi dan asal analisis terpisah; pertahankan tiga nilai asal lama secara internal untuk kompatibilitas.
- [x] Integrasikan dua status pada API/filter/modal; rincian variabel dan alasan pemeriksaan dapat dilihat.
- [x] Verifikasi SQL dengan PostgreSQL lokal sementara; jalankan uji AHSP terkait dan pemeriksaan tipe.
- [x] Terapkan perubahan data yang disetujui pengguna melalui mekanisme proyek, lalu baca ulang dan bandingkan hasil. DDL mengikuti SQL Editor manual proyek.
- [x] Simpan laporan akhir, prosedur pemulihan, dan batas pemeriksaan.

Hasil: 11.541 versi; 8.763 Verified; 2.778 Need re-verified; 10.189 versi non-SMKK dilengkapi; 67.813 baris komponen dan 72.477 variabel tersimpan. Pembacaan ulang seluruh data dan pemeriksaan filter/MPTK langsung lulus. Build Webpack lulus; Turbopack gagal internal pada proses CSS. Pemeriksaan visual browser langsung tidak dilakukan. Detail di `docs/ahsp-master-verification.md`.

## Keputusan

Tidak membuat worktree baru karena checkout berisi perubahan pengguna terkait RAB; hanya berkas relevan disentuh. Tidak menghapus atau menggabungkan versi lama. Status Verified adalah kelulusan rekonsiliasi terhadap snapshot JSON, bukan pengesahan hukum atau harga. Warna semantik mengikuti permintaan pengguna; tampilan katalog, fokus daftar berkode, dan tema dipertahankan (ENERGY 2 / RHYTHM 2 / MOTION 1).
