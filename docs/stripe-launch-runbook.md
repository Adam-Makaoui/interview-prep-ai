# Stripe Launch Runbook

This runbook covers the paid Pro subscription path.

## Required Stripe Setup

1. Create a Pro monthly product/price in Stripe.
2. Copy the monthly price id into Railway as `STRIPE_PRICE_PRO_MONTHLY`.
3. Add Railway `STRIPE_SECRET_KEY`.
4. Add Railway `STRIPE_WEBHOOK_SECRET`.
5. In Stripe webhooks, point to:

   `https://<railway-service>/api/billing/webhook`

6. Subscribe the webhook to:
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

## Test Checklist

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
