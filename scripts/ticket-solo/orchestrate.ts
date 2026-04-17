#!/usr/bin/env -S npx tsx

import * as readline from 'readline';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadEnvLocal, queryTickets, updateStatus, saveBranch } from './notion.js';
import { proposeGroups } from './grouping.js';
import { runImplementation } from './implement.js';
import type { Group, Ticket } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

const ASSIGNEES = ['中村', '尼崎', 'かつはら', '小川'];

// ブランチ名は fix/ feat/ chore/ refactor/ で始まり英数字とハイフンのみ
const VALID_BRANCH_RE = /^(fix|feat|chore|refactor)\/[a-zA-Z0-9\-]{1,60}$/;

function validateBranchName(branch: string): void {
  if (!VALID_BRANCH_RE.test(branch)) {
    throw new Error(`Invalid branch name: "${branch}". Must match ${VALID_BRANCH_RE}`);
  }
}

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

function remoteHasBranch(branch: string): boolean {
  const result = spawnSync('git', ['ls-remote', '--heads', 'origin', branch], {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

type StartPhase = 'plan' | 'implement' | 'review' | 'createPr';

function createWorktree(branch: string): { path: string; isNew: boolean } {
  validateBranchName(branch);

  const existing = getWorktreePath(branch);
  if (existing) {
    return { path: existing, isNew: false };
  }

  spawnGit(['fetch', 'origin'], PROJECT_ROOT);

  // リモートブランチが存在する場合のみ削除
  if (remoteHasBranch(branch)) {
    spawnSync('git', ['push', 'origin', '--delete', branch], {
      encoding: 'utf8',
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });
  }

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
    const fallbackResult = spawnSync(
      'git',
      ['worktree', 'add', fallbackPath, '-b', branch, 'origin/main'],
      { encoding: 'utf8', cwd: PROJECT_ROOT, stdio: 'pipe' }
    );
    if (fallbackResult.status !== 0) {
      throw new Error(`git worktree add failed:\n${fallbackResult.stderr}`);
    }
  }

  const actual = getWorktreePath(branch);
  if (!actual) throw new Error(`Worktree for branch '${branch}' not found after creation`);
  return { path: actual, isNew: true };
}

async function selectGroup(rl: readline.Interface, tickets: Ticket[]): Promise<Group> {
  console.log(`\n${tickets.length} 件のチケットを取得しました。`);
  console.log('\nグループを提案中...');
  const groups = await proposeGroups(tickets);

  console.log('\n## 候補グループ\n');
  console.log(renderGroups(groups));

  const groupInput = await prompt(rl, `\n実装するグループ番号を入力 (1-${groups.length}, cancel でキャンセル): `);
  if (groupInput.trim().toLowerCase() === 'cancel') {
    console.log('キャンセルしました。');
    process.exit(0);
  }

  const groupIdx = parseInt(groupInput.trim(), 10) - 1;
  if (isNaN(groupIdx) || groupIdx < 0 || groupIdx >= groups.length) {
    console.error('無効なグループ番号です');
    process.exit(1);
  }

  const selected = groups[groupIdx];
  console.log(`\n選択されたグループ: ${selected.branch}`);
  console.log(`チケット: ${selected.tickets.map((t) => t.name).join(', ')}`);
  return selected;
}

function setInProgress(group: Group, assigneeName: string): void {
  console.log('\nチケットのステータスを「進行中」に更新中...');
  for (const ticket of group.tickets) {
    updateStatus({ pageId: ticket.id, status: '進行中', assigneeName });
  }
  console.log('更新完了。');
}

async function askStartPhase(rl: readline.Interface): Promise<StartPhase> {
  const phaseMap: Record<string, StartPhase> = {
    '1': 'plan', '2': 'implement', '3': 'review', '4': 'createPr',
  };
  const input = await prompt(rl, 'どのフェーズから開始しますか? (1=プラン再生成, 2=実装のみ, 3=レビューのみ, 4=PR作成のみ): ');
  return phaseMap[input.trim()] ?? 'plan';
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

    // Phase 1a: Query tickets (承認OK + 進行中でブランチ記録あり)
    console.log('\nチケットを取得中...');
    let tickets: Ticket[] = queryTickets({ status: '承認OK', assigneeName });

    // 中断チケット検出: ブランチが記録済みのチケットをチェック
    const inProgressTickets = queryTickets({ status: '進行中', assigneeName });
    const resumableBranches = new Map<string, Ticket[]>();
    for (const t of [...tickets, ...inProgressTickets]) {
      if (t.branch) {
        const existing = resumableBranches.get(t.branch) ?? [];
        resumableBranches.set(t.branch, [...existing, t]);
      }
    }

    let selectedGroup: Group;

    if (resumableBranches.size > 0) {
      console.log('\n⚡ 中断されたブランチを検出しました:');
      const branches = [...resumableBranches.keys()];
      branches.forEach((b, i) => {
        const names = resumableBranches.get(b)!.map((t) => t.name).join(', ');
        console.log(`  ${i + 1}. ${b} (${names})`);
      });
      console.log(`  ${branches.length + 1}. 新しいチケットを選ぶ`);

      const resumeInput = await prompt(rl, '\n選択: ');
      const resumeIdx = parseInt(resumeInput.trim(), 10) - 1;

      if (resumeIdx >= 0 && resumeIdx < branches.length) {
        const branch = branches[resumeIdx];
        const branchTickets = resumableBranches.get(branch)!;
        selectedGroup = {
          branch,
          path: branchTickets[0].path,
          priority: 1,
          tickets: branchTickets,
        };
        console.log(`\nブランチ "${branch}" から再開します。`);
        // Phase 2-1 へスキップ（以降の処理は通常フローと同じ）
        goto_phase2: {
          // ステータスが承認OKに戻っている場合は進行中に再設定
          for (const ticket of selectedGroup.tickets) {
            if (ticket.status === '承認OK') {
              updateStatus({ pageId: ticket.id, status: '進行中', assigneeName });
            }
          }
          break goto_phase2;
        }
      } else {
        // 新しいチケットを選ぶ → 通常フローへ
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
        selectedGroup = await selectGroup(rl, tickets);
        await setInProgress(selectedGroup, assigneeName);
      }
    } else {
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
      selectedGroup = await selectGroup(rl, tickets);
      await setInProgress(selectedGroup, assigneeName);
    }

    // Phase 2-1 〜 2-6: 実装〜PR完了まで。失敗時はステータスをロールバック
    let statusFinalized = false;
    const rollbackStatus = () => {
      if (statusFinalized) return;
      statusFinalized = true;
      console.error('\nチケットを「承認OK」に戻します...');
      for (const ticket of selectedGroup.tickets) {
        try { updateStatus({ pageId: ticket.id, status: '承認OK' }); } catch { /* best effort */ }
      }
    };

    try {
      // Phase 2-1: Create worktree (existing worktree は再利用)
      console.log(`\nWorktree を確認中 (${selectedGroup.branch})...`);
      const { path: worktreePath, isNew } = createWorktree(selectedGroup.branch);
      console.log(`Worktree: ${worktreePath}${isNew ? ' (新規作成)' : ' (既存を再利用)'}`);

      // ブランチをチケットに保存（中断時の復元用）
      if (isNew) {
        for (const ticket of selectedGroup.tickets) {
          saveBranch({ pageId: ticket.id, branch: selectedGroup.branch });
        }
      }

      const startPhase: StartPhase = isNew ? 'plan' : await askStartPhase(rl);

      const ask = async (q: string): Promise<string> => {
        return prompt(rl, `\n[Claude からの質問] ${q}\n> `);
      };

      // Phase 2-2: Plan
      let plan = '';
      if (startPhase === 'plan' || startPhase === 'implement') {
        console.log('\n実装プランを作成中...');
        plan = await runImplementation.plan({ group: selectedGroup, worktreePath });

        if (startPhase === 'plan') {
          console.log('\n## 実装プラン\n');
          console.log(plan);

          const planOk = await prompt(rl, '\nこのプランで実装を開始しますか? (ok/no): ');
          if (planOk.trim().toLowerCase() !== 'ok') {
            rollbackStatus();
            console.log('実装をキャンセルしました。');
            return;
          }
        }
      }

      // Phase 2-3: Implement (commit only, no PR)
      if (startPhase === 'plan' || startPhase === 'implement') {
        console.log('\n実装を開始します（コミットまで）...');
        await runImplementation.implement({ group: selectedGroup, worktreePath, plan, ask });
        console.log('\n実装・コミット完了。');
      }

      // Phase 2-4: Review → Fix → Re-review（Critical がなくなるまで、安全上限5回）
      if (startPhase !== 'createPr') {
        const MAX_FIX_ROUNDS = 5;
        for (let round = 1; round <= MAX_FIX_ROUNDS; round++) {
          console.log(`\nレビューを実行中... (ラウンド ${round})`);
          const reviewResult = await runImplementation.review({ worktreePath });

          console.log('\n## レビュー結果\n');
          console.log(reviewResult);

          const hasCritical = /🔴 Critical/.test(reviewResult) &&
            !/🔴 Critical\s*[\r\n]+none/i.test(reviewResult);

          if (!hasCritical) {
            console.log('✅ Critical なし。PR作成に進みます。');
            break;
          }
          if (round === MAX_FIX_ROUNDS) {
            console.warn(`⚠️ ${MAX_FIX_ROUNDS}回修正後も Critical が残っています。PR を作成します。`);
            break;
          }
          console.log('\n🔴 Critical の指摘があります。自動修正します...');
          await runImplementation.fix({ worktreePath, reviewResult, ask });
          console.log('修正完了。再レビューします。');
        }
      }

      // Phase 2-5: Create PR + CodeRabbit loop
      console.log('\nPRを作成・CodeRabbitループを実行中...');
      const { prUrl } = await runImplementation.createPr({ group: selectedGroup, worktreePath, ask });

      // Phase 2-6: Update status to レビュー依頼（ここまで来たらロールバック不要）
      statusFinalized = true;
      console.log('\nチケットのステータスを「レビュー依頼」に更新中...');
      for (const ticket of selectedGroup.tickets) {
        try {
          updateStatus({ pageId: ticket.id, status: 'レビュー依頼', assigneeName, prUrl: prUrl || undefined });
        } catch {
          console.error(`警告: チケット "${ticket.name}" の更新に失敗しました。手動で「レビュー依頼」に変更してください。PR: ${prUrl}`);
        }
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
    } catch (err) {
      rollbackStatus();
      throw err;
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
