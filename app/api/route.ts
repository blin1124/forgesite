// Force Node.js runtime for ALL API routes
// This prevents the Edge compiler from trying to bundle
// Stripe, Supabase Admin, crypto, etc.

export const runtime = "nodejs"
