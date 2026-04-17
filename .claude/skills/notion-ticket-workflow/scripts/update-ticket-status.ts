/**
 * update-ticket-status.ts
 *
 * Notion チケットのステータスを更新し、オプションで PR URL をコメントとして追加するスクリプト
 *
 * Usage:
 *   npx tsx .claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts \
 *     --page-id <notion-page-uuid> \
 *     --status "レビュー依頼" \
 *     [--pr-url "https://github.com/bighope99/nobi-reco-app/pull/205"] \
 *     [--assignee-name "中村"]
 *
 * Options:
 *   --page-id       (required) Notion ページの UUID
 *   --status        (required) 新しいステータス値 (例: "レビュー依頼", "進行中")
 *   --pr-url        (optional) PR URL。指定した場合はコメントとして追加される
 *   --assignee-name (optional) 担当者として設定する名前 (例: "中村", "尼崎")
 */

import {
  NOTION_API_BASE,
  loadEnvLocal,
  notionFetch,
} from "./shared.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdatePageResponse {
  id: string;
  url: string;
}

interface OutputResult {
  page_id: string;
  status: string;
  pr_url: string | null;
  assignee_name: string | null;
  success: true;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface Args {
  pageId: string;
  status: string | null;
  prUrl: string | null;
  assigneeName: string | null;
  branch: string | null;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let pageId: string | null = null;
  let status: string | null = null;
  let prUrl: string | null = null;
  let assigneeName: string | null = null;
  let branch: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--page-id" && argv[i + 1]) {
      pageId = argv[i + 1];
      i++;
    } else if (argv[i] === "--status" && argv[i + 1]) {
      status = argv[i + 1];
      i++;
    } else if (argv[i] === "--pr-url" && argv[i + 1]) {
      prUrl = argv[i + 1];
      i++;
    } else if (argv[i] === "--assignee-name" && argv[i + 1]) {
      assigneeName = argv[i + 1];
      i++;
    } else if (argv[i] === "--branch" && argv[i + 1]) {
      branch = argv[i + 1];
      i++;
    }
  }

  if (!pageId) {
    process.stderr.write("Error: --page-id is required.\n");
    process.exit(1);
  }

  if (!status && !branch && !prUrl && !assigneeName) {
    process.stderr.write("Error: --status or at least one of --branch, --pr-url, --assignee-name is required.\n");
    process.exit(1);
  }

  return { pageId, status, prUrl, assigneeName, branch };
}

// ---------------------------------------------------------------------------
// Notion API operations
// ---------------------------------------------------------------------------

async function updatePageStatus(
  token: string,
  pageId: string,
  status: string
): Promise<void> {
  process.stderr.write(`Updating status to "${status}" for page ${pageId}...\n`);

  await notionFetch<UpdatePageResponse>(
    `${NOTION_API_BASE}/pages/${pageId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          ステータス: {
            status: { name: status },
          },
        },
      }),
    }
  );

  process.stderr.write(`Status updated successfully.\n`);
}

async function updatePrUrl(
  token: string,
  pageId: string,
  prUrl: string
): Promise<void> {
  process.stderr.write(`Setting PR URL: ${prUrl}...\n`);

  await notionFetch<UpdatePageResponse>(
    `${NOTION_API_BASE}/pages/${pageId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          PR: { url: prUrl },
        },
      }),
    }
  );

  process.stderr.write(`PR URL set successfully.\n`);
}

async function addBranchComment(
  token: string,
  pageId: string,
  branch: string
): Promise<void> {
  process.stderr.write(`Adding branch comment "${branch}" for page ${pageId}...\n`);

  await notionFetch<{ id: string }>(
    `${NOTION_API_BASE}/comments`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        parent: { page_id: pageId },
        rich_text: [{ type: "text", text: { content: `🌿 ブランチ: ${branch}` } }],
      }),
    }
  );

  process.stderr.write(`Branch comment added successfully.\n`);
}

async function updateAssignee(
  token: string,
  pageId: string,
  assigneeName: string
): Promise<void> {
  process.stderr.write(`Setting assignee to "${assigneeName}" for page ${pageId}...\n`);

  await notionFetch<UpdatePageResponse>(
    `${NOTION_API_BASE}/pages/${pageId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          // NOTE: 既存の担当者を全て上書きする（追記ではなく置換）
          担当者: {
            multi_select: [{ name: assigneeName }],
          },
        },
      }),
    }
  );

  process.stderr.write(`Assignee updated successfully.\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnvLocal();

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    process.stderr.write(
      "Error: NOTION_TOKEN is not set. Set it in .env.local or as an environment variable.\n"
    );
    process.exit(1);
  }

  const args = parseArgs();

  // Step 1: Update the page status (optional)
  if (args.status !== null) {
    await updatePageStatus(token, args.pageId, args.status);
  }

  // Step 2: Add PR URL if provided
  if (args.prUrl !== null) {
    await updatePrUrl(token, args.pageId, args.prUrl);
  }

  // Step 3: Update assignee if provided
  if (args.assigneeName !== null) {
    await updateAssignee(token, args.pageId, args.assigneeName);
  }

  // Step 4: Add branch comment if provided
  if (args.branch !== null) {
    await addBranchComment(token, args.pageId, args.branch);
  }

  const output: OutputResult = {
    page_id: args.pageId,
    status: args.status ?? '',
    pr_url: args.prUrl,
    assignee_name: args.assigneeName,
    success: true,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
