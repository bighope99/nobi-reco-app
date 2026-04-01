import {
  CHILD_IMPORT_TEMPLATE_HEADERS,
  CHILD_IMPORT_TEMPLATE_SAMPLE_ROW_WITHOUT_ID,
} from '@/lib/children/import-csv';

export async function GET() {
  const csv =
    `\ufeff${CHILD_IMPORT_TEMPLATE_HEADERS.join(',')}\r\n` +
    `${CHILD_IMPORT_TEMPLATE_SAMPLE_ROW_WITHOUT_ID.join(',')}\r\n`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="children-import-template.csv"',
    },
  });
}
