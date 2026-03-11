/**
 * query-tickets.ts
 *
 * Notion データベースからチケットをクエリするスクリプト
 *
 * Usage:
 *   npx tsx .claude/skills/notion-ticket-workflow/scripts/query-tickets.ts [--status <value>] [--limit <number>]
 *
 * Options:
 *   --status  ステータスフィルター (default: "承認OK")
 *   --limit   最大取得件数 (default: 30)
 */

import {
  NOTION_API_BASE,
  loadEnvLocal,
  notionFetch,
} from "./shared.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotionRichText {
  plain_text: string;
  type: string;
}

interface NotionTitleProperty {
  type: "title";
  title: NotionRichText[];
}

interface NotionStatusProperty {
  type: "status";
  status: { name: string } | null;
}

interface NotionSelectProperty {
  type: "select";
  select: { name: string } | null;
}

interface NotionRichTextProperty {
  type: "rich_text";
  rich_text: NotionRichText[];
}

interface NotionRelationProperty {
  type: "relation";
  relation: { id: string }[];
}

interface NotionNumberProperty {
  type: "number";
  number: number | null;
}

interface NotionDateProperty {
  type: "date";
  date: { start: string } | null;
}

type NotionProperty =
  | NotionTitleProperty
  | NotionStatusProperty
  | NotionSelectProperty
  | NotionRichTextProperty
  | NotionRelationProperty
  | NotionNumberProperty
  | NotionDateProperty
  | { type: string; [key: string]: unknown };

interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  paragraph?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  to_do?: { rich_text: NotionRichText[]; checked: boolean };
  toggle?: { rich_text: NotionRichText[] };
  callout?: { rich_text: NotionRichText[] };
  quote?: { rich_text: NotionRichText[] };
  [key: string]: unknown;
}

interface NotionBlocksResponse {
  results: NotionBlock[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionComment {
  id: string;
  created_by: { name?: string; id: string };
  created_time: string;
  rich_text: NotionRichText[];
}

interface NotionCommentsResponse {
  results: NotionComment[];
}

interface OutputTicket {
  id: string;
  url: string;
  properties: {
    名前: string;
    ステータス: string;
    トラッカー: string;
    優先度: string;
    パス: string;
    プロジェクト: string[];
    [key: string]: unknown;
  };
  content: string;
  comments: {
    author: string;
    text: string;
    created_at: string;
  }[];
}

interface OutputJson {
  status_filter: string;
  total: number;
  tickets: OutputTicket[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_ID = "2b2092aab0148012aeaff214786b8832";
const CONCURRENCY_LIMIT = 5;
const BATCH_DELAY_MS = 100;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface Args {
  status: string;
  limit: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let status = "承認OK";
  let limit = 30;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--status" && argv[i + 1]) {
      status = argv[i + 1];
      i++;
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (!isNaN(n) && n > 0) limit = n;
      i++;
    }
  }

  return { status, limit };
}

// ---------------------------------------------------------------------------
// Query database with pagination
// ---------------------------------------------------------------------------

async function queryDatabase(
  token: string,
  statusFilter: string,
  limit: number
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;
  const pageSize = Math.min(limit, 100);

  while (pages.length < limit) {
    const body: Record<string, unknown> = {
      filter: {
        property: "ステータス",
        status: { equals: statusFilter },
      },
      page_size: Math.min(pageSize, limit - pages.length),
    };

    if (cursor) {
      body.start_cursor = cursor;
    }

    const data = await notionFetch<NotionQueryResponse>(
      `${NOTION_API_BASE}/databases/${DATABASE_ID}/query`,
      token,
      { method: "POST", body: JSON.stringify(body) }
    );

    pages.push(...data.results);

    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return pages.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Block content extraction
// ---------------------------------------------------------------------------

function extractRichText(richText: NotionRichText[]): string {
  return richText.map((rt) => rt.plain_text).join("");
}

function extractBlockText(block: NotionBlock): string {
  const textBlocks = [
    "paragraph",
    "bulleted_list_item",
    "numbered_list_item",
    "heading_1",
    "heading_2",
    "heading_3",
    "toggle",
    "callout",
    "quote",
  ] as const;

  for (const blockType of textBlocks) {
    const data = block[blockType] as { rich_text: NotionRichText[] } | undefined;
    if (data?.rich_text) {
      return extractRichText(data.rich_text);
    }
  }

  if (block.to_do?.rich_text) {
    const checked = block.to_do.checked ? "[x]" : "[ ]";
    return `${checked} ${extractRichText(block.to_do.rich_text)}`;
  }

  return "";
}

async function fetchBlocksRecursive(
  token: string,
  blockId: string
): Promise<string[]> {
  const lines: string[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${NOTION_API_BASE}/blocks/${blockId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);

    const data = await notionFetch<NotionBlocksResponse>(url.toString(), token);

    for (const block of data.results) {
      const text = extractBlockText(block);
      if (text) lines.push(text);

      if (block.has_children) {
        const childLines = await fetchBlocksRecursive(token, block.id);
        lines.push(...childLines);
      }
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return lines;
}

async function fetchPageContent(token: string, pageId: string): Promise<string> {
  try {
    const lines = await fetchBlocksRecursive(token, pageId);
    return lines.join("\n");
  } catch (err) {
    process.stderr.write(`  Warning: Failed to fetch content for ${pageId}: ${err}\n`);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Comments extraction
// ---------------------------------------------------------------------------

async function fetchPageComments(
  token: string,
  pageId: string
): Promise<OutputTicket["comments"]> {
  try {
    const url = new URL(`${NOTION_API_BASE}/comments`);
    url.searchParams.set("block_id", pageId);
    url.searchParams.set("page_size", "100");

    const data = await notionFetch<NotionCommentsResponse>(url.toString(), token);

    return data.results.map((c) => ({
      author: c.created_by.name ?? c.created_by.id,
      text: extractRichText(c.rich_text),
      created_at: c.created_time,
    }));
  } catch (err) {
    process.stderr.write(`  Warning: Failed to fetch comments for ${pageId}: ${err}\n`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Property extraction
// ---------------------------------------------------------------------------

function extractPropertyValue(prop: NotionProperty): unknown {
  switch (prop.type) {
    case "title": {
      const p = prop as NotionTitleProperty;
      return p.title.map((rt) => rt.plain_text).join("");
    }
    case "status": {
      const p = prop as NotionStatusProperty;
      return p.status?.name ?? "";
    }
    case "select": {
      const p = prop as NotionSelectProperty;
      return p.select?.name ?? "";
    }
    case "rich_text": {
      const p = prop as NotionRichTextProperty;
      return p.rich_text.map((rt) => rt.plain_text).join("");
    }
    case "relation": {
      const p = prop as NotionRelationProperty;
      return p.relation.map((r) => r.id);
    }
    case "number": {
      const p = prop as NotionNumberProperty;
      return p.number;
    }
    case "date": {
      const p = prop as NotionDateProperty;
      return p.date?.start ?? null;
    }
    default:
      return null;
  }
}

function extractPageProperties(
  properties: Record<string, NotionProperty>
): OutputTicket["properties"] {
  const getName = (key: string): string => {
    const prop = properties[key];
    if (!prop) return "";
    return String(extractPropertyValue(prop) ?? "");
  };

  const getRelation = (key: string): string[] => {
    const prop = properties[key];
    if (!prop || prop.type !== "relation") return [];
    return (prop as NotionRelationProperty).relation.map((r) => r.id);
  };

  const result: OutputTicket["properties"] = {
    名前: getName("名前"),
    ステータス: getName("ステータス"),
    トラッカー: getName("トラッカー"),
    優先度: getName("優先度"),
    パス: getName("パス"),
    プロジェクト: getRelation("プロジェクト"),
  };

  // Include remaining properties
  for (const [key, prop] of Object.entries(properties)) {
    if (!(key in result)) {
      result[key] = extractPropertyValue(prop);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Concurrency control
// ---------------------------------------------------------------------------

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    batches.push(items.slice(i, i + concurrency));
  }

  let itemIndex = 0;
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchResults = await Promise.all(
      batch.map((item, idx) => {
        const originalIdx = itemIndex + idx;
        return fn(item).then((r) => {
          results[originalIdx] = r;
          return r;
        });
      })
    );
    itemIndex += batch.length;
    void batchResults;

    if (batchIdx < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
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

  process.stderr.write(`Fetching tickets with status="${args.status}" (limit=${args.limit})...\n`);

  const pages = await queryDatabase(token, args.status, args.limit);

  process.stderr.write(`Fetching content for ${pages.length} tickets...\n`);

  const ticketData = await runWithConcurrency(
    pages,
    CONCURRENCY_LIMIT,
    BATCH_DELAY_MS,
    async (page): Promise<OutputTicket> => {
      const [content, comments] = await Promise.all([
        fetchPageContent(token, page.id),
        fetchPageComments(token, page.id),
      ]);

      return {
        id: page.id,
        url: page.url,
        properties: extractPageProperties(page.properties),
        content,
        comments,
      };
    }
  );

  const output: OutputJson = {
    status_filter: args.status,
    total: ticketData.length,
    tickets: ticketData,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  process.stderr.write(`Done. ${ticketData.length} tickets exported.\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
