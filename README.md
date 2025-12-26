# ForgeSite AI

AI website builder with Next.js 14. Generate production-ready HTML/CSS from a prompt.
- Landing + Builder
- Stripe subscriptions
- Supabase entitlements via webhook (server-side check, no cookie)
- Template Gallery
- Section Regeneration

## Dev
npm install
cp .env.example .env.local
npm run dev

## Deploy
Use Vercel; add env vars above. Set Stripe webhook to /api/webhooks/stripe



## Team seats (owner + members)
- Schema: `entitlements` now has `team_id` and `role` ('owner' or 'member').
- Invites: `POST /api/team/invite` with `{ inviter_email, invitee_email }` creates a pending invite.
- Accept: `POST /api/team/accept` with `{ email }` accepts all pending invites and upserts an entitlement row as `member` with the inviter's `team_id`.
- Export checks: `/api/generate` verifies owner's active subscription for the `team_id` if the requester is a `member`.
- UI: Builder includes an **Invite teammate** field and a **Check & accept invites** button.


## Team Panel, Email Invites, Metered Billing
- New page: `/team` shows members and pending invites, with **Revoke** buttons.
- Email invites (via Resend): set `RESEND_API_KEY`. Invite emails include a secure token link (`/login?invite=<token>`).
- Metered seats: set `STRIPE_SEAT_PRICE_ID` to the metered seat price. Webhook stores the subscription item id; accepting an invite increments seat usage; revoking a member decrements it.
