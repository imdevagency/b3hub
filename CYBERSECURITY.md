# B3Hub — Cybersecurity Audit Report

**Date:** 2026-03-31  
**Scope:** `apps/backend` (NestJS), `apps/mobile` (Expo/React Native), `apps/web` (Next.js)  
**Methodology:** Static code analysis, dependency audit (`npm audit`), OWASP Top 10 checklist, architecture review

---

## Executive Summary

The platform has a solid security foundation with correct patterns in most areas.
Authentication, input validation, rate limiting, and payment security are all implemented correctly.
However, **four issues require immediate attention** before a production launch, and several medium-priority items should be addressed in the first sprint after launch.

| Severity               | Count |
| ---------------------- | ----- |
| 🔴 Critical            | 2     |
| 🟠 High                | 4     |
| 🟡 Medium              | 5     |
| 🟢 Low / Informational | 6     |

---

## Critical Issues

### C-1 — JWT Tokens Stored in AsyncStorage (Unencrypted)

**File:** `apps/mobile/lib/auth-context.tsx`  
**Risk:** Tokens are written to `AsyncStorage`, which is **not encrypted** on either iOS or Android. On a rooted/jailbroken device, any app or forensic tool can read all AsyncStorage keys, including the JWT access token and refresh token.

**OWASP Mobile:** M9 — Insecure Data Storage

**Fix:**

```bash
cd apps/mobile && npx expo install expo-secure-store
```

Replace `AsyncStorage` with `expo-secure-store` for the three token keys:

```ts
// Before
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem(TOKEN_KEY, token);
const token = await AsyncStorage.getItem(TOKEN_KEY);

// After
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync(TOKEN_KEY, token);
const token = await SecureStore.getItemAsync(TOKEN_KEY);
```

`SecureStore` uses iOS Keychain and Android Keystore under the hood — both hardware-backed on modern devices.

---

### C-2 — CORS Misconfiguration: Wrong Env Variable Name

**File:** `apps/backend/src/main.ts` line 27 vs `apps/backend/.env` line 21  
**Risk:** `main.ts` reads `ALLOWED_ORIGIN` but `.env` defines `CORS_ORIGIN`. In production with `NODE_ENV=production`, the fallback when `ALLOWED_ORIGIN` is absent is `false` — which blocks all cross-origin requests, breaking the web portal. In development the fallback is `true` — which allows **all origins**, exposing the API to CSRF from any website.

**Fix:**

Either rename the env variable in `.env`:

```env
# Replace:
CORS_ORIGIN="http://localhost:3001,..."
# With:
ALLOWED_ORIGIN="http://localhost:3001,..."
```

Or update `main.ts` to read `CORS_ORIGIN` and parse comma-separated origins:

```ts
const rawOrigin = process.env.ALLOWED_ORIGIN ?? process.env.CORS_ORIGIN;
const allowedOrigin = rawOrigin
  ? rawOrigin.split(',').map((o) => o.trim())
  : process.env.NODE_ENV === 'production'
    ? ['https://app.b3hub.lv', 'https://www.b3hub.lv']
    : true;
```

---

## High Severity

### H-1 — No HTTP Security Headers (Missing Helmet)

**File:** `apps/backend/src/main.ts`  
**Risk:** Without Helmet, responses lack `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, and `Referrer-Policy`. These headers are the first line of defense against clickjacking, MIME sniffing, and cross-site attacks.

**Fix:**

```bash
cd apps/backend && npm install helmet
```

```ts
// main.ts — add before app.enableCors()
import helmet from 'helmet';
app.use(helmet());
```

---

### H-2 — Critical Handlebars Dependency (JS Injection)

**Source:** `npm audit` on `apps/backend`  
**Advisory:** GHSA-3mfm-83xf-c92r, GHSA-2w6w-674q-4c4q  
**Risk:** Handlebars is a transitive dependency with multiple critical prototype pollution and JS injection vulnerabilities. These are exploitable if any code path renders Handlebars templates with user-supplied input.

**Fix:**

```bash
cd apps/backend && npm audit fix
```

If `npm audit fix` can't resolve it automatically, find the package pulling in `handlebars`:

```bash
npm why handlebars
```

And update or replace that parent package.

---

### H-3 — Insecure `bcrypt` Transitive Dependency (tar path traversal)

**Source:** `npm audit` on `apps/backend`  
**Advisory:** GHSA-8qq5-rm4j-mr97, GHSA-34x7-hfp2-rc4v  
**Risk:** `bcrypt@5.x` depends on `@mapbox/node-pre-gyp` which depends on `tar <=7.5.10` — vulnerable to hardlink path traversal during `npm install`. This is a **supply-chain risk** during build/CI, not a runtime attack on your users.

**Fix:**

```bash
cd apps/backend && npm install bcrypt@6.0.0
```

> Note: bcrypt@6 is a breaking change — verify the API still works after upgrade. If not, add `"overrides": { "tar": "^7.5.11" }` to `package.json` as a temporary mitigation.

---

### H-4 — No MIME-Type or Size Validation on File Uploads

**File:** `apps/backend/src/documents/dto/create-document.dto.ts`, `apps/backend/src/transport-jobs/dto/update-status.dto.ts`  
**Risk:** `mimeType` and `pickupPhotoUrl` (which accepts base64 data URIs) are accepted as plain `@IsString()` with no content type check, no size limit, and no extension allowlist. A malicious user could:

- Upload an HTML/SVG file as `mimeType: "image/png"` and serve it from your domain
- Submit a multi-megabyte base64 string to exhaust memory (partially mitigated by the 10 MB JSON limit in `main.ts`)

**Fix:**

```ts
// In CreateDocumentDto — add allowed MIME types:
const ALLOWED_MIME_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
] as const;

@IsOptional()
@IsIn(ALLOWED_MIME_TYPES)
mimeType?: string;

@IsOptional()
@IsInt()
@Min(0)
@Max(20 * 1024 * 1024) // 20 MB max
fileSize?: number;
```

For `pickupPhotoUrl` — validate it's either an `https://` URL or a `data:image/(jpeg|png);base64,...` pattern:

```ts
@IsOptional()
@Matches(/^(https:\/\/.+|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*)$/)
pickupPhotoUrl?: string;
```

---

## Medium Severity

### M-1 — Forgot Password Endpoint Has No Rate Limit

**File:** `apps/backend/src/auth/auth.controller.ts` line 46  
**Risk:** `POST /auth/forgot-password` uses the global 120 req/min limit (not the 10 req/min auth limit). An attacker can send 120 password reset emails per minute per IP for any registered user — causing email spam abuse and Resend API cost exhaustion.

**Fix:**

```ts
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Post('forgot-password')
async forgotPassword(@Body() dto: ForgotPasswordDto) {
```

---

### M-2 — Password Has No Maximum Length (bcrypt Truncation)

**File:** `apps/backend/src/auth/dto/register.dto.ts`  
**Risk:** `bcrypt` silently truncates passwords at 72 bytes. A user who sets a 200-character password believes it is fully hashed, but only the first 72 characters are evaluated. This is a well-known bcrypt pitfall.

**Fix:**

```ts
@IsString()
@MinLength(8)
@MaxLength(72)
password: string;
```

Apply the same `@MaxLength(72)` to `ChangePasswordDto.newPassword`.

---

### M-3 — WebSocket Gateway Has No Auth Guard

**Source:** Socket.io via `@nestjs/websockets`  
**Risk:** If the `ChatGateway` or `NotificationsGateway` does not validate the JWT on connection, any unauthenticated client can connect and receive events. NestJS WebSocket guards require explicit setup — they do not inherit from HTTP guards.

**Action:** Verify each `@WebSocketGateway()` class has:

```ts
@UseGuards(WsJwtGuard)  // or validates token in handleConnection()
```

---

### M-4 — No `DIRECT_URL` in Env Validation

**File:** `apps/backend/src/config/env.validation.ts`  
**Risk:** `DIRECT_URL` is used for Prisma migrations (bypasses PgBouncer) but is not listed in `EnvironmentVariables`. If it is accidentally absent in production, Prisma `migrate deploy` will silently fall back to `DATABASE_URL` (PgBouncer), causing migration failures that are hard to trace.

**Fix:** Add to `EnvironmentVariables`:

```ts
@IsString()
DIRECT_URL!: string;
```

---

### M-5 — `_devResetUrl` Could Leak in Staging

**File:** `apps/backend/src/auth/auth.service.ts` line 343  
**Risk:** The raw password reset token is returned in the API response when `NODE_ENV !== 'production'`. If a staging environment is inadvertently left with `NODE_ENV=development`, this token is exposed in API responses that may be logged by proxies or monitoring tools.

**Fix:** Tie the dev leak to an explicit flag rather than `NODE_ENV`:

```ts
const exposeDevToken = process.env.EXPOSE_DEV_RESET_URL === 'true';
return {
  ok: true,
  ...(exposeDevToken && { _devResetUrl: `/reset-password?token=${rawToken}` }),
};
```

---

## Low / Informational

### L-1 — Login Rate Limit Is Per-IP, Not Per-Account

**Risk:** The 10 req/min throttle is IP-based. An attacker distributing requests across many IPs (botnet) can perform credential stuffing without hitting the rate limit. Industry best practice layers account-level lockout on top of IP throttling.

**Recommendation:** After N consecutive failed logins for the same email within a time window, lock the account temporarily and notify the user. Prisma already has `failedLoginAttempts` and `lockedUntil` fields — wire them up.

---

### L-2 — Supabase Key Is Service Role Key

**File:** `apps/backend/.env` — `SUPABASE_KEY`  
**Risk:** Using the Supabase service-role key from the backend bypasses Row Level Security entirely. This is acceptable for a server-side backend that enforces its own authorization. However, if this key is ever exposed (e.g. committed to Git), all data in the Supabase project is readable and writable by anyone.

**Recommendation:**

- Ensure `apps/backend/.env` is in `.gitignore` ✅ (verify this)
- Rotate the Supabase service key immediately if it has ever been committed
- Consider scoping to specific storage buckets only where possible

---

### L-3 — No Git-Secret / Secret Scanning in CI

**Risk:** There is no `gitleaks`, `truffleHog`, or GitHub secret scanning configured. A developer could accidentally commit an API key and it would go undetected.

**Recommendation:** Add to `.github/workflows/`:

```yaml
- name: Scan for secrets
  uses: gitleaks/gitleaks-action@v2
```

---

### L-4 — Socket.io Binary Attachment DoS (Transitive)

**Source:** `npm audit` — GHSA-677m-j7p3-52f9  
**Risk:** `socket.io-parser` allows an unbounded number of binary attachments, which can exhaust server memory. Affects both `apps/backend` and `apps/mobile`.

**Fix:** `npm audit fix` in both packages should resolve this.

---

### L-5 — NSAllowsArbitraryLoads in iOS plist

**File:** `apps/mobile/app.config.ts` line 58  
**Risk:** `NSAllowsArbitraryLoads: true` is set for non-production builds. If a build is accidentally submitted with `NODE_ENV !== 'production'`, it bypasses iOS App Transport Security and allows plain HTTP connections. Apple regularly rejects apps with ATS disabled.

**Status:** The comment correctly notes this should be removed once the backend is on HTTPS. Track this as a pre-submission blocker.

---

### L-6 — `0.0.0.0` Bind Address in main.ts

**File:** `apps/backend/src/main.ts` line 49  
**Risk:** Binding to `0.0.0.0` is intentional for Docker/cloud deployment but means the server is reachable on all network interfaces including local ones. Ensure firewall/VPC rules or a reverse proxy (nginx, Caddy) restrict direct public access to port 3000.

---

## OWASP Top 10 Summary

| #   | Category                    | Status      | Notes                                                                                                                                          |
| --- | --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Broken Access Control       | 🟡 Partial  | Guards on all endpoints; resource-level ownership checks exist in most services. Verify all `findMany` queries filter by `userId`/`companyId`. |
| A02 | Cryptographic Failures      | 🟠 High     | Tokens in AsyncStorage (C-1). bcrypt used correctly for passwords.                                                                             |
| A03 | Injection                   | ✅ Pass     | Prisma ORM with parameterized queries throughout. No raw SQL. `whitelist: true` on ValidationPipe strips unknown fields.                       |
| A04 | Insecure Design             | 🟡 Partial  | Rate limits on auth; missing on forgot-password (M-1). No account lockout (L-1).                                                               |
| A05 | Security Misconfiguration   | 🔴 Critical | CORS env variable mismatch (C-2). Missing Helmet (H-1).                                                                                        |
| A06 | Vulnerable Components       | 🟠 High     | 1 critical + 18 high vulnerabilities in `npm audit`.                                                                                           |
| A07 | Auth & Identity Failures    | 🟡 Partial  | JWT correctly implemented. Tokens unencrypted on device (C-1). No account lockout.                                                             |
| A08 | Software Integrity          | ✅ Pass     | Stripe webhook signature verified. No `npm --ignore-scripts` risk identified.                                                                  |
| A09 | Logging & Monitoring        | ✅ Pass     | Sentry integrated. NestJS Logger used. HttpExceptionFilter in place.                                                                           |
| A10 | Server-Side Request Forgery | ✅ Pass     | No user-supplied URLs are fetched server-side. Google Maps key is server-side only.                                                            |

---

## Remediation Priority

| Priority                | Issue                                    | Effort |
| ----------------------- | ---------------------------------------- | ------ |
| 🔴 Do before launch     | C-1: AsyncStorage → SecureStore          | 2h     |
| 🔴 Do before launch     | C-2: Fix CORS env variable name          | 15min  |
| 🔴 Do before launch     | H-1: Add Helmet                          | 15min  |
| 🔴 Do before launch     | H-2/H-3: `npm audit fix`                 | 30min  |
| 🟠 Sprint 1 post-launch | H-4: File upload MIME/size validation    | 2h     |
| 🟠 Sprint 1 post-launch | M-1: Rate limit forgot-password          | 15min  |
| 🟠 Sprint 1 post-launch | M-2: MaxLength(72) on password           | 15min  |
| 🟠 Sprint 1 post-launch | M-3: Verify WebSocket auth guards        | 1h     |
| 🟡 Sprint 2             | L-1: Account lockout after failed logins | 3h     |
| 🟡 Sprint 2             | L-3: Add secret scanning to CI           | 1h     |
| 🟡 Sprint 2             | M-4: Add DIRECT_URL to env validation    | 15min  |

---

## What Is Already Good

- ✅ **Bcrypt with salt rounds 10** for password hashing
- ✅ **JWT with short-lived access tokens** (check expiry) + server-side refresh token revocation
- ✅ **Anti-enumeration** on forgot-password (always returns `ok: true`)
- ✅ **Hashed reset tokens** (SHA-256 stored, raw token emailed — correct pattern)
- ✅ **Stripe webhook signature verification** with raw body + `constructEvent`
- ✅ **Authorization on payment endpoints** — user must own the order to create a PaymentIntent
- ✅ **ValidationPipe with `whitelist: true` and `forbidNonWhitelisted: true`** — strips and rejects extra fields globally
- ✅ **Rate limiting on login/register** (10 req/min)
- ✅ **Global 120 req/min throttle** via ThrottlerGuard as APP_GUARD
- ✅ **Sentry integration** for error monitoring
- ✅ **Parameterized queries via Prisma** — no SQL injection risk
- ✅ **Admin endpoints protected** by both `JwtAuthGuard` + `AdminGuard`
- ✅ **SUPABASE_KEY only on server** — never sent to the mobile client
- ✅ **Google Maps API keys split** by platform with usage restrictions
