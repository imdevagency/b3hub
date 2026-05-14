# Bilt — Rental Platform Scaling Guide

> **Last updated**: May 2026  
> This document describes the architecture that makes adding new rental services
> (scaffolding, generators, fencing, portable toilets, etc.) fast and zero-copy-paste.

---

## Core principle

All rental services share **one generic data model** (`RentalOrder`) and one backend
module (`RentalsModule`). A new service is a **configuration entry**, not a new module.

```
New service type ─────────────────────────────────── 4 files touched, 0 new screens
Prisma enum value   →  1 line  apps/backend/prisma/schema.prisma
Backend type config →  1 block apps/backend/src/rentals/rental.types.ts
Mobile registry     →  1 block apps/mobile/lib/rental-services.ts
DB migration        →  1 line  prisma/migrations/<ts>_add_<name>/migration.sql
```

---

## Architecture overview

### Database layer

| Model                      | Purpose                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RentalOrder`              | Single table for ALL generic rental orders — stores `serviceType`, flexible `metadata Json` for service-specific fields, `trackingToken`, status lifecycle, carrier assignment |
| `CarrierRentalSettings`    | Per-carrier pricing and supported cities per service type                                                                                                                      |
| `RentalServiceType` (enum) | Source of truth for valid service type strings                                                                                                                                 |
| `RentalOrderStatus` (enum) | `PENDING → CONFIRMED → DELIVERED → IN_USE → COLLECTED → COMPLETED`                                                                                                             |
| `SkipHireOrder`            | Legacy — has its own module for backward compat. New services do NOT get their own model.                                                                                      |
| `ToiletCabinOrder`         | Legacy — same as above.                                                                                                                                                        |

### Backend layer

```
apps/backend/src/rentals/
  rental.types.ts          ← per-service metadata interfaces + status flow config
  rentals.service.ts       ← all business logic (create, status update, assign, track)
  rentals.controller.ts    ← HTTP routes (one controller serves all service types)
  rentals.module.ts        ← NestJS wiring
  dto/
    create-rental-order.dto.ts   ← validated input DTO
    update-rental-order.dto.ts   ← status update DTO
```

**Routes** (all under `/api/v1/rentals`):

| Method  | Path                             | Auth     | Purpose                       |
| ------- | -------------------------------- | -------- | ----------------------------- |
| `POST`  | `/rentals`                       | Optional | Create order (buyer or guest) |
| `GET`   | `/rentals/my`                    | JWT      | Buyer: list own orders        |
| `GET`   | `/rentals/carrier`               | JWT      | Carrier: list assigned orders |
| `GET`   | `/rentals/track/:token`          | None     | Public order tracking         |
| `GET`   | `/rentals/:id`                   | JWT      | Get single order              |
| `PATCH` | `/rentals/:id/status`            | JWT      | Carrier: advance status       |
| `PATCH` | `/rentals/:id/assign/:carrierId` | JWT      | Admin: assign carrier         |

### Mobile layer

```
apps/mobile/lib/rental-services.ts          ← service registry (labels, icons, flow)
apps/mobile/lib/api/rentals.ts              ← all typed API functions (one file)
apps/mobile/components/wizard/
  RentalHirePeriodStep.tsx                  ← shared hire period wizard step
apps/mobile/components/driver/
  RentalOrderCard.tsx                       ← generic driver order card
```

---

## How to add a new rental service

### Step 1 — Add the enum value to Prisma

**File**: `apps/backend/prisma/schema.prisma`

```prisma
enum RentalServiceType {
  SCAFFOLDING
  TEMP_FENCING
  SITE_OFFICE
  GENERATOR
  LIGHTING_TOWER
  WATER_BOWSER
  PRESSURE_WASHER   ← add here
}
```

### Step 2 — Create the DB migration

Shadow DB is broken on this project. Create the SQL manually:

```bash
mkdir -p apps/backend/prisma/migrations/$(date +%Y%m%d%H%M%S)_add_pressure_washer
```

`migration.sql`:

```sql
DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'PRESSURE_WASHER';
EXCEPTION WHEN others THEN null;
END $$;
```

Apply it:

```bash
cd apps/backend && npx prisma migrate deploy
npm run prisma:generate
```

### Step 3 — Add backend type config

**File**: `apps/backend/src/rentals/rental.types.ts`

Add a metadata interface:

```ts
export interface PressureWasherMetadata {
  flowRateLpm: number;
  fuelIncluded: boolean;
}
```

Add it to the `RentalMetadata` union:

```ts
export type RentalMetadata =
  | ...
  | PressureWasherMetadata;
```

Add to `RENTAL_SERVICE_CONFIG`:

```ts
PRESSURE_WASHER: {
  label: 'Augstspiediena mazgātājs',
  unitLabel: 'agregāti',
  hasInUseStep: true,
  orderNumberPrefix: 'PW',
},
```

If the service skips `IN_USE`, add it to `SERVICES_WITHOUT_IN_USE`:

```ts
export const SERVICES_WITHOUT_IN_USE: RentalServiceType[] = [
  'SCAFFOLDING',
  'TEMP_FENCING',
  'WATER_BOWSER',
  'PRESSURE_WASHER', // ← add if no in-use step
];
```

### Step 4 — Add to the mobile registry

**File**: `apps/mobile/lib/rental-services.ts`

Add to `RentalServiceType`:

```ts
export type RentalServiceType =
  | ...
  | 'PRESSURE_WASHER';
```

Add to `RENTAL_SERVICES`:

```ts
PRESSURE_WASHER: {
  type: 'PRESSURE_WASHER',
  label: 'Augstspiediena mazgātājs',
  description: 'Augstspiediena mazgātājs virsmu tīrīšanai',
  Icon: Droplets,          // pick appropriate Lucide icon
  unitLabel: 'agregāti',
  actions: RENTAL_ACTIONS_WITH_IN_USE,  // or RENTAL_ACTIONS_SIMPLE
  hasInUseStep: true,
  hirePeriodOptions: [
    { days: 1, label: '1 diena' },
    { days: 3, label: '3 dienas' },
    { days: 7, label: '1 nedēļa' },
  ],
  apiPath: 'rentals',
},
```

### Step 5 — Done

The service now:

- Accepts orders via `POST /api/v1/rentals` with `serviceType: 'PRESSURE_WASHER'`
- Appears in `api.rentals.*` on mobile
- Renders on the driver tab via `RentalOrderCard` (normalise to `RentalCardOrder` shape)
- Shows the correct hire period picker via `RentalHirePeriodStep`
- Has the correct status flow (with or without `IN_USE`)

---

## Status lifecycle options

### With IN_USE step (generators, site offices, toilet cabins)

```
PENDING → CONFIRMED → DELIVERED → IN_USE → COLLECTED → COMPLETED
```

Actions array: `RENTAL_ACTIONS_WITH_IN_USE`

### Without IN_USE step (scaffolding, fencing, water bowsers, skips)

```
PENDING → CONFIRMED → DELIVERED → COLLECTED → COMPLETED
```

Actions array: `RENTAL_ACTIONS_SIMPLE`  
Register: add type to `SERVICES_WITHOUT_IN_USE` in both `rental.types.ts` and `rental-services.ts`.

---

## Order number prefixes

Each service type maps to a 2-letter prefix in `rentals.service.ts → generateOrderNumber()`:

| Service        | Prefix | Example       |
| -------------- | ------ | ------------- |
| SCAFFOLDING    | SC     | SC-2026-00001 |
| TEMP_FENCING   | TF     | TF-2026-00001 |
| SITE_OFFICE    | SO     | SO-2026-00001 |
| GENERATOR      | GN     | GN-2026-00001 |
| LIGHTING_TOWER | LT     | LT-2026-00001 |
| WATER_BOWSER   | WB     | WB-2026-00001 |
| (fallback)     | RN     | RN-2026-00001 |

When adding a new service, add its prefix to the `prefixMap` in `generateOrderNumber()`.

---

## Service-specific metadata

The `metadata` column is `Json` — no migration needed to add or change fields.
Define the TypeScript interface in `rental.types.ts` for compile-time safety.
Pass it from the wizard via `CreateRentalOrderDto.metadata`.

---

## What NOT to do

- **Do not** create a new Prisma model (e.g. `ScaffoldingOrder`) for a new rental service.
- **Do not** create a new NestJS module for each rental service type.
- **Do not** create new wizard screens — compose from `RentalHirePeriodStep` and existing wizard primitives.
- **Do not** create a new driver screen — normalise to `RentalCardOrder` and render via `RentalOrderCard`.
- **Do not** add a new route group in `lib/api/` — all rental API calls live in `lib/api/rentals.ts`.

---

## Legacy services (SkipHire, ToiletCabin)

`SkipHireOrder` and `ToiletCabinOrder` predate this architecture and keep their own
dedicated modules (`skip-hire/`, `toilet-cabins/`). They will not be migrated.
All new rental service types use `RentalOrder` only.

---

## Adding new non-rental service categories

For entirely different service categories (e.g. earthworks, surveying) that don't
fit the hire-period model, they need their own order model. Follow the same 5-step
checklist but create a new Prisma model and NestJS module. Use the `rentals/` module
as the template — the structure is: `types.ts`, `dto/`, `service.ts`, `controller.ts`,
`module.ts`, registered in `app.module.ts`.
