# Bilt — Production Launch Reference

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS                                     │
│  Buyers / Sellers / Carriers / Recyclers / Admins               │
└───────────┬─────────────────────┬───────────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────┐   ┌─────────────────────────────────────────┐
│  Mobile App       │   │  Web Portal                             │
│  Expo (iOS +      │   │  Next.js 14 App Router                  │
│  Android)         │   │  Buyers / Sellers / Admins              │
│                   │   │                                         │
│  Hosted: EAS /    │   │  Hosted: Vercel                         │
│  App Store /      │   │  URL: https://app.bilt.lv              │
│  Google Play      │   │  (or admin.bilt.lv for admin mode)     │
└─────────┬─────────┘   └────────────────────┬────────────────────┘
          │                                   │
          │  REST + WebSocket                 │  REST + WebSocket
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API                                  │
│                     NestJS + Prisma                              │
│                                                                  │
│                     Hosted: Railway                              │
│                     URL: https://api.bilt.lv  (or Railway URL) │
│                     Port: 3000, prefix /api/v1                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
┌──────────────────┐  ┌──────────────┐  ┌────────────────────────┐
│  Supabase DB     │  │  Supabase    │  │  Third-party services  │
│  PostgreSQL      │  │  Auth (JWT)  │  │  Resend (email)        │
│  All app data    │  │  All user    │  │  Stripe (payments)     │
│                  │  │  sessions    │  │  Google Maps (geocode) │
└──────────────────┘  └──────────────┘  └────────────────────────┘
```

---

## Where each app lives

| App         | Platform                      | URL                                                     |
| ----------- | ----------------------------- | ------------------------------------------------------- |
| **Backend** | Railway                       | `https://<service>.railway.app` → map to `api.bilt.lv` |
| **Web**     | Vercel                        | `https://<project>.vercel.app` → map to `app.bilt.lv`  |
| **Mobile**  | EAS → App Store / Google Play | `lv.b3hub.app` bundle ID                                |

---

## Environment Variables — Full Reference

### Railway (Backend)

Set these in Railway dashboard → your service → **Variables**.

| Variable                     | Where to get it                                                                                     | Required |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| `NODE_ENV`                   | Set to `production`                                                                                 | ✅       |
| `PORT`                       | Set to `3000`                                                                                       | ✅       |
| `ALLOWED_ORIGIN`             | Your Vercel URL, e.g. `https://app.bilt.lv`                                                        | ✅       |
| `DATABASE_URL`               | Supabase → Settings → Database → **Connection string** (Transaction mode, port 6543)                | ✅       |
| `DIRECT_URL`                 | Supabase → Settings → Database → **Connection string** (Direct, port 5432)                          | ✅       |
| `JWT_SECRET`                 | Supabase → Settings → API → **JWT Secret**                                                          | ✅       |
| `SUPABASE_URL`               | Supabase → Settings → API → **Project URL**                                                         | ✅       |
| `SUPABASE_KEY`               | Supabase → Settings → API → **service_role** key (secret)                                           | ✅       |
| `RESEND_API_KEY`             | [resend.com](https://resend.com/api-keys) → create key                                              | ✅       |
| `EMAIL_FROM`                 | `noreply@bilt.lv` (must be verified domain in Resend)                                              | ✅       |
| `WEB_URL`                    | `https://app.bilt.lv`                                                                              | ✅       |
| `STRIPE_SECRET_KEY`          | Stripe dashboard → Developers → **API keys** → Secret key (`sk_live_...`)                           | ✅       |
| `STRIPE_WEBHOOK_SECRET`      | Stripe dashboard → Developers → **Webhooks** → endpoint → Signing secret                            | ✅       |
| `GOOGLE_MAPS_SERVER_API_KEY` | Google Cloud Console → APIs & Services → Credentials — restrict to Routes API + Geocoding API by IP | ✅       |
| `SENTRY_DSN`                 | sentry.io → your project → Settings → Client Keys                                                   | optional |

> **`DATABASE_URL` vs `DIRECT_URL`**: Prisma uses `DATABASE_URL` for queries (go through Supabase connection pooler, port 6543) and `DIRECT_URL` for migrations (direct connection, port 5432). Both point at the same Supabase DB. Set both.

---

### Vercel (Web)

Set these in Vercel dashboard → your project → **Settings → Environment Variables**.
Mark all as **Production** (and Preview/Development as needed).

| Variable                          | Value                                                                              | Required |
| --------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| `NEXT_PUBLIC_API_URL`             | `https://api.bilt.lv/api/v1` (your Railway URL + `/api/v1`)                       | ✅       |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud → restrict to HTTP referrer `app.bilt.lv/*`                          | ✅       |
| `NEXT_PUBLIC_APP_MODE`            | `marketplace` for the seller/buyer portal **or** `admin` for admin-only deployment | ✅       |

> `NEXT_PUBLIC_*` variables are baked into the browser bundle at build time — they are **not secret**. Never put private keys in `NEXT_PUBLIC_*`.

---

### EAS (Mobile)

Set these in [expo.dev](https://expo.dev) → your project → **Secrets**, or via CLI:

```bash
cd apps/mobile
eas secret:create --scope project --name EXPO_PUBLIC_API_URL \
  --value "https://api.bilt.lv/api/v1"
```

| Variable                                  | Value                                                 | Required |
| ----------------------------------------- | ----------------------------------------------------- | -------- |
| `EXPO_PUBLIC_API_URL`                     | `https://api.bilt.lv/api/v1`                         | ✅       |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS`     | Google Cloud → restrict to iOS app `lv.b3hub.app`     | ✅       |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID` | Google Cloud → restrict to Android app `lv.b3hub.app` | ✅       |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`      | Stripe → `pk_live_...`                                | ✅       |
| `EAS_PROJECT_ID`                          | From `eas init` (already in `app.config.ts`)          | ✅       |

> **iOS/Android separate Maps keys**: Google requires separate API key restrictions per platform. Create two keys in Google Cloud Console, one restricted to "iOS apps: lv.b3hub.app", one to "Android apps: lv.b3hub.app".

---

## How a deployment works

### Backend (Railway)

1. Push to `main` → Railway detects the change
2. Railway reads `railway.toml` (repo root)
3. Build: `npm ci` (full workspace install) → `npm run build --workspace=apps/backend` → `prisma generate` (prebuild) → `nest build` → `dist/`
4. Deploy: `npx prisma migrate deploy` (runs any pending DB migrations) → `node --max-old-space-size=512 dist/main`
5. Railway runs health check at `/api/v1/health` before routing traffic

**Build config lives in**: `railway.toml` (repo root) and `apps/backend/railway.toml`

---

### Web (Vercel)

1. Push to `main` → Vercel detects the change
2. Vercel reads `apps/web/vercel.json` (if present) — otherwise auto-detects Next.js
3. Build runs from repo root: `cd ../.. && npm install` then `next build` inside `apps/web`
4. TypeScript check runs during build — any type errors fail the deploy
5. Static pages are pre-rendered; dynamic routes are server-rendered on demand via Vercel Edge

**Key config**: `apps/web/next.config.ts`, `apps/web/vercel.json`

---

### Mobile (EAS)

1. Trigger build manually or via CI:
   ```bash
   cd apps/mobile
   eas build --profile preview --platform ios     # TestFlight internal testing
   eas build --profile production --platform all  # App Store + Google Play
   ```
2. EAS reads `apps/mobile/eas.json` for build profiles
3. EAS pulls secrets you set on expo.dev
4. For **preview** builds: distributed via TestFlight (iOS) / internal testing (Android)
5. For **production** builds: submit to App Store / Google Play via `eas submit`

**Build profiles** (in `apps/mobile/eas.json`):

- `development` — dev client, local testing
- `preview` — TestFlight/internal, points at production backend
- `production` — store release

---

## Google Maps keys — how to split them

You need **3 separate API keys**:

| Key         | Restriction                    | Used by                    |
| ----------- | ------------------------------ | -------------------------- |
| Server key  | By IP (Railway server IP)      | Backend geocoding, routing |
| Web key     | HTTP referrer `app.bilt.lv/*` | Web portal maps            |
| iOS key     | iOS app bundle `lv.b3hub.app`  | Mobile iOS                 |
| Android key | Android app `lv.b3hub.app`     | Mobile Android             |

One key with no restrictions works during development but **must** be locked down for production.

---

## Supabase setup

1. **Auth**: Supabase Auth issues JWTs. The backend validates them using `JWT_SECRET` from Supabase → Settings → API → JWT Secret.
2. **Database**: PostgreSQL on Supabase. Use the **Transaction mode** URL (port 6543) for `DATABASE_URL` and the **Direct** URL (port 5432) for `DIRECT_URL`.
3. **Storage**: File uploads (delivery proofs, documents) go to Supabase Storage via the backend. The backend uses `SUPABASE_URL` + `SUPABASE_KEY` (service role).
4. **Email confirmations**: Disabled (handled by Resend via backend). Turn off Supabase's built-in email sending.

---

## Custom domain setup

### `api.bilt.lv` → Railway

1. Railway dashboard → your service → Settings → **Domains** → Add custom domain
2. Add DNS CNAME: `api` → `<your-service>.railway.app`

### `app.bilt.lv` → Vercel

1. Vercel dashboard → your project → Settings → **Domains** → Add
2. Add DNS CNAME: `app` → `cname.vercel-dns.com`

### `admin.bilt.lv` → Vercel (optional — separate admin deployment)

Same Vercel project, second domain. Set `NEXT_PUBLIC_APP_MODE=admin` on that domain only using Vercel's **per-domain environment variables** (Settings → Environment Variables → toggle "Specific domains").

---

## Pre-launch checklist

### Supabase

- [ ] `DATABASE_URL` and `DIRECT_URL` both set in Railway
- [ ] `JWT_SECRET` matches what Supabase uses
- [ ] Email confirmations turned OFF (backend handles email via Resend)
- [ ] Storage buckets created: `documents`, `delivery-proofs`, `avatars`

### Railway

- [ ] All env vars set (see table above)
- [ ] `ALLOWED_ORIGIN` = Vercel production URL
- [ ] Health check passing at `/api/v1/health`
- [ ] Custom domain `api.bilt.lv` pointing to Railway
- [ ] Prisma migrations ran cleanly on first deploy (check deploy logs for `migrate deploy`)

### Vercel

- [ ] `NEXT_PUBLIC_API_URL` set to `https://api.bilt.lv/api/v1`
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set
- [ ] `NEXT_PUBLIC_APP_MODE` set to `marketplace`
- [ ] Custom domain `app.bilt.lv` configured

### Stripe

- [ ] Switch from `sk_test_*` / `pk_test_*` to `sk_live_*` / `pk_live_*`
- [ ] Webhook endpoint registered: `https://api.bilt.lv/api/v1/payments/webhook`
- [ ] Webhook signing secret (`STRIPE_WEBHOOK_SECRET`) updated in Railway

### Resend

- [ ] Domain `bilt.lv` verified in Resend (add DNS TXT records)
- [ ] `EMAIL_FROM=noreply@bilt.lv` set in Railway

### EAS / Mobile

- [ ] All `EXPO_PUBLIC_*` secrets set on expo.dev
- [ ] Production build triggered: `eas build --profile production --platform all`
- [ ] Submitted to App Store + Google Play: `eas submit`

---

## Request flow (example: buyer places an order on mobile)

```
1. Buyer taps "Pasūtīt" in the mobile app
2. Mobile → POST https://api.bilt.lv/api/v1/orders
   (Bearer: Supabase JWT in Authorization header)
3. Railway backend receives request
   → JwtStrategy validates token against JWT_SECRET
   → OrdersService creates order in Supabase PostgreSQL
   → Email notification sent via Resend
   → WebSocket event pushed to seller's web dashboard
4. Seller sees new order in web portal (https://app.bilt.lv/dashboard/incoming-orders)
5. Seller confirms → driver picks up → delivery proof uploaded to Supabase Storage
6. Documents auto-generated and stored
```
