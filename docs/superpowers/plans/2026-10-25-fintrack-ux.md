# FinTrack UX Implementation Plan

**Goal:** Terapkan lima koreksi audit yang disetujui pengguna tanpa mengubah saldo, RPC, atau perhitungan laporan.

**Architecture:** Draf transaksi disimpan sementara di provider React saat membuka kategori, tidak di disk. Sheet bersama mengonfirmasi penutupan isian berubah dan menahan penutupan selama penyimpanan. Filter aktivitas diteruskan lewat URL. Login memetakan error callback ke pesan aman. Goals menjelaskan total pendanaan.

**Tech Stack:** Next.js, React, TypeScript, komponen FinTrack yang sudah ada.

**Spec:** Audit UX pada percakapan ini, disetujui 25 Oktober 2026.

- [x] Tulis tes regresi untuk pemetaan error, URL kategori/aktivitas, dan status penutupan; pastikan gagal sebelum implementasi.
- [x] Provider + transaction-form + manage: simpan draf saat Kelola kategori, buka tab Kategori, sediakan Kembali ke transaksi dan pulihkan isian serta identitas transaksi edit. Tidak simpan PIN atau data finansial di localStorage.
- [x] TransactionSheet + transaction-form + GoalEditor: isian berubah meminta pilihan Lanjutkan mengisi/Buang perubahan. Simpan berhasil dan perpindahan terencana tidak meminta buang. Penutupan saat request berjalan ditahan.
- [x] Goals + Activity: kirim account_id, baca dan tampilkan filter dompet, sediakan pelepasan filter. Pertahankan filter kategori/periode yang sudah ada.
- [x] Login: petakan oauth/identity/bootstrap ke pesan aman; pertahankan input dan opsi retry.
- [x] Goals: label Total pendanaan dan penjelasan dana tersedia + dana terpakai; perhitungan tidak berubah.
- [x] Jalankan regresi FinTrack, typecheck, lint terkait, build, dan walkthrough browser sintetis. Catat batas bukti database/OAuth.

Keputusan lanjutan pengguna: pembayaran utang memiliki kategori opsional dan dapat dihitung sebagai pengeluaran. Implementasi mempertahankan ledger transfer, menambah metadata melalui RPC atomik, serta menyediakan pilihan Hitung sebagai pengeluaran dengan penjelasan risiko hitungan ganda. Transaksi lama tidak diubah otomatis.
