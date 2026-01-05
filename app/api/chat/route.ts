import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

const SYSTEM = [
  "You are ForgeSite's prompt assistant.",
  "Your job is to rewrite the user's WEBSITE PROMPT (the left textbox) based on what they ask in chat.",
  "You MUST return JSON only (no markdown): { reply: string, prompt_update: string }.",
  "NEVER return HTML, CSS, JS, or code blocks.",
  "NEVER instruct the user to edit files.",
  "If the user asks for changes, incorporate them into a clean, detailed prompt spec.",
  "If an image/logo is provided, instruct the website to include the logo and reference it by URL.",
  "If a PDF is provided, instruct the website to include a Documents section with (1) View link (new tab), (2) Download link, (3) embedded preview using <object>.",
  "If a DOCX/XLSX is provided, include Documents section with View/Download links (no embed).",
  "Keep prompt_update as a single cohesive prompt.",
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

  const attachmentDirective = (() => {
    if (!isHttpUrl(file_url)) return "";

    if (isImage) {
      return [
        "Attachment handling requirement:",
        "- This is an image/logo. The generated website MUST display it.",
        "- Place it in the header and/or hero area.",
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
        "  3) An embedded preview using an <object> tag (~700px height) with a fallback link.",
        `- Use this PDF URL exactly: ${file_url}`,
      ].join("\n");
    }

    if (isDocx || isXlsx) {
      return [
        "Attachment handling requirement:",
        "- This is an office document (DOCX/XLSX).",
        "- Add a 'Documents' (or 'Resources') section.",
        "- Include a 'View' link (opens in a new tab) and a 'Download' link.",
        "- Do NOT embed in an iframe/object.",
        `- Use this URL exactly: ${file_url}`,
      ].join("\n");
    }

    return [
      "Attachment handling requirement:",
      "- A file was provided. Add a 'Documents' section with open/download link.",
      `- Use this URL exactly: ${file_url}`,
    ].join("\n");
  })();

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      ...history,
      {
        role: "user",
        content: [
          `User chat request: ${message}`,
          currentPrompt?.trim() ? `\n\nCURRENT PROMPT:\n${currentPrompt.trim()}` : "\n\nCURRENT PROMPT is empty.",
          fileNote ? `\n\n${fileNote}` : "",
          attachmentDirective ? `\n\n${attachmentDirective}` : "",
          "\n\nReturn ONLY JSON: { reply, prompt_update }.",
        ].join("\n"),
      },
    ],
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

  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "OK",
    prompt_update: typeof parsed.prompt_update === "string" ? parsed.prompt_update : currentPrompt || "",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const apiKey = String(body?.apiKey || "");
    const message = String(body?.message || "");
    const currentPrompt = String(body?.currentPrompt || "");
    const history = cleanHistory(body?.history);

    const file_url = body?.file_url ? String(body.file_url) : null;
    const file_mime = body?.file_mime ? String(body.file_mime) : null;
    const file_name = body?.file_name ? String(body.file_name) : null;

    if (!apiKey || !apiKey.startsWith("sk-")) return jsonError("Missing/invalid OpenAI API key.", 400);
    if (!message.trim() && !file_url) return jsonError("No message provided.", 400);
    if (file_url && !isHttpUrl(file_url)) return jsonError("Invalid file_url (must start with http/https).", 400);

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






