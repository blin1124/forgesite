// lib/uploads/extract.ts
import pdfParse from "pdf-parse";
import { fileTypeFromBuffer } from "file-type";

export type ExtractedAttachment =
  | { kind: "text"; filename: string; mime: string; text: string }
  | { kind: "image"; filename: string; mime: "image/png" | "image/jpeg"; dataUrl: string }
  | { kind: "unsupported"; filename: string; mime: string; reason: string };

const MAX_BYTES = 8 * 1024 * 1024; // 8MB hard limit (keeps you safe + fast)

function toDataUrl(mime: string, buf: Buffer) {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function extractAttachment(file: File): Promise<ExtractedAttachment> {
  const filename = file.name || "upload";
  const arrayBuf = await file.arrayBuffer();

  if (arrayBuf.byteLength > MAX_BYTES) {
    return {
      kind: "unsupported",
      filename,
      mime: file.type || "application/octet-stream",
      reason: `File too large. Max ${MAX_BYTES / (1024 * 1024)}MB.`,
    };
  }

  const buf = Buffer.from(arrayBuf);

  // Trust sniffing more than browser-provided mimetype
  const sniff = await fileTypeFromBuffer(buf);
  const mime = (sniff?.mime || file.type || "application/octet-stream").toLowerCase();

  // ---- PDFs -> extract text (chat can reference it)
  if (mime === "application/pdf") {
    const parsed = await pdfParse(buf);
    const text = (parsed.text || "").trim();
    return { kind: "text", filename, mime, text: text || "(No extractable text found in PDF.)" };
  }

  // ---- PNG/JPEG -> pass to model as image (vision)
  if (mime === "image/png" || mime === "image/jpeg") {
    return { kind: "image", filename, mime: mime as any, dataUrl: toDataUrl(mime, buf) };
  }

  // ---- Basic “text-like” fallbacks (optional)
  if (mime.startsWith("text/")) {
    const text = buf.toString("utf8").slice(0, 200_000); // cap
    return { kind: "text", filename, mime, text };
  }

  return {
    kind: "unsupported",
    filename,
    mime,
    reason: "Unsupported file type. Allowed: PDF, PNG, JPG (plus plain text).",
  };
}
