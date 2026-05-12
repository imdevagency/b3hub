---
applyTo: 'apps/**'
---

# Adding a new rental service to B3Hub

> Read `SCALING.md` at the repo root for the full architecture overview.
> This file is the actionable checklist for AI agents.

---

## The rule

**New rental service = 4 file edits, 0 new screens, 0 new modules.**

All rental services share:

- One Prisma model: `RentalOrder` (table: `rental_orders`)
- One backend module: `apps/backend/src/rentals/`
- One mobile API file: `apps/mobile/lib/api/rentals.ts`
- One mobile registry: `apps/mobile/lib/rental-services.ts`
- One wizard step: `apps/mobile/components/wizard/RentalHirePeriodStep.tsx`
- One driver card: `apps/mobile/components/driver/RentalOrderCard.tsx`

---

## Checklist (run in order)

### 1. Prisma enum — `apps/backend/prisma/schema.prisma`

Add the new value to `RentalServiceType`:

```prisma
enum RentalServiceType {
  SCAFFOLDING
  TEMP_FENCING
  SITE_OFFICE
  GENERATOR
  LIGHTING_TOWER
  WATER_BOWSER
  NEW_SERVICE_TYPE   ← add here
}
```

### 2. DB migration

Shadow DB is broken — create SQL manually. Never run `prisma migrate dev`.

```bash
mkdir -p apps/backend/prisma/migrations/$(date +%Y%m%d%H%M%S)_add_<name>
```

`migration.sql`:

```sql
DO $$ BEGIN
  ALTER TYPE "RentalServiceType" ADD VALUE 'NEW_SERVICE_TYPE';
EXCEPTION WHEN others THEN null;
END $$;
```

Apply:

```bash
cd apps/backend && npx prisma migrate deploy && npm run prisma:generate
```

### 3. Backend types config — `apps/backend/src/rentals/rental.types.ts`

a) Add a metadata interface:

```ts
export interface NewServiceMetadata {
  // service-specific fields
}
```

b) Add it to the `RentalMetadata` union:

```ts
export type RentalMetadata = ... | NewServiceMetadata;
```

c) Add to `RENTAL_SERVICE_CONFIG`:

```ts
NEW_SERVICE_TYPE: {
  label: 'Service label (Latvian)',
  unitLabel: 'units (Latvian)',
  hasInUseStep: true,      // false if no IN_USE step
  orderNumberPrefix: 'XX', // unique 2-letter prefix
},
```

d) If no IN_USE step, add to `SERVICES_WITHOUT_IN_USE`:

```ts
export const SERVICES_WITHOUT_IN_USE = [
  ...existing...,
  'NEW_SERVICE_TYPE',
];
```

e) Add the prefix to `generateOrderNumber()` in `apps/backend/src/rentals/rentals.service.ts`:

```ts
const prefixMap: Record<string, string> = {
  ...existing...
  NEW_SERVICE_TYPE: 'XX',
};
```

### 4. Mobile registry — `apps/mobile/lib/rental-services.ts`

a) Add to the `RentalServiceType` union type:

```ts
export type RentalServiceType = ... | 'NEW_SERVICE_TYPE';
```

b) Add entry to `RENTAL_SERVICES`:

```ts
NEW_SERVICE_TYPE: {
  type: 'NEW_SERVICE_TYPE',
  label: 'Latvian label',
  description: 'Short description shown in catalog',
  Icon: SomeLucideIcon,
  unitLabel: 'vienības',
  actions: RENTAL_ACTIONS_WITH_IN_USE, // or RENTAL_ACTIONS_SIMPLE
  hasInUseStep: true,
  hirePeriodOptions: [
    { days: 1, label: '1 diena' },
    { days: 3, label: '3 dienas' },
    { days: 7, label: '1 nedēļa' },
    { days: 14, label: '2 nedēļas' },
  ],
  apiPath: 'rentals',
},
```

---

## That's it — nothing else needed

The service now:

- Accepts orders: `POST /api/v1/rentals` with `{ serviceType: 'NEW_SERVICE_TYPE', ... }`
- Buyer list: `GET /api/v1/rentals/my?serviceType=NEW_SERVICE_TYPE`
- Carrier list: `GET /api/v1/rentals/carrier?serviceType=NEW_SERVICE_TYPE`
- Public tracking: `GET /api/v1/rentals/track/:token`
- Status update: `PATCH /api/v1/rentals/:id/status`
- Mobile API: `api.rentals.create()`, `api.rentals.myOrders()`, `api.rentals.carrierOrders()`
- Driver card: normalise to `RentalCardOrder` shape → `<RentalOrderCard />`
- Wizard hire period step: `<RentalHirePeriodStep />`

---

## Status flows

### With IN_USE (generators, site offices, portable toilets)

`PENDING → CONFIRMED → DELIVERED → IN_USE → COLLECTED → COMPLETED`
Use `RENTAL_ACTIONS_WITH_IN_USE`, set `hasInUseStep: true`.

### Without IN_USE (scaffolding, fencing, water bowsers)

`PENDING → CONFIRMED → DELIVERED → COLLECTED → COMPLETED`
Use `RENTAL_ACTIONS_SIMPLE`, set `hasInUseStep: false`, add to `SERVICES_WITHOUT_IN_USE`.

---

## Hard rules — never break these

- **Never** create a new Prisma model for a rental service. `RentalOrder` handles all of them.
- **Never** create a new NestJS module for a rental service type.
- **Never** create new wizard screens. Compose from `RentalHirePeriodStep` + wizard primitives.
- **Never** create a new driver list/card screen. Use `RentalOrderCard` with `RentalCardOrder` shape.
- **Never** add a new API file in `lib/api/`. All rental calls live in `lib/api/rentals.ts`.
- **Never** duplicate status logic. `RENTAL_STATUS_FLOW` and `SERVICES_WITHOUT_IN_USE` are the single source of truth.
- **Always** keep `rental-services.ts` (mobile) and `rental.types.ts` (backend) in sync on `hasInUseStep` and `SERVICES_WITHOUT_IN_USE`.

---

## Key files at a glance

| File                                          | What to touch                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`           | Add enum value to `RentalServiceType`                                                                                 |
| `apps/backend/prisma/migrations/`             | SQL to `ALTER TYPE ... ADD VALUE`                                                                                     |
| `apps/backend/src/rentals/rental.types.ts`    | Metadata interface + `RENTAL_SERVICE_CONFIG` + optional `SERVICES_WITHOUT_IN_USE`                                     |
| `apps/backend/src/rentals/rentals.service.ts` | Add prefix to `prefixMap` in `generateOrderNumber()`                                                                  |
| `apps/mobile/lib/rental-services.ts`          | Add to `RentalServiceType` union + `RENTAL_SERVICES` record                                                           |
| **Never touch**                               | `rentals.module.ts`, `rentals.controller.ts`, `lib/api/rentals.ts`, `RentalOrderCard.tsx`, `RentalHirePeriodStep.tsx` |
