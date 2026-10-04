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

## Kamera, lokasi perangkat, dan panel editor

- Foto unggahan atau hasil kamera langsung aktif, tanpa konfirmasi penggunaan foto.
- Desktop: pengaturan dan pratinjau berbagi tinggi viewport; pengaturan memiliki scroll sendiri. Mobile: pratinjau di atas, panel pengaturan dengan scroll di bawah. Pada layar sangat pendek, halaman boleh bergulir agar kontrol tetap dapat diakses.
- Kamera memakai `getUserMedia`, tanpa audio, dan hanya dibuka lewat tombol. Stream dihentikan saat kamera ditutup atau komponen dilepas, termasuk jika izin baru selesai setelah ditutup. Hasil kamera berupa JPEG.
- Lokasi diambil setelah tombol ditekan. Koordinat dikirim lewat POST `/api/timemark/location` ke proxy reverse geocoding Geoapify. Hasil alamat dibatasi Indonesia dan tidak dicache di server. Jika alamat gagal diperoleh, koordinat tetap tersedia untuk diganti manual.
- Kamera/lokasi memerlukan izin browser dan secure context (HTTPS atau localhost). Respons lokasi yang terlambat tidak menimpa pengeditan manual.
- `node scripts/test-timemark-device.cjs`: simulasi capture, lifecycle kamera, reverse lookup, validasi koordinat, dan edit manual saat lookup berjalan. Hardware kamera/GPS nyata perlu diperiksa pada perangkat pengguna.

## Diagnosis produksi (2026-10-04)

Posisi perangkat bisa tersedia walau alamat gagal. Reverse geocoding dan autocomplete produksi sama-sama mengembalikan HTTP 502; panggilan Geoapify dengan key lokal berhasil. Periksa GEOAPIFY_API_KEY di environment server produksi (termasuk pembatasan key) serta akses outbound server ke pi.geoapify.com. Route reverse sekarang mengembalikan pesan yang membedakan key ditolak, kuota, HTTP provider, dan koneksi/timeout. Deploy perubahan dulu untuk melihat pesan yang tepat di produksi. Kamera meminta stream portrait 9:16; CSS menampilkan seluruh video dalam ruang kamera penuh dan mempertahankan kontrol di bawah.

