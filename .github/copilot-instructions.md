````instructions
# Bilt Monorepo — Copilot Instructions

## What this product is

**Bilt** is Latvia's **all-in-one digital platform for construction site supply and waste management** — a neutral marketplace, a driver of a genuine circular economy, and an expert in optimized material flows.

> THE PLATFORM FOR MATERIAL FLOWS. SUSTAINABLE. DIGITAL. EFFICIENT.

**Bilt is an ecosystem, not just a marketplace.** The platform combines digital logistics know-how, data-driven material flow management, and recycling center infrastructure to make the construction sector more sustainable — driving the industry toward climate neutrality.

Bilt connects **four market sides** into one closed logistics loop:
- **Buyers** — construction companies ordering bulk materials, transport, and waste disposal; homeowners and small trades for one-off needs
- **Suppliers** — quarries and material suppliers listing gravel, sand, concrete, recycled construction materials (RC materials)
- **Carriers** — trucking companies and independent drivers executing deliveries via the transport exchange
- **Recyclers** — licensed recycling centers accepting, processing, and certifying construction waste; producing RC materials for resale

Full order flow: buyer places order → seller confirms loading → driver delivers → documents auto-generated.

Every tonne of material has a digital trail. Every waste transfer has a certified record. Every payment is automatic.

**Circular economy vision**: Bilt knows what materials are produced in "urban quarries" (demolition/dismantling sites) and where they are needed. Our own recycling centers supply customers quickly and reliably with RC materials — reducing the construction sector's ecological footprint. Goals: increase recycling rates for construction materials, reduce landfill dependency, promote sustainable resource use.

**B2C segment**: homeowners, small trades, micro-contractors. One-off needs. Guest checkout supported; account offered post-order as convenience, not a gate. Public order wizards are a valid acquisition channel for this segment.
**B2B segment**: construction companies, contractors, project managers. Account required. Framework contracts, project cost tracking, invoicing, team/permissions management.

Both segments share the same backend and mobile app. The web portal serves sellers and admins primarily.

---

## Monorepo structure

| Path | Tech | Purpose |
|------|------|---------|
| `apps/backend` | NestJS + Prisma | REST API, WebSockets, all business logic |
| `apps/web` | Next.js 14 App Router | Seller/admin web portal |
| `apps/mobile` | Expo (React Native) + NativeWind | Buyer + driver mobile app |

Package manager: **npm workspaces**. Run installs from the repo root.

> **Before adding a new feature**, check `STATUS.md` for a high-level feature map — but **do not rely on it as proof of implementation**. MD files lag behind the code. Always verify real status by reading the actual source files (controllers, services, screens, API functions). If unsure whether something is built, `grep` for it in the codebase first.

---

## Development commands

```bash
npm install               # install all workspaces
npm run dev:backend       # NestJS on :3000 (watch mode)
npm run dev:web           # Next.js on :3001
npm run dev:mobile        # Expo dev server
````

---

## Backend (NestJS) — key patterns

### API prefix

<!-- GEN:api-prefix -->

All routes prefixed with `/api/v1` (e.g. `POST /api/v1/orders`).

<!-- END GEN -->

### Module anatomy

Every feature follows the same structure:

```
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts   ← HTTP layer only, no business logic
  <feature>.service.ts      ← all business logic + Prisma calls
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
```

### Authentication

- **Supabase Auth** issues JWTs; the backend validates them via `JwtStrategy`.
- Protect a route: `@UseGuards(JwtAuthGuard)` (from `../auth/guards/jwt-auth.guard`).
- Optional auth: `@UseGuards(OptionalJwtAuthGuard)`.
- Get the current user in a controller param: `@CurrentUser() user: RequestingUser` (from `../common/decorators/current-user.decorator`).
- `RequestingUser` is defined in `src/common/types/requesting-user.interface.ts`.

### RequestingUser shape (JWT payload)

<!-- GEN:requesting-user -->

```ts
export interface RequestingUser {
  /** Primary ID (alias: same as userId) */
  id: string;
  userId: string;
  email?: string;
  userType: string; // 'BUYER' | 'ADMIN'  (UserType enum — all non-admin users are BUYER regardless of business role)
  isCompany: boolean;
  canBuy: boolean; // approved to place orders as a buyer
  canSell: boolean; // approved seller — can list materials, see incoming orders
  canTransport: boolean; // approved driver — can accept & execute transport jobs
  canSkipHire: boolean; // legacy — skip hire removed from scope; field retained for schema compatibility
  canRecycle: boolean; // approved to operate a recycling/waste center
  companyId?: string; // linked Company id, if any
  companyRole?: string; // 'OWNER' | 'MANAGER' | 'DRIVER' | 'MEMBER'
  // Fine-grained company member permissions
  permCreateContracts: boolean;
  permReleaseCallOffs: boolean;
  permManageOrders: boolean;
  permViewFinancials: boolean;
  permManageTeam: boolean;
  payoutEnabled?: boolean;
  tokenVersion?: number; // incremented on capability/role changes; stale JWTs are rejected
  companyFeatures?: string[]; // Enabled SaaS feature modules for this company (CompanyFeature enum values)
}
```

<!-- END GEN -->

> ⚠️ **Important**: The `/auth/me` and login API responses return company features as `user.company.features` (nested), **not** as a flat `user.companyFeatures`. Mobile `mode-context.tsx` reads `user.company.features` accordingly. Never read `user.companyFeatures` directly in mobile code.

### User roles

`UserType` has only two values — the business role is determined by **capability flags** and **CompanyType**:

| `UserType` | Who                                                                                 |
| ---------- | ----------------------------------------------------------------------------------- |
| `BUYER`    | Everyone who isn't internal staff (buyers, suppliers, carriers, drivers, recyclers) |
| `ADMIN`    | Internal platform staff                                                             |

Access is controlled by flags on the `User` model:

| Flag           | Meaning                                                |
| -------------- | ------------------------------------------------------ |
| `canSell`      | Approved to list materials and receive incoming orders |
| `canTransport` | Approved to accept and execute transport jobs          |

A **company's business type** (`CompanyType`) is separate: `CONSTRUCTION`, `SUPPLIER`, `RECYCLER`, `CARRIER`, `HYBRID`.
A recycler operator is `userType: BUYER` + their company has `companyType: RECYCLER`.
A carrier driver is `userType: BUYER` + `canTransport: true` + `companyRole: DRIVER`.

Company members have a `CompanyRole`: `OWNER` | `MANAGER` | `DRIVER` | `MEMBER`, plus five `perm*` flags for fine-grained access.

### DTOs & validation

Use `class-validator` decorators on all DTOs. Always create `Create*Dto` and `Update*Dto` (Update extends `PartialType(Create*Dto)`).

### Database

- ORM: **Prisma** (schema: `apps/backend/prisma/schema.prisma`)
- DB: **PostgreSQL** hosted on Supabase
- Always inject `PrismaService` from `src/prisma/prisma.module.ts` — never import `@prisma/client` directly in services
- Enum types from Prisma (`OrderStatus`, `UserType`, etc.) are imported from `@prisma/client`

### File storage

Supabase Storage via `SupabaseModule` (`src/supabase/`). Never use local disk storage.

### Rate limiting

Global: 120 req/min per IP (ThrottlerModule). Override per-route with `@Throttle()`.

### Common utilities

- `src/common/decorators/` — `@CurrentUser()`, role guards
- `src/common/filters/` — global HTTP exception filters
- `src/common/interceptors/` — response transform interceptors
- `src/common/types/` — shared TypeScript interfaces (`RequestingUser`, etc.)

---

## Mobile (Expo) — key patterns

### Route groups (Expo Router file-based routing)

<!-- GEN:mobile-routes -->

- `(auth)` — apply-role, forgot-password, login, onboarding, phone-otp, register, welcome
- `(buyer)` — (account)/, catalog, equipment/, framework-contract/, framework-contracts, home, messages, more, new-order, order/, orders, profile, transport-job/
- `(driver)` — active, billing-settings, documents, earnings, home, job-stat/, jobs, messages, more, profile, schedule, vehicles
- `(recycler)` — documents, home, incoming, messages, more, profile, records
- `(seller)` — billing-settings, catalog, documents, earnings, framework-contract/, framework-contracts, home, incoming, more, order/, profile
- `(shared)` — change-password, chat/, delivery-proof, help, language, messages, notification/, notifications, review/, settings, support-chat
- `(wizards)` — disposal/, material-order, transport/, utilization/
<!-- END GEN -->

### Styling

**NativeWind** (Tailwind CSS for React Native). Always use Tailwind class names. Avoid `StyleSheet.create` unless required for animations or native-only properties.

Design tokens (`colors`, `spacing`, `radius`, `fontSizes`, `shadows`) are defined in `lib/tokens.js` and exposed as NativeWind classes in `tailwind.config.js`. Use semantic classes like `bg-card`, `p-base`, `text-text-muted`, `rounded-lg`, `border-border`. When numeric values are needed (e.g. in StyleSheet or shadow props), import from `@/lib/theme`. **Never hardcode hex colours or pixel values.**

### API layer

All API calls live in `lib/api/` (barrel re-exported from `lib/api.ts`). Never call `fetch` directly in a component — add a function to the appropriate `lib/api/*.ts` file.

### Auth state

Global auth context: `lib/auth-context.tsx`. Use the `useAuth()` hook in components.

### Domain contexts

`lib/order-context.tsx`, `lib/disposal-context.tsx`, `lib/transport-context.tsx`, `lib/mode-context.tsx`.

### Custom hooks

`lib/use-orders.ts`, `lib/use-transport-job.ts`, `lib/use-order-detail.ts`, etc.
Prefer hooks over inline `useEffect` + `fetch` in components.

---

## Web (Next.js) — key patterns

- **App Router** (Next.js 14+). All pages under `src/app/`.
- UI components in `src/components/` — built on **shadcn/ui** (config: `components.json`).
- Shared hooks: `src/hooks/`, utilities: `src/lib/`, types: `src/types/`.

---

## Admin dashboard — scope

One admin dashboard, one scope: `/dashboard/admin/*`. It manages all four market sides — buyers, suppliers, carriers, and recyclers — plus platform operations.

Recycling centers are a **market participant** (one of the four sides), not a separate branded scope. The admin view for recyclers lives at `/dashboard/admin/recycling-centers` — same pattern as suppliers, carriers.

The `b3-recycling` path (`/dashboard/(internal)/b3-recycling/`) is legacy from a previous private-operator concept. Do not extend it. Do not add new pages there. The platform-side recycler portal is at `/dashboard/(platform)/recycling/`.

> There is **no** separate B3 Group admin tab, **no** `B3 Recycling` sidebar scope, and **no** B3-branded sub-portal. It’s one neutral marketplace admin.

---

## Features frozen — do not develop further

The following areas are **out of scope** and must not be extended, improved, or have new screens/APIs added:

| Area                                                | What exists                                                                     | Action                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Rental services**                                 | `apps/backend/src/rentals/`, `apps/mobile/lib/rental-services.ts`, wizard steps | Frozen. No new service types, no new screens, no extensions.                              |
| **B3 field operator portal / APUS waste reporting** | `/dashboard/(internal)/b3-recycling/`                                           | Legacy. Do not add pages or extend.                                                       |
| **CRM / projects module**                           | Any `projects` or `crm` routes/services                                         | Do not add or extend.                                                                     |
| **P2P messaging between market sides**              | `apps/backend/src/chat/`, `(shared)/chat/[jobId]`                               | Do not add buyer↔driver, buyer↔seller, or carrier↔supplier chat. Reroute to Bilt support. |
| **Quote Requests / RFQ module**                     | Removed from codebase                                                           | Removed from scope. Do not rebuild.                                                       |
| **Skip hire / Toilet cabin**                        | Removed from codebase                                                           | Removed from scope. Do not rebuild.                                                       |

If asked to work on any of these areas, decline and explain the feature is out of scope.

---

## Communication architecture — Schüttflix model (CRITICAL)

Bilt is modelled on Schüttflix's **"Smooth Contacts"** principle:

> _"No unnecessary discussions on the construction site and no hassle with customer accounts. We are your contractual and contact partner."_

### Rules that apply to all code in this repo

1. **Bilt is the sole contractual and contact partner for all market sides.** The buyer's contract is with Bilt. The carrier's contract is with Bilt. The supplier's agreement is with Bilt. There is no direct contractual relationship between a buyer and a driver.

2. **No peer-to-peer messaging.** Do NOT build or extend:
   - Buyer ↔ driver chat
   - Buyer ↔ seller chat
   - Carrier ↔ supplier chat
   - Any multi-party job thread visible to both sides

3. **The correct contact channel is support.** When a user needs to communicate about an order, they contact Bilt:
   - Mobile: `(shared)/support-chat.tsx` → `SupportThread` / `SupportMessage` backend models → `POST /api/v1/support`
   - The support thread can carry a `jobId` or `orderId` context so Bilt staff see which job it's about
   - Both the buyer AND the driver/carrier can open separate support threads about the same job — they do NOT see each other's threads

4. **The `messages` tab = Bilt communications only.** Order status updates, system notifications, platform announcements, and Bilt support replies. Not inbox messages from other users.

5. **The `chat/` backend module** (`apps/backend/src/chat/`) is currently implemented as peer-to-peer job chat. Do NOT extend it with new chat rooms. If refactoring, scope it to Bilt↔user support threads only.

6. **Next-day payment.** Bilt pays carriers and sellers directly — the buyer does not pay the carrier. Payouts go via Paysera (all companies) or Stripe Connect (solo individual drivers). Never build a flow where a buyer sends money directly to a driver or seller outside the platform.

7. **Autonomous pricing.** Suppliers set their own catalog prices. Carriers decide which jobs to accept. No RFQ/negotiation flow between buyers and suppliers on the platform. Framework contracts (large B2B) are arranged by Bilt staff, not via an in-app negotiation chat.

### Integration ownership

All integrations live under `/dashboard/admin/integrations/*` — they serve the marketplace (all four sides).

**Concrete examples:**

- `Lursoft` — company registry auto-fill for B2B registration, buyer/seller risk checks → `/dashboard/admin/integrations/lursoft`
- Payment processor (Paysera), SMS, email, maps — serve marketplace transactions/notifications → `/dashboard/admin/integrations/`

### Platform integrations hub

All platform integrations are registered in `/dashboard/admin/integrations/page.tsx`. When you add a new platform integration:

1. Create the page at `/dashboard/admin/integrations/<name>/page.tsx`
2. Add it to the `INTEGRATIONS` array in `integrations/page.tsx` (the hub)
3. The sidebar item ("Visas integrācijas") already covers all sub-routes — no extra sidebar entry needed

### Backend module ownership signal

Backend is flat (`apps/backend/src/`). All marketplace and admin features use the prefix `/api/v1/<name>/*` (e.g. `/api/v1/lursoft/*`).

---

## Improving existing flows — rules to prevent duplication

- **Grep before you build.** Before creating any new component, sheet, state machine, or screen for a flow, search for existing implementations first. `order-request-new.tsx`, wizard components, and context files often already handle what you're about to build.
- **Check global components first.** Before writing any inline UI (address picker, status badge, price row, empty state, loading state, modal, map) — check `apps/mobile/components/ui/` and `apps/web/src/components/ui/` for an existing component. The component catalog in `.github/instructions/mobile-components.instructions.md` and `.github/instructions/web-components.instructions.md` is the single source of truth. One `grep` takes less than a second.
- **"Improve X" means edit X, not build a parallel X.** Patch the gap in the existing file — do not design a new flow from scratch alongside it.
- **Read the destination screen before touching the entry point.** If the task is "improve the catalog → order flow," read `order-request-new.tsx` (or whatever the destination is) before writing a single line in `catalog.tsx`.
- **Ask one scoped question before implementing anything net-new.** If unsure whether a flow already exists, ask: _"Does [screen] already handle [feature]?"_ — one grep answers it in seconds.
- **No new BottomSheet/modal for a flow that has a dedicated screen.** If a full wizard screen exists (`order-request-new`, `disposal/`, `transport/`, etc.), navigate to it — don't replicate steps inside a sheet.

---

## Code style rules

- **TypeScript** everywhere. Avoid `any` — use `unknown` + narrowing, or define proper interfaces.
- Prettier + ESLint enforced. Run `npm run lint` before committing.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes/components/types/interfaces.
- Controllers only do HTTP concerns (parse request, call service, return result). No business logic in controllers.
- Services contain all business logic and Prisma queries.
- No `console.log` in production code — use NestJS `Logger` in backend; remove debug logs from mobile/web.
- Use absolute imports (`@/...`) in mobile and web. Use relative imports in backend.

---

## Scoped instruction files (loaded automatically per path)

Before writing any backend code, DB query, or migration, check the backend schema reference.
Before writing any custom styled View, div, or input, check the component library for the relevant app.
Detailed references are in scoped instruction files:

- **Backend** (`apps/backend/**`) → `.github/instructions/backend-schema.instructions.md`
- **Web** (`apps/web/**`) → `.github/instructions/web-components.instructions.md`
- **Mobile** (`apps/mobile/**`) → `.github/instructions/mobile-components.instructions.md`
- **Mobile styling** (`apps/mobile/**`) → `.github/instructions/mobile-styling.instructions.md`

Key rules:

- **Backend**: always use the schema reference before writing Prisma queries or migrations. Follow the migration checklist when adding new fields or models.
- **Web**: use shadcn/ui primitives from `@/components/ui/`. Never write raw `<button>` or custom modal markup.
- **Mobile**: every screen must start with `<ScreenContainer>`. Detail screens must use `<ScreenHeader>`. Named sections must use `<InfoSection>` + `<DetailRow>`. Status must use `<StatusPill>`. Empty lists must use `<EmptyState>`.
- **Mobile styling**: always check the NativeWind safe-usage rules before writing any `className` or `style` in mobile. Never use arbitrary values (`text-[16px]`) in `className`. Never mix the custom `Text` component with font-weight overrides.

---

## Key files quick-reference

| File                                                         | Purpose                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                          | Single source of truth for all DB models and enums                                      |
| `apps/backend/src/common/types/requesting-user.interface.ts` | JWT user payload shape                                                                  |
| `apps/backend/src/app.module.ts`                             | Root module — all features registered here                                              |
| `apps/mobile/lib/api.ts`                                     | Barrel re-export for all mobile API functions                                           |
| `apps/mobile/lib/auth-context.tsx`                           | Auth state for mobile app                                                               |
| `apps/mobile/lib/tokens.js`                                  | Mobile design token primitives (colours, spacing, radius, shadows)                      |
| `apps/mobile/lib/transitions.ts`                             | Screen transition presets + Reanimated spring constants                                 |
| `STATUS.md`                                                  | **Feature status matrix** — what is built, connected, or missing across all three apps  |
| `ARCHITECTURE.md`                                            | System architecture overview — ⚠️ partially stale, see stale notice at file top         |
| `PRODUCT.md`                                                 | Product description, user personas, and full order flow                                 |
| `apps/web/src/components/admin-sidebar.tsx`                  | Admin sidebar — single scope managing all 4 market sides                                |
| `apps/web/src/components/sidebar-switch.tsx`                 | Picks AdminSidebar vs AppSidebar based on `user.userType`                               |
| `apps/web/src/proxy.ts`                                      | Next.js middleware — route guards for admin and marketplace deployments                 |
| `.github/instructions/backend-schema.instructions.md`        | All 30 DB models, enums, Prisma workflow, migration checklist                           |
| `.github/instructions/web-components.instructions.md`        | Web UI component catalog + usage                                                        |
| `.github/instructions/mobile-components.instructions.md`     | Mobile UI component catalog + usage                                                     |
| `.github/instructions/mobile-styling.instructions.md`        | NativeWind safe-usage rules — what goes in className vs style, font rules               |
| `scripts/generate-instructions.mjs`                          | Regenerates all instruction files from source — runs automatically on `prisma:generate` |

```

```
