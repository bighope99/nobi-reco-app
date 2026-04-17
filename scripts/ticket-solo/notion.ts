import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadEnvLocal } from '../../.claude/skills/notion-ticket-workflow/scripts/shared.js';
import type { Ticket } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const QUERY_SCRIPT = resolve(__dirname, '../../.claude/skills/notion-ticket-workflow/scripts/query-tickets.ts');
const UPDATE_SCRIPT = resolve(__dirname, '../../.claude/skills/notion-ticket-workflow/scripts/update-ticket-status.ts');

function extractNumber(url: string): string | undefined {
  const m = url.match(/([a-f0-9]{32})$/);
  return m ? m[1].slice(0, 8) : undefined;
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
    担当者: string[];
    [key: string]: unknown;
  };
  content: string;
  comments: { author: string; text: string; created_at: string }[];
}

interface QueryOutput {
  status_filter: string;
  total: number;
  tickets: OutputTicket[];
}

export function queryTickets({
  status,
  assigneeName,
}: {
  status: string;
  assigneeName: string;
}): Ticket[] {
  const result = spawnSync(
    'npx',
    ['tsx', QUERY_SCRIPT, '--status', status, '--assignee-name', assigneeName],
    { encoding: 'utf8', env: process.env }
  );

  if (result.status !== 0) {
    throw new Error(`query-tickets failed:\n${result.stderr}`);
  }

  const parsed: QueryOutput = JSON.parse(result.stdout);

  return parsed.tickets.map((t) => ({
    id: t.id,
    url: t.url,
    number: extractNumber(t.url),
    name: t.properties['名前'],
    status: t.properties['ステータス'],
    tracker: t.properties['トラッカー'],
    priority: t.properties['優先度'],
    path: t.properties['パス'],
    content: t.content,
    comments: t.comments,
  }));
}

export function updateStatus({
  pageId,
  status,
  assigneeName,
  prUrl,
}: {
  pageId: string;
  status: string;
  assigneeName?: string;
  prUrl?: string;
}): void {
  const args = ['tsx', UPDATE_SCRIPT, '--page-id', pageId, '--status', status];
  if (assigneeName) args.push('--assignee-name', assigneeName);
  if (prUrl) args.push('--pr-url', prUrl);

  const result = spawnSync('npx', args, { encoding: 'utf8', env: process.env });

  if (result.status !== 0) {
    throw new Error(`update-ticket-status failed for ${pageId}:\n${result.stderr}`);
  }
}

export { loadEnvLocal };
