// lib/csv/helpers.ts
// Shared CSV utilities for import/export across all modules.

export function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvResponse(
  headers: string[],
  rows: string[][],
  filename: string,
): Response {
  const headerLine = headers.join(',');
  const csvRows = rows.map((row) => row.map((v) => csvEscape(v)).join(','));
  const csv = [headerLine, ...csvRows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateDate(value: string): boolean {
  return DATE_REGEX.test(value);
}

export const MAX_IMPORT_ROWS = 1000;
