import fs from "fs/promises";
// pdf-parse has no default ESM export; use require-style interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer, opts?: any) => Promise<any>;

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

/**
 * Extracts text from a PDF file on a per-page basis.
 * Uses pdf-parse's pagerender hook to capture text page-by-page.
 * Falls back to full-text (page 1) if per-page extraction yields nothing.
 * Individual page errors are caught and skipped rather than aborting the parse.
 */
export async function extractPdfPages(filePath: string): Promise<ParsedPage[]> {
  const buffer = await fs.readFile(filePath);
  const pages: ParsedPage[] = [];

  // Per-page extraction via pagerender callback
  await pdfParse(buffer, {
    pagerender: (pageData: any) => {
      return pageData
        .getTextContent()
        .then((content: any) => {
          try {
            const text = content.items
              .map((item: any) => (typeof item.str === "string" ? item.str : ""))
              .join(" ")
              .trim();
            if (text.length > 0) {
              pages.push({ pageNumber: pageData.pageIndex + 1, text });
            }
            return text;
          } catch {
            // Malformed page content — skip this page, don't abort entire parse
            return "";
          }
        })
        .catch(() => {
          // getTextContent() itself rejected — skip page silently
          return "";
        });
    },
  });

  // Fallback: if per-page callback captured nothing, use the full-text concatenation
  if (pages.length === 0) {
    const data = await pdfParse(buffer);
    const fullText = data.text?.trim() ?? "";
    if (fullText.length > 0) {
      pages.push({ pageNumber: 1, text: fullText });
    }
  }

  return pages;
}

/**
 * Extracts plain text from a .txt or .md file, treating it as a single page.
 */
export async function extractTextFile(filePath: string): Promise<ParsedPage[]> {
  const text = await fs.readFile(filePath, "utf-8");
  return [{ pageNumber: 1, text: text.trim() }];
}
