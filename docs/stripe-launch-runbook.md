# Stripe Launch Runbook

Supabase/Vercel/Railway isolation for non-billing env vars: [`environment-isolation.md`](./environment-isolation.md).

This runbook covers the paid Pro subscription path. Keep **dev/test billing**
and **production/live billing** separate: each environment needs its own Stripe
mode, price id, webhook endpoint, webhook secret, Railway backend, and database.

## Environment Matrix

| Environment | Stripe mode | Railway service | Database | Frontend |
|---|---|---|---|---|
| Dev / staging | Test mode | Railway `dev` environment | Supabase dev project | `dev.interviewintel.ai` |
| Production | Live mode | Railway `production` environment | Supabase production project | `interviewintel.ai` |

Do not point Stripe test webhooks at production Railway, and do not reuse a live
Stripe price id in the dev Railway environment.

## Required Stripe Setup

### Dev / Staging

1. In Stripe **test mode**, create a Pro monthly product/price.
2. Copy the **test** price id into Railway `dev` as `STRIPE_PRICE_PRO_MONTHLY`.
3. Add Railway `dev` `STRIPE_SECRET_KEY` using a **test** secret key.
4. Create a Stripe **test mode** webhook endpoint:

   `https://<dev-railway-service>/api/billing/webhook`

5. Copy that endpoint's signing secret into Railway `dev` as `STRIPE_WEBHOOK_SECRET`.
6. Set `STRIPE_CUSTOMER_PORTAL_RETURN_URL` to:

   `https://dev.interviewintel.ai/app/settings`

### Production

1. In Stripe **live mode**, create a Pro monthly product/price.
2. Copy the **live** price id into Railway `production` as `STRIPE_PRICE_PRO_MONTHLY`.
3. Add Railway `production` `STRIPE_SECRET_KEY` using a live secret key.
4. Create a Stripe **live mode** webhook endpoint:

   `https://<prod-railway-service>/api/billing/webhook`

5. Copy that endpoint's signing secret into Railway `production` as `STRIPE_WEBHOOK_SECRET`.
6. Set `STRIPE_CUSTOMER_PORTAL_RETURN_URL` to:

   `https://interviewintel.ai/app/settings`

For both webhook endpoints, subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## App Behavior

- `/api/billing/checkout` creates a subscription Checkout Session for signed-in users.
- `/api/billing/portal` creates a Customer Portal Session for users with a linked Stripe customer.
- `/api/billing/webhook` verifies the Stripe signature and maps subscription state to `profiles.plan`.
- Active or trialing subscription on the configured Pro price sets `profiles.plan = 'pro'`.
- Deleted, unpaid, incomplete, or wrong-price subscriptions set `profiles.plan = 'free'`.

## Dev Test Checklist

- Sign in as a test user.
- Click Upgrade in Settings.
- Complete Checkout with a Stripe test card.
- Confirm Stripe webhook returns `2xx`.
- Confirm `GET /api/profile/me` returns `plan: "pro"`.
- Confirm Pro model choices are available.
- Confirm daily session limit does not block the user.
- Open Customer Portal from Settings.
- Cancel subscription in test mode.
- Confirm webhook downgrades the profile to `free`.

## Production Live Checklist

- Confirm Railway production uses live Stripe keys and production Supabase.
- Confirm Vercel production uses production Supabase and production Railway.
- Create a small live subscription with a real card.
- Confirm Stripe webhook returns `2xx`.
- Confirm `GET /api/profile/me` returns `plan: "pro"`.
- Cancel through Customer Portal.
- Confirm webhook downgrades the profile to `free`.
- Refund/cancel any real charge created during launch validation.

## Environment variable verification (operator)

Use this as a final pass before flipping traffic or announcing billing.

| Check | Production | Dev / staging |
|-------|------------|---------------|
| `STRIPE_SECRET_KEY` | Live `sk_live_...` | Test `sk_test_...` |
| `STRIPE_PRICE_PRO_MONTHLY` | Live price id | Test price id |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from **live** webhook endpoint | From **test** webhook endpoint |
| Webhook URL host | Production Railway only | Dev Railway only |
| `STRIPE_CUSTOMER_PORTAL_RETURN_URL` | `https://interviewintel.ai/app/settings` (or prod app URL) | Dev/staging settings URL |
| Railway service | `production` environment | `dev` (or separate service) |
| Same Stripe mode everywhere on that host | No test keys on prod API | No live keys on dev API |

If `GET /api/billing/checkout` returns **503**, the price id or secret key is missing for that deploy.
