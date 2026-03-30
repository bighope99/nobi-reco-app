import { CHILD_IMPORT_HEADERS, CHILD_IMPORT_TEMPLATE_SAMPLE_ROW } from '@/lib/children/import-csv';

export async function GET() {
  const csv = `\ufeff${CHILD_IMPORT_HEADERS.join(',')}\r\n${CHILD_IMPORT_TEMPLATE_SAMPLE_ROW.join(',')}\r\n`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="children-import-template.csv"',
    },
  });
}
