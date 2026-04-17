export interface Ticket {
  id: string;
  url: string;
  number?: string;
  name: string;
  status: string;
  tracker: string;
  priority: string;
  path: string;
  content: string;
  comments: { author: string; text: string; created_at: string }[];
}

export interface Group {
  branch: string;
  path: string;
  priority: number;
  tickets: Ticket[];
}
