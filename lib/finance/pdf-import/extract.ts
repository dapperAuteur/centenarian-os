// lib/finance/pdf-import/extract.ts
// PDF bytes -> positioned text -> lines, inside this server process.
//
// PRIVACY: the statement is read here with pdfjs-dist (Apache-2.0), in
// memory, and never written anywhere or sent to any other service. No OCR, no
// AI, no external API. A PDF with no text layer (a scan) is refused rather
// than guessed at.
//
// Server only: call it from a Node route (`export const runtime = 'nodejs'`).
// pdfjs is loaded with a dynamic import so the parsers and their tests never
// load it.

import { ImportError } from '../csv-import/errors.ts';
import { groupIntoLines } from './lines.ts';
import type { PdfLine, PdfPageText, TextItem } from './types.ts';

/** The largest PDF accepted, in bytes. The host may refuse a smaller request body first. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** The most pages read. Card statements run 4 to 25 pages; a card agreement insert makes them long. */
export const MAX_PDF_PAGES = 60;

export const NO_TEXT_MESSAGE =
  "This PDF has no readable text; scanned statements aren't supported. Download the statement from your bank's website as a PDF or CSV.";

export const ENCRYPTED_MESSAGE =
  'This PDF is password-protected. Open it, save a copy without the password, and choose that copy.';

export const NOT_PDF_MESSAGE = "This file isn't a PDF that can be read. Download the statement again and choose that file.";

export interface ExtractedPdf {
  pageCount: number;
  /** Pages actually read (at most MAX_PDF_PAGES). */
  pagesRead: number;
  lines: PdfLine[];
}

/** True when the bytes start with the PDF signature (allowing a little junk before it, as readers do). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

interface PdfjsTextItem {
  str?: string;
  transform?: number[];
  width?: number;
}

/**
 * Reads the text of a PDF. Throws ImportError 400 for a file that isn't a
 * PDF, is password-protected, or has no text layer, and 413 when it is too large.
 */
export async function extractPdfLines(bytes: Uint8Array): Promise<ExtractedPdf> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new ImportError(413, 'file_too_large', 'This PDF is larger than 10 MB. Statements are usually far smaller: check you chose the right file.');
  }
  if (!looksLikePdf(bytes)) throw new ImportError(400, 'not_pdf', NOT_PDF_MESSAGE);

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Run pdfjs's worker code in this process instead of a worker thread, so it
  // never has to locate its worker file on disk at runtime.
  const globals = globalThis as { pdfjsWorker?: unknown };
  if (!globals.pdfjsWorker) {
    globals.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }

  const task = pdfjs.getDocument({
    // pdfjs takes ownership of the buffer it is given: pass a copy.
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => undefined);
    const name = (error as { name?: string } | null)?.name;
    if (name === 'PasswordException') throw new ImportError(400, 'pdf_encrypted', ENCRYPTED_MESSAGE);
    throw new ImportError(400, 'not_pdf', NOT_PDF_MESSAGE);
  }

  try {
    const pagesRead = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: PdfPageText[] = [];
    for (let number = 1; number <= pagesRead; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const raw of content.items as PdfjsTextItem[]) {
        if (typeof raw.str !== 'string' || !raw.transform || raw.str.trim() === '') continue;
        items.push({ x: raw.transform[4], y: raw.transform[5], w: raw.width ?? 0, str: raw.str });
      }
      pages.push({ page: number, items });
      page.cleanup();
    }

    const lines = groupIntoLines(pages);
    const words = lines.reduce((count, line) => count + line.text.split(' ').length, 0);
    if (words < 20) throw new ImportError(400, 'pdf_no_text', NO_TEXT_MESSAGE);
    return { pageCount: doc.numPages, pagesRead, lines };
  } finally {
    await task.destroy();
  }
}
