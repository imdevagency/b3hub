````instructions
# B3Hub Monorepo — Copilot Instructions

## What this product is

**B3Hub** is a **neutral construction logistics marketplace** for the Latvian/Baltic market, owned and operated by B3 Group.

**B3 Group does not have internal admin portals on this platform.** B3 Recycling (licensed waste facility in Gulbene) and B3 Construction (groundworks company) are separate business units that **use B3Hub as external operators** — their staff log in with regular accounts, the same portals as any other recycler or construction company on the platform. There is no BU-specific admin section.

The **admin dashboard** (`/dashboard/admin/*`) covers **platform management only**: users, orders, listings, disputes, platform config.

The platform connects three sides:
- **Buyers** — ranges from homeowners ordering a skip for a garden project (B2C, guest checkout) to construction companies running 50 deliveries across multiple sites (B2B, full account with contracts and team management)
- **Sellers/Suppliers** — quarries and material suppliers listing gravel, sand, concrete, soil
- **Transport providers** — trucking companies and independent drivers executing deliveries

Full order flow: buyer places order → seller confirms loading → driver delivers → documents auto-generated.

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
  canSell: boolean; // approved seller — can list materials, see incoming orders
  canTransport: boolean; // approved driver — can accept & execute transport jobs
  canSkipHire: boolean; // approved to manage skip hire fleet
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
| `canSkipHire`  | Approved to manage skip hire fleet                     |

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
- `(buyer)` — (account)/, catalog, home, messages, more, new-order, order/, orders, profile, rfq/, skip-order/, transport-job/
- `(driver)` — active, documents, earnings, home, job-stat/, jobs, messages, more, profile, schedule, skips, vehicles
- `(gate)` — fields
- `(recycler)` — home, incoming, more, records
- `(seller)` — billing-settings, catalog, documents, earnings, framework-contract/, framework-contracts, home, incoming, more, order/, profile, quotes
- `(shared)` — change-password, chat/, delivery-proof, gate-scan, help, messages, notification/, notifications, review/, settings, support-chat
- `(wizards)` — disposal/, material-order, skip-hire/, transport/
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

## Improving existing flows — rules to prevent duplication

- **Grep before you build.** Before creating any new component, sheet, state machine, or screen for a flow, search for existing implementations first. `order-request-new.tsx`, wizard components, and context files often already handle what you're about to build.
- **"Improve X" means edit X, not build a parallel X.** Patch the gap in the existing file — do not design a new flow from scratch alongside it.
- **Read the destination screen before touching the entry point.** If the task is "improve the catalog → order flow," read `order-request-new.tsx` (or whatever the destination is) before writing a single line in `catalog.tsx`.
- **Ask one scoped question before implementing anything net-new.** If unsure whether a flow already exists, ask: _"Does [screen] already handle [feature]?"_ — one grep answers it in seconds.
- **No new BottomSheet/modal for a flow that has a dedicated screen.** If a full wizard screen exists (`order-request-new`, `rfq/[id]`, etc.), navigate to it — don't replicate steps inside a sheet.

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
| `.github/instructions/backend-schema.instructions.md`        | All 30 DB models, enums, Prisma workflow, migration checklist                           |
| `.github/instructions/web-components.instructions.md`        | Web UI component catalog + usage                                                        |
| `.github/instructions/mobile-components.instructions.md`     | Mobile UI component catalog + usage                                                     |
| `.github/instructions/mobile-styling.instructions.md`        | NativeWind safe-usage rules — what goes in className vs style, font rules               |
| `scripts/generate-instructions.mjs`                          | Regenerates all instruction files from source — runs automatically on `prisma:generate` |

```

```
