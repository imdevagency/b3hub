# Bilt — Product Concept

## What Bilt Is

Bilt is a **construction logistics marketplace** for the Latvian and Baltic market. It connects buyers, suppliers, carriers, and recyclers on one transaction layer.

One platform. One login. One place to order, move, and dispose of bulk construction materials.

---

## Two Surfaces

### 1. Admin Panel (`/dashboard/admin/*`)

Internal B3 staff only. Controls the platform.

- User and company management
- Feature flag assignment (who gets what)
- Marketplace health (orders, payouts, disputes)
- Recycling center verification and waste records
- Carrier and supplier applications
- Platform analytics

### 2. Bilt App (`/dashboard/*` — web + mobile)

Everyone else. What a company sees depends on their company type and role.

---

## Who Uses Bilt and What They See

### Any authenticated user (baseline)

- Order bulk materials, transport jobs, waste disposal
- Track their orders and documents
- View delivery notes and waste certificates
- Bilt support chat (the one contact channel)

### B2B Buyer (construction company, contractor)

Everything above, plus:

- Framework contracts + call-offs
- Team and permissions management
- Company invoicing

### Supplier

- Material catalog management
- Incoming orders — confirm / reject
- Pricing and availability

### Carrier / Driver

- Transport job queue — accept / reject jobs
- Real-time status flow during active delivery
- Earnings and payout view
- Vehicle and document management

### Recycler company (`companyType: RECYCLER`)

Everything a B2B company gets, plus:

- Intake log — waste received by type, weight, source order
- APUS reporting — VVD mandatory waste movement reporting (Latvia)
- Certificate generation — waste acceptance certificates per customer
- Site settings — operating hours, accepted waste types, capacity

---

## Feature Access Model

Access is determined by the auth token:

```
userType        BUYER | ADMIN
companyType     CONSTRUCTION | SUPPLIER | CARRIER | RECYCLER | HYBRID
companyRole     OWNER | MANAGER | DRIVER | MEMBER
```

| Who | Sees |
| --- | ---- |
| `userType: ADMIN` | Admin panel only |
| Any authenticated user | Marketplace (orders, catalog, transport, disposal) |
| `companyType: RECYCLER` | Intake log, APUS, Certificates |

---

## The Three Business Units

All three use the same platform. None has a separate app or login.

### Bilt (the marketplace)

The core. Material orders, transport jobs, waste disposal bookings. Open to all. Bilt is the sole contractual and contact partner — no buyer contacts a driver directly, no buyer negotiates with a supplier on-platform. All communication routes through Bilt support.

### B3 Recycling — Gulbene

A licensed construction waste recycling facility. Operates as a `RECYCLER` company on its own platform — exactly as any external recycler would. Listed as the primary provider in the disposal wizard. Processes waste into certified RC material and lists that material back on the Bilt catalogue — closing the circular loop.

### B3 Construction

A groundworks subcontracting company. Operates as a `CONSTRUCTION` buyer on its own platform. Orders materials, books disposal, places transport jobs through Bilt. Provides baseline order volume from day one and proves the platform works before external buyers are acquired.

---

## What Is Out of Scope

The rule: **if it doesn't move a tonne of material or handle a tonne of waste on Bilt, don't build it.**

Do not build:

- **Skip hire / container hire** — removed from scope
- **Toilet cabin hire** — removed from scope
- **Metal scrap buyback** — removed from scope
- **Quote requests / RFQ** — removed; framework contracts replace the negotiation workflow
- **Project management** (Gantt, milestones, DPRs, GPS timesheets) — out of scope
- **Equipment / plant hire** — out of scope
- **P2P messaging** — no buyer↔driver, buyer↔seller, or carrier↔supplier direct chat
- Payroll / HR / accounting
- BIM or site planning tools

---

## Roadmap (high level)

### Now — Build density in Riga region

- Drive material order volume with B3 Construction as anchor buyer
- Get enough carriers that response time is under 24 hours
- Activate disposal wizard for existing buyers

### Next — Close the circular loop

- Activate WasteRecord → Material listing workflow at Gulbene (the one missing step — admin clicks "Create Supply Listing" on a completed waste record)
- External recycler onboarding (apply → verify → listed in disposal wizard)

### Phase 2 — Baltic expansion

- Extend platform to Lithuania and Estonia
- Add B3 Field locations in secondary Latvian cities (Jelgava, Valmiera, Daugavpils)

---

## The Differentiator

Bilt is the only Baltic construction logistics platform that closes the full material loop: material delivered to sites → construction waste routed to B3 Recycling Gulbene → processed into certified secondary raw material → listed back on the platform. Every tonne in generates revenue; every tonne out generates supply. No other Baltic operator owns all four sides of this loop.
