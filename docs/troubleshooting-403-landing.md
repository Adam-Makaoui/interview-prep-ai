# Troubleshooting intermittent 403 on the marketing site

The public landing route (`/`) is a static SPA shell from Vercel; the FastAPI backend does not serve that HTML. A **403** on “the landing page” almost always comes from the **CDN / edge / deployment policy** or a **failed subresource**, not from Python session routes.

## 1. Identify the exact failing request

In Chrome DevTools → **Network**:

1. Enable **Preserve log** and reload `/`.
2. Filter by status **403** (or type `403` in the filter box).
3. Note the **full URL** and **initiator** (document vs script vs font vs third party).

Interpretation:

| Failing URL pattern | Likely cause |
|--------------------|--------------|
| Document request for `/` | Vercel **Deployment Protection**, SSO, IP allowlist, or WAF-style rule blocking anonymous viewers. |
| `/assets/*.js` or `/assets/*.css` | Same as above, or a bad rewrite/cache rule; compare response headers to a **200** for another asset. |
| `api.*` or your Railway host | Unlikely from `Landing.tsx` (no direct API calls). If present, trace the initiator script. |
| Fonts, analytics, embeds | Third-party policy or adblock; not under your repo’s FastAPI. |

## 2. Vercel project settings

- **Deployment Protection** (password, Vercel authentication, “Only team can access”): unauthenticated visitors receive **401/403** on HTML or assets depending on configuration. Intermittent behavior can happen when some users have a Vercel session cookie and others do not.
- **Firewall / bot protection** (if enabled): can block certain IPs or user-agents with 403.

**Mitigation:** For the **production** domain’s production deployment, turn off protection for public marketing unless you intentionally gate the whole site.

## 3. Backend 403 in this repository

The API returns **403** for **plan-gated LLM model** updates (`PUT /api/profile/llm-model`), not for `GET /`. If DevTools shows 403 on an `/api/...` URL from **Settings**, that is expected for Free users picking a Pro-only model.

## 4. CORS vs 403

Browser **CORS** failures usually surface as blocked responses or console CORS errors; preflight **OPTIONS** should return **200** with `Access-Control-Allow-Origin` matching the page origin. If your symptom is actually **resume upload** or API calls from `www` vs apex, fix **`FRONTEND_URL`** on Railway (list both origins or rely on apex/www expansion). See [`environment-isolation.md`](environment-isolation.md) and `scripts/prod_smoke.py` (CORS checks).

## 5. What to capture when escalating

- Exact 403 URL, method, and response body snippet.
- Response headers: `server`, `x-vercel-id`, `cache-control`.
- Whether the issue reproduces in an incognito window (no cookies).
