// src/worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle preview routes
    if (path.startsWith('/preview/')) {
      return handleVirtualPreview(request, env, ctx);
    }

    // CORS handling
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Route handlers
    const routes = {
      '/api/chat': handleChat,
      '/api/generate-project': handleGenerateProject,
      '/api/fix-code': handleFixCode,
      '/api/save-workspace': handleSaveWorkspace,
      '/api/load-workspace': handleLoadWorkspace,
      '/api/user-projects': handleUserProjects,
      '/api/deploy-preview': handleDeployPreview
  '/api/create-preview': handleCreatePreview,
  '/api/preview-status': handlePreviewStatus,
  '/api/deploy-preview': handleDeployPreview,
  '/api/list-previews': handleListPreviews
    };

    const handler = routes[path];
    if (handler) {
      return handler(request, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  }
};

function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
    }
  });
}

// Helper untuk response konsisten
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  });
}

// System prompt untuk AI programming assistant
const SYSTEM_PROMPTS = {
  codeAssistant: `Anda adalah AI programming assistant expert dengan spesialisasi:
- Next.js 14+ (App Router, Server Components, Streaming)
- React 18+ dengan best practices
- TypeScript dan modern JavaScript
- Tailwind CSS dan styling
- Database (Prisma, Drizzle, PostgreSQL)
- Authentication (NextAuth, Clerk)
- Deployment (Vercel, Cloudflare Pages)

Format respons:
1. Berikan kode yang clean dan terstruktur
2. Jelaskan implementasinya
3. Sertakan best practices
4. Untuk project, berikan struktur lengkap
5. Gunakan TypeScript ketika diminta

Prioritas: Performance, security, dan maintainability.`,

  nextjsExpert: `Anda adalah Next.js 14+ specialist. Fokus pada:
- App Router bukan Pages Router
- Server Components vs Client Components
- Streaming, Suspense, dan loading states
- Optimized images dan performance
- SEO dan metadata
- API Routes dan server actions
- Middleware dan routing

Berikan kode yang mengikuti latest Next.js patterns.`
};

async function handleChat(request, env) {
  try {
    const { message, context = [], userId, projectType = 'nextjs' } = await request.json();
    
    if (!userId) {
      return jsonResponse({ error: 'User ID required' }, 400);
    }

    const systemPrompt = projectType === 'nextjs' ? SYSTEM_PROMPTS.nextjsExpert : SYSTEM_PROMPTS.codeAssistant;

    const messages = [
      { role: "system", content: systemPrompt },
      ...context.slice(-6), // Keep last 6 messages for context
      { role: "user", content: message }
    ];

    // Log interaction untuk analytics
    await logUserInteraction(env, userId, 'chat', { projectType, messageLength: message.length });

    const response = await env.AI.run('@cf/deepseek-ai/deepseek-coder-6.7b-instruct', {
      messages,
      max_tokens: 4000,
      temperature: 0.7
    });

    return jsonResponse({
      response: response.response,
      usage: response.usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleGenerateProject(request, env) {
  try {
    const { userId, framework = 'nextjs', requirements, features, projectName } = await request.json();
    
    if (!userId || !requirements) {
      return jsonResponse({ error: 'User ID and requirements are required' }, 400);
    }

    const projectPrompt = `
Buatkan project ${framework} dengan spesifikasi:

NAMA PROJECT: ${projectName || 'Untitled Project'}
REQUIREMENTS: ${requirements}
FEATURES: ${features}

Berikan struktur project lengkap dalam format JSON:

{
  "project": {
    "name": "project-name",
    "framework": "${framework}",
    "structure": [
      {
        "path": "relative/file/path",
        "type": "file|folder",
        "content": "file content jika type=file",
        "language": "javascript|typescript|jsx|tsx|css|json etc"
      }
    ],
    "dependencies": {
      "package.json": {
        "dependencies": { ... },
        "devDependencies": { ... },
        "scripts": { ... }
      }
    },
    "setupInstructions": "langkah-langkah setup dan run",
    "deployment": "instruksi deployment"
  }
}

Gunakan best practices untuk ${framework} dan pastikan kode modern dan efisien.
    `;

    const response = await env.AI.run('@cf/deepseek-ai/deepseek-coder-6.7b-instruct', {
      messages: [{ role: "user", content: projectPrompt }],
      max_tokens: 6000
    });

    let projectData;
    try {
      // Extract JSON dari response AI
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        projectData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback parsing
      projectData = await parseProjectStructure(response.response, framework);
    }

    // Simpan project ke KV dan R2
    const projectId = generateProjectId();
    const projectMetadata = {
      id: projectId,
      userId,
      name: projectName || 'New Project',
      framework,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileCount: projectData.structure?.length || 0
    };

    // Save metadata to KV
    await saveProjectMetadata(env, userId, projectId, projectMetadata);
    
    // Save project files to R2
    await saveProjectToR2(env, projectId, projectData);

    await logUserInteraction(env, userId, 'generate_project', { 
      framework, 
      projectId,
      fileCount: projectMetadata.fileCount 
    });

    return jsonResponse({
      projectId,
      metadata: projectMetadata,
      project: projectData,
      rawResponse: response.response
    });

  } catch (error) {
    console.error('Generate project error:', error);
    return jsonResponse({ error: 'Failed to generate project' }, 500);
  }
}

async function handleFixCode(request, env) {
  try {
    const { userId, code, error, fileName, requirements } = await request.json();

    const fixPrompt = `
PERBAIKI KODE: ${fileName || 'unknown file'}

ERROR/DESKRIPSI: ${error}

KODE SAAT INI:
\`\`\`
${code}
\`\`\`

REQUIREMENTS: ${requirements}

Tugas:
1. Analisis dan identifikasi masalah
2. Berikan kode yang diperbaiki
3. Jelaskan root cause
4. Berikan prevention tips

Format response JSON:
{
  "fixedCode": "kode yang sudah diperbaiki",
  "explanation": "penjelasan detail perbaikan",
  "rootCause": "penyebab error",
  "prevention": "cara menghindari error serupa",
  "changesMade": ["list perubahan yang dilakukan"]
}
    `;

    const response = await env.AI.run('@cf/deepseek-ai/deepseek-coder-6.7b-instruct', {
      messages: [{ role: "user", content: fixPrompt }],
      max_tokens: 4000
    });

    let fixResult;
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      fixResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { fixedCode: response.response };
    } catch {
      fixResult = await parseFixResponse(response.response);
    }

    await logUserInteraction(env, userId, 'fix_code', { 
      fileName,
      errorLength: error?.length 
    });

    return jsonResponse({
      ...fixResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fix code error:', error);
    return jsonResponse({ error: 'Failed to fix code' }, 500);
  }
}

async function handleSaveWorkspace(request, env) {
  try {
    const { userId, projectId, files, currentFile, cursorPosition } = await request.json();
    
    const workspaceData = {
      userId,
      projectId,
      files,
      currentFile,
      cursorPosition,
      lastSaved: new Date().toISOString()
    };

    // Save to R2
    await env.USER_WORKSPACES.put(`workspace/${userId}/${projectId}`, JSON.stringify(workspaceData));

    return jsonResponse({ 
      success: true, 
      savedAt: workspaceData.lastSaved 
    });

  } catch (error) {
    return jsonResponse({ error: 'Failed to save workspace' }, 500);
  }
}

async function handleLoadWorkspace(request, env) {
  try {
    const url = new URL(request.url);
    const userId = request.headers.get('X-User-ID') || url.searchParams.get('userId');
    const projectId = url.searchParams.get('projectId');

    if (!userId || !projectId) {
      return jsonResponse({ error: 'User ID and Project ID required' }, 400);
    }

    const workspace = await env.USER_WORKSPACES.get(`workspace/${userId}/${projectId}`, 'json');
    
    if (!workspace) {
      return jsonResponse({ error: 'Workspace not found' }, 404);
    }

    return jsonResponse(workspace);

  } catch (error) {
    return jsonResponse({ error: 'Failed to load workspace' }, 500);
  }
}

async function handleUserProjects(request, env) {
  try {
    const url = new URL(request.url);
    const userId = request.headers.get('X-User-ID') || url.searchParams.get('userId');

    if (!userId) {
      return jsonResponse({ error: 'User ID required' }, 400);
    }

    // Get project list from KV
    const projects = await getUserProjects(env, userId);

    return jsonResponse({ projects });

  } catch (error) {
    return jsonResponse({ error: 'Failed to get projects' }, 500);
  }
}

// Helper Functions
async function logUserInteraction(env, userId, action, metadata = {}) {
  try {
    const logKey = `logs:${userId}:${Date.now()}`;
    const logData = {
      userId,
      action,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    await env.CODE_AI_USERS.put(logKey, JSON.stringify(logData), {
      expirationTtl: 60 * 60 * 24 * 30 // 30 days retention
    });
  } catch (error) {
    console.error('Logging error:', error);
  }
}

async function saveProjectMetadata(env, userId, projectId, metadata) {
  const key = `projects:${userId}:${projectId}`;
  await env.CODE_AI_USERS.put(key, JSON.stringify(metadata));
}

async function saveProjectToR2(env, projectId, projectData) {
  const key = `projects/${projectId}/project.json`;
  await env.USER_WORKSPACES.put(key, JSON.stringify(projectData));
}

async function getUserProjects(env, userId) {
  const list = await env.CODE_AI_USERS.list({ prefix: `projects:${userId}:` });
  const projects = [];

  for (const key of list.keys) {
    const project = await env.CODE_AI_USERS.get(key.name, 'json');
    if (project) {
      projects.push(project);
    }
  }

  return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function generateProjectId() {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Fallback parsers untuk AI response
async function parseProjectStructure(rawResponse, framework) {
  const structure = [];
  const fileRegex = /(?:```|`)(\w+)?\s*\n([\s\S]*?)(?:```|`)/g;
  let match;
  let fileIndex = 1;

  while ((match = fileRegex.exec(rawResponse)) !== null) {
    const language = match[1] || 'txt';
    const content = match[2].trim();
    
    let filename = `file${fileIndex}`;
    let extension = getExtensionFromLanguage(language);
    
    // Common file detection
    if (content.includes('package.json')) {
      filename = 'package.json';
      extension = 'json';
    } else if (content.includes('import React') || content.includes('export default')) {
      filename = `component${fileIndex}`;
      extension = framework === 'nextjs' ? 'tsx' : 'jsx';
    }

    structure.push({
      path: `${filename}.${extension}`,
      type: 'file',
      content: content,
      language: language
    });

    fileIndex++;
  }

  return {
    project: {
      name: 'Generated Project',
      framework,
      structure,
      setupInstructions: 'Extracted from AI response',
      dependencies: {}
    }
  };
}
// Preview functionality
async function handleCreatePreview(request, env) {
  try {
    const { userId, projectId, branch = 'main' } = await request.json();
    
    if (!userId || !projectId) {
      return jsonResponse({ error: 'User ID and Project ID required' }, 400);
    }

    // Get project data from R2
    const projectData = await env.USER_WORKSPACES.get(`projects/${projectId}/project.json`, 'json');
    if (!projectData) {
      return jsonResponse({ error: 'Project not found' }, 404);
    }

    // Create preview deployment
    const previewResult = await createCloudflarePagesPreview(env, userId, projectId, projectData);
    
    // Save preview metadata
    await savePreviewMetadata(env, userId, projectId, previewResult);

    return jsonResponse({
      previewId: previewResult.id,
      url: previewResult.url,
      status: 'building',
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create preview error:', error);
    return jsonResponse({ error: 'Failed to create preview' }, 500);
  }
}

async function createCloudflarePagesPreview(env, userId, projectId, projectData) {
  // Generate unique preview ID
  const previewId = `preview_${projectId}_${Date.now()}`;
  
  // Upload project files to R2 for Pages to access
  await uploadProjectToPreviewBucket(env, previewId, projectData);
  
  // Simulate deployment process
  // In real implementation, you'd use Cloudflare Pages API
  const previewUrl = `https://${previewId}.code-ai-studio.pages.dev`;
  
  return {
    id: previewId,
    url: previewUrl,
    status: 'deploying'
  };
}

async function uploadProjectToPreviewBucket(env, previewId, projectData) {
  const files = projectData.project?.structure || [];
  
  for (const file of files) {
    if (file.type === 'file') {
      await env.USER_WORKSPACES.put(
        `previews/${previewId}/${file.path}`, 
        file.content
      );
    }
  }
  
  // Create special configuration files for Pages
  const config = {
    build: {
      command: 'npm run build',
      publish: '/dist'
    },
    environment: {
      NODE_VERSION: '18'
    }
  };
  
  await env.USER_WORKSPACES.put(
    `previews/${previewId}/_config.json`,
    JSON.stringify(config)
  );
}

// Virtual preview system - no deployment needed
async function handleDeployPreview(request, env) {
  try {
    const { userId, projectId, files } = await request.json();
    
    // Create virtual preview session
    const previewSession = await createVirtualPreview(env, userId, projectId, files);
    
    return jsonResponse({
      sessionId: previewSession.id,
      previewUrl: `/preview/${previewSession.id}`,
      expiresAt: previewSession.expiresAt
    });
    
  } catch (error) {
    return jsonResponse({ error: 'Preview deployment failed' }, 500);
  }
}

// Virtual preview handler
async function handleVirtualPreview(request, env, ctx) {
  const url = new URL(request.url);
  const sessionId = url.pathname.split('/preview/')[1];
  
  if (!sessionId) {
    return new Response('Preview not found', { status: 404 });
  }
  
  // Get preview data
  const previewData = await env.USER_WORKSPACES.get(`previews/${sessionId}`, 'json');
  if (!previewData) {
    return new Response('Preview expired or not found', { status: 404 });
  }
  
  // Serve the preview HTML
  const html = generatePreviewHTML(previewData);
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}

function generatePreviewHTML(previewData) {
  const { files, project } = previewData;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Preview - ${project.name}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .preview-container {
            width: 100%;
            height: 100vh;
            border: none;
        }
        .preview-header {
            background: #f5f5f5;
            padding: 10px;
            border-bottom: 1px solid #ddd;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="preview-header">
        🔄 Live Preview - ${project.name} | Built with Code AI Studio
    </div>
    <iframe 
        class="preview-container" 
        id="preview-frame"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        src="about:blank"
    ></iframe>
    
    <script>
        // Inject project files into iframe
        const frame = document.getElementById('preview-frame');
        const projectFiles = ${JSON.stringify(files)};
        
        frame.onload = function() {
            const frameDoc = frame.contentDocument || frame.contentWindow.document;
            
            // Find and execute main entry point
            const htmlFile = projectFiles.find(f => f.path.endsWith('.html'));
            const jsFiles = projectFiles.filter(f => f.path.endsWith('.js'));
            const cssFiles = projectFiles.filter(f => f.path.endsWith('.css'));
            
            if (htmlFile) {
                frameDoc.write(htmlFile.content);
            } else {
                // Generate basic HTML structure
                frameDoc.write('<html><head><title>Preview</title></head><body><div id="root"></div></body></html>');
            }
            
            // Inject CSS
            cssFiles.forEach(cssFile => {
                const style = frameDoc.createElement('style');
                style.textContent = cssFile.content;
                frameDoc.head.appendChild(style);
            });
            
            // Inject and execute JS
            jsFiles.forEach(jsFile => {
                const script = frameDoc.createElement('script');
                script.textContent = jsFile.content;
                frameDoc.body.appendChild(script);
            });
        };
        
        // Load initial empty document
        frame.contentWindow.document.open();
        frame.contentWindow.document.close();
    </script>
</body>
</html>
  `;
}

async function parseFixResponse(rawResponse) {
  const codeMatch = rawResponse.match(/(?:```|`)(?:\w+)?\s*\n([\s\S]*?)(?:```|`)/);
  
  return {
    fixedCode: codeMatch ? codeMatch[1].trim() : rawResponse,
    explanation: 'Kode telah diperbaiki oleh AI assistant',
    changesMade: ['Auto-fixed by AI'],
    rootCause: 'Analyzed by AI',
    prevention: 'Follow best practices and testing'
  };
}

function getExtensionFromLanguage(lang) {
  const extensions = {
    javascript: 'js',
    typescript: 'ts',
    jsx: 'jsx',
    tsx: 'tsx',
    css: 'css',
    html: 'html',
    json: 'json',
    python: 'py'
  };
  
  return extensions[lang] || 'txt';
}

// Specialized Next.js preview
async function handleNextJSPreview(request, env) {
  const { userId, projectId, entryFile = 'app/page.tsx' } = await request.json();
  
  const project = await env.USER_WORKSPACES.get(`projects/${projectId}/project.json`, 'json');
  const files = project.project.structure;
  
  // Generate Next.js specific preview
  const previewHTML = generateNextJSPreviewHTML(files, entryFile);
  
  const previewId = `nextjs_${projectId}_${Date.now()}`;
  await env.USER_WORKSPACES.put(
    `previews/${previewId}`,
    JSON.stringify({
      type: 'nextjs',
      files,
      entryFile,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    })
  );
  
  return jsonResponse({
    previewId,
    previewUrl: `${new URL(request.url).origin}/preview/${previewId}`,
    type: 'nextjs',
    expiresIn: '24 hours'
  });
}

function generateNextJSPreviewHTML(files, entryFile) {
  const reactContent = files.find(f => f.path === entryFile)?.content || 'export default function Page() { return <div>Hello World</div> }';
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Next.js Preview</title>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .preview-container { padding: 20px; }
    </style>
</head>
<body>
    <div id="root"></div>
    
    <script type="text/babel">
        ${extractComponents(files)}
        
        ${reactContent}
        
        // Render the component
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Page));
    </script>
</body>
</html>
  `;
}

async function handlePreviewStatus(request, env) {
  const url = new URL(request.url);
  const previewId = url.searchParams.get('previewId');
  
  if (!previewId) {
    return jsonResponse({ error: 'Preview ID required' }, 400);
  }
  
  const previewData = await env.USER_WORKSPACES.get(`previews/${previewId}`, 'json');
  
  if (!previewData) {
    return jsonResponse({ error: 'Preview not found' }, 404);
  }
  
  return jsonResponse({
    previewId,
    status: 'active',
    url: `${new URL(request.url).origin}/preview/${previewId}`,
    createdAt: previewData.createdAt,
    expiresAt: previewData.expiresAt
  });
}

async function handleListPreviews(request, env) {
  const userId = request.headers.get('X-User-ID');
  
  if (!userId) {
    return jsonResponse({ error: 'User ID required' }, 400);
  }
  
  // List all previews for user
  const list = await env.USER_WORKSPACES.list({ prefix: `user-previews/${userId}/` });
  const previews = [];
  
  for (const key of list.keys) {
    const preview = await env.USER_WORKSPACES.get(key.name, 'json');
    if (preview) {
      previews.push(preview);
    }
  }
  
  return jsonResponse({ previews });
}

// Helper functions
async function savePreviewMetadata(env, userId, projectId, previewData) {
  const key = `user-previews/${userId}/${previewData.id}`;
  await env.USER_WORKSPACES.put(key, JSON.stringify({
    ...previewData,
    userId,
    projectId,
    createdAt: new Date().toISOString()
  }));
}

function extractComponents(files) {
  let components = '';
  files.forEach(file => {
    if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
      components += file.content + '\n\n';
    }
  });
  return components;
}