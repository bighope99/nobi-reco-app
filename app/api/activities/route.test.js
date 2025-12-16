const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('module');
const ts = require('typescript');
const { NextRequest } = require('next/server');

const mockModules = {
  '@/utils/supabase/server': path.join(__dirname, '__mocks__', 'supabase-server.ts'),
  '@/lib/auth/session': path.join(__dirname, '__mocks__', 'session.ts'),
  '@langchain/openai': path.join(__dirname, '__mocks__', 'langchain-openai.ts'),
  '@langchain/core/prompts': path.join(__dirname, '__mocks__', 'langchain-prompts.ts'),
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (mockModules[request]) {
    return originalResolve(mockModules[request], parent, isMain, options);
  }
  if (request.startsWith('@/')) {
    const mapped = path.join(process.cwd(), request.slice(2));
    return originalResolve(mapped, parent, isMain, options);
  }
  return originalResolve(request, parent, isMain, options);
};

const originalTsHandler = Module._extensions['.ts'];
Module._extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      resolveJsonModule: true,
      allowJs: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { resetSupabaseMock, getSupabaseState } = require('./__mocks__/supabase-server.ts');
const { resetUserSession } = require('./__mocks__/session.ts');

function loadRoute() {
  delete require.cache[require.resolve('./route.ts')];
  return require('./route.ts');
}

beforeEach(() => {
  resetSupabaseMock();
  resetUserSession();
});

test('returns 400 when required fields are missing', async () => {
  const { POST } = loadRoute();
  const request = new NextRequest('http://localhost/api/activities', {
    method: 'POST',
    body: JSON.stringify({ class_id: 'class-1' }),
  });

  const response = await POST(request);
  const json = await response.json();

  assert.equal(response.status, 400);
  assert.equal(json.success, false);
  assert.match(json.error, /Bad Request/);
});

test('saves draft activity with photos and mentions', async () => {
  const { POST } = loadRoute();
  const payload = {
    activity_date: '2025-01-15',
    class_id: 'class-1',
    title: '雪遊び',
    content: '今日は@たなか はると くんが雪遊びを楽しみました。',
    snack: 'クッキー',
    photos: [{ url: 'https://example.com/photo1.jpg', caption: '外遊び' }],
    mentions: [
      {
        child_id: 'child-1',
        name: 'たなか はると',
        position: { start: 3, end: 10 },
      },
    ],
    is_draft: true,
  };

  const request = new NextRequest('http://localhost/api/activities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const response = await POST(request);
  const json = await response.json();
  const state = getSupabaseState();

  assert.equal(response.status, 200);
  assert.equal(json.data.is_draft, true);
  assert.equal(json.data.photos.length, 1);
  assert.equal(json.data.mentions.length, 1);
  assert.deepEqual(state.activityInsert.photos, payload.photos);
  assert.deepEqual(state.activityInsert.mentions, payload.mentions);
});

test('saves confirmed activity without photos or mentions', async () => {
  const { POST } = loadRoute();
  const payload = {
    activity_date: '2025-02-01',
    class_id: 'class-2',
    content: '散歩に行きました。',
  };

  const request = new NextRequest('http://localhost/api/activities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const response = await POST(request);
  const json = await response.json();
  const state = getSupabaseState();

  assert.equal(response.status, 200);
  assert.equal(json.data.is_draft, false);
  assert.deepEqual(json.data.photos, []);
  assert.deepEqual(json.data.mentions, []);
  assert.equal(state.activityInsert.is_draft, false);
});
