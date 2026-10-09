# KADAKA · Marketing Office 3D

Kantor pemasaran dengan seorang **Marketing Manager manusia** dan delapan agen dalam empat divisi. Tampilan kantor 3D memakai karakter voxel dan aset terpilih dari [Claw3D](https://github.com/iamlukethedev/Claw3D). Pekerjaan terhubung ke brief, tugas, percakapan, hasil kerja, persetujuan, dan paket publikasi yang tersimpan secara lokal.

## Menjalankan aplikasi

Gunakan **Node.js 24+** dan npm. Tidak diperlukan database terpisah atau OpenClaw Gateway.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Server pengembangan menggunakan port 3000 dan alamat loopback. Untuk produksi lokal:

```sh
npm run build
npm start
```

Kunci AI bersifat opsional. Tanpa kunci, gunakan mode demo dan penyuntingan manual. Jangan memasukkan nilai rahasia ke Git. Konfigurasi lengkap tersedia di [.env.example](.env.example).

## Tim kantor

| Divisi | Agen | Tanggung jawab |
| --- | --- | --- |
| Marketing Manager | Anda | Brief, perintah, evaluasi, revisi, persetujuan |
| Digital Marketing | Maya · Marketing Strategist | Strategi kampanye |
| Digital Marketing | Rio · Copywriter | Copy dan naskah konten |
| Graphic Design | Luna · Art Director | Arahan visual |
| Graphic Design | Pixel · Visual Designer | Desain dan permintaan gambar |
| Data Analyst | Atlas · Research Analyst | Riset dan asumsi audiens |
| Data Analyst | Nova · Performance Analyst | Rencana pengukuran dan analisis |
| Publisher | Cleo · Content Editor | Pemeriksaan editorial |
| Publisher | Kai · Publishing Coordinator | Paket publikasi dan jadwal |

## Alur kerja

1. Buat kampanye dengan produk, audiens, tujuan, kanal, anggaran, dan tenggat. **Instagram dan TikTok** adalah kanal awal; pilihan kanal tambahan juga tersedia.
2. Brief membuat tugas untuk delapan agen. Jalankan kampanye untuk menghasilkan hasil kerja lintas divisi. Dependensi menghubungkan hasil analisis, strategi, copy, desain, dan editorial.
3. Beri perintah atau minta laporan melalui percakapan kantor. Pilih agen untuk membuat penugasan dari pesan.
4. Tinjau hasil kerja. Manager dapat menyunting isi, menyetujui, atau meminta revisi dengan umpan balik. Jalankan ulang tugas yang perlu direvisi.
5. Tinjau dan setujui paket kampanye sebelum menjadwalkan distribusi. Jadwal disimpan di aplikasi; menyimpan jadwal tidak otomatis mengirim konten.
6. Ekspor paket hasil kerja; gambar campaign yang sudah dibuat ikut dikemas sebagai data PNG base64 di dalam JSON. Jika webhook penerbitan sudah dikonfigurasi, pengiriman dilakukan melalui tindakan terpisah yang eksplisit.
7. Masukkan metrik aktual secara manual untuk meninjau performa. Aplikasi tidak mengambil statistik Instagram atau TikTok secara otomatis.

**Persetujuan manusia tetap diperlukan.** Tidak ada integrasi OAuth bawaan dengan Instagram atau TikTok, dan tidak ada proses latar belakang yang otomatis memublikasikan konten pada waktu terjadwal. Status pengiriman webhook menunjukkan hasil permintaan ke endpoint yang Anda konfigurasi, bukan verifikasi tayangnya konten di jejaring sosial.

## Demo, AI langsung, dan manual

- **Demo:** menghasilkan contoh kerja berbasis brief agar seluruh alur dapat dicoba tanpa biaya API. Contoh riset, perkiraan, dan KPI adalah bahan latihan, bukan data pasar yang telah diverifikasi.
- **AI langsung:** menggunakan API OpenAI dari server ketika kunci tersedia. Tinjau hasil, asumsi, hak penggunaan aset, dan klaim sebelum menyetujuinya. Model bahasa tidak otomatis mengakses analitik akun atau melakukan riset web.
- **Manual:** manager dapat menyunting isi hasil kerja. Perubahan tetap disimpan bersama kampanye.

Kantor 3D menampilkan karakter dan status pekerjaan. Gerakan karakter adalah animasi tampilan; gerakan itu sendiri bukan bukti bahwa model sedang menjalankan pekerjaan.

## Konfigurasi server

| Variabel | Fungsi | Bawaan |
| --- | --- | --- |
| `MARKETING_AI_KEY` | Kunci OpenAI untuk pekerjaan teks | Kosong; mode demo tetap tersedia |
| `OPENAI_API_KEY` | Alternatif jika `MARKETING_AI_KEY` tidak diisi | Kosong |
| `MARKETING_AI_MODEL` | Model teks OpenAI | `gpt-4.1-mini` |
| `MARKETING_IMAGE_KEY` | Kunci terpisah untuk pembuatan gambar kampanye | Menggunakan kunci AI jika kosong |
| `OFFICE_DATA_DIR` | Direktori database SQLite dan gambar yang dihasilkan | `.data` |
| `OFFICE_ACCESS_TOKEN` | Token akses manager opsional | Kosong; tidak ada autentikasi aplikasi |
| `MARKETING_PUBLISH_URL` | Endpoint webhook penerbitan opsional | Kosong; ekspor lokal tersedia |
| `MARKETING_PUBLISH_TOKEN` | Token webhook penerbitan opsional | Kosong |

Semua kunci digunakan di server. Ubah `.env.local`, lalu mulai ulang server agar konfigurasi diterapkan. `OFFICE_ACCESS_TOKEN` merupakan akses bersama untuk satu kantor, bukan sistem akun dengan peran atau isolasi banyak organisasi. Isi token dan gunakan infrastruktur HTTPS yang sesuai sebelum membagikan akses server ke jaringan.

Data kampanye disimpan dengan SQLite di `.data` secara bawaan dan bertahan setelah browser atau server dimulai ulang. Pertahankan direktori data ketika melakukan deployment. Gunakan `OFFICE_DATA_DIR` berbeda untuk pengujian agar data kerja tetap terpisah.

## Pemeriksaan

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Pengujian browser memakai Playwright dengan Chromium sistem di `/usr/bin/chromium` dan rendering WebGL perangkat lunak. Ubah `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` jika Chromium berada di lokasi lain. Hentikan server pengembangan aktif sebelum menjalankan E2E karena Next.js memakai satu direktori build. Secara bawaan, pengujian memulai server terpisah pada port 3001, memakai direktori data baru di `/tmp`, dan menonaktifkan kredensial AI serta webhook untuk proses uji.

Gunakan `E2E_PORT` untuk memilih port lain atau `E2E_DATA_DIR` untuk menetapkan direktori uji. `E2E_BASE_URL` memungkinkan pengujian terhadap server yang sudah berjalan; pengujian akan membuat kampanye di server tersebut, sehingga gunakan instance uji. Pengujian browser tidak membuktikan integrasi OpenAI atau keberhasilan publikasi ke jejaring sosial.

Hasil pemeriksaan instance ini tercatat di [docs/VALIDATION.md](docs/VALIDATION.md).

## Sumber Claw3D

Integrasi menggunakan kode dan model nyata yang disalin secara selektif dari upstream Claw3D pada commit `0565b7892909eca7bbc8f2d9b0fad171dd75ad7c`: karakter voxel, pembangkit profil avatar, helper koordinat, dan furnitur. Aplikasi pemasaran, data lokal, dan alur persetujuan dikembangkan terpisah; ini bukan pemasangan penuh aplikasi upstream.

Daftar berkas dan adaptasi tercatat di [vendor/claw3d/README.md](vendor/claw3d/README.md). Lisensi MIT upstream dipertahankan di [vendor/claw3d/LICENSE](vendor/claw3d/LICENSE). Lisensi font berada bersama aset font di `public/office-assets/fonts/`.
