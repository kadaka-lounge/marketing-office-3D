#Marketing Office 3D

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

Jika layanan Ollama belum aktif, jalankan `ollama serve` di terminal lain. Aplikasi tidak mengunduh model baru. Gunakan nama persis yang muncul pada `ollama list`; nilai awal mengikuti permintaan Anda, `qwen2.5:3b`, dan bisa diubah apabila nama yang terpasang berbeda.

```sh
git clone https://github.com/kadaka-lounge/marketing-office-3D.git
cd marketing-office-3D
npm ci
npm run dev:local
```

Buka browser laptop pada port **3000** di localhost. Preset **Backend & API → Koneksi API → Ollama (lokal)** memakai `http://127.0.0.1:11434/v1` dan tidak memerlukan API key. Pilih **Simpan backend**, lalu **Uji koneksi tersimpan**. Alamat root Ollama, `/api/chat`, dan URL lengkap `/v1/chat/completions` otomatis dinormalkan ke URL dasar `/v1`, termasuk konfigurasi lama. Jika pesan menunjukkan model tidak ditemukan (HTTP 404), periksa `ollama list`; bila model belum tersedia, jalankan `ollama pull qwen2.5:3b` di laptop. Pilih mode AI langsung untuk menjalankan agen dengan model lokal. Jika Anda sudah menyimpan provider lain sebelumnya, pilih dan simpan Ollama agar konfigurasi tersimpan diperbarui; launcher tidak menghapus pengaturan lama.

Untuk produksi di laptop:

```sh
npm run build
npm run start:local
```

`dev:local` dan `start:local` bekerja melalui launcher Node di Windows, macOS, dan Linux. Untuk nama model atau endpoint berbeda, isi `.env.local`:

```dotenv
LOCAL_LLM_MODEL=qwen2.5:3b
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
```

Launcher membaca `.env.local`, mempertahankan data kantor, dan tidak meneruskan kunci teks provider cloud ke Ollama. Endpoint HTTP diperbolehkan hanya untuk loopback (`localhost`, `127.0.0.1`, `[::1]`); provider di jaringan lain tetap membutuhkan HTTPS. Perangkat harus memiliki RAM/VRAM yang cukup untuk model yang Anda pilih. Pemuatan awal atau inferensi lokal dapat menunggu hingga 5 menit per permintaan. Skill, chat, tugas, review, dan ekspor memakai alur yang sama. Pembuatan visual memakai provider terpisah pada tab **Model Gambar**: GPT Image, Google Imagen, Hugging Face FLUX.1, atau Qwen Image GGUF. Ollama tetap digunakan untuk pekerjaan teks.

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
- **AI langsung:** menggunakan backend utama yang kompatibel dengan OpenAI Chat Completions, atau Claude/Gemini/OpenAI sesuai pengaturan API per divisi dari server ketika kunci tersedia. Tinjau hasil, asumsi, hak penggunaan aset, dan klaim sebelum menyetujuinya. Model bahasa tidak otomatis mengakses analitik akun atau melakukan riset web.
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
| `MARKETING_IMAGE_KEY` | Kunci OpenAI terpisah untuk pembuatan gambar kampanye | Profil OpenAI desain aktif, lalu kunci backend utama jika endpoint-nya OpenAI |
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

## API per divisi

Buka **Backend & API → API per divisi** untuk memasukkan kunci secara privat:

| Koneksi | Agen dan pekerjaan | Model bawaan |
| --- | --- | --- |
| Claude / Anthropic | Atlas, Nova, dan agen tambahan Data Analyst | `claude-sonnet-4-6` |
| Gemini / Google | Luna dan agen tambahan Graphic Design, untuk brief dan arahan visual | `gemini-2.5-flash` |
| OpenAI API / ChatGPT | Pixel; semua agen desain jika Gemini dinonaktifkan; GPT Image | `gpt-4.1-mini` |
| Meta Graph | Publisher: uji identitas akun Instagram/Facebook melalui token Facebook Login | Bukan model LLM |

Digital Marketing dan pekerjaan teks Publisher tetap memakai backend utama, termasuk Ollama `qwen2.5:3b`. Provider divisi yang dinonaktifkan kembali ke backend utama (desain memakai OpenAI jika masih aktif). Provider aktif tanpa kunci memblokir tugas tersebut; kunci provider lain tidak dipakai sebagai pengganti. Model dapat diganti dengan ID yang tersedia pada akun API Anda. Langganan aplikasi ChatGPT/Claude/Gemini tidak otomatis menyediakan akses API berbayar.

Kunci disimpan terpisah dengan enkripsi AES-256-GCM pada server. Input kosong mempertahankan kunci; **Hapus kunci** menghapus nilai tersimpan dan menonaktifkan fallback environment. Menonaktifkan provider mempertahankan kuncinya untuk penggunaan berikutnya. Endpoint provider divisi tetap agar kredensial tidak diteruskan ke host kustom. Simpan seluruh `OFFICE_DATA_DIR`, termasuk `backend.key`, secara privat dan persisten.

Alternatif environment: `CLAUDE_API_KEY`, `GEMINI_API_KEY`, `DESIGN_OPENAI_KEY`, dan `META_GRAPH_TOKEN`. Kunci environment mengaktifkan koneksi jika belum ada pengaturan tersimpan yang menonaktifkannya. Jangan gunakan awalan `NEXT_PUBLIC_`. Untuk GPT Image, prioritas kunci adalah `MARKETING_IMAGE_KEY`, lalu profil OpenAI aktif, lalu kunci backend utama jika endpoint-nya OpenAI.

**Uji koneksi tersimpan** mengirim permintaan teks kecil pada API model (dapat dikenai biaya). Uji Meta hanya membaca `GET /v23.0/me?fields=id,name` dengan header Bearer; keberhasilan menunjukkan identitas token, bukan kelengkapan izin publishing atau koneksi akun Instagram tertentu. Token Instagram Login yang hanya berlaku di `graph.instagram.com` tidak didukung koneksi ini. Publikasi tetap melalui ekspor manual atau webhook Publisher dengan tindakan eksplisit Marketing Manager. Menyimpan token, menguji koneksi, menyetujui hasil, atau menjadwalkan konten tidak memublikasikan apa pun. TikTok dapat dikonfigurasi melalui tab Publisher TikTok.

Server membutuhkan akses HTTPS ke `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.openai.com`, dan `graph.facebook.com` untuk koneksi terkait. Tambahkan domain tersebut pada allowlist environment jika diperlukan; laptop membutuhkan akses internet untuk provider cloud. Pengujian otomatis memakai respons API tiruan untuk memverifikasi format native, routing, dan pemisahan kunci; akses akun/model sebenarnya harus diuji dengan kunci Anda melalui pengaturan aplikasi.

## Publisher TikTok

Buka **Backend & API → Publisher TikTok**, aktifkan koneksi, isi **user access token OAuth** dengan scope `video.publish`, lalu simpan. Kunci aplikasi (`client_key`) atau `client_secret` saja tidak dapat digunakan untuk publish. Alternatif environment: `TIKTOK_ACCESS_TOKEN`. Token disimpan terenkripsi dengan mekanisme yang sama seperti kunci provider; kolom kosong mempertahankannya dan **Hapus token** menonaktifkan fallback environment. Fitur ini tidak menyimpan client secret/refresh token atau memperbarui access token secara otomatis.

**Uji token & akun** membaca `creator_info/query` dan menampilkan akun tujuan, privasi yang tersedia, serta batas durasi video. Ini tidak mengirim video. Aplikasi TikTok harus memiliki Content Posting API dan izin `video.publish`; aplikasi yang belum diaudit TikTok dapat dibatasi ke posting privat. Dapatkan token melalui alur OAuth aplikasi Anda di [TikTok for Developers](https://developers.tiktok.com/).

Untuk mengirim, setujui seluruh hasil kampanye, buat jadwal TikTok, lalu buka **Hasil pekerjaan**. Saat jadwal tiba, muat informasi akun pada formulir TikTok, masukkan URL video final dan caption, pilih privasi secara eksplisit, atur interaksi/promosi komersial, dan berikan persetujuan manager sebelum menekan **Kirim video ke TikTok**. Video harus berada di URL HTTPS pada domain/prefix yang diverifikasi di aplikasi TikTok (`PULL_FROM_URL`). Server kantor hanya mengirim URL kepada TikTok; tidak mengunduh video atau membuat file video dari naskah AI.

Pengiriman melalui `video/init` dicatat sebagai **Diproses TikTok**. Klik **Periksa status TikTok** untuk membaca `status/fetch`; status menjadi terkirim hanya setelah `PUBLISH_COMPLETE`. Batas komentar/Duet/Stitch pada akun tetap diterapkan oleh server. Persetujuan hasil, penyimpanan token, dan jadwal tidak memicu pengiriman otomatis. Pengiriman webhook dan TikTok langsung tidak dapat dipakai bersamaan pada entri yang sudah dikirim.

Jika koneksi terputus setelah pengiriman dimulai, catatan tetap dipertahankan dan pengiriman ulang diblokir untuk menghindari duplikat. Jika ID belum diterima, periksa akun TikTok terlebih dahulu; buat jadwal baru hanya setelah memastikan status kiriman sebelumnya. Penolakan yang dikonfirmasi TikTok dapat dicoba kembali setelah masalah akses/konfigurasi diperbaiki. Riwayat pengiriman TikTok dipertahankan ketika hasil kerja direvisi.

Izinkan `open.tiktokapis.com` pada jaringan server. Token asli dan publikasi ke akun nyata tidak digunakan dalam pengujian otomatis; pengujian memakai respons TikTok tiruan dan tidak memublikasikan konten.

## Pembaruan keamanan dependensi

Next.js dan konfigurasi ESLint diperbarui ke `16.4.0`, React/React DOM ke `19.2.8` (kompatibel dengan React Three Fiber), serta Vitest ke `4.1.11`. Sharp dipatok pada `0.35.5`; lockfile mengunci PostCSS yang sudah diperbaiki.

Rantai dev dependency `fast-glob → micromatch → braces` memiliki advisory tanpa rilis braces yang diperbaiki. Override **khusus `@next/eslint-plugin-next`** mengganti fast-glob dengan `tinyglobby@0.2.17`. Plugin Next hanya memakai API `globSync` untuk pencarian root direktori; tinyglobby menyediakan API tersebut. Pengujian menggunakan resolver root direktori Next yang sebenarnya (termasuk pola glob/brace dan filter direktori) dan aturan Next untuk tautan halaman internal diuji langsung melalui ESLint. Aturan lint Next tetap diaktifkan. Override ini menghapus rantai rentan, bukan menonaktifkan audit.

Verifikasi instalasi menggunakan `npm ci`, lalu `npm run audit`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, dan `npm run build`. Audit npm saat pembaruan ini melaporkan **0 kerentanan**, termasuk dependency development. Angka ini merupakan hasil database advisory npm saat pengujian, bukan jaminan terhadap advisory baru. GitHub Dependabot dapat memerlukan waktu untuk menghitung ulang alert setelah push.

Data runtime (`.data`, termasuk kunci enkripsi) dan berkas `.env` dikecualikan dari output file tracing Next.js. Data kantor tetap harus disediakan sebagai penyimpanan privat terpisah pada server deployment.

### Model pembuat gambar

Buka **Backend & API → Model Gambar**, pilih provider, isi kunci/token, tentukan model dan rasio, lalu simpan. Pilihan aktif digunakan oleh **Buat visual** pada hasil Graphic Design. Kunci tiap provider terenkripsi dan disimpan terpisah dari provider teks; mengganti provider mempertahankan kunci provider lainnya. Kolom kosong mempertahankan kunci, sedangkan **Hapus kunci** juga menonaktifkan fallback environment untuk provider tersebut. Provider yang gagal tidak otomatis diganti oleh provider lain.

| Provider | Model preset | Kunci environment opsional |
| --- | --- | --- |
| OpenAI | `gpt-image-1` | `MARKETING_IMAGE_KEY`, model `MARKETING_IMAGE_MODEL` |
| Google AI Studio / Gemini API | `imagen-3.0-generate-002` | `GOOGLE_IMAGEN_KEY`, model `GOOGLE_IMAGEN_MODEL` |
| Hugging Face Inference Providers | `black-forest-labs/FLUX.1-schnell`, `black-forest-labs/FLUX.1-dev` | `HF_IMAGE_TOKEN`, model `HF_IMAGE_MODEL` |

Google memakai endpoint native `https://generativelanguage.googleapis.com/v1beta/models/{model}:predict` dengan header `x-goog-api-key`. Akses Imagen 3 bergantung pada model yang masih tersedia, project, billing, dan kuota akun; jika ditolak/404, pilih model Imagen yang tersedia di Google AI Studio. Preset `imagen-4.0-generate-001` juga tersedia. Kunci Gemini teks tidak otomatis dipakai untuk gambar.

Hugging Face memakai SDK resmi `@huggingface/inference` dengan pemilihan provider `auto` dan endpoint `router.huggingface.co`, bukan endpoint lama `api-inference.huggingface.co`. Gunakan token `hf_` dengan izin Inference Providers, kredit, dan akses model/lisensi bila diperlukan. Model FLUX.1-dev dapat memerlukan persetujuan akses. Unduhan hasil URL memakai HTTPS tanpa token, tanpa redirect, dan dibatasi ke domain/subdomain `fal.media`, `replicate.delivery`, `huggingface.co`, atau `hf.co`; provider dengan CDN lain perlu dukungan tambahan. Allowlist jaringan server perlu mengizinkan domain tersebut serta `huggingface.co`, `router.huggingface.co`, dan `generativelanguage.googleapis.com`.

Hasil PNG/JPEG/WebP divalidasi dan disimpan sebagai PNG pada rasio 1:1, 4:5, 9:16, atau 16:9. Rasio 4:5 menggunakan rasio native Imagen 3:4 lalu crop. Cover TikTok berupa gambar statis. Kegagalan generasi mempertahankan aset sebelumnya; gambar baru membatalkan persetujuan hasil terkait agar Marketing Manager meninjaunya lagi. **Uji gambar tersimpan** benar-benar membuat satu gambar dan dapat memakai kuota berbayar, tanpa menambahkan aset ke kampanye. Tes otomatis memakai respons provider tiruan; akses model dan kunci akun perlu diuji melalui tombol ini setelah dikonfigurasi.

### Generate Video melalui Hugging Face

Buka **Backend & API → Model Video**, isi token Hugging Face `hf_` dengan izin Inference Providers dan kredit, pilih preset Wan, tentukan rasio, lalu simpan. Token video terenkripsi dan terpisah dari FLUX.1 maupun token Publisher. Environment opsional: `HF_VIDEO_TOKEN` dan `HF_VIDEO_MODEL`. Kolom kosong mempertahankan token; **Hapus token** juga menonaktifkan fallback environment. Preset default `Wan-AI/Wan2.2-T2V-A14B`, alternatif `Wan-AI/Wan2.1-T2V-14B`, menggunakan model Wan dengan bobot terbuka.

Aplikasi membaca pemetaan model terbaru dari Hugging Face dan memakai layanan **fal-ai melalui Hugging Face Inference Providers** untuk text-to-video. Ketersediaan layanan tidak dijamin hanya karena model tersedia di Hub. Preset yang tidak memiliki pemetaan live menghasilkan pesan untuk memilih model lain. Endpoint lama `api-inference.huggingface.co` tidak digunakan. Token hanya dikirim ke `huggingface.co` dan `router.huggingface.co`; antrean/result dipoll melalui HF router, bukan host URL job yang dikembalikan. Aset diunduh tanpa token, tanpa redirect, dari domain/subdomain `fal.media`, `huggingface.co`, atau `hf.co`. Tambahkan domain tersebut pada allowlist jaringan bila diperlukan.

**Periksa token & model** memeriksa identitas token dan pemetaan model tanpa membuat video berbayar. Izin inferensi, billing, dan kuota baru dipastikan saat generasi. Buka hasil desain, lalu **Buat video** untuk mengirim brief dan arahan desain. Permintaan meminta 720p dan rasio 16:9, 9:16, atau 1:1; rasio, durasi, codec, dan resolusi akhir mengikuti kemampuan provider. Tidak ada upscaling/crop video lokal. Generasi memakai kredit provider dan bisa menunggu hingga 8 menit. Jika koneksi berakhir, job provider mungkin tetap berjalan; periksa akun sebelum mengulangi agar tidak mengirim job berbayar ganda. Refresh saat generasi dapat menghentikan tampilan tunggu; periksa kembali hasil campaign setelah operasi selesai.

MP4 maksimal 64 MiB divalidasi sebagai container lengkap dengan track video, metadata dimensi, dan durasi maksimal 120 detik, lalu disimpan privat. Tidak perlu memasang FFmpeg untuk menjalankan aplikasi. Hasil dapat dipreview, diunduh, dan masuk dalam paket ekspor bersama gambar. Aset hanya dapat diakses melalui referensi artifact, mengikuti access token kantor, dan mendukung byte-range untuk seek. Generasi baru membatalkan approval terkait; kegagalan mempertahankan aset sebelumnya. Perubahan arahan desain menghapus referensi video lama. Marketing Manager tetap mengendalikan review dan publikasi. URL localhost bukan URL video domain terverifikasi TikTok; unggah MP4 hasil ekspor ke hosting terverifikasi sebelum memakai Publisher TikTok. Tes otomatis memakai response antrean dan fixture MP4, tanpa generasi video langsung atau publikasi.

### Qwen-Image-2.1-Uncensored-GGUF

Pada **Backend & API → Model Gambar**, pilih **Qwen Image GGUF · Server lokal**, isi endpoint server gambar dan nama/alias model, lalu simpan. Preset nama `Qwen-Image-2.1-Uncensored-GGUF` dapat diganti sesuai model yang dimuat oleh runtime. Aplikasi tidak mengunduh model, memuat GGUF, atau memastikan kompatibilitas varian community model tersebut. GGUF adalah format bobot, bukan layanan Hugging Face Inference Providers; server gambar perlu dijalankan terpisah dengan diffusion model, text encoder, VAE, dan versi runtime yang cocok.

Integrasi ini memakai API kompatibel OpenAI **POST `/v1/images/generations`**, seperti compatibility API [stable-diffusion.cpp sd-server](https://github.com/leejet/stable-diffusion.cpp/blob/master/examples/server/api.md). Default endpoint `http://127.0.0.1:1234/v1` mengikuti port default sd-server, dan dapat diganti. Anda juga dapat menempel URL penuh `/v1/images/generations`; aplikasi menormalkannya ke base URL. ComfyUI native `/prompt` memerlukan adapter/workflow dan tidak dapat langsung digunakan pada field ini. Ollama untuk teks tidak menyediakan endpoint gambar tersebut. Memilih nama model di kantor tidak mengganti file yang telah dimuat pada sd-server.

Jalankan kantor dan server model pada laptop yang sama agar `127.0.0.1` mengarah ke runtime laptop; pada kantor cloud, loopback mengarah ke mesin cloud. Server loopback HTTP/HTTPS dapat digunakan tanpa kunci; endpoint nonlokal harus HTTPS dan membutuhkan kunci khusus. Kunci provider cloud lain tidak dipakai untuk Qwen. Mengganti endpoint menghapus penggunaan kunci endpoint lama. Pengaturan environment opsional: `QWEN_IMAGE_BASE_URL`, `QWEN_IMAGE_MODEL`, `QWEN_IMAGE_KEY`; kunci melalui tab disimpan terenkripsi.

Payload berisi `model`, `prompt`, `n:1`, `size`, `response_format:b64_json`, dan `output_format:png`. Server harus mengembalikan `data[0].b64_json`. Rasio output, validasi PNG/JPEG/WebP, penyimpanan PNG, ekspor, dan review manager mengikuti alur gambar yang sama. **Uji gambar tersimpan** benar-benar menjalankan generasi dengan konfigurasi aktif; dapat menunggu hingga 10 menit saat model lokal dimuat. Status **Endpoint disetel** tidak menjamin runtime aktif atau model sudah dimuat. Tes otomatis memakai server loopback tiruan; file model ini belum dimuat atau diuji langsung pada laptop pengguna.

### ComfyUI untuk Qwen GGUF dan LTX 2.5 lokal

Pada **Backend & API → Model Gambar**, pilih **ComfyUI · Qwen GGUF**. Pada **Model Video**, pilih **ComfyUI · LTX 2.5**, dengan preset label `ltx25_uncensored_v1.1-fp8`. Endpoint default `http://127.0.0.1:8188` memakai API native ComfyUI. Jalankan kantor dan ComfyUI di laptop yang sama. HTTP hanya diperbolehkan untuk loopback; HTTPS nonlokal membutuhkan API key khusus. Kunci gambar/video terpisah, tidak memakai token HF atau OpenAI. Mengganti provider mempertahankan profil lain, termasuk Wan. Mengganti endpoint menghapus key dan workflow lama kecuali Anda memasukkan ulang workflow/key untuk endpoint baru.

Jika belum punya workflow, unduh template canvas lewat tab pengaturan atau lihat [panduan template](public/comfyui-workflows/README.md). Template resmi Qwen Image 2.1 dan LTX 2.5 disertakan dengan lisensi MIT serta commit sumber; template tersebut memakai model standar, bukan konfigurasi GGUF/uncensored yang sudah siap. Buka di ComfyUI terbaru, pilih loader dan file model sesuai model card varian komunitas Anda, beserta encoder/VAE yang cocok, lalu uji di ComfyUI. Model GGUF memerlukan custom loader yang mendukung arsitekturnya. Model LTX FP8 dapat berupa checkpoint lengkap atau diffusion component; keduanya membutuhkan loader berbeda. Kantor tidak mengunduh bobot atau memasang custom node. Sumber model yang tepat diperlukan untuk memastikan pipeline community model tersebut.

Aktifkan opsi developer/API di ComfyUI bila perlu, lalu **Export (API)**. Unggah/tempel JSON API maksimal 60 KB pada tab kantor. Format canvas `nodes/links` tidak diterima langsung. Isi **ID node prompt**, **nama input prompt**, dan **ID node penyimpan hasil** sesuai ekspor API. Node ID subgraph seperti `459:452` didukung. Input prompt biasanya `text` pada CLIPTextEncode, atau `prompt` pada TextEncodeQwenImage21. Hanya input ini diganti dengan brief; nama model kantor hanya label. File model, VAE, encoder, resolusi, durasi, sampler, seed dan audio mengikuti workflow. Rasio gambar akhir mengikuti crop kantor; rasio/durasi video mengikuti workflow. Untuk video, simpan output MP4 melalui SaveVideo atau VHS Video Combine. Preview sementara, WebM, atau GIF tidak diterima sebagai video MP4.

Workflow disimpan terenkripsi; respons konfigurasi hanya berisi status dan ID binding, tanpa JSON workflow/secret. Kolom kosong mempertahankan workflow; **Hapus workflow** menonaktifkan kesiapan generasi. Sebelum generasi aplikasi mengecek `/object_info`, custom node yang diperlukan, pilihan file/enum, dan node output. Pemeriksaan ini belum menjamin kecukupan VRAM atau kompatibilitas arsitektur model. Tombol pemeriksaan video mengecek `/system_stats` dan `/object_info` tanpa membuat job; tombol uji gambar benar-benar membuat gambar dengan konfigurasi aktif.

Generasi mengirim `/prompt` dengan graph salinan dan brief, mempoll `/history/{prompt_id}`, lalu mengambil filename dari node output terpilih melalui `/view` pada server yang sama. Tidak ada fetch URL aset arbitrer. Maksimal waktu tunggu 12 menit; job mungkin tetap berjalan setelah koneksi putus, jadi periksa ComfyUI sebelum mengulangi. PNG/JPEG/WebP dan MP4 tetap divalidasi sebelum disimpan. Metadata user MP4 (udta/meta/uuid) dari ComfyUI dibersihkan tanpa mengubah offset media agar workflow/key yang mungkin ditanamkan oleh node video tidak terbawa ke ekspor. Aset baru memerlukan review manager, hasil gagal mempertahankan aset lama, dan ekspor/publikasi mengikuti kontrol yang sudah ada. Tes otomatis menggunakan server ComfyUI tiruan dan fixture media; model komunitas belum dijalankan pada laptop pengguna.

Sumber model resmi yang dipilih: [Qwen/Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1) dan [Lightricks/LTX-2.5](https://huggingface.co/Lightricks/LTX-2.5). Kedua label resmi tersedia sebagai preset tambahan. Nama `Qwen-Image-2.1-Uncensored-GGUF` dan `ltx25_uncensored_v1.1-fp8` tetap tersedia sebagai label varian lokal; tautan model resmi belum menentukan file quantization/varian uncensored atau loader-nya. Gunakan model card file yang benar-benar Anda unduh untuk memilih loader dan companion weights.
