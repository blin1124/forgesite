// app/api/generate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const apiKey = String(body?.apiKey || "");
    const prompt = String(body?.prompt || "");

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return jsonError("Missing/invalid apiKey. Paste your OpenAI key into the Builder page.", 400);
    }

    if (!prompt.trim()) {
      return jsonError("Missing prompt.", 400);
    }

    const client = new OpenAI({ apiKey });

    const system = [
      "You are a website generator.",
      "Return ONLY valid HTML (no markdown, no backticks).",
      "Must start with <html> and end with </html>.",
      "Include <head> and <body>.",
      "Use clean, modern, responsive styling with inline CSS in <style>.",
      "If the prompt includes an IMAGE URL, use it with <img src='...'> (do not invent other URLs).",
      "If the prompt includes a PDF URL, add a 'Documents' section with:",
      " - a 'View PDF' link (target=_blank)",
      " - a 'Download PDF' link (download attribute if possible)",
      " - a preview using <object data='PDF_URL' type='application/pdf'> with a fallback message + link if embedding fails.",
      "Do NOT use an <iframe> for PDF preview; prefer <object> or <embed>.",
    ].join(" ");

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const html = resp.choices?.[0]?.message?.content?.trim() || "";

    if (!html.startsWith("<html")) {
      return jsonError("Model did not return raw HTML. Try again or tighten the prompt.", 500);
    }

    return NextResponse.json({ html });
  } catch (err: any) {
    console.error("GENERATE_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Server error in /api/generate", 500);
  }
}









