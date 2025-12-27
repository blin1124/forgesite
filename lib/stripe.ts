import Stripe from "stripe";

// ✅ FIX: do NOT set apiVersion here (prevents TS literal mismatch)
// Stripe will use your account's default API version.
const secret = process.env.STRIPE_SECRET_KEY;

if (!secret) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(secret);
