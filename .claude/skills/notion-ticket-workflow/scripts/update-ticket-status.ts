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
  status: string;
  prUrl: string | null;
  assigneeName: string | null;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let pageId: string | null = null;
  let status: string | null = null;
  let prUrl: string | null = null;
  let assigneeName: string | null = null;

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
    }
  }

  if (!pageId) {
    process.stderr.write("Error: --page-id is required.\n");
    process.exit(1);
  }

  if (!status) {
    process.stderr.write("Error: --status is required.\n");
    process.exit(1);
  }

  return { pageId, status, prUrl, assigneeName };
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

  // Step 1: Update the page status
  await updatePageStatus(token, args.pageId, args.status);

  // Step 2: Add PR URL comment if provided
  if (args.prUrl !== null) {
    await updatePrUrl(token, args.pageId, args.prUrl);
  }

  // Step 3: Update assignee if provided
  if (args.assigneeName !== null) {
    await updateAssignee(token, args.pageId, args.assigneeName);
  }

  const output: OutputResult = {
    page_id: args.pageId,
    status: args.status,
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
