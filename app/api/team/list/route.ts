https://nextjs.org/telemetry
  ▲ Next.js 14.2.35
   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
Failed to compile.
./app/api/team/list/route.ts:9:18
Type error: This expression is not callable.
  Type 'SupabaseClient<any, "public", "public", any, any>' has no call signatures.
   7 |     const { owner_email } = await req.json()
   8 |     if (!owner_email) return new NextResponse('Missing owner_email', { status: 400 })
>  9 |     const supa = supabaseAdmin()
     |                  ^
  10 |     const { data: owner, error: e1 } = await supa.from('entitlements').select('team_id, role').eq('email', owner_email).maybeSingle()
  11 |     if (e1 || !owner || owner.role !== 'owner') return new NextResponse('Not owner or no team', { status: 403 })
  12 |     const { data: members } = await supa.from('entitlements').select('email, role').eq('team_id', owner.team_id)
Next.js build worker exited with code: 1 and signal: null
Error: Command "npm run build" exited with 1
