import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { prompt, html, key } = await req.json()
    if (!prompt || !html || !key) return new NextResponse('Missing data', { status: 400 })
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return new NextResponse('Missing OPENAI_API_KEY', { status: 500 })
    const sys = `You are a senior front-end developer. Given an existing HTML document and a target section (by title or selector), regenerate only that section's HTML and CSS, keeping styles embedded. Do not return explanations—only the updated full HTML document, with the target section replaced. Preserve IDs and anchors when possible.`
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `Original HTML:\n\n${html.substring(0, 50000)}\n\nTarget section: ${key}\n\nContext prompt: ${prompt}` }
      ],
      temperature: 0.6
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) return new NextResponse(await res.text(), { status: 500 })
    const data = await res.json()
    const newHtml = data.choices?.[0]?.message?.content
    if (!newHtml || !newHtml.includes('<!doctype html')) return new NextResponse('Bad model output', { status: 500 })
    return NextResponse.json({ html: newHtml })
  } catch (e:any) {
    return new NextResponse(e.message || 'Server error', { status: 500 })
  }
}
