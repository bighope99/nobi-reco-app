import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import ts from 'typescript';

const projectRoot = process.cwd();

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const basePath = path.join(projectRoot, specifier.slice(2));
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.js`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.js'),
    ];
    const existingPath = candidates.find(candidate => fs.existsSync(candidate));
    if (existingPath) {
      const resolvedPath = pathToFileURL(existingPath).href;
      return { url: resolvedPath, shortCircuit: true };
    }
  }
  if (specifier === 'next/server') {
    const serverPath = pathToFileURL(path.join(projectRoot, 'node_modules/next/server.js')).href;
    return { url: serverPath, shortCircuit: true };
  }
  if (specifier === 'next/headers') {
    const headersPath = pathToFileURL(path.join(projectRoot, 'node_modules/next/headers.js')).href;
    return { url: headersPath, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith('.ts')) {
    const source = await fsPromises.readFile(fileURLToPath(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
      },
      fileName: url,
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return next(url, context);
}
