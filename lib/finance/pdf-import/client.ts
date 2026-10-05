// lib/finance/pdf-import/client.ts
// Browser helpers for statement files: telling a PDF from a CSV, encoding a
// PDF for the import request, and handing a chosen file from the Settings
// page to the import page.
//
// The handoff keeps the File object in this module's memory only. A client
// side navigation (router.push) keeps the module loaded, so the import page
// picks the file up; a full reload drops it, and nothing about the statement
// is ever written to browser storage.

/** The largest PDF the import accepts, in bytes (the server checks again). */
export const MAX_PDF_FILE_BYTES = 10 * 1024 * 1024;

export const PDF_TOO_LARGE_TEXT =
  'This PDF is larger than 10 MB. Statements are usually far smaller: check you chose the right file.';

/** True for a file that is a PDF by type or by name. */
export function isPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** The file's bytes as base64, built in chunks so a large file doesn't overflow the call stack. */
export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

let pending: File | null = null;

/** Keeps a statement file for the import page to pick up after navigating there. */
export function setPendingStatementFile(file: File | null): void {
  pending = file;
}

/** Returns the waiting file once, then forgets it. */
export function takePendingStatementFile(): File | null {
  const file = pending;
  pending = null;
  return file;
}
