import type { FileTypeResult } from "file-type"
import { fileTypeFromBuffer } from "file-type"
import mammoth from "mammoth"

// ✅ pdf-parse needs a CJS-safe import in Next/TS
import * as pdfParseNS from "pdf-parse"

type Extracted =
  | { kind: "text"; filename: string; mime: string; text: string }
  | { kind: "binary"; filename: string; mime: string; note: string }

function asString(v: unknown) {
  return typeof v === "string" ? v : ""
}

export async function extractFromUpload(buf: Buffer, filename: string): Promise<Extracted> {
  const ft: FileTypeResult | undefined = await fileTypeFromBuffer(buf)
  const mime = ft?.mime || "application/octet-stream"
  const name = filename || "upload"

  // DOCX -> extract text
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: buf })
    const text = asString(result.value).trim()
    return {
      kind: "text",
      filename: name,
      mime,
      text: text || "(No extractable text found in DOCX.)",
    }
  }

  // PDF -> extract text
  if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    // pdf-parse default export can be tricky; this works reliably:
    const pdfParse = (pdfParseNS as any).default ?? (pdfParseNS as any)
    const parsed = await pdfParse(buf)
    const text = asString(parsed?.text).trim()
    return {
      kind: "text",
      filename: name,
      mime,
      text: text || "(No extractable text found in PDF.)",
    }
  }

  // fallback
  return {
    kind: "binary",
    filename: name,
    mime,
    note: "Unsupported file type for text extraction.",
  }
}

