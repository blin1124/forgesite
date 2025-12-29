// app/api/section/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId")?.trim() || null;

    if (!siteId) {
      return new NextResponse("Missing siteId", { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      id,
      title,
      content,
      order_index,
      page,
      type,
    }: {
      id?: string | null;
      title?: string | null;
      content?: any;
      order_index?: number | null;
      page?: string | null;
      type?: string | null;
    } = body || {};

    // ✅ IMPORTANT: supabaseAdmin is a client object, not a function
    const admin = supabaseAdmin;

    // Update existing
    if (id) {
      const { data, error } = await admin
        .from("sections")
        .update({
          title: title ?? null,
          content: content ?? null,
          order_index: order_index ?? null,
          page: page ?? null,
          type: type ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("site_id", siteId)
        .select("*")
        .single();

      if (error) {
        return new NextResponse(error.message, { status: 500 });
      }

      return NextResponse.json({ section: data });
    }

    // Create new
    const { data, error } = await admin
      .from("sections")
      .insert({
        site_id: siteId,
        title: title ?? null,
        content: content ?? null,
        order_index: order_index ?? null,
        page: page ?? null,
        type: type ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json({ section: data });
  } catch (err: any) {
    return new NextResponse(err?.message || "Section route error", { status: 500 });
  }
}



