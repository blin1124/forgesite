import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")

// ✅ Export a SINGLE browser client instance (NOT a function)
export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey)
