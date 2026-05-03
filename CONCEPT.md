# B3Hub — Product Concept

## What B3Hub Is

B3Hub is a **construction logistics platform** for the Latvian and Baltic market. It connects buyers, suppliers, carriers, and recyclers in one place — and gives construction companies the operational software to manage their projects, crews, and costs on top of that marketplace.

One platform. One login. Everything a construction company needs.

---

## Two Surfaces

### 1. Admin Panel (`/dashboard/admin/*`)

Internal B3 staff only. Controls the platform.

- User and company management
- Feature flag assignment (who gets what)
- Marketplace health (orders, payouts, disputes)
- Recycling center verification
- Subscription and billing management
- Platform analytics

### 2. B3Hub App (`/dashboard/*` — web + mobile)

Everyone else. What a company sees depends on their type and active features.

---

## Who Uses B3Hub and What They See

### Any authenticated user (baseline)

- Order materials, transport, disposal, skip hire
- Track their orders
- Messaging

### B2B Buyer (construction company, contractor)

Everything above, plus:

- Project-linked ordering (assign orders to a project/site)
- Framework contracts
- Team and permissions management
- Cost tracking against marketplace spend

### Supplier

- Material catalog management
- Incoming orders
- Pricing and availability

### Carrier

- Transport job queue
- Earnings and payouts
- Vehicle and driver management

### Construction company with `CONSTRUCTION_MANAGEMENT` feature

Everything a B2B buyer gets, plus:

- **Projects** — create and manage construction projects
- **Budget estimator** — line-item cost planning with live marketplace rates
- **Daily reports (DPRs)** — field progress and cost logging per day
- **Budget vs actual** — real profitability per project
- **GPS timesheets** _(Phase 2)_ — field crew clock in/out, feeds DPR costs automatically

### Recycler company (`companyType: RECYCLER`)

Everything a B2B company gets, plus:

- **Intake log** — waste received by type, weight, source order
- **APUS reporting** — VVD mandatory waste movement reporting
- **Certificate generation** — waste acceptance certificates per customer
- **Site settings** — operating hours, accepted waste types, capacity

---

## Feature Access Model

Access is determined by three things carried in the auth token:

```
userType        BUYER | ADMIN
companyType     CONSTRUCTION | SUPPLIER | CARRIER | RECYCLER | HYBRID
companyFeatures CONSTRUCTION_MANAGEMENT | RECYCLING_OPS | ...
companyRole     OWNER | MANAGER | DRIVER | MEMBER
```

| Who                                                                       | Sees                                     |
| ------------------------------------------------------------------------- | ---------------------------------------- |
| `userType: ADMIN`                                                         | Admin panel only                         |
| Any authenticated user                                                    | Marketplace (orders, catalog, transport) |
| `companyFeatures: CONSTRUCTION_MANAGEMENT` + `companyRole: OWNER/MANAGER` | Projects, DPRs, Budgets, Timesheets      |
| `companyFeatures: CONSTRUCTION_MANAGEMENT` + `companyRole: DRIVER/MEMBER` | Clock in/out, own DPR entries            |
| `companyType: RECYCLER`                                                   | Intake log, APUS, Certificates           |

---

## The Three Business Units

All three use the same platform. None has a separate app or login.

### B3Hub (the marketplace)

The core. Materials, transport, disposal, skip hire. Open to all.

### B3 Recycling

A licensed construction waste recycling facility in Gulbene. Operates as a `RECYCLER` company on its own platform — exactly how any other recycler would. Gets `RECYCLING_OPS` features. Also listed in the disposal wizard as a marketplace provider.

### B3 Construction

A groundworks subcontracting company. Operates as a `CONSTRUCTION` company on its own platform — exactly how any other contractor would. Gets `CONSTRUCTION_MANAGEMENT` features. Dog-foods the SaaS before it opens to other contractors.

---

## What Is Out of Scope

The rule: **if it doesn't make someone order more through B3Hub, don't build it.**

Never build:

- Payroll processing
- Full accounting / bookkeeping (VAT, P&L, tax)
- BIM or site planning tools
- HR / recruitment
- Dedicated compliance software for other recyclers

---

## Roadmap (high level)

### Now

- Finish construction SaaS features for internal B3 Construction use
- All routes still behind `ADMIN` guard while dog-fooding

### Next

- Add `companyFeatures` flag to Company model
- Swap `ADMIN` guards to `CompanyFeatureGuard`
- Move construction routes from `/b3-construction/*` to `/projects/*`
- Move recycling routes to `/recycling/*`
- Open to first external construction companies

### Phase 2

- GPS timesheets (mobile clock in/out → auto-feed DPR labour costs)
- External recycler onboarding (apply → verify → listed in disposal wizard)
- Equipment rental marketplace
- Subcontractor marketplace

---

## The Differentiator

No other Baltic tool connects project budget lines to live supplier rates, procurement orders, delivery tracking, and field costs in one place. A construction manager on B3Hub sees their project budget, places a material order against it, tracks the delivery, and sees the actual cost land in their profitability dashboard — without touching a spreadsheet.
