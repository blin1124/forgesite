import Stripe from "stripe";

// IMPORTANT:
// Your installed Stripe types only accept this exact apiVersion string.
// If you change Stripe package versions later, this string may change too.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

