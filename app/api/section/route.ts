export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

type SectionRow = {
  id: string
  site_id: string
  type?: string | null
  content?: any
  order_index?: number | null
  created_at?: string
  updated_at?: string
}

function jsonError(message: string, status = 400) {
  return new NextResponse(message, { status })
}

/**
 * GET /api/section?siteId=xxx
 * GET /api/section?id=xxx
 *
 * - If `id` is provided, returns a single section.
 * - If `siteId` is provided, returns all sections for the site.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")?.trim()
    const siteId = url.searchParams.get("siteId")?.trim()

    const admin = supabaseAdmin()

    if (id) {
      const { data, error } = await admin
        .from("sections")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        console.error("GET /api/section (by id) error:", error)
        return jsonError("Failed to fetch section", 500)
      }

      return NextResponse.json({ section: data })
    }

    if (!siteId) return jsonError("Missing siteId or id", 400)

    const { data, error } = await admin
      .from("sections")
      .select("*")
      .eq("site_id", siteId)
      .order("order_index", { ascending: true })

    if (error) {
      console.error("GET /api/section (by siteId) error:", error)
      return jsonError("Failed to fetch sections", 500)
    }

    return NextResponse.json({ sections: data || [] })
  } catch (err) {
    console.error("GET /api/section unexpected error:", err)
    return jsonError("Internal server error", 500)
  }
}

/**
 * POST /api/section
 * Body examples:
 *  - Create:
 *    { "siteId": "xxx", "type": "hero", "content": {...}, "orderIndex": 1 }
 *
 *  - Update:
 *    { "id": "sectionId", "patch": { "content": {...}, "order_index": 2 } }
 *
 * Notes:
 * - This assumes a table named `sections` with columns:
 *   id (uuid), site_id (text/uuid), type (text), content (jsonb),
 *   order_index (int), created_at, updated_at
 * - If your table/columns differ, tell me and I’ll output the exact full file for your schema.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const admin = supabaseAdmin()

    // UPDATE mode
    if (body?.id && body?.patch && typeof body.patch === "object") {
      const id = String(body.id).trim()
      const patch = body.patch as Partial<SectionRow>

      const { data, error } = await admin
        .from("sections")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single()

      if (error) {
        console.error("POST /api/section (update) error:", error)
        return jsonError("Failed to update section", 500)
      }

      return NextResponse.json({ section: data })
    }

    // CREATE mode
    const siteId = String(body?.siteId || "").trim()
    if (!siteId) return jsonError("Missing siteId for create", 400)

    const insertRow = {
      site_id: siteId,
      type: body?.type ?? null,
      content: body?.content ?? null,
      order_index: typeof body?.orderIndex === "number" ? body.orderIndex : null,
    }

    const { data, error } = await admin
      .from("sections")
      .insert(insertRow)
      .select("*")
      .single()

    if (error) {
      console.error("POST /api/section (create) error:", error)
      return jsonError("Failed to create section", 500)
    }

    return NextResponse.json({ section: data })
  } catch (err) {
    console.error("POST /api/section unexpected error:", err)
    return jsonError("Internal server error", 500)
  }
}

/**
 * DELETE /api/section?id=xxx
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")?.trim()
    if (!id) return jsonError("Missing id", 400)

    const admin = supabaseAdmin()

    const { error } = await admin.from("sections").delete().eq("id", id)

    if (error) {
      console.error("DELETE /api/section error:", error)
      return jsonError("Failed to delete section", 500)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("DELETE /api/section unexpected error:", err)
    return jsonError("Internal server error", 500)
  }
}


