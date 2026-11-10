import { detectFormatFromFilename, extractTextFromPdf, extractTextFromTxt } from "../parsing/extractText";
import { PDFDocument, StandardFonts } from "pdf-lib";

let passed = 0;
let failed = 0;
function assertTrue(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

async function buildSampleResumePdf(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const lines = [
    "Jordan Rivera",
    "Senior Backend Engineer",
    "",
    "EXPERIENCE",
    "Backend Engineer, Acme Corp, Jan 2020 - Jan 2023",
    "Built payment processing systems using Python and PostgreSQL.",
    "Increased throughput by 35 percent.",
    "",
    "SKILLS",
    "Python, PostgreSQL, Docker, AWS",
  ];
  let y = 740;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 12, font });
    y -= 20;
  }
  return Buffer.from(await pdfDoc.save());
}

async function main() {
  console.log("TEST: format detection from filename");
  assertTrue(detectFormatFromFilename("resume.pdf") === "pdf", "detects .pdf");
  assertTrue(detectFormatFromFilename("resume.DOCX") === "docx", "detects .DOCX case-insensitively");
  assertTrue(detectFormatFromFilename("resume.txt") === "txt", "detects .txt");
  assertTrue(detectFormatFromFilename("resume.pages") === null, "unsupported format returns null, never guesses");

  console.log("TEST: real PDF text extraction (pdfjs-dist, actually parsed, not mocked)");
  {
    const buffer = await buildSampleResumePdf();
    const result = await extractTextFromPdf(buffer);
    assertTrue(result.pageCount === 1, `page count correct (got ${result.pageCount})`);
    assertTrue(result.rawText.includes("Jordan Rivera"), "extracted name from PDF");
    assertTrue(result.rawText.includes("Acme Corp"), "extracted employer from PDF");
    assertTrue(result.rawText.includes("Python"), "extracted skill from PDF");
    assertTrue(result.warnings.length === 0, "no warnings on a normal text PDF");
  }

  console.log("TEST: empty PDF produces a warning instead of silently returning nothing");
  {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = Buffer.from(await doc.save());
    const result = await extractTextFromPdf(bytes);
    assertTrue(result.warnings.length > 0, "warns about likely-scanned/empty PDF");
  }

  console.log("TEST: TXT extraction");
  {
    const buffer = Buffer.from("Alex Kim\nSoftware Engineer\n5 years of Java", "utf-8");
    const result = await extractTextFromTxt(buffer);
    assertTrue(result.rawText.includes("Alex Kim"), "TXT content extracted correctly");
    assertTrue(result.warnings.length === 0, "no warnings on non-empty TXT");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();

