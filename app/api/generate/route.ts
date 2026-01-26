import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function extractHtml(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return "";

  // Pull from ```html fences if present
  const fenceMatch =
    text.match(/```html\s*([\s\S]*?)\s*```/i) ||
    text.match(/```\s*([\s\S]*?)\s*```/i);

  const unfenced = (fenceMatch?.[1] ?? text).trim();

  // Full doc already?
  if (/<html[\s>]/i.test(unfenced) && /<\/html>/i.test(unfenced)) return unfenced;

  // Has head/body but no html wrapper
  if (/<head[\s>]/i.test(unfenced) || /<body[\s>]/i.test(unfenced)) {
    return `<!doctype html>\n<html lang="en">\n${unfenced}\n</html>`;
  }

  // Fragment only -> wrap
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ForgeSite</title>
</head>
<body>
${unfenced}
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = String(body?.apiKey || "").trim();
    const prompt = String(body?.prompt || "").trim();

    if (!apiKey) return jsonError("Missing apiKey", 400);
    if (!prompt) return jsonError("Missing prompt", 400);

    const system = [
      "You generate a complete single-file website as HTML.",
      "Return ONLY the raw HTML document.",
      "Must include: <!doctype html>, <html>, <head>, <body>, and closing tags.",
      "Do NOT wrap in markdown fences.",
      "Do NOT return JSON.",
      "No commentary."
    ].join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}

    if (!res.ok) {
      const msg = json?.error?.message || text.slice(0, 500) || `OpenAI error (${res.status})`;
      return jsonError(msg, 500);
    }

    const content =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.text ??
      "";

    const html = extractHtml(content);

    if (!html.trim()) return jsonError("Model returned empty output", 500);

    return NextResponse.json({ html });
  } catch (e: any) {
    return jsonError(e?.message || "Generate failed", 500);
  }
}

