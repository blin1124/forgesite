// app/api/generate/route.ts
import OpenAI from "openai";

export const runtime = "nodejs";

/**
 * /api/generate
 * - BYOK (Bring Your Own Key)
 * - Expects: { apiKey: string, prompt: string }
 * - Returns: { html: string }
 * - This route ONLY generates HTML
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const apiKey =
      typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const prompt =
      typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return Response.json(
        { error: "Missing or invalid OpenAI API key." },
        { status: 400 }
      );
    }

    if (!prompt) {
      return Response.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt = [
      "You are a website generator.",
      "Return ONLY raw HTML.",
      "Do NOT use markdown.",
      "Do NOT wrap in backticks.",
      "The response MUST start with <html> and end with </html>.",
      "Include <head> and <body>.",
      "Use inline CSS only (no external files).",
      "Images must use full https URLs.",
    ].join(" ");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const html =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!html.startsWith("<html")) {
      return Response.json(
        { error: "Model did not return valid HTML." },
        { status: 500 }
      );
    }

    return Response.json({ html });
  } catch (err: any) {
    console.error("GENERATE_ROUTE_ERROR:", err);
    return Response.json(
      { error: err?.message || "Server error in /api/generate" },
      { status: 500 }
    );
  }
}







