# API kantor

API berjalan pada server Next.js yang sama dengan antarmuka. Seluruh operasi menggunakan satu kantor lokal dan satu penyimpanan SQLite. Ini bukan API multi-tenant.

## Akses

Jika `OFFICE_ACCESS_TOKEN` tidak diisi, API tersedia tanpa login aplikasi. Jika token dikonfigurasi, masuk melalui antarmuka atau kirim `POST /api/session` dengan JSON `{ "token": "<token manager>" }`. Server membuat cookie sesi `HttpOnly` dengan `SameSite=Strict`; sertakan cookie pada permintaan berikutnya. Jangan menaruh token pada URL atau di kode klien.

## Endpoint

| Metode | Rute | Fungsi |
| --- | --- | --- |
| `GET` | `/api/office` | Mengambil `{ state, config }`; konfigurasi hanya berisi status fitur, provider, endpoint, model, dan sumber kunci, tanpa nilai kunci |
| `POST` | `/api/office/action` | Menjalankan tindakan kantor yang divalidasi dan mengembalikan `{ state, config }` |
| `GET` | `/api/office/export?campaignId=<id>` | Mengunduh paket kampanye dalam JSON |
| `GET` | `/api/office/assets/<name>` | Mengambil gambar kampanye yang dihasilkan; akses mengikuti autentikasi kantor |
| `POST` | `/api/office/backend/test` | Menguji koneksi chat tersimpan dengan satu permintaan kecil; tidak menyimpan hasil kerja |
| `POST` | `/api/session` | Memulai sesi manager dengan token yang dikonfigurasi |

## Tindakan kantor

Kirim JSON dengan `Content-Type: application/json` ke `/api/office/action`. Bentuk lengkap dan tipe respons tersedia di [`src/lib/office/types.ts`](../src/lib/office/types.ts); validasi runtime berada di [`src/lib/office/server/validation.ts`](../src/lib/office/server/validation.ts).

| `type` | Data tambahan | Efek |
| --- | --- | --- |
| `createCampaign` | `brief` | Membuat kampanye, delapan tugas awal, dan tugas setiap agen tambahan |
| `saveBackend` | `backend` | Menyimpan endpoint, model, dan kunci terenkripsi untuk pekerjaan berikutnya |
| `addAgent` | `agent`, opsional `campaignId` | Menambah agen dengan skill dan opsional tugas di campaign aktif |
| `updateAgent` | `agentId`, `agent` | Mengubah profil/skill; membatalkan persetujuan hasil terkait |
| `sendMessage` | `content`, `channel`, opsional `campaignId`, `assignTo` | Menyimpan pesan; penugasan agen membuat tugas |
| `runCampaign` | `campaignId`, `mode` | Menjalankan tugas kampanye sesuai dependensi |
| `runTask` | `taskId`, `mode` | Menjalankan satu tugas |
| `approveArtifact` | `artifactId` | Persetujuan manager terhadap hasil kerja |
| `requestRevision` | `artifactId`, `feedback` | Meminta revisi; pekerjaan turunan perlu ditinjau kembali |
| `editArtifact` | `artifactId`, `content` | Menyimpan perubahan manual pada hasil kerja |
| `schedule` | `campaignId`, `scheduledAt`, `channels` | Menyimpan jadwal lokal setelah persetujuan |
| `publish` | `publicationId` | Mengirim publikasi yang telah disetujui ke webhook yang dikonfigurasi |
| `importMetrics` | `campaignId`, `metrics` | Menyimpan metrik yang diberikan manager |
| `generateImage` | `artifactId` | Membuat gambar kampanye melalui OpenAI jika tersedia |

`mode` bernilai `demo` atau `live`. Mode live memerlukan kunci server untuk provider cloud; LLM loopback tidak memerlukan kunci. Nilai `channel` percakapan adalah `general`, `manager`, `marketing`, `design`, `analytics`, atau `publisher`; kanal distribusi adalah `Instagram`, `TikTok`, `LinkedIn`, atau `Website / Blog`.

Contoh brief tanpa rahasia:

```json
{
  "type": "createCampaign",
  "brief": {
    "name": "Kopi Sore Kadaka",
    "product": "Menu kopi sore Kadaka Lounge",
    "audience": "Profesional muda yang mencari tempat bertemu teman",
    "objective": "Mengumpulkan minat kunjungan untuk menu baru",
    "channels": ["Instagram", "TikTok"],
    "budget": "Rp3.000.000, masih berupa usulan",
    "deadline": "2026-11-01"
  }
}
```

`scheduledAt` memakai tanggal ISO 8601 dengan zona waktu. Baris metrik memiliki `channel`, `impressions`, `clicks`, `conversions`, dan `spend`; nilai harus nonnegatif, dengan `conversions ≤ clicks ≤ impressions`. Angka yang diimpor tidak diverifikasi terhadap platform sosial.

## Backend dan agen

`backend` berisi `baseUrl` (URL dasar HTTPS atau HTTP loopback localhost/127.0.0.1/[::1], tanpa kredensial/query/fragment), `model`, opsional `apiKey`, dan opsional `clearKey`. Ollama lokal memakai URL `/v1`, nama model yang terpasang, dan tidak membutuhkan API key. `config.aiLocal` menunjukkan koneksi loopback; `aiConfigured` menandakan konfigurasi tersedia, bukan hasil uji koneksi. Uji model lokal menyediakan hingga 512 token dan menunggu hingga 5 menit agar pemuatan model dan respons reasoning bisa diperiksa. Kunci kosong mempertahankan kunci tersimpan hanya pada endpoint yang sama. Endpoint berbeda tidak menerima kunci tersimpan provider lama; fallback environment hanya berlaku untuk endpoint environment. `clearKey: true` menonaktifkan kunci tersimpan dan fallback. Tidak ada respons yang memuat nilai kunci. Endpoint uji mengembalikan `{ ok: true, model, checkedAt }` setelah mendapat respons chat nonkosong, tanpa mengembalikan isi respons provider.

`agent` berisi `name`, `role`, `division` (`marketing`, `design`, `analytics`, `publisher`), `avatarIndex` (1–8), `instructions` (boleh kosong), dan `skills` (1–6 objek `{ name, instructions }` dengan nama unik). Batas kantor adalah 32 agen AI dan 8 per divisi. Manager manusia tidak bisa diubah melalui tindakan agen. Skill dimasukkan ke prompt model; skill tidak menyediakan konektor atau eksekusi kode baru.

Contoh menambah agen tanpa secret:

```json
{
  "type": "addAgent",
  "agent": {
    "name": "Sora",
    "role": "SEO Specialist",
    "division": "marketing",
    "avatarIndex": 2,
    "instructions": "Laporkan asumsi kepada Marketing Manager.",
    "skills": [{
      "name": "SEO Content Strategy",
      "instructions": "Susun keyword intent dan outline. Jangan mengarang volume pencarian."
    }]
  }
}
```

Pengaturan backend dan penyuntingan agen menghasilkan HTTP 409 selama pekerjaan sedang berjalan. Permintaan POST juga mengikuti pemeriksaan origin dan autentikasi manager yang sama dengan tindakan kantor.

## Webhook penerbitan

`MARKETING_PUBLISH_URL` adalah endpoint integrasi Anda sendiri. Aplikasi mengirim paket kampanye yang disetujui ketika manager memilih tindakan kirim; tidak ada pengiriman otomatis saat menyetujui atau menjadwalkan. `MARKETING_PUBLISH_TOKEN` wajib diisi ketika webhook digunakan; seluruh integrasi webhook bersifat opsional.

ID publikasi dikirim dalam header `Idempotency-Key`. Integrasi penerima perlu menghormati kunci tersebut agar pengulangan permintaan tidak membuat publikasi ganda. Aplikasi mengharapkan respons HTTP 2xx dengan JSON yang memuat `"status": "published"` sebelum menandai pengiriman sebagai berhasil. Respons tersebut adalah pengakuan integrasi, bukan pemeriksaan independen terhadap Instagram atau TikTok.

## Batas perilaku

Permintaan yang tidak valid ditolak. Kunci API tidak dikembalikan melalui konfigurasi. Pekerjaan yang gagal tidak menjadi hasil yang disetujui. Perubahan hasil kerja dapat membatalkan persetujuan pekerjaan yang bergantung padanya; tinjau kembali hasil turunan sebelum publikasi.

Ekspor merupakan unduhan lokal dan tidak mengirim konten ke pihak lain. Uji penyedia AI, gambar, dan webhook hanya dengan kredensial serta endpoint yang memang dimaksudkan untuk pengujian; tes browser bawaan memakai mode demo dan menonaktifkan integrasi eksternal.
