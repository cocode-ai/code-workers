Code AI Studio - Cloudflare Worker

Backend AI-powered code assistant untuk membangun, memperbaiki, dan deploy project Next.js dengan Cloudflare Workers.

🚀 Features

· AI Conversational Assistant - Chat dengan AI tentang programming
· Project Generation - Generate project Next.js lengkap dengan AI
· Code Fixing - Perbaiki error dan optimasi kode
· Live Preview - Preview project secara real-time
· Workspace Management - Simpan dan load project
· User Sessions - Management user dan project history

🛠 Tech Stack

· Cloudflare Workers - Edge runtime
· Cloudflare AI - Model AI (DeepSeek Coder, Llama)
· KV Namespace - Session & metadata storage
· R2 Storage - File & workspace storage
· Ionic Core 8 - Frontend framework

📁 Project Structure

```
code-ai-studio/
├── src/
│   └── worker.js          # Main worker handler
├── wrangler.toml         # Configuration
├── package.json          # Dependencies
└── README.md            # Documentation
```

⚙️ Setup & Deployment

1. Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

2. Clone & Setup

```bash
# Clone repository
git clone <repository-url>
cd code-ai-studio

# Install dependencies
npm install
```

3. Configuration

Edit wrangler.toml:

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

4. Create Resources

```bash
# Create KV namespace
wrangler kv:namespace create "CODE_AI_USERS"

# Create R2 bucket
wrangler r2 bucket create "code-ai-workspaces"
```

5. Deploy

```bash
# Deploy to Cloudflare
wrangler deploy
```

🎯 API Endpoints

Chat & AI

· POST /api/chat - Chat dengan AI assistant
· POST /api/generate-project - Generate project baru
· POST /api/fix-code - Perbaiki kode error

Project Management

· POST /api/save-workspace - Simpan workspace
· GET /api/load-workspace - Load workspace
· GET /api/user-projects - List project user

Preview System

· POST /api/create-preview - Buat live preview
· GET /api/preview-status - Status preview
· GET /api/list-previews - List semua preview

🔧 Environment Variables

Variable Description Required
AI Cloudflare AI binding ✅
CODE_AI_USERS KV namespace binding ✅
USER_WORKSPACES R2 bucket binding ✅

💡 Usage Examples

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

🎨 Frontend Integration

Frontend menggunakan Ionic Core 8. Contoh integration:

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@ionic/core@8/dist/ionic/ionic.esm.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@ionic/core@8/css/ionic.bundle.css" />
</head>
<body>
    <ion-app>
        <!-- Your Ionic components here -->
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

🔒 Security Features

· CORS Protection - Configured for web apps
· User Isolation - Data separation by user ID
· Input Validation - Request validation
· Rate Limiting Ready - Easy to implement limits

📊 AI Models Supported

· @cf/deepseek-ai/deepseek-coder-6.7b-instruct - Best for coding
· @cf/meta/llama-3.1-8b-instruct - General purpose
· @cf/mistral/mistral-7b-instruct-v0.1 - Alternative option

🚨 Error Handling

Worker includes comprehensive error handling:

```javascript
{
  "error": "Descriptive error message",
  "success": false,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

🔄 Development

```bash
# Local development
wrangler dev

# Debug mode
wrangler dev --debug

# View logs
wrangler tail
```

📈 Monitoring

Worker includes observability:

```toml
[observability]
enabled = true
```

View logs di Cloudflare Dashboard → Workers & Pages → Your Worker → Logs

🗂 Data Storage

KV Structure

```
user:123:profile → User data
projects:123:abc → Project metadata
logs:123:timestamp → Activity logs
```

R2 Structure

```
projects/abc123/project.json → Project files
workspace/user123/project456 → Workspace state
previews/preview123/ → Preview assets
```

💰 Pricing Considerations

· AI Inference: $0.00 - $1.50 per 1M tokens
· KV Operations: $0.50 per 1M operations
· R2 Storage: $0.015 per GB/month
· Worker Requests: $0.30 per million requests

🐛 Troubleshooting

Common Issues

1. Worker not found
   · Check wrangler.toml configuration
   · Verify file paths in project structure
2. AI model errors
   · Check model availability in your region
   · Verify AI binding in configuration
3. KV/R2 access denied
   · Check binding names in wrangler.toml
   · Verify namespace/bucket permissions

Debug Commands

```bash
# Check deployment status
wrangler whoami

# View production logs
wrangler tail

# Test locally
wrangler dev --local
```

📝 License

MIT License - feel free to use and modify.

🤝 Contributing

1. Fork the project
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

📞 Support

For issues and questions:

1. Check troubleshooting section
2. Review Cloudflare Workers documentation
3. Create issue in repository

---

Happy Coding! 🚀

Built with ❤️ using Cloudflare Workers & AI