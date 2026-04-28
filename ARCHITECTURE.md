# B3Hub — Platform Architecture

> **Last updated: April 2026.**
> For the authoritative DB schema, see `apps/backend/prisma/schema.prisma` and `.github/instructions/backend-schema.instructions.md`.
> For feature status, see `STATUS.md`.

---

## Overview

B3Hub is a **construction logistics marketplace** for the Latvian and Baltic market, connecting:

- **Buyers** — construction companies, contractors, homeowners ordering materials, skip hire, or transport
- **Sellers/Suppliers** — quarries and material suppliers listing gravel, sand, concrete, soil
- **Carriers** — trucking companies and independent drivers executing deliveries

The platform handles the complete transaction lifecycle: order placement → seller confirmation → driver delivery → document generation → payment settlement.

Two customer segments share the same backend and mobile app:

- **B2C** — homeowners and micro-contractors. Guest checkout supported. Public order wizards are the primary acquisition channel.
- **B2B** — construction companies. Full accounts, framework contracts, project cost tracking, team management, invoicing.

---

## Monorepo Structure

| Path | Tech | Purpose |
|------|------|---------|
| `apps/backend` | NestJS + Prisma | REST API, WebSockets, all business logic |
| `apps/web` | Next.js 14 App Router | Seller/admin web portal + B2C marketing + guest wizards |
| `apps/mobile` | Expo (React Native) + NativeWind | Buyer + driver mobile app |
| `packages/shared` | TypeScript | Shared types (currently minimal) |

Package manager: **npm workspaces** (root `package.json`).

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend framework | NestJS (TypeScript) |
| ORM | Prisma |
| Database | PostgreSQL (Supabase) |
| Authentication | Supabase Auth (JWT) |
| File storage | Supabase Storage |
| Web frontend | Next.js 14 App Router |
| Mobile | Expo (React Native) + NativeWind (Tailwind) |
| Real-time | WebSockets (NestJS Gateway) + Supabase Realtime |
| Payment | Paysera (redirect checkout + webhook) |
| Payout | Stripe Connect — solo individual driver payouts only |
| Email | Resend (falls back to console.log in dev) |
| Maps | Google Maps API (distance pricing, route optimisation) |
| Push notifications | Expo Push Notifications |

---

## Authentication & User Model

### JWT Strategy

Supabase Auth issues JWTs. The backend validates them via `JwtStrategy`. Every protected route uses `@UseGuards(JwtAuthGuard)`. The JWT payload is typed as `RequestingUser` (see `src/common/types/requesting-user.interface.ts`).

### UserType — only two values

```ts
enum UserType {
  BUYER   // Everyone who is not internal staff (buyers, suppliers, carriers, drivers, recyclers)
  ADMIN   // Internal platform staff
}
```

Business roles are **not** separate enum values. They are controlled by capability flags on the `User` model:

| Flag | Meaning |
|------|---------|
| `canSell` | Approved to list materials and receive incoming orders |
| `canTransport` | Approved to accept and execute transport jobs |
| `canSkipHire` | Approved to manage skip hire fleet |

A user's business category is further distinguished by their company's `CompanyType`:

`CONSTRUCTION | SUPPLIER | RECYCLER | CARRIER | HYBRID`

### Company Roles

Users linked to a company have a `CompanyRole`: `OWNER | MANAGER | DRIVER | MEMBER`, plus five `perm*` boolean flags:

- `permCreateContracts`
- `permReleaseCallOffs`
- `permManageOrders`
- `permViewFinancials`
- `permManageTeam`

### RequestingUser shape (JWT payload)

```ts
interface RequestingUser {
  id: string;
  userId: string;
  email?: string;
  userType: string;        // 'BUYER' | 'ADMIN'
  isCompany: boolean;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire: boolean;
  companyId?: string;
  companyRole?: string;    // 'OWNER' | 'MANAGER' | 'DRIVER' | 'MEMBER'
  permCreateContracts: boolean;
  permReleaseCallOffs: boolean;
  permManageOrders: boolean;
  permViewFinancials: boolean;
  permManageTeam: boolean;
  payoutEnabled?: boolean;
  tokenVersion?: number;
}
```

---

## Backend Module Structure

Every feature follows the same anatomy:

```
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts   // HTTP only, no business logic
  <feature>.service.ts      // all business logic + Prisma queries
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
```

All routes are prefixed `/api/v1`.

### Module inventory

| Module | Routes prefix | Purpose |
|--------|--------------|---------|
| `admin` | `/api/v1/admin/*` | Platform-wide stats, user/company/order/job management, materials, payments, audit logs, surcharges, SLA, exceptions, suppliers |
| `auth` | `/api/v1/auth/*` | Login, register, token refresh, JWT cookie sync |
| `b3-fields` | `/api/v1/b3-fields/*` | Physical B3 Field nodes — locations, hours, services |
| `carrier-settings` | `/api/v1/carrier-settings/*` | Carrier pricing, service zones, availability |
| `chat` | `/api/v1/chat/*` | WebSocket-based per-job messaging |
| `company` | `/api/v1/companies/*` | Company CRUD, geo coordinates |
| `company-members` | `/api/v1/company-members/*` | Team management, permissions |
| `containers` | `/api/v1/containers/*` | Skip/container inventory |
| `disputes` | `/api/v1/disputes/*` | Dispute creation, resolution, admin alerts |
| `documents` | `/api/v1/documents/*` | Delivery proof, waste transfer notes, certificates |
| `driver-schedule` | `/api/v1/driver-schedule/*` | Availability calendar, online toggle |
| `email` | (internal service) | Resend-backed transactional email |
| `field-passes` | `/api/v1/field-passes/*` | Gate-access passes for B3 Fields |
| `framework-contracts` | `/api/v1/framework-contracts/*` | Long-term supply contracts with call-off releases |
| `guest-orders` | `/api/v1/guest-orders/*` | Guest/B2C order creation, tracking token, status updates |
| `invoices` | `/api/v1/invoices/*` | Auto-generated invoices from completed orders |
| `maps` | `/api/v1/maps/*` | Distance calculation, route optimisation (Google Directions) |
| `materials` | `/api/v1/materials/*` | Listings, stock, pricing, distance-based delivery fee |
| `notifications` | `/api/v1/notifications/*` | In-app + Expo push; unread count |
| `orders` | `/api/v1/orders/*` | Order lifecycle, multi-truck delivery, recurring schedules, auto-complete cron |
| `payments` | `/api/v1/payments/*` | Paysera checkout initiation, webhook processing, void/refund |
| `payouts` | `/api/v1/payouts/*` | Stripe Connect account links, fund releases |
| `projects` | `/api/v1/projects/*` | Project P&L, order assignment to projects |
| `provider-applications` | `/api/v1/provider-applications/*` | Seller/carrier onboarding applications |
| `quote-requests` | `/api/v1/quote-requests/*` | RFQ creation, responses, accept flow |
| `recycling-centers` | `/api/v1/recycling-centers/*` | Registered waste disposal facilities |
| `reviews` | `/api/v1/reviews/*` | Post-delivery buyer reviews |
| `saved-addresses` | `/api/v1/saved-addresses/*` | Buyer saved delivery addresses |
| `skip-hire` | `/api/v1/skip-hire/*` | Skip order creation, Paysera payment, driver management |
| `support` | `/api/v1/support/*` | Buyer to admin support threads and messages |
| `tracking` | `/api/v1/tracking/*` | Public order tracking (guest token), live GPS |
| `transport-jobs` | `/api/v1/transport-jobs/*` | Job board, assignment, status lifecycle, return-trip suggestions, proof submission |
| `vehicles` | `/api/v1/vehicles/*` | Driver vehicle registry |
| `weighing-slips` | `/api/v1/weighing-slips/*` | Weigh bridge records; discrepancy alert >5% deviation |

---

## Database

- ORM: **Prisma** (`apps/backend/prisma/schema.prisma`)
- DB: **PostgreSQL** on Supabase
- Migrations: `prisma migrate dev` (dev) / `prisma migrate deploy` (prod)
- Always inject `PrismaService` from `src/prisma/prisma.module.ts`
- Enum values (`OrderStatus`, `UserType`, etc.) imported from `@prisma/client`

> **Schema reference:** See `apps/backend/prisma/schema.prisma` for all 30+ models. The AI-ready reference is at `.github/instructions/backend-schema.instructions.md`.

---

## Web Application

### Deployment Modes

The web app supports two distinct deployment modes via a single env var:

| Mode | `NEXT_PUBLIC_APP_MODE` | Purpose |
|------|------------------------|---------|
| **Marketplace** (default) | `marketplace` or unset | Public-facing: marketing pages, B2C wizards, seller/buyer portal |
| **Admin** | `admin` | Internal admin ERP: non-ADMIN users rejected at login, redirected by middleware, auto-logged-out by DashboardGuard |

### Route Structure

```
apps/web/src/app/
  (auth)/                  — login, register, forgot-password, reset-password
  (marketing)/             — public site: landing, features, pricing, B2C order wizards
    order/
      materials/           — B2C materials wizard
      skip-hire/           — B2C skip hire wizard
      transport/           — B2C transport wizard
      disposal/            — B2C disposal wizard
  apply/                   — provider application form
  dashboard/               — authenticated portal (sidebar layout)
    admin/                 — admin ERP hub (19 admin pages)
    buyer/                 — buyer home, projects, analytics
    ...                    — shared: orders, jobs, chat, notifications, settings
  pasutijums/[token]/      — public guest order tracking
  share/[token]/           — shareable order links
```

### Sidebar Architecture

`dashboard/layout.tsx` renders a `SidebarSwitch` client component that selects between:

- **`AdminSidebar`** — for `userType === 'ADMIN'`. 7 ERP sections: Pārskats, Darbības, Cilvēki, Finanses, Platforma, Kvalitāte, Sistēma. Live badge counts (pending applications, open disputes, open exceptions, open support threads) refreshed every 30 s.
- **`AppSidebar`** — for all marketplace users. Role-aware nav with BUYER / SUPPLIER / CARRIER mode switcher.

### Key web components

| File | Purpose |
|------|---------|
| `src/components/admin-sidebar.tsx` | Admin ERP sidebar (7 sections, live badges) |
| `src/components/app-sidebar.tsx` | Marketplace sidebar (buyer/supplier/carrier) |
| `src/components/sidebar-switch.tsx` | Client wrapper — picks admin vs marketplace sidebar |
| `src/components/dashboard-guard.tsx` | Redirects unauthenticated; rejects non-ADMIN on admin deployment |
| `src/middleware.ts` | Protects dashboard routes; enforces admin-only mode |
| `src/lib/auth-context.tsx` | Global auth state (user, token, logout) |
| `src/lib/mode-context.tsx` | Active role mode switcher |
| `src/lib/api/` | All API call functions, one file per domain |

---

## Mobile Application

### Build Variants (EAS)

| Variant (`APP_VARIANT`) | Profile | Purpose |
|-------------------------|---------|---------|
| `development` | development | Local dev, Expo Go or dev client |
| `preview` | preview | Internal test builds |
| `production` | production | App Store / Play Store release |
| `gate` | preview | B3 Field operator app (physical site gate access) |

### Route Groups

```
app/
  (auth)/     — welcome, login, register, onboarding, apply-role, forgot-password, phone-otp
  (buyer)/    — home, catalog, orders, transport-job, rfq, skip-order, account sub-group
  (driver)/   — home, jobs, active, earnings, schedule, vehicles, skips, documents
  (seller)/   — home, incoming, catalog, quotes, earnings, documents, framework-contracts
  (shared)/   — settings, notifications, chat, help, delivery-proof, reviews, change-password
  (wizards)/  — material-order, skip-hire, transport, disposal
  (gate)/     — fields, gate-scan (gate variant only)
```

### Key patterns

- Styling: NativeWind (Tailwind). Design tokens in `lib/tokens.js`. Never hardcode hex or pixel values.
- API: all calls in `lib/api/` — never call `fetch` directly in components.
- Auth: `lib/auth-context.tsx` via `useAuth()` hook.
- Domain contexts: `lib/order-context.tsx`, `lib/disposal-context.tsx`, `lib/transport-context.tsx`.

---

## Key Flows

### Order lifecycle

```
Buyer places order (PENDING)
  -> Paysera payment captured
  -> Seller confirms loading (CONFIRMED)
  -> Driver picks up (IN_PROGRESS)
  -> Driver delivers + submits proof (DELIVERED)
  -> 24h auto-complete — blocked if open dispute (COMPLETED)
  -> Invoice generated, payment released to supplier
```

### Transport job lifecycle

```
AVAILABLE -> ASSIGNED -> ACCEPTED -> EN_ROUTE_PICKUP -> AT_PICKUP
-> LOADED -> EN_ROUTE_DELIVERY -> AT_DELIVERY -> DELIVERED -> COMPLETED
```

### Payment flow

- **Marketplace orders**: Paysera redirect checkout → webhook sets `paymentStatus: PAID` → held until COMPLETED
- **Skip hire**: Paysera redirect checkout → webhook auto-confirms skip hire order
- **Individual driver payouts**: Stripe Connect (owner-operators without a company)

### Guest / B2C checkout

1. Public wizard (materials / skip hire / transport / disposal)
2. `WebWizardAuthGate` — "Turpināt kā viesis" or login/register
3. Guest: name + phone + optional email → `POST /api/v1/guest-orders`
4. Paysera checkout → confirmation email
5. Public tracking: `/pasutijums/[token]`
6. Post-checkout account prompt

---

## Infrastructure & Deployment

| Service | Provider |
|---------|----------|
| Backend | Railway (Docker) |
| Web | Vercel (two deployments: marketplace + admin) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File storage | Supabase Storage |
| Mobile | Expo EAS Build — App Store + Play Store |
| Email | Resend |
| Payments | Paysera |

### Key environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Backend | Prisma connection string |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Backend + Web | Supabase client |
| `JWT_SECRET` | Backend | JWT signing |
| `PAYSERA_PROJECT_ID` + `PAYSERA_SIGN_PASSWORD` | Backend | Paysera |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Backend | Stripe Connect |
| `RESEND_API_KEY` | Backend | Email |
| `GOOGLE_MAPS_API_KEY` | Backend + Mobile | Distance pricing, maps |
| `NEXT_PUBLIC_APP_MODE` | Web | `admin` = admin-only deployment |
| `APP_VARIANT` | Mobile (EAS) | `development` / `preview` / `production` / `gate` |

---

## Security

- JWTs validated per request via `JwtStrategy`; `tokenVersion` rejects stale tokens after role changes
- HttpOnly cookie sync for Next.js middleware (server-side, not JS-accessible)
- Rate limiting: 120 req/min per IP (global ThrottlerModule)
- Admin deployment: `NEXT_PUBLIC_APP_MODE=admin` + `DashboardGuard` + middleware enforce ADMIN-only access
- ATS (iOS): `NSAllowsArbitraryLoads` disabled in production builds; guarded on `APP_VARIANT !== 'production'`
- Input validation: `class-validator` on all DTOs; Prisma parameterised queries; no raw SQL

---

## B3 Fields

B3 Fields are physical sites where customers can collect materials, dispose of waste, or rent trailers. Every B3 Field transaction flows through the B3Hub platform — payment, documents, and receipts are handled identically to online orders.

**Platform model:**
- Material pickup: order with `fulfillmentType: PICKUP` at a B3 Field address
- Waste disposal: B3 Field registered as a `RecyclingCenter` with address and opening hours
- Field access: `FieldPass` model — gate-access QR passes scanned by the Gate app variant

**Gate app variant:** The `gate` EAS build renders `app/(gate)/` screens only. B3 Field operators use it to pick a field and scan customer passes. Auth-guarded.
