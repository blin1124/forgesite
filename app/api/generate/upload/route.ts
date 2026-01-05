// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return jsonError("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.", 500);
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return jsonError("No file provided. Field name must be 'file'.", 400);
    }

    const mime = file.type || "application/octet-stream";
    const name = file.name || "upload";
    const ext = name.includes(".") ? name.split(".").pop() : "";
    const safeExt = (ext || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const path = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt ? "." + safeExt : ""}`;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const buf = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    });

    if (upErr) return jsonError(upErr.message, 500);

    // If bucket is PUBLIC, this works:
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl || "";

    // If bucket is NOT public, you can switch to signed URLs later.
    if (!publicUrl) return jsonError("Upload succeeded but no public URL available. Make bucket public or use signed URLs.", 500);

    return NextResponse.json({
      file_url: publicUrl,
      file_name: name,
      file_mime: mime,
      storage_path: path,
      bucket: BUCKET,
    });
  } catch (err: any) {
    console.error("UPLOAD_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Upload route crashed.", 500);
  }
}



