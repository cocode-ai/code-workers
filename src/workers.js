// src/worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

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