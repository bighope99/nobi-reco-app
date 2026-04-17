import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { z } from 'zod';
import type { Group } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const CLAUDE_CODE_EXEC = (() => {
  const result = spawnSync('which', ['claude'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  return resolve(PROJECT_ROOT, 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js');
})();

function readSkill(name: string): string {
  try {
    return readFileSync(resolve(PROJECT_ROOT, `.claude/skills/${name}/SKILL.md`), 'utf8');
  } catch {
    process.stderr.write(`Warning: skill file not found: .claude/skills/${name}/SKILL.md\n`);
    return '';
  }
}

function collectAssistantText(event: SDKAssistantMessage): string {
  return event.message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n');
}

async function collectText(opts: Parameters<typeof query>[0]): Promise<string> {
  const parts: string[] = [];
  for await (const event of query(opts)) {
    if (event.type === 'assistant') {
      parts.push(collectAssistantText(event as SDKAssistantMessage));
    }
  }
  return parts.join('\n');
}

function buildTicketContext(group: Group): string {
  return group.tickets
    .map((t) => [
      `### ${t.name}`,
      `- URL: ${t.url}`,
      `- Path: ${t.path}`,
      `- Tracker: ${t.tracker}`,
      `- Priority: ${t.priority}`,
      t.content ? `\n**Description:**\n${t.content}` : '',
      t.comments.length > 0
        ? `\n**Comments:**\n${t.comments.map((c) => `[${c.author}] ${c.text}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n'))
    .join('\n\n');
}

function makeEscalateTool(ask: (q: string) => Promise<string>) {
  const escalateTool = tool(
    'escalate_to_user',
    'Ask the human operator a question when you need clarification or approval before proceeding.',
    { question: z.string() },
    async ({ question }: { question: string }) => {
      const answer = await ask(question);
      return { content: [{ type: 'text' as const, text: answer }] };
    }
  );
  return { escalateTool, mcpServer: createSdkMcpServer({ name: 'orchestrator', tools: [escalateTool] }) };
}

const DESTRUCTIVE_GUARD = async (name: string, input: Record<string, unknown>) => {
  if (name === 'Bash') {
    const cmd = String(input['command'] ?? '');
    // 連続スペースを正規化してからチェック（バイパス防止）
    const normalized = cmd.replace(/\s+/g, ' ');
    const DENIED = [
      /rm\s+-[a-zA-Z]*r[a-zA-Z]*f/,   // rm -rf, rm -fr, rm -Rf 等
      /rm\s+--recursive/,
      /git\s+reset\s+--hard/,
      /git\s+push\s+(--force|-f)(\s|$)/, // --force と -f 両方
      /git\s+push\s+\S+\s+--force/,
    ];
    if (DENIED.some((p) => p.test(normalized))) {
      return { behavior: 'deny' as const, message: 'Destructive git/rm commands are not allowed.' };
    }
  }
  return { behavior: 'allow' as const };
};

async function runReviewAgent(aspect: string, focus: string, diff: string, worktreePath: string, projectRules: string): Promise<string> {
  return collectText({
    prompt: `You are a ${aspect} code reviewer for a Next.js 15 + Supabase SaaS project.

Focus specifically on: ${focus}

${projectRules}

## Git diff to review:
\`\`\`diff
${diff}
\`\`\`

Use Read/Grep/Glob tools to look at more file context if needed.

Report format (concise, include file:line references):
### [${aspect.toUpperCase()} REVIEW]
🔴 Critical (must fix before merge): ...
🟡 Important (recommended): ...
🔵 Suggestion (optional): ...
✅ Good: ...

Write "none" for any category with no findings.`,
    options: {
      tools: ['Read', 'Grep', 'Glob'],
      permissionMode: 'plan',
      cwd: worktreePath,
      pathToClaudeCodeExecutable: CLAUDE_CODE_EXEC,
    },
  });
}

export const runImplementation = {
  async plan({ group, worktreePath }: { group: Group; worktreePath: string }): Promise<string> {
    const ticketContext = buildTicketContext(group);

    return collectText({
      prompt: `You are a senior developer. Read the existing codebase and create a detailed implementation plan for the following tickets.

Branch: ${group.branch}
Working directory: ${worktreePath}

## Tickets to implement:
${ticketContext}

Read relevant files using Read, Grep, and Glob tools. Then produce a numbered step-by-step plan covering:
1. Files to create or modify
2. Logic changes needed
3. Tests to add or update
4. Any edge cases to handle

Be specific about file paths and function names.`,
      options: {
        tools: ['Read', 'Grep', 'Glob'],
        permissionMode: 'plan',
        cwd: worktreePath,
        pathToClaudeCodeExecutable: CLAUDE_CODE_EXEC,
      },
    });
  },

  async implement({
    group,
    worktreePath,
    plan,
    ask,
  }: {
    group: Group;
    worktreePath: string;
    plan: string;
    ask: (q: string) => Promise<string>;
  }): Promise<void> {
    const ticketContext = buildTicketContext(group);
    const { mcpServer } = makeEscalateTool(ask);

    const systemPrompt = `You are a senior full-stack developer implementing Notion tickets in a Next.js 15 project.

Working directory: ${worktreePath}
Branch: ${group.branch}

## Tickets:
${ticketContext}

## Implementation Plan:
${plan}

## Instructions:
1. Implement all tickets following the plan above
2. Follow existing code patterns and TypeScript conventions
3. Run tests if applicable
4. Commit all changes with a meaningful commit message
5. Output exactly: IMPLEMENTATION_DONE when finished
6. Do NOT create a PR — implementation and commit only
7. Use escalate_to_user if you need human input at any point

IMPORTANT: Never run \`rm -rf\`, \`git reset --hard\`, or \`git push --force\`.`;

    let implementationDone = false;

    for await (const event of query({
      prompt: 'Implement the tickets and commit the changes as described in your system prompt. Do not create a PR.',
      options: {
        systemPrompt,
        tools: { type: 'preset', preset: 'claude_code' },
        permissionMode: 'bypassPermissions',
        cwd: worktreePath,
        pathToClaudeCodeExecutable: CLAUDE_CODE_EXEC,
        allowedTools: ['mcp__orchestrator__escalate_to_user'],
        mcpServers: { orchestrator: mcpServer },
        canUseTool: DESTRUCTIVE_GUARD,
      },
    })) {
      if (event.type === 'assistant') {
        const text = collectAssistantText(event as SDKAssistantMessage);
        if (text.includes('IMPLEMENTATION_DONE')) implementationDone = true;
      }
    }

    if (!implementationDone) {
      const logResult = spawnSync('git', ['log', '--oneline', 'origin/main..HEAD'], {
        encoding: 'utf8', cwd: worktreePath, stdio: 'pipe',
      });
      const hasCommits = logResult.status === 0 && logResult.stdout.trim().length > 0;
      if (hasCommits) {
        process.stderr.write('警告: IMPLEMENTATION_DONE が出力されませんでしたが、新しいコミットが検出されました。続行します。\n');
      } else {
        throw new Error('実装エージェントが IMPLEMENTATION_DONE を出力せず、新しいコミットも見つかりませんでした。コミットを確認してから再実行してください。');
      }
    }
  },

  async fix({
    worktreePath,
    reviewResult,
    ask,
  }: {
    worktreePath: string;
    reviewResult: string;
    ask: (q: string) => Promise<string>;
  }): Promise<void> {
    const { mcpServer } = makeEscalateTool(ask);

    const systemPrompt = `You are a senior full-stack developer fixing code review findings in a Next.js 15 project.

Working directory: ${worktreePath}

## Review findings to fix:
${reviewResult}

## Instructions:
1. Fix all 🔴 Critical issues (required before merge)
2. Fix 🟡 Important issues where reasonable
3. Follow existing code patterns and TypeScript conventions
4. Commit all fixes with a meaningful commit message (e.g. "fix: address review findings")
5. Output exactly: IMPLEMENTATION_DONE when finished
6. Do NOT create a PR
7. Use escalate_to_user if you need human input

IMPORTANT: Never run \`rm -rf\`, \`git reset --hard\`, or \`git push --force\`.`;

    let done = false;

    for await (const event of query({
      prompt: 'Fix the review findings and commit as described in your system prompt.',
      options: {
        systemPrompt,
        tools: { type: 'preset', preset: 'claude_code' },
        permissionMode: 'bypassPermissions',
        cwd: worktreePath,
        pathToClaudeCodeExecutable: CLAUDE_CODE_EXEC,
        allowedTools: ['mcp__orchestrator__escalate_to_user'],
        mcpServers: { orchestrator: mcpServer },
        canUseTool: DESTRUCTIVE_GUARD,
      },
    })) {
      if (event.type === 'assistant') {
        const text = collectAssistantText(event as SDKAssistantMessage);
        if (text.includes('IMPLEMENTATION_DONE')) done = true;
      }
    }

    if (!done) {
      const logResult = spawnSync('git', ['log', '--oneline', 'origin/main..HEAD'], {
        encoding: 'utf8', cwd: worktreePath, stdio: 'pipe',
      });
      const hasCommits = logResult.status === 0 && logResult.stdout.trim().length > 0;
      if (!hasCommits) {
        process.stderr.write('警告: 修正エージェントが IMPLEMENTATION_DONE を出力せず、新しいコミットも見つかりませんでした。\n');
      }
    }
  },

  async review({ worktreePath }: { worktreePath: string }): Promise<string> {
    const diffResult = spawnSync('git', ['diff', 'main...HEAD'], {
      encoding: 'utf8', cwd: worktreePath, stdio: 'pipe',
    });
    if (diffResult.status !== 0) {
      throw new Error(`git diff failed:\n${diffResult.stderr}`);
    }
    const diff = diffResult.stdout || '(no diff)';

    const changedFilesResult = spawnSync('git', ['diff', 'main...HEAD', '--name-only'], {
      encoding: 'utf8', cwd: worktreePath, stdio: 'pipe',
    });
    const changedFiles = changedFilesResult.stdout || '';

    const projectRules = readSkill('pr-review');

    // Always-run agents (mirrors pr-review SKILL.md Step 2)
    const agents: { aspect: string; focus: string }[] = [
      { aspect: 'code', focus: 'code quality, standards compliance, Next.js 15 + React 19 patterns' },
      { aspect: 'security', focus: 'security vulnerabilities: injection, auth bypass, XSS, data exposure' },
      { aspect: 'performance', focus: 'N+1 queries, memory leaks, unnecessary re-renders, missing optimizations' },
    ];

    // Conditional agents
    if (/\.(test|spec)\.|__tests__/.test(changedFiles))
      agents.push({ aspect: 'tests', focus: 'test coverage quality, behavioral completeness, missing edge cases' });
    if (/components\/|app\/.*\/(page|layout)\.tsx/.test(changedFiles)) {
      agents.push({ aspect: 'ux', focus: 'UI/UX: display order, label clarity, empty states, form flows' });
      agents.push({ aspect: 'a11y', focus: 'accessibility: ARIA labels, keyboard navigation, color contrast, focus management' });
    }
    if (/try\s*\{|catch\s*\(/.test(diff))
      agents.push({ aspect: 'errors', focus: 'error handling, silent failures, inadequate fallback behavior' });
    if (/^[+-].*(?:interface |type )\w/m.test(diff))
      agents.push({ aspect: 'types', focus: 'type design quality, invariant expression, encapsulation' });

    process.stderr.write(
      `レビューエージェント実行中 (${agents.length}件並列): ${agents.map((a) => a.aspect).join(', ')}\n`
    );

    const results = await Promise.all(
      agents.map(({ aspect, focus }) => runReviewAgent(aspect, focus, diff, worktreePath, projectRules))
    );

    return results.join('\n\n---\n\n');
  },

  async createPr({
    group,
    worktreePath,
    ask,
  }: {
    group: Group;
    worktreePath: string;
    ask: (q: string) => Promise<string>;
  }): Promise<{ prUrl: string }> {
    const createPrSkill = readSkill('create-pr');
    const ticketContext = buildTicketContext(group);
    const { mcpServer } = makeEscalateTool(ask);

    const systemPrompt = `You are a senior developer. Your task is to create a PR and complete the CodeRabbit review loop.

Working directory: ${worktreePath}
Branch: ${group.branch}

## Tickets in this PR:
${ticketContext}

## PR Creation & CodeRabbit Loop Guidelines:
${createPrSkill}

## Instructions:
1. Create a PR following the guidelines above
   - Title: "fix: " or "feat: " + brief description
   - Body: include the ticket list above
2. Wait for CI to pass
3. Wait 5 minutes for CodeRabbit review
4. Handle CodeRabbit comments (max 3 rounds)
5. After the loop is complete, output exactly: PR_URL=<url>
6. Use escalate_to_user if you need human input at any point

IMPORTANT: Never run \`rm -rf\`, \`git reset --hard\`, or \`git push --force\`.`;

    const lastMessages: string[] = [];

    for await (const event of query({
      prompt: 'Create the PR and complete the CodeRabbit review loop as described in your system prompt.',
      options: {
        systemPrompt,
        tools: { type: 'preset', preset: 'claude_code' },
        permissionMode: 'bypassPermissions',
        cwd: worktreePath,
        pathToClaudeCodeExecutable: CLAUDE_CODE_EXEC,
        allowedTools: ['mcp__orchestrator__escalate_to_user'],
        mcpServers: { orchestrator: mcpServer },
        canUseTool: DESTRUCTIVE_GUARD,
      },
    })) {
      if (event.type === 'assistant') {
        const text = collectAssistantText(event as SDKAssistantMessage);
        if (text) lastMessages.push(text);
      }
    }

    // 全メッセージを結合して検索（最後以外に出力されるケースも拾う）
    const allText = lastMessages.join('\n');
    const urlMatch = allText.match(/PR_URL=(https?:\/\/github\.com\/\S+)/);
    if (!urlMatch) {
      throw new Error('createPr エージェントが PR_URL=... を出力せずに終了しました。PRが作成されたか確認してください。');
    }
    return { prUrl: urlMatch[1] };
  },
};
