# KADAKA · Marketing Office 3D

Kantor pemasaran dengan seorang **Marketing Manager manusia** dan delapan agen awal dalam empat divisi. Tambahkan agen dan skill melalui tab **Backend & API**. Tampilan kantor 3D memakai karakter voxel dan aset terpilih dari [Claw3D](https://github.com/iamlukethedev/Claw3D). Pekerjaan terhubung ke brief, tugas, percakapan, hasil kerja, persetujuan, dan paket publikasi yang tersimpan secara lokal.

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

Pada cloud yang memakai `HTTP_PROXY`/`HTTPS_PROXY`, jalankan Node.js 24.19+ dengan `NODE_USE_ENV_PROXY=1 npm run dev` (atau `NODE_USE_ENV_PROXY=1 npm start` untuk produksi). Ini membuat fetch Node memakai proxy yang tersedia, termasuk kredensial environment yang dibatasi ke domain provider. Pertahankan konfigurasi CA yang disediakan environment.

## Laptop localhost dengan Ollama

Aplikasi dan Ollama dijalankan pada **laptop yang sama**. Pastikan Node.js 24+ dan Ollama sudah terpasang. Periksa nama model yang sudah ada:

```sh
ollama list
```

Jika layanan Ollama belum aktif, jalankan `ollama serve` di terminal lain. Aplikasi tidak mengunduh model baru. Gunakan nama persis yang muncul pada `ollama list`; nilai awal mengikuti permintaan Anda, `Gwen3.8:27b`, dan bisa diubah apabila nama yang terpasang berbeda.

```sh
git clone https://github.com/kadaka-lounge/marketing-office-3D.git
cd marketing-office-3D
npm ci
npm run dev:local
```

Buka browser laptop pada port **3000** di localhost. Preset **Backend & API → Koneksi API → Ollama (lokal)** memakai `http://127.0.0.1:11434/v1` dan tidak memerlukan API key. Pilih **Simpan backend**, lalu **Uji koneksi tersimpan**. Pilih mode AI langsung untuk menjalankan agen dengan model lokal. Jika Anda sudah menyimpan provider lain sebelumnya, pilih dan simpan Ollama agar konfigurasi tersimpan diperbarui; launcher tidak menghapus pengaturan lama.

Untuk produksi di laptop:

```sh
npm run build
npm run start:local
```

`dev:local` dan `start:local` bekerja melalui launcher Node di Windows, macOS, dan Linux. Untuk nama model atau endpoint berbeda, isi `.env.local`:

```dotenv
LOCAL_LLM_MODEL=Gwen3.8:27b
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
```

Launcher membaca `.env.local`, mempertahankan data kantor, dan tidak meneruskan kunci teks provider cloud ke Ollama. Endpoint HTTP diperbolehkan hanya untuk loopback (`localhost`, `127.0.0.1`, `[::1]`); provider di jaringan lain tetap membutuhkan HTTPS. Perangkat harus memiliki RAM/VRAM yang cukup untuk varian model 27B Anda. Pemuatan awal atau inferensi lokal dapat menunggu hingga 5 menit per permintaan. Skill, chat, tugas, review, dan ekspor memakai alur yang sama. GPT Image tetap membutuhkan koneksi OpenAI terpisah melalui `MARKETING_IMAGE_KEY`.

Jika kantor dijalankan di cloud, localhost menunjuk mesin cloud dan tidak dapat menjangkau Ollama pada laptop Anda. Jalankan kantor di laptop untuk memakai model lokal tanpa integrasi jaringan tambahan.

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
2. Brief membuat tugas untuk delapan agen awal dan setiap agen tambahan. Jalankan kampanye untuk menghasilkan hasil kerja lintas divisi. Dependensi menghubungkan hasil analisis, strategi, copy, desain, dan editorial; tugas agen tambahan mengikuti rangkaian awal.
3. Beri perintah atau minta laporan melalui percakapan kantor. Pilih agen untuk membuat penugasan dari pesan.
4. Tinjau hasil kerja. Manager dapat menyunting isi, menyetujui, atau meminta revisi dengan umpan balik. Jalankan ulang tugas yang perlu direvisi.
5. Tinjau dan setujui paket kampanye sebelum menjadwalkan distribusi. Jadwal disimpan di aplikasi; menyimpan jadwal tidak otomatis mengirim konten.
6. Ekspor paket hasil kerja; gambar campaign yang sudah dibuat ikut dikemas sebagai data PNG base64 di dalam JSON. Jika webhook penerbitan sudah dikonfigurasi, pengiriman dilakukan melalui tindakan terpisah yang eksplisit.
7. Masukkan metrik aktual secara manual untuk meninjau performa. Aplikasi tidak mengambil statistik Instagram atau TikTok secara otomatis.

**Persetujuan manusia tetap diperlukan.** Tidak ada integrasi OAuth bawaan dengan Instagram atau TikTok, dan tidak ada proses latar belakang yang otomatis memublikasikan konten pada waktu terjadwal. Status pengiriman webhook menunjukkan hasil permintaan ke endpoint yang Anda konfigurasi, bukan verifikasi tayangnya konten di jejaring sosial.

## Demo, AI langsung, dan manual

- **Demo:** menghasilkan contoh kerja berbasis brief agar seluruh alur dapat dicoba tanpa biaya API. Contoh riset, perkiraan, dan KPI adalah bahan latihan, bukan data pasar yang telah diverifikasi.
- **AI langsung:** menggunakan OpenAI atau provider yang kompatibel dengan OpenAI Chat Completions dari server ketika kunci tersedia. Tinjau hasil, asumsi, hak penggunaan aset, dan klaim sebelum menyetujuinya. Model bahasa tidak otomatis mengakses analitik akun atau melakukan riset web.
- **Manual:** manager dapat menyunting isi hasil kerja. Perubahan tetap disimpan bersama kampanye.

Kantor 3D menampilkan karakter dan status pekerjaan. Gerakan karakter adalah animasi tampilan; gerakan itu sendiri bukan bukti bahwa model sedang menjalankan pekerjaan.

## Backend, API, dan skill agen

Buka **Backend & API → Koneksi API** untuk memilih OpenAI, OpenRouter, Groq, Ollama lokal, atau endpoint HTTPS kustom yang menyediakan `/chat/completions`. Isi URL dasar, model, dan kunci provider, lalu pilih **Simpan backend**. Perubahan langsung berlaku untuk pekerjaan berikutnya tanpa restart. Menyimpan tidak menjalankan model; **Uji koneksi tersimpan** mengirim satu permintaan chat kecil dan dapat memakai kuota provider. Preset provider membantu mengisi formulir; ketersediaan model mengikuti akun Anda.

Kunci baru disimpan menggunakan AES-256-GCM di direktori data server dengan izin berkas terbatas. Kunci tidak dikembalikan melalui API kantor atau ekspor. Kolom kunci kosong mempertahankan kunci pada endpoint yang sama; mengganti endpoint membuang kunci tersimpan provider lama. Kunci environment hanya digunakan untuk endpoint yang ditetapkan oleh environment. Checkbox nonaktifkan kunci juga menonaktifkan fallback environment untuk koneksi tersebut. Ollama lokal tidak memerlukan kunci; credential cloud tidak otomatis diteruskan ke loopback. Provider kustom memerlukan izin jaringan ke domainnya di pengaturan cloud; jika environment menyuntikkan secret dengan batas domain, masukkan kunci provider kustom melalui formulir backend.

Buka **Agen & skill** untuk membuat agen dengan nama, peran, divisi, arahan, potret dari atlas GPT Image yang tersedia, dan 1–6 skill. Skill berisi instruksi kerja yang dimasukkan ke prompt AI pada setiap tugas. Agen baru muncul dalam tim, kantor 3D, dan penugasan chat. Anda dapat membuat tugasnya di campaign aktif; semua campaign baru otomatis mencakup agen tambahan. Maksimal 8 agen per divisi dan 32 agen AI per kantor.

Pilih **Sunting skill** untuk memperbarui profil atau keahlian agen. Perubahan membatalkan persetujuan hasil terkait dan pekerjaan turunannya sehingga perlu dikerjakan atau ditinjau ulang. Pengaturan API dan penyuntingan agen ditolak selama pekerjaan sedang berjalan. Skill merupakan instruksi model; akses data, alat, atau layanan eksternal tetap memerlukan integrasi yang tersedia.

## Konfigurasi server

| Variabel | Fungsi | Bawaan |
| --- | --- | --- |
| `MARKETING_AI_KEY` | Kunci provider teks untuk endpoint environment | Kosong; mode demo tetap tersedia |
| `OPENAI_API_KEY` | Alternatif jika `MARKETING_AI_KEY` tidak diisi | Kosong |
| `MARKETING_AI_BASE_URL` | URL dasar API teks kompatibel OpenAI | `https://api.openai.com/v1` |
| `MARKETING_AI_MODEL` | Model teks | `gpt-4.1-mini` |
| `MARKETING_IMAGE_KEY` | Kunci OpenAI terpisah untuk pembuatan gambar kampanye | Menggunakan kunci teks hanya jika endpoint teks adalah OpenAI |
| `OFFICE_DATA_DIR` | Direktori SQLite, gambar, konfigurasi backend, dan kunci enkripsi lokal | `.data` |
| `OFFICE_ACCESS_TOKEN` | Token akses manager opsional | Kosong; tidak ada autentikasi aplikasi |
| `MARKETING_PUBLISH_URL` | Endpoint webhook penerbitan opsional | Kosong; ekspor lokal tersedia |
| `MARKETING_PUBLISH_TOKEN` | Token webhook penerbitan opsional | Kosong |

Semua kunci digunakan di server. Konfigurasi dari tab backend mengutamakan endpoint dan model tersimpan; environment menjadi nilai awal dan fallback kunci untuk endpoint environment. Perubahan `.env.local` memerlukan restart server. `OFFICE_ACCESS_TOKEN` merupakan akses bersama untuk satu kantor, bukan sistem akun dengan peran atau isolasi banyak organisasi. Isi token dan gunakan infrastruktur HTTPS yang sesuai sebelum membagikan akses server ke jaringan.

Data kampanye dan profil agen disimpan dengan SQLite di `.data` secara bawaan dan bertahan setelah browser atau server dimulai ulang. Pertahankan direktori data ketika melakukan deployment. Backup konfigurasi terenkripsi membutuhkan **backend.json dan backend.key** bersama-sama; kehilangan kunci enkripsi memerlukan memasukkan ulang API key. Lindungi seluruh direktori data karena kunci enkripsi lokal berada di dalamnya. Gunakan `OFFICE_DATA_DIR` berbeda untuk pengujian agar data kerja tetap terpisah.

## Pemeriksaan

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Pengujian browser memakai Playwright dengan Chromium sistem di `/usr/bin/chromium` dan rendering WebGL perangkat lunak. Ubah `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` jika Chromium berada di lokasi lain. Hentikan server pengembangan aktif sebelum menjalankan E2E karena Next.js memakai satu direktori build. Secara bawaan, pengujian memulai server terpisah pada port 3001, memakai direktori data baru di `/tmp`, dan menonaktifkan kredensial AI serta webhook untuk proses uji.

Gunakan `E2E_PORT` untuk memilih port lain atau `E2E_DATA_DIR` untuk menetapkan direktori uji. `E2E_BASE_URL` memungkinkan pengujian terhadap server yang sudah berjalan; pengujian akan membuat kampanye di server tersebut, sehingga gunakan instance uji. Pengujian browser tidak membuktikan koneksi provider AI langsung atau keberhasilan publikasi ke jejaring sosial.

Hasil pemeriksaan instance ini tercatat di [docs/VALIDATION.md](docs/VALIDATION.md).

## Sumber Claw3D

Integrasi menggunakan kode dan model nyata yang disalin secara selektif dari upstream Claw3D pada commit `0565b7892909eca7bbc8f2d9b0fad171dd75ad7c`: karakter voxel, pembangkit profil avatar, helper koordinat, dan furnitur. Aplikasi pemasaran, data lokal, dan alur persetujuan dikembangkan terpisah; ini bukan pemasangan penuh aplikasi upstream.

Daftar berkas dan adaptasi tercatat di [vendor/claw3d/README.md](vendor/claw3d/README.md). Lisensi MIT upstream dipertahankan di [vendor/claw3d/LICENSE](vendor/claw3d/LICENSE). Lisensi font berada bersama aset font di `public/office-assets/fonts/`.
