export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { Resend } from "resend"
import { supabaseAdmin } from "@/lib/supabase"

type InviteBody = {
  email?: string
  teamId?: string
  inviterName?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InviteBody

    const email = body.email?.trim()
    const teamId = body.teamId?.trim()
    const inviterName = body.inviterName?.trim() || "Forgesite"

    if (!email) return new NextResponse("Missing email", { status: 400 })
    if (!teamId) return new NextResponse("Missing teamId", { status: 400 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return new NextResponse("Missing RESEND_API_KEY", { status: 500 })
    }

    // Create a simple invite token row in Supabase (adjust table/fields if yours differ)
    // Expected table example: team_invites(id uuid, team_id text, email text, token text, created_at)
    const token = crypto.randomUUID()

    const { error: inviteErr } = await supabaseAdmin
      .from("team_invites")
      .insert({
        team_id: teamId,
        email,
        token,
        inviter_name: inviterName,
      })

    if (inviteErr) {
      console.error("Supabase invite insert error:", inviteErr)
      return new NextResponse("Failed to create invite", { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const acceptUrl = `${appUrl}/team/accept?token=${encodeURIComponent(token)}`

    const resend = new Resend(resendKey)

    const { error: emailErr } = await resend.emails.send({
      from: "Forgesite <no-reply@forgesite.ai>",
      to: [email],
      subject: `${inviterName} invited you to join a Forgesite team`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>You&apos;re invited</h2>
          <p><b>${inviterName}</b> invited you to join their team in Forgesite.</p>
          <p>
            <a href="${acceptUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
              Accept invite
            </a>
          </p>
          <p style="font-size:12px;color:#666">Or paste this link in your browser:<br/>${acceptUrl}</p>
        </div>
      `,
    })

    if (emailErr) {
      console.error("Resend error:", emailErr)
      return new NextResponse("Failed to send invite email", { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("team/invite error:", err)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

