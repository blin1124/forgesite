import OpenAI from "openai";

export const runtime = "nodejs";

function stripFences(s: string) {
  // removes ```html ... ``` if the model tries it
  return s.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = String(body?.apiKey || "");
    const prompt = String(body?.prompt || "");

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return Response.json({ error: "Missing/invalid apiKey. Paste your OpenAI key into the Builder page." }, { status: 400 });
    }
    if (!prompt.trim()) {
      return Response.json({ error: "Missing prompt" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });

    const system = [
      "You are a website generator.",
      "Return ONLY valid HTML. No markdown. No backticks.",
      "Must start with <html> and end with </html>.",
      "Include <head> and <body>.",
      "Put CSS in a single <style> inside <head>.",
      "Make it modern, clean, and responsive.",
      "If the prompt includes an IMAGE URL, use it exactly in <img src='...'>.",
      "If the prompt includes a PDF URL, add a Documents section with:",
      " - View link target=_blank",
      " - Download link",
      " - Embedded preview using <object> or <embed> (preferred over iframe).",
    ].join(" ");

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    const html = stripFences(raw);

    if (!html.startsWith("<html") || !html.endsWith("</html>")) {
      return Response.json(
        { error: "Model did not return raw <html>...</html>. Try Generate again (or tighten prompt).", raw: raw.slice(0, 400) },
        { status: 500 }
      );
    }

    return Response.json({ html });
  } catch (err: any) {
    console.error("GENERATE_ERROR:", err);
    return Response.json({ error: err?.message || "Server error in /api/generate" }, { status: 500 });
  }
}









