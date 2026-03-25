/**
 * query-manual-pages.ts
 *
 * db_nr_情報 から「マニュアル」タグのページ一覧を取得するスクリプト
 *
 * Usage:
 *   npx tsx .claude/skills/manual-update/scripts/query-manual-pages.ts [--keyword <text>]
 *
 * Options:
 *   --keyword    タイトルに含む文字列でフィルター（例: "記録管理"）
 *
 * Output (stdout):
 *   JSON: { total, pages: [{ id, url, title }] }
 */

import {
  NOTION_API_BASE,
  loadEnvLocal,
  notionFetch,
} from "../../notion-ticket-workflow/scripts/shared.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATABASE_ID = "260092aab01480a7b275c849f8386a4f";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotionRichText {
  plain_text: string;
}

interface NotionPage {
  id: string;
  url: string;
  properties: {
    名前?: { type: "title"; title: NotionRichText[] };
    タグ?: { type: "multi_select"; multi_select: { name: string }[] };
    [key: string]: unknown;
  };
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface OutputPage {
  id: string;
  url: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { keyword: string | null } {
  const argv = process.argv.slice(2);
  let keyword: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--keyword" && argv[i + 1]) {
      keyword = argv[i + 1];
      i++;
    }
  }

  return { keyword };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

async function queryManualPages(token: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;

  do {
    const body: Record<string, unknown> = {
      filter: {
        property: "タグ",
        multi_select: { contains: "マニュアル" },
      },
      sorts: [{ property: "名前", direction: "ascending" }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const data = await notionFetch<NotionQueryResponse>(
      `${NOTION_API_BASE}/databases/${DATABASE_ID}/query`,
      token,
      { method: "POST", body: JSON.stringify(body) }
    );

    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
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

  const { keyword } = parseArgs();

  process.stderr.write("Fetching manual pages from db_nr_情報...\n");

  let pages = await queryManualPages(token);

  // キーワードフィルター
  if (keyword) {
    pages = pages.filter((p) => {
      const title = p.properties["名前"]?.title.map((t) => t.plain_text).join("") ?? "";
      return title.includes(keyword);
    });
    process.stderr.write(`Filtered by keyword="${keyword}": ${pages.length} pages\n`);
  }

  const output: { total: number; pages: OutputPage[] } = {
    total: pages.length,
    pages: pages.map((p) => ({
      id: p.id,
      url: p.url,
      title: p.properties["名前"]?.title.map((t) => t.plain_text).join("") ?? "(no title)",
    })),
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.stderr.write(`Done. ${output.total} pages found.\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
