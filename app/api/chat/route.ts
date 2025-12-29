import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * SAFE DESIGN GOAL:
 * - Chat can help users rewrite the WEBSITE PROMPT (left textbox).
 * - Chat must NEVER output HTML/CSS/JS/code blocks.
 * - Chat returns JSON only: { reply, prompt_update }.
 */
const SYSTEM = [
  "You are ForgeSite's prompt assistant.",
  "Your job is to rewrite the user's WEBSITE PROMPT (the left textbox) based on what they ask in chat.",
  "You MUST return JSON only (no markdown): { reply: string, prompt_update: string }.",
  "NEVER return HTML, CSS, JS, or code blocks.",
  "NEVER instruct the user to edit files.",
  "If the user asks for changes, incorporate them into a clean, detailed prompt spec.",
  "If an image/logo is provided, instruct the website to include the logo (header and/or hero) and reference it by URL.",
  "If a PDF is provided, instruct the website to include a Documents section with (1) a View link opening in a new tab, (2) a Download link, and (3) an embedded preview using an iframe.",
  "If a DOCX/XLSX is provided, instruct the website to include a Documents section with View/Download links (no embed).",
  "Keep prompt_update as a single cohesive prompt (not bullet fragments).",
  "If currentPrompt is empty, create a fresh prompt from the user's request.",
].join(" ");

type ChatMsg = { role?: string; content?: string };

function cleanHistory(history: any): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  if (!Array.isArray(history)) return out;

  for (const m of history.slice(-12)) {
    const role = m?.role;
    const content = m?.content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      out.push({ role, content: content.trim() });
    }
  }
  return out;
}

function isHttpUrl(u?: string | null) {
  return !!u && /^https?:\/\//i.test(u);
}

function classifyFile(mime?: string | null) {
  const m = (mime || "").toLowerCase();
  const isImage = m === "image/png" || m === "image/jpeg" || m === "image/jpg" || m === "image/webp";
  const isPdf = m === "application/pdf";
  const isDocx =
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || m === "application/msword";
  const isXlsx =
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || m === "application/vnd.ms-excel";
  return { isImage, isPdf, isDocx, isXlsx };
}

/**
 * Uses the model to produce strict JSON: { reply, prompt_update }
 * Ensures PDFs are described in prompt_update as link + iframe embed instructions.
 */
async function producePromptUpdate(args: {
  client: OpenAI;
  message: string;
  currentPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  file_url?: string | null;
  file_mime?: string | null;
  file_name?: string | null;
}) {
  const { client, message, currentPrompt, history, file_url, file_mime, file_name } = args;

  const { isImage, isPdf, isDocx, isXlsx } = classifyFile(file_mime);

  const fileNote =
    isHttpUrl(file_url) && file_name
      ? `Attachment provided: ${file_name} (${file_mime || "unknown"}). URL: ${file_url}`
      : isHttpUrl(file_url)
      ? `Attachment provided (${file_mime || "unknown"}). URL: ${file_url}`
      : "";

  // Add extra “hard instructions” for the model so it reliably handles PDFs.
  const attachmentDirective = (() => {
    if (!isHttpUrl(file_url)) return "";

    if (isImage) {
      return [
        "Attachment handling requirement:",
        "- This is an image/logo. The generated website MUST display it.",
        "- Place it in the header and/or hero area (top left by default unless user specified).",
        `- Use this URL exactly: ${file_url}`,
      ].join("\n");
    }

    if (isPdf) {
      return [
        "Attachment handling requirement:",
        "- This is a PDF. The generated website MUST NOT treat it like an image.",
        "- Add a 'Documents' (or 'Resources') section.",
        "- Include:",
        "  1) 'View PDF' link opening in a new tab (target=_blank).",
        "  2) 'Download PDF' link.",
        "  3) An embedded preview using an iframe (full width, ~700px height) with a fallback link if embedding fails.",
        `- Use this PDF URL exactly: ${file_url}`,
      ].join("\n");
    }

    if (isDocx || isXlsx) {
      return [
        "Attachment handling requirement:",
        "- This is an office document (DOCX/XLSX).",
        "- Add a 'Documents' (or 'Resources') section.",
        "- Include a 'View' link (opens in a new tab) and a 'Download' link.",
        "- Do NOT embed in an iframe.",
        `- Use this URL exactly: ${file_url}`,
      ].join("\n");
    }

    return [
      "Attachment handling requirement:",
      "- A file was provided. Add a 'Documents' (or 'Resources') section with a link to open/download it.",
      `- Use this URL exactly: ${file_url}`,
    ].join("\n");
  })();

  const model = "gpt-4o-mini";

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
  ];

  for (const m of history) messages.push(m);

  const userText = [
    `User chat request: ${message}`,
    currentPrompt?.trim() ? `\n\nCURRENT PROMPT:\n${currentPrompt.trim()}` : "\n\nCURRENT PROMPT is empty.",
    fileNote ? `\n\n${fileNote}` : "",
    attachmentDirective ? `\n\n${attachmentDirective}` : "",
    "\n\nTask: Rewrite prompt_update as one cohesive website prompt spec incorporating the user's request and any attachment handling requirements.",
    "Return ONLY JSON: { reply, prompt_update }.",
  ].join("\n");

  const resp = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: SYSTEM }, ...messages.slice(1), { role: "user", content: userText }],
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: "json_object" },
  });

  const raw = resp.choices?.[0]?.message?.content || "{}";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reply: "OK", prompt_update: currentPrompt || "" };
  }

  const reply = typeof parsed.reply === "string" ? parsed.reply : "OK";
  const prompt_update =
    typeof parsed.prompt_update === "string" ? parsed.prompt_update : currentPrompt || "";

  return { reply, prompt_update };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const apiKey = String(body?.apiKey || "");
    const message = String(body?.message || "");
    const currentPrompt = String(body?.currentPrompt || "");
    const history = cleanHistory(body?.history);

    // These must be passed from your Builder after /api/upload succeeds
    const file_url = body?.file_url ? String(body.file_url) : null;
    const file_mime = body?.file_mime ? String(body.file_mime) : null;
    const file_name = body?.file_name ? String(body.file_name) : null;

    if (!apiKey || !apiKey.startsWith("sk-")) {
      return jsonError("Missing/invalid OpenAI API key.", 400);
    }
    if (!message.trim() && !file_url) {
      return jsonError("No message provided.", 400);
    }

    if (file_url && !isHttpUrl(file_url)) {
      return jsonError("Invalid file_url (must start with http/https).", 400);
    }

    const client = new OpenAI({ apiKey });

    const { reply, prompt_update } = await producePromptUpdate({
      client,
      message: message.trim() || (file_url ? "User attached a file and wants to use it on the site." : ""),
      currentPrompt,
      history,
      file_url,
      file_mime,
      file_name,
    });

    return NextResponse.json({ reply, prompt_update });
  } catch (err: any) {
    console.error("CHAT_ROUTE_ERROR:", err);
    return jsonError(err?.message || "Chat route crashed.", 500);
  }
}






