#!/usr/bin/env -S npx tsx

import * as readline from 'readline';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadEnvLocal, queryTickets, updateStatus } from './notion.js';
import { proposeGroups } from './grouping.js';
import { runImplementation } from './implement.js';
import type { Group, Ticket } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

const ASSIGNEES = ['中村', '尼崎', 'かつはら', '小川'];

const PRIORITY_MAP: Record<string, number> = {
  '今すぐ': 5,
  '急いで': 4,
  '高め': 3,
  '通常': 2,
  '低い': 1,
};

function createReadline(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function renderGroups(groups: Group[]): string {
  const header = '| # | Branch | Path | Priority | Tickets |';
  const sep = '|---|--------|------|----------|---------|';
  const rows = groups.map((g: Group, i: number) =>
    `| ${i + 1} | \`${g.branch}\` | ${g.path} | ${g.priority} | ${g.tickets.map((t: Ticket) => t.name).join(', ')} |`
  );
  return [header, sep, ...rows].join('\n');
}

function spawnGit(args: string[], cwd: string, ignoreError = false): string {
  const result = spawnSync('git', args, { encoding: 'utf8', cwd, stdio: ignoreError ? 'pipe' : 'inherit' });
  if (!ignoreError && result.status !== 0) {
    throw new Error(`git ${args[0]} failed`);
  }
  return result.stdout ?? '';
}

function getWorktreePath(branch: string): string | null {
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });
  if (result.status !== 0) return null;
  const entries = result.stdout.split('\n\n');
  for (const entry of entries) {
    if (entry.includes(`branch refs/heads/${branch}`)) {
      const match = entry.match(/^worktree (.+)$/m);
      if (match) return match[1].trim();
    }
  }
  return null;
}

function createWorktree(branch: string): string {
  spawnGit(['fetch', 'origin'], PROJECT_ROOT);

  spawnSync('git', ['push', 'origin', '--delete', branch], {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });

  spawnSync('git', ['branch', '-D', branch], {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });

  const gtrResult = spawnSync(
    'git',
    ['gtr', 'new', branch, '--from', 'origin/main', '--yes'],
    { encoding: 'utf8', cwd: PROJECT_ROOT, stdio: 'inherit' }
  );

  if (gtrResult.status !== 0) {
    const fallbackPath = resolve(PROJECT_ROOT, `../nobi-reco-app-${branch.replace(/\//g, '-')}`);
    spawnSync(
      'git',
      ['worktree', 'add', fallbackPath, '-b', branch, 'origin/main'],
      { encoding: 'utf8', cwd: PROJECT_ROOT, stdio: 'inherit' }
    );
  }

  const actual = getWorktreePath(branch);
  if (!actual) throw new Error(`Worktree for branch '${branch}' not found after creation`);
  return actual;
}

async function main(): Promise<void> {
  loadEnvLocal();

  delete process.env.ANTHROPIC_API_KEY;

  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    throw new Error(
      'CLAUDE_CODE_OAUTH_TOKEN is not set.\n' +
      'Run `claude` once to authenticate, then set CLAUDE_CODE_OAUTH_TOKEN in .env.local.'
    );
  }

  const rl = createReadline();

  try {
    // Phase 0: Assignee selection
    console.log('\n担当者を選択してください:');
    ASSIGNEES.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));
    console.log(`  ${ASSIGNEES.length + 1}. その他`);

    const assigneeInput = await prompt(rl, '\n番号を入力: ');
    const assigneeIdx = parseInt(assigneeInput.trim(), 10) - 1;

    let assigneeName: string;
    if (assigneeIdx >= 0 && assigneeIdx < ASSIGNEES.length) {
      assigneeName = ASSIGNEES[assigneeIdx];
    } else if (assigneeIdx === ASSIGNEES.length) {
      assigneeName = await prompt(rl, '担当者名を入力: ');
    } else {
      console.error('無効な選択です');
      process.exit(1);
    }

    console.log(`\n担当者: ${assigneeName}`);

    // Phase 1a: Query tickets
    console.log('\nチケットを取得中...');
    let tickets: Ticket[] = queryTickets({ status: '承認OK', assigneeName });

    if (tickets.length === 0) {
      const retry = await prompt(rl, `承認OKのチケットが見つかりません。担当者フィルターなしで検索しますか? (y/n): `);
      if (retry.trim().toLowerCase() === 'y') {
        tickets = queryTickets({ status: '承認OK', assigneeName: '' });
      }
      if (tickets.length === 0) {
        console.log('処理対象のチケットがありません。終了します。');
        return;
      }
    }

    console.log(`\n${tickets.length} 件のチケットを取得しました。`);

    // Phase 1b: Propose groups
    console.log('\nグループを提案中...');
    const groups = await proposeGroups(tickets);

    console.log('\n## 候補グループ\n');
    console.log(renderGroups(groups));

    // Phase 1c: Group selection
    const groupInput = await prompt(rl, `\n実装するグループ番号を入力 (1-${groups.length}, cancel でキャンセル): `);

    if (groupInput.trim().toLowerCase() === 'cancel') {
      console.log('キャンセルしました。');
      return;
    }

    const groupIdx = parseInt(groupInput.trim(), 10) - 1;
    if (groupIdx < 0 || groupIdx >= groups.length) {
      console.error('無効なグループ番号です');
      process.exit(1);
    }

    const selectedGroup = groups[groupIdx];
    console.log(`\n選択されたグループ: ${selectedGroup.branch}`);
    console.log(`チケット: ${selectedGroup.tickets.map((t) => t.name).join(', ')}`);

    // Phase 2-0: Update status to 進行中
    console.log('\nチケットのステータスを「進行中」に更新中...');
    for (const ticket of selectedGroup.tickets) {
      updateStatus({ pageId: ticket.id, status: '進行中', assigneeName });
    }
    console.log('更新完了。');

    // Phase 2-1: Create worktree
    console.log(`\nWorktree を作成中 (${selectedGroup.branch})...`);
    const worktreePath = createWorktree(selectedGroup.branch);
    console.log(`Worktree: ${worktreePath}`);

    // Phase 2-2: Plan
    console.log('\n実装プランを作成中...');
    const plan = await runImplementation.plan({ group: selectedGroup, worktreePath });

    console.log('\n## 実装プラン\n');
    console.log(plan);

    const planOk = await prompt(rl, '\nこのプランで実装を開始しますか? (ok/no): ');
    if (planOk.trim().toLowerCase() !== 'ok') {
      console.log('実装をキャンセルしました。チケットを「承認OK」に戻します...');
      for (const ticket of selectedGroup.tickets) {
        updateStatus({ pageId: ticket.id, status: '承認OK' });
      }
      return;
    }

    const ask = async (q: string): Promise<string> => {
      return prompt(rl, `\n[Claude からの質問] ${q}\n> `);
    };

    // Phase 2-3: Implement (commit only, no PR)
    console.log('\n実装を開始します（コミットまで）...');
    await runImplementation.implement({ group: selectedGroup, worktreePath, plan, ask });
    console.log('\n実装・コミット完了。');

    // Phase 2-4: Review (pr-review スキルに準拠、常時実行)
    console.log('\nレビューを実行中...');
    const reviewResult = await runImplementation.review({ worktreePath });

    console.log('\n## レビュー結果\n');
    console.log(reviewResult);

    const reviewOk = await prompt(rl, '\nこの状態でPRを作成しますか? (ok/cancel): ');
    if (reviewOk.trim().toLowerCase() !== 'ok') {
      console.log('PR作成をキャンセルしました。worktree は保持します。');
      return;
    }

    // Phase 2-5: Create PR + CodeRabbit loop
    console.log('\nPRを作成・CodeRabbitループを実行中...');
    const { prUrl } = await runImplementation.createPr({ group: selectedGroup, worktreePath, ask });

    // Phase 2-6: Update status to レビュー依頼
    console.log('\nチケットのステータスを「レビュー依頼」に更新中...');
    for (const ticket of selectedGroup.tickets) {
      updateStatus({ pageId: ticket.id, status: 'レビュー依頼', assigneeName, prUrl: prUrl || undefined });
    }
    console.log('更新完了。');

    // Phase 3: Summary
    console.log('\n## 完了サマリー\n');
    console.log('| チケット | ステータス |');
    console.log('|---------|-----------|');
    for (const ticket of selectedGroup.tickets) {
      console.log(`| ${ticket.name} | レビュー依頼 |`);
    }
    if (prUrl) {
      console.log(`\nPR: ${prUrl}`);
    }
    console.log('\n完了しました。');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
