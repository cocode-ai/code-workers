# Code AI Studio — Cloudflare Worker

Backend AI-powered code assistant untuk membangun, memperbaiki, dan deploy project Next.js menggunakan Cloudflare Workers.

## Ringkasan
Code AI Studio menyediakan:
- Asisten percakapan AI untuk bantuan programming.
- Generator project Next.js lengkap.
- Fitur perbaikan dan optimasi kode.
- Live preview project.
- Manajemen workspace dan sesi pengguna.

## Fitur Utama
- AI Conversational Assistant — Chat dengan AI tentang programming
- Project Generation — Generate project Next.js otomatis
- Code Fixing — Diagnosa dan perbaikan bug/format
- Live Preview — Preview project secara real-time
- Workspace Management — Simpan dan muat workspace dari R2
- User Sessions — Riwayat sesi & project per user

## Tech Stack
- Cloudflare Workers (edge runtime)
- Cloudflare AI bindings (DeepSeek Coder, Llama, dll.)
- KV Namespace — session & metadata storage
- R2 Storage — file & workspace storage
- Frontend — Ionic Core 8 (opsional)

## Struktur Project (contoh)
```
code-ai-studio/
├── src/
│   └── worker.js          # Main worker handler
├── wrangler.toml          # Konfigurasi deployment
├── package.json           # Dependencies & scripts
└── README.md              # Dokumentasi
```

## Prerequisites
- Node.js & npm
- Wrangler CLI
- Akun Cloudflare dengan akses Workers, KV, R2, dan AI bindings (jika diperlukan)

Instal Wrangler:
```bash
npm install -g wrangler
wrangler login
```

## Clone & Setup
```bash
git clone <repository-url>
cd code-ai-studio
npm install
```

## Konfigurasi (wrangler.toml)
Contoh entri penting di wrangler.toml:
```toml
name = "code-ai-studio"
main = "src/worker.js"
compatibility_date = "2025-01-01"

[ai]
binding = "AI"

[[kv_namespaces]]
binding = "CODE_AI_USERS"
id = "your-kv-namespace-id"

[[r2_buckets]]
binding = "USER_WORKSPACES"
bucket_name = "code-ai-workspaces"
```

## Membuat Resource Cloudflare
```bash
# Buat KV namespace
wrangler kv:namespace create "CODE_AI_USERS"

# Buat R2 bucket
wrangler r2 bucket create "code-ai-workspaces"
```

## Deploy
```bash
wrangler deploy
```

## API Endpoints (ringkasan)
Chat & AI:
- POST /api/chat — Chat dengan AI assistant
- POST /api/generate-project — Generate project baru
- POST /api/fix-code — Meminta perbaikan kode

Manajemen Project:
- POST /api/save-workspace — Simpan workspace ke R2
- GET /api/load-workspace — Muat workspace dari R2
- GET /api/user-projects — Daftar project milik user

Preview:
- POST /api/create-preview — Buat live preview
- GET /api/preview-status — Cek status preview
- GET /api/list-previews — List semua preview

Catatan: Semua endpoint di atas mengharuskan header atau body berisi identifier user (mis. X-User-ID).

## Environment Variables / Bindings
- AI — Cloudflare AI binding (required)
- CODE_AI_USERS — KV namespace binding (required)
- USER_WORKSPACES — R2 bucket binding (required)

Pastikan nama binding sama dengan yang ada di wrangler.toml.

## Contoh Penggunaan

1. Chat dengan AI
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': 'user123'
  },
  body: JSON.stringify({
    message: "Buatkan component React untuk form login",
    projectType: "nextjs"
  })
});
```

2. Generate Project
```javascript
const response = await fetch('/api/generate-project', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': 'user123'
  },
  body: JSON.stringify({
    framework: "nextjs",
    projectName: "My E-commerce",
    requirements: "Build modern e-commerce site",
    features: "Shopping cart, user auth, payment"
  })
});
```

3. Fix Code
```javascript
const response = await fetch('/api/fix-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': 'user123'
  },
  body: JSON.stringify({
    code: "export function Component() { return <div>Hello }",
    error: "JSX syntax error",
    fileName: "Component.jsx"
  })
});
```

## Integrasi Frontend (Ionic Core 8 — contoh)
```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@ionic/core@8/dist/ionic/ionic.esm.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@ionic/core@8/css/ionic.bundle.css" />
</head>
<body>
  <ion-app>
    <!-- Ionic components -->
  </ion-app>

  <script>
    const API_BASE = 'https://your-worker.your-subdomain.workers.dev/api';

    async function sendMessage() {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello AI!' })
      });
      return await response.json();
    }
  </script>
</body>
</html>
```

## Security & Best Practices
- CORS: konfigurasikan origin yang diizinkan.
- User Isolation: simpan data per user ID untuk memisahkan workspace.
- Input Validation: validasi semua request sebelum memproses.
- Rate Limiting: pertimbangkan rate limiting untuk memproteksi endpoint AI dan storage.

## Model AI yang Didukung (opsional)
- @cf/deepseek-ai/deepseek-r1-distill-qwen-32b — coding-focused
- @cf/meta/llama-3.1-8b-instruct — general purpose
- @cf/mistral/mistral-7b-instruct-v0.1 — alternatif
- @cf/google/gemma-3-12b-it — alternatif

## Error Response (format)
Contoh respons error standar:
```json
{
  "error": "Descriptive error message",
  "success": false,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Development
- Local dev:
  ```bash
  wrangler dev
  ```
- Debug:
  ```bash
  wrangler dev --debug
  ```
- Tail logs:
  ```bash
  wrangler tail
  ```

## Observability / Monitoring
Contoh konfigurasi observability di wrangler.toml:
```toml
[observability]
enabled = true
```
Lihat logs melalui Cloudflare Dashboard → Workers & Pages → Your Worker → Logs

## Penyimpanan Data (struktur & contoh)
KV:
- user:123:profile → User data
- projects:123:abc → Project metadata
- logs:123:timestamp → Activity logs

R2:
- projects/abc123/project.json → Project files
- workspace/user123/project456 → Workspace state
- previews/preview123/ → Preview assets

## Perkiraan Biaya (indikatif)
- AI Inference: $0.00 - $1.50 per 1M tokens
- KV Operations: $0.50 per 1M operations
- R2 Storage: $0.015 per GB/month
- Worker Requests: $0.30 per million requests

## Troubleshooting (umum)
1. Worker tidak ditemukan
   - Periksa wrangler.toml dan path file
2. Error model AI
   - Periksa ketersediaan model & binding AI
3. KV/R2 access denied
   - Periksa nama binding dan izin

Debug commands:
```bash
wrangler whoami
wrangler tail
wrangler dev --local
```

## Contributing
1. Fork repository
2. Buat branch fitur (feature/*)
3. Commit perubahan
4. Push branch dan buat Pull Request

## License
MIT License — bebas dipakai dan dimodifikasi.

## Support
- Baca bagian troubleshooting
- Dokumentasi Cloudflare Workers & AI
- Buat issue di repository jika menemukan bug atau ingin request fitur

---

Happy coding! 🚀
Built with ❤️ using Cloudflare Workers & AI
