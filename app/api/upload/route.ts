import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/msword",
  "application/vnd.ms-excel",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_");
}

export async function POST(req: Request) {
  try {
    // ✅ Don't trust content-type checks—just attempt formData
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError("Upload must be sent as multipart/form-data (FormData).", 400);
    }

    const file = form.get("file");

    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return jsonError('Missing file. Field name must be "file".', 400);
    }

    const f = file as File;
    const mime = (f.type || "").toLowerCase();

    if (!ALLOWED_MIME.has(mime)) return jsonError(`File type not allowed: ${mime || "unknown"}`, 400);
    if (f.size > MAX_BYTES) return jsonError(`File too large. Max ${MAX_BYTES / (1024 * 1024)}MB`, 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const bucket = process.env.SUPABASE_UPLOADS_BUCKET || "uploads";

    const clean = safeFileName(f.name);
    const ext = clean.includes(".") ? clean.split(".").pop() : "bin";
    const path = `builder/${crypto.randomUUID()}.${ext}`;

    const bytes = new Uint8Array(await f.arrayBuffer());

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });

    if (upErr) return jsonError(`Upload failed: ${upErr.message}`, 500);

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    const publicUrl = data?.publicUrl || "";
    if (!publicUrl.startsWith("http")) return jsonError("Upload succeeded but no public URL returned.", 500);

    // ✅ Return BOTH response shapes so client never breaks again
    return NextResponse.json({
      url: publicUrl,
      file_url: publicUrl,

      mime,
      file_mime: mime,

      name: f.name,
      file_name: f.name,

      path,
      size: f.size,
    });
  } catch (err: any) {
    console.error("UPLOAD_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Upload route crashed", 500);
  }
}



