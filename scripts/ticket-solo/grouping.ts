import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import type { Ticket, Group } from './types.js';
import { getCurrentDateJST } from '../../lib/utils/timezone.js';

const PRIORITY_MAP: Record<string, number> = {
  '今すぐ': 5,
  '急いで': 4,
  '高め': 3,
  '通常': 2,
  '低い': 1,
};

function maxPriority(tickets: Ticket[]): number {
  return tickets.reduce((max, t) => {
    const p = PRIORITY_MAP[t.priority] ?? 2;
    return p > max ? p : max;
  }, 1);
}

function fallbackGroup(tickets: Ticket[]): Group[] {
  const date = getCurrentDateJST().replace(/-/g, '');
  return [
    {
      branch: `fix/batch-${date}`,
      path: tickets[0]?.path ?? '/',
      priority: maxPriority(tickets),
      tickets,
    },
  ];
}

function parseJsonBlock(text: string): Group[] | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return null;
    return parsed as Group[];
  } catch {
    return null;
  }
}

export async function proposeGroups(tickets: Ticket[]): Promise<Group[]> {
  if (tickets.length === 0) return [];

  const ticketSummary = tickets.map((t) =>
    `- id:${t.id} name:"${t.name}" path:"${t.path}" priority:"${t.priority}" tracker:"${t.tracker}"`
  ).join('\n');

  const prompt = `You are a software project manager. Group the following Notion tickets into logical implementation batches.

Rules:
- Group tickets that touch the same area (same path prefix or related functionality)
- Each group becomes one git branch and one PR
- branch name format: fix/<kebab-case-description> or feat/<kebab-case-description>
- path: the primary file/directory path affected by the group
- priority: integer 1-5 (max priority of tickets in group, mapping: 今すぐ=5, 急いで=4, 高め=3, 通常=2, 低い=1)
- tickets: array of ticket objects from the input (keep all fields)

Tickets:
${ticketSummary}

Respond with ONLY a JSON code block (no explanation):
\`\`\`json
[
  {
    "branch": "fix/example-feature",
    "path": "app/some/path",
    "priority": 3,
    "tickets": [/* ticket objects */]
  }
]
\`\`\``;

  const messages: string[] = [];

  for await (const event of query({
    prompt,
    options: {
      tools: [],
      permissionMode: 'plan',
    },
  })) {
    if (event.type === 'assistant') {
      const msg = event as SDKAssistantMessage;
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          messages.push(block.text);
        }
      }
    }
  }

  const lastMessage = messages[messages.length - 1] ?? '';
  const groups = parseJsonBlock(lastMessage);

  if (!groups || groups.length === 0) {
    process.stderr.write('Warning: grouping parse failed, using fallback single group\n');
    return fallbackGroup(tickets);
  }

  // Claude returns only summarized ticket fields; restore full objects from the original array
  return groups.map((g) => ({
    ...g,
    priority: typeof g.priority === 'number' ? g.priority : maxPriority(g.tickets),
    tickets: (g.tickets as { id: string }[])
      .map((t) => tickets.find((orig) => orig.id === t.id))
      .filter((t): t is Ticket => t !== undefined),
  }));
}
