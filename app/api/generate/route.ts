import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey as string | undefined;
    const prompt = body.prompt as string | undefined;

    if (!apiKey) {
      return Response.json(
        { error: "Missing apiKey. Paste your OpenAI key into the Builder page." },
        { status: 400 }
      );
    }

    if (!prompt?.trim()) {
      return Response.json({ error: "Missing prompt" }, { status: 400 });
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
    });

    const html = resp.choices?.[0]?.message?.content?.trim() || "";

    if (!html.startsWith("<html")) {
      return Response.json(
        { error: "Model did not return raw HTML. Try again or tighten the prompt." },
        { status: 500 }
      );
    }

    return Response.json({ html });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Server error in /api/generate" },
      { status: 500 }
    );
  }
}








