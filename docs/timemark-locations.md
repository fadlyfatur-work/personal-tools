# Autocomplete lokasi Timemark

Tambahkan `GEOAPIFY_API_KEY=<API key dari Geoapify>` ke `.env.local` atau environment deployment. Key hanya dibaca server dan tidak dikirim ke browser. Restart server setelah mengganti environment.

- Endpoint: `/api/timemark/locations?q=...`.
- Minimal 5 karakter setelah spasi dinormalisasi; maksimal 200 karakter.
- Debounce 400 ms, request lama dibatalkan saat query berubah atau dropdown ditutup.
- Filter Geoapify `countrycode:id`, bahasa `id`, maksimal 5 alamat. Server juga menyaring hasil non-Indonesia dan duplikat.
- Cache browser `timemark-locations-id-v1`: 200 query terakhir, 7 hari untuk hasil berisi alamat dan 1 jam untuk hasil kosong. Error tidak dicache. Cache berbeda untuk setiap perangkat/browser; bukan pembatas kuota global.
- Satu kolom lokasi untuk pencarian dan alamat manual. Teks langsung digunakan pada foto; memilih saran menggantikan teks tersebut. Dropdown dapat dipakai dengan panah atas/bawah, Enter, Escape, atau klik. Pilihan terakhir “Isi manual” mempertahankan teks dan menutup dropdown. Alamat manual mendukung hingga 400 karakter; pencarian hanya berjalan hingga 200 karakter.
- Input alamat manual tetap tersedia jika key belum ada, provider gagal, offline, atau hasil kosong.
- Pencarian mengirim teks query ke Geoapify melalui server. Foto tetap di browser. Atribusi Geoapify dan OpenStreetMap ditampilkan di dropdown.

Jalankan `node scripts/test-timemark-locations.cjs` untuk tes route dengan respons provider simulasi dan cache. Pengujian alamat nyata memerlukan API key aktif.
