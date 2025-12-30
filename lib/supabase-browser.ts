> forgesite-ai@0.2.0 build
> next build
  ▲ Next.js 14.2.35
   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
Failed to compile.
./components/Navbar.tsx:15:46
Type error: Property 'auth' does not exist on type '() => SupabaseClient<any, "public", "public", any, any>'.
  13 |     const load = async () => {
  14 |       setLoading(true)
> 15 |       const { data } = await supabaseBrowser.auth.getSession()
     |                                              ^
  16 |       setEmail(data?.session?.user?.email ?? null)
  17 |       setLoading(false)
  18 |     }
Next.js build worker exited with code: 1 and signal: null
Error: Command "npm run build" exited with 1

