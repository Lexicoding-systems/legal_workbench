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
 * Falls back to splitting the full text by estimated word count if
 * page-level extraction yields no results.
 */
export async function extractPdfPages(filePath: string): Promise<ParsedPage[]> {
  const buffer = await fs.readFile(filePath);
  const pages: ParsedPage[] = [];

  // Use pagerender callback to capture per-page text
  await pdfParse(buffer, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((content: any) => {
        const text = content.items
          .map((item: any) => item.str)
          .join(" ")
          .trim();
        if (text.length > 0) {
          pages.push({ pageNumber: pageData.pageIndex + 1, text });
        }
        return text;
      });
    },
  });

  // Fallback: if pagerender captured nothing, use full-text and treat as page 1
  if (pages.length === 0) {
    const data = await pdfParse(buffer);
    if (data.text.trim().length > 0) {
      pages.push({ pageNumber: 1, text: data.text.trim() });
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
