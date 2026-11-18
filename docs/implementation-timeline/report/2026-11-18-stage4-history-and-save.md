# 18 November 2026: progres Tahap 4 dan penyimpanan laporan

- Paket baru otomatis memulai proses PU. Riwayat perpindahan status disimpan per paket dan dapat dibuka dari modal Tahap 4; pengembalian ke PU menyimpan status asal, tujuan, waktu, dan catatan opsional.
- Penghapusan progres Tahap 4 meminta konfirmasi, mereset paket aktif ke PU, dan menghapus riwayat progres. Aksi hapus/arsip paket serta data akun dan provinsi juga meminta konfirmasi.
- Paket nonaktif tidak menampilkan status proses atau catatan pada detail paket.
- Penyimpanan memperbarui snapshot dan ringkasan pada halaman yang sama dengan overlay. Bagian ringkasan akun per peran dan jumlah paket aktif tersedia di atas filter dalam keadaan tertutup.
- Submit dan Batal pada mode edit ditampilkan berdampingan.
- Tidak ada perubahan skema basis data; riwayat progres berada di dokumen laporan dan data lama mendapat nilai bawaan kosong.
- Pemeriksaan: `npx tsc --noEmit` dan ESLint pada berkas laporan lulus. Test tidak dijalankan.
