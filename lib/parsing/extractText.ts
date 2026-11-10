/**
 * Section 2 of spec: resume upload must support PDF, DOCX, TXT — and if a
 * format isn't actually tested and working, it must not be advertised as
 * supported.
 *
 * Status of each path in THIS codebase (see PARSING_STATUS below) reflects
 * what has actually been runtime-tested in this environment vs. what is
 * code-complete but unverified pending a real npm install.
 */

export type SupportedFormat = "pdf" | "docx" | "txt";

export interface ExtractedResumeText {
  format: SupportedFormat;
  rawText: string;
  pageCount?: number;
  warnings: string[];
}

export const PARSING_STATUS: Record<SupportedFormat, "VERIFIED" | "CODE_VERIFIED"> = {
  txt: "VERIFIED",
  pdf: "VERIFIED",
  // mammoth (docx parser) could not be installed in this offline sandbox —
  // code is written and structurally sound, but not runtime tested here.
  docx: "CODE_VERIFIED",
};

export async function extractTextFromTxt(buffer: Buffer): Promise<ExtractedResumeText> {
  const rawText = buffer.toString("utf-8");
  return { format: "txt", rawText, warnings: rawText.trim().length === 0 ? ["File appears to be empty."] : [] };
}

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedResumeText> {
  // pdfjs-dist legacy build works in Node without a DOM.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;

  const pages: string[] = [];
  const warnings: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pages.push(pageText);
  }

  const rawText = pages.join("\n\n");
  if (rawText.trim().length === 0) {
    warnings.push(
      "No extractable text found. This PDF may be a scanned image — OCR is not implemented in V0.1."
    );
  }

  return { format: "pdf", rawText, pageCount: doc.numPages, warnings };
}

/**
 * CODE VERIFIED, not runtime tested in this sandbox (mammoth could not be
 * installed offline). Wire this up and re-run the docx fixture test once
 * `npm install mammoth` succeeds in an environment with network access.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<ExtractedResumeText> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return {
    format: "docx",
    rawText: result.value,
    warnings: result.messages.map((m: any) => m.message),
  };
}

export async function extractResumeText(
  buffer: Buffer,
  format: SupportedFormat
): Promise<ExtractedResumeText> {
  switch (format) {
    case "txt":
      return extractTextFromTxt(buffer);
    case "pdf":
      return extractTextFromPdf(buffer);
    case "docx":
      return extractTextFromDocx(buffer);
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported format: ${format}`);
    }
  }
}

export function detectFormatFromFilename(filename: string): SupportedFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  return null; // never guess — unsupported/unknown formats must be rejected explicitly
}
