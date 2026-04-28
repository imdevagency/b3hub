# B3Hub — Product Documentation

> **This is the single source of truth** for what B3Hub is, who it serves, and what it does.
> Keep it updated as the product evolves. All other documentation follows from this file.

---

## Vision

> **Build the end-to-end infrastructure for construction materials and logistics in the Baltics — digitally and physically — so that every tonne of material moved, every load disposed of, and every delivery executed is trackable, documented, and settled through one platform.**

---

## Mission

> Make it as simple to order, move, and dispose of construction materials in Latvia and the Baltics as it is to book a taxi — whether you're a homeowner picking up gravel from a B3 Field or a construction company running 50 simultaneous deliveries across the country.

---

## North Star

The single metric that defines success:

> **Total value of transactions processed through B3Hub** (orders + transport + disposal + skip hire).

Every feature, every B3 Field, and every integration should either increase the number of transactions or increase the value of each one. If it doesn't move this number, it's not a priority.

---

## What B3Hub Is

B3Hub is a **construction logistics marketplace** for the Latvian and Baltic market.

It connects three sides of the construction supply chain:

- **Buyers** — construction companies, contractors, homeowners who need materials delivered or waste removed
- **Sellers** — quarries, material suppliers who sell gravel, sand, concrete, soil, recycled materials
- **Carriers** — trucking companies and independent drivers who execute deliveries

The platform handles the **complete transaction lifecycle**: buyer places order → seller confirms loading → driver delivers → documents generated automatically → payment settled.

Every euro spent on materials and transport through B3Hub is trackable, documented, and tied to a real delivery. That's the core product promise.

B3Hub serves **two customer segments on the same marketplace**:

- **B2B** — construction companies, contractors, and project managers running complex multi-site procurement. Account required. Framework contracts, project cost tracking, invoicing, team management.
- **B2C** — homeowners, small trades, and micro-contractors with simple one-off needs: order a skip, get gravel delivered, book waste collection. Guest checkout with phone/email capture. Account creation offered post-order as a convenience, not a gate.

---

## B3 Fields — Physical Fulfillment Network

In addition to the digital marketplace, B3Hub operates **B3 Fields** — physical centers where customers can interact with materials and services directly.

Each B3 Field is a branded fulfillment node offering some or all of the following:

- **Gravel & material pickup** — buy materials on the platform and collect them on-site (no delivery truck needed). Ideal for homeowners and small contractors with their own vehicle.
- **Waste disposal** — drive in and dispose of construction waste. Processed through the platform as a standard disposal transaction with certificate auto-generated.
- **Trailer rental** — rent a trailer tied to a material pickup order, so small buyers can self-haul without needing a carrier.

### How B3 Fields fit the platform

B3 Fields are not standalone physical stores — every transaction at a B3 Field flows through the B3Hub platform. Payment, documents, and receipts are handled the same way as any other order. This keeps the data model consistent and every euro traceable.

B3 Fields are modelled as **fulfillment locations** in the system:

- Material orders: `fulfillmentType: PICKUP` at a B3 Field address
- Waste disposal: B3 Field registered as a `RecyclingCenter` with a physical address and opening hours
- Trailer rental: attached to a B3Hub order (not available as a standalone rental)

### Strategic value

Physical centers create a **network of fulfillment nodes** that competitors cannot copy with software alone. They unlock the homeowner and micro-contractor segment — buyers who need half a tonne of gravel and have no need for a full delivery truck. This expands the addressable market without breaking the transaction-first model.

---

## What B3Hub Is NOT

These are out of scope by design. Adding them would dilute focus and pull B3Hub away from its defensible position as a transaction marketplace.

| Out of scope                                                    | Why                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Project management** (Gantt, milestones, dependencies)        | That's Procore / PlanRadar territory                                    |
| **On-site quality management** (punch lists, NCRs, inspections) | That's Qualisflow / BIM tools — happens after delivery                  |
| **Labor / timesheet tracking**                                  | That's payroll / HR software                                            |
| **Equipment / plant management**                                | Not a B3Hub transaction                                                 |
| **External cost tracking**                                      | We track only what moves through our platform                           |
| **General ERP**                                                 | We are the procurement + logistics layer, not the full operating system |

**The rule:** if a feature requires data that doesn't originate from a B3Hub transaction, it's out of scope.

---

## B2C vs B2B — Platform Strategy

Both segments run on the same marketplace, the same supply network, and the same backend. The split is in the **buyer experience** and **checkout rules** only.

### Segment comparison

| Dimension             | B2C (homeowners, micro-contractors)                   | B2B (construction companies, contractors)                  |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Order complexity      | Low — 1 address, simple qty, no project               | High — site contacts, tonnage, timed windows, multi-drop   |
| Typical order value   | €50–500                                               | €500–50 000+                                               |
| Account required?     | No — guest checkout (phone/email at step 1)           | Yes — verified company account                             |
| Pricing               | Fixed displayed price                                 | RFQ, framework contracts, negotiated rates                 |
| Invoicing             | Email receipt + basic invoice                         | VAT invoice with company details, project codes            |
| Repeat orders         | Low                                                   | High — framework contracts, call-offs, recurring schedules |
| Document requirements | Waste transfer note auto-generated (legally required) | Full document suite: delivery notes, weighing slips, certs |
| Support path          | Self-serve, phone confirmation for skip delivery slot | Dedicated account management at scale                      |

### Entry points

**Landing page** (`apps/landing`) is the B2C entry point:

- Skip hire wizard — size, waste type, postcode, dates → guest checkout
- Materials quick order — material type, quantity, delivery postcode → guest checkout
- Price estimator widget — no order created; shows indicative price + "Sign up to book" CTA

**Web app** (`apps/web`) and **mobile app** (`apps/mobile`) are the authenticated B2B entry points.

### Design rules that follow from this

1. **Fixed price must exist before B2C checkout** — suppliers listing materials must set a public retail price. RFQ-only listings are invisible in the B2C flow.
2. **Phone or email captured at wizard step 1** — not at the end. Carrier needs to confirm delivery slot; without contact detail the order cannot be executed.
3. **Waste transfer note triggers on every disposal/skip order** — even guest orders. Legal requirement regardless of company status.
4. **Carriers can opt out of guest orders** — B2C orders are flagged so carriers can filter by order type if they prefer verified accounts.
5. **Post-checkout account prompt** — after guest order confirmation, show "Save your details for faster ordering next time" → account creation with order auto-linked.
6. **B2B features invisible to guests** — framework contracts, RFQ, projects, team management, analytics never shown in guest flow.

---

## Why We Win

The features that make B3Hub defensible are ones that **only work because we own the transaction**. A standalone ERP cannot do these things:

| Feature                                           | Why only a marketplace can do it                                |
| ------------------------------------------------- | --------------------------------------------------------------- |
| **Project cost tracking**                         | Auto-populated from real orders — no manual entry               |
| **Supplier performance scores**                   | Calculated from actual on-time delivery data                    |
| **Cost per tonne benchmarking**                   | We hold price data across all buyers and suppliers              |
| **Waste certificates auto-attached**              | Generated from the transaction that produced the waste          |
| **Framework contract call-offs → auto-transport** | Dispatch triggered from a live order event                      |
| **CO₂ reporting per project**                     | Distance × vehicle type × load weight — all from transport jobs |

These can't be replicated by a competitor who doesn't own the supply network.

---

## Business Model

> **Principle:** Every party that touches a transaction pays something. Every data asset generates revenue. Every relationship becomes a product.

---

### How money flows through the platform (core mechanics)

```
Buyer pays → Paysera checkout (full order total, redirect-and-webhook flow)
  ├─ Platform fee retained   (commissionRate % — default 10%)
  ├─ Seller payout released  (sellerPayout — manual / batch payout)
  └─ Carrier payout released (driverPayout — manual / batch, or Stripe Connect for solo individual drivers)
```

`commissionRate` and `payoutEnabled` are per-company (`Company` model), so rates are fully negotiable per partner. Solo individual drivers (no company) optionally use Stripe Connect (`DriverProfile.stripeConnectId`); all other payouts go via Paysera or bank transfer.

---

### Revenue stream map

#### TIER 1 — Transaction layer (earn on every order, today)

| #   | Stream                            | Mechanism                                                                                                       | Margin profile     |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | **Material order commission**     | % of subtotal + delivery fee, retained before seller payout                                                     | 8–15%              |
| 2   | **Transport job margin**          | `rate` charged to buyer minus `driverPayout` to carrier — B3Hub acts as logistics broker, not just intermediary | 15–30%             |
| 3   | **Skip hire spread**              | Retail price set by B3Hub; carrier paid wholesale `CarrierPricing` rate per size. Full spread owned.            | 20–35%             |
| 4   | **Container rental commission**   | % on `ContainerOrder` total (rental days × daily rate + delivery/pickup fees)                                   | 8–12%              |
| 5   | **Waste disposal commission**     | % on disposal fee when waste is routed to a recycling center through the platform                               | 8–12%              |
| 6   | **Double-dip on combined orders** | `OrderType.COMBINED` = materials + transport in one order. Commission on both sides simultaneously.             | 2× per transaction |

---

#### TIER 1B — Logistics margin levers (squeeze more out of every truck run)

These all sit inside the transport layer. The spread between what B3Hub charges the buyer and what B3Hub pays the carrier is the logistics margin. Every lever below widens that spread without changing the carrier's rate.

| #   | Stream                              | Mechanism                                                                                                                                                                                                   | Notes                                                                                            |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 7   | **Backhaul / return load matching** | Driver delivers gravel north → B3Hub matches a return load (waste collection, equipment) going south. Buyer 2 pays a full transport rate. Driver gets a small top-up. B3Hub keeps the delta.                | Empty truck on way back = pure waste. This is the single highest-margin opportunity in trucking. |
| 8   | **Multi-stop consolidation**        | Combine 3 small orders going to nearby sites into one truck run. Charge each buyer the full single-delivery rate. Pay the driver once for the run.                                                          | `cargoWeight`/`cargoVolume` fields on `TransportJob` enable this.                                |
| 9   | **Surcharge ownership**             | Buyers are charged surcharges (fuel, weekend delivery, overweight, narrow access, waiting time). Carriers are paid flat agreed rates. Surcharges = 100% platform margin.                                    | Store as line items on the order. Fuel surcharge alone can be 8–12% of job value.                |
| 10  | **Pricing vs. cost arbitrage**      | Charge buyers distance-based pricing (€/km × km). Pay carriers a flat day-rate or regional zone rate. On short urban runs, the km-rate overbills vs. a flat rate — margin is captured automatically.        | `distanceKm` on `TransportJob` enables per-km billing.                                           |
| 11  | **Waiting / demurrage fees**        | Charge buyers for truck waiting time at loading/unloading (after first 30 min free). Carriers are not paid extra for waiting — it's already priced into their day rate. Full demurrage is platform revenue. | Common in construction — sites are often not ready when the truck arrives.                       |
| 12  | **Minimum job fee**                 | Every job has a minimum charge (e.g., €120 minimum regardless of distance). Short-haul jobs at minimum fee have very high margin since driver cost is the same.                                             | Enforce in pricing logic on job creation.                                                        |
| 13  | **Dynamic peak pricing**            | Charge buyers more during peak periods (Monday mornings, end-of-month, pre-holiday). Pay carriers the same flat rate. Margin expands automatically during high demand.                                      | Seasonal in Baltic construction — summer = peak.                                                 |
| 14  | **Preferred carrier stack**         | Assigned jobs go to carriers with lower agreed rates first. Buyer always pays the same platform rate. Lower-cost carrier = wider margin.                                                                    | Route-matching logic in `TransportJob` assignment.                                               |

---

#### TIER 2 — Relationship layer (earn on ongoing accounts, near-term)

| #   | Stream                                | Mechanism                                                                                                                                                       |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | **Framework contract management fee** | Flat monthly fee OR per-tonne override on every call-off released under a contract. Large construction companies with €500k+ annual procurement are the target. |
| 8   | **Supplier onboarding fee**           | One-time activation fee for verified supplier accounts. Covers vetting, onboarding session, and listing setup. Justified as cost recovery.                      |
| 9   | **Carrier onboarding fee**            | One-time fee for carrier/driver activation — covers document verification, license checks, vehicle inspection records.                                          |
| 10  | **Enhanced supplier profile**         | Paid tier: more photos, promotional description, certifications badge, priority placement in catalog. Monthly subscription.                                     |
| 11  | **Promoted catalog listings**         | Suppliers pay to appear at top of search results in their region/category. Per-position, per-week pricing. Direct analog to Google Ads for the catalog.         |
| 12  | **RFQ lead fee**                      | Suppliers pay per quote response submitted (`QuoteResponse`), or a success fee when a quote converts to an order.                                               |

---

#### TIER 3 — Float & financial services (earn on money in motion)

| #   | Stream                         | Mechanism                                                                                                                                                                                   |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **Payment float / interest**   | Paysera holds funds between buyer payment and platform-initiated seller payout. At volume, even 2–5 days of float on €1M/month GMV earns ~€3–5k/year. Modest but free.                      |
| 14  | **Trade credit for buyers**    | Verified construction companies buy now, pay in 30/60 days. Funded via a lending partner (B3Hub earns referral + spread). Construction companies live on credit — this is extremely sticky. |
| 15  | **Early payout for suppliers** | Suppliers get paid instantly (for a 1–2% discount) instead of waiting for buyer payment cycle. Platform or factoring partner absorbs the receivable.                                        |
| 16  | **Cargo insurance**            | Bundle per-shipment transit insurance into transport orders. Zero effort for the user — opt-out rather than opt-in. Revenue split with insurer.                                             |
| 17  | **Driver/carrier credit**      | Carriers need vehicles and equipment. B3Hub data (earnings history, job completion rate) makes creditworthiness transparent. Refer to lenders for a fee, or originate directly later.       |

---

#### TIER 4 — SaaS & data layer (earn on information and tools)

| #   | Stream                               | Mechanism                                                                                                                                                                                                            |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | **Analytics & reporting add-on**     | Free tier: basic order history. Paid tier: full P&L per project, budget alerts, supplier benchmarking, CSV/Excel export, custom date ranges. Monthly subscription per seat.                                          |
| 19  | **Market price intelligence**        | B3Hub sees every material price transacted across the Baltic market. Aggregate and anonymize → sell as a "Construction Material Price Index" report to suppliers, buyers, and banks financing construction projects. |
| 20  | **API access / ERP integration**     | Large buyers want to push orders from SAP, Procountor, or their own ERP directly into B3Hub without touching the web app. Charge a monthly API access fee + per-call volume pricing beyond a free tier.              |
| 21  | **White-label platform**             | Sell the entire B3Hub stack (rebranded) to a logistics operator in Poland, Finland, or Germany who wants to run their own marketplace. SaaS licensing fee + revenue share.                                           |
| 22  | **Demand forecasting for suppliers** | Quarries need to plan quarry output 6–12 months ahead. B3Hub order data = the best demand signal in the market. Sell forecast reports to suppliers.                                                                  |

---

#### TIER 5 — Compliance & documents (earn on regulation)

| #   | Stream                                   | Mechanism                                                                                                                                                                                         |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | **Waste certificate issuance**           | Every tonne of construction waste legally requires a waste transfer certificate (EU Waste Framework Directive). Platform auto-generates these. Charge per certificate above a free monthly quota. |
| 24  | **Document archiving**                   | Buyers and suppliers must store delivery/waste documents for 5 years (regulatory requirement). Charge a small annual archiving fee per company for long-term secure storage.                      |
| 25  | **ESG / carbon reporting**               | Construction companies under ESG reporting obligations need scope 3 data on waste disposal and material sourcing. B3Hub data = automatic scope 3 emissions report. Sell as compliance add-on.     |
| 26  | **ADR / hazardous transport compliance** | Hazardous waste transport requires specific documentation. Premium document generation for ADR-classified loads.                                                                                  |

---

#### TIER 6 — Physical operations (earn on assets)

| #   | Stream                         | Mechanism                                                                                                                                                                              |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | **Physical recycling centers** | Own or franchise intake sites. Revenue: gate fees per tonne, recycled aggregate sales, municipal waste contracts. Platform drives all logistics to the center.                         |
| 28  | **Material depots**            | Branded stockpiles in strategic locations. Buy from quarries in bulk, sell through the platform catalog. Own the full margin — no supplier commission sharing.                         |
| 29  | **Weighbridge-as-a-service**   | Install certified weighbridges at supplier/recycler sites. Charge per weighing event. Certified weight data is a legal requirement for every truck movement — nobody escapes this fee. |

---

#### TIER 7 — Carrier & driver ecosystem (earn on the labor side)

| #   | Stream                              | Mechanism                                                                                                                                                                             |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | **Driver training & certification** | ADR training, digital tachograph courses, weighbridge operation. Partner with training providers and take a referral/commission. Drivers need these to be eligible for platform jobs. |
| 31  | **Fleet management tools**          | Carriers with 5+ vehicles pay for premium dispatch tools: route optimization, vehicle tracking, maintenance alerts, driver schedule management. Monthly SaaS fee.                     |
| 32  | **Fuel card partnership**           | Negotiate a fuel card deal with a Baltic fuel network. Offer it to carriers via the platform. Earn per-litre commission on all platform carrier fuel spend.                           |

---

#### TIER 8 — Advertising & marketplace (earn on attention)

| #   | Stream                              | Mechanism                                                                                                                                                                           |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 33  | **Third-party display advertising** | Equipment rental companies, tool suppliers, insurance providers, and banks want to reach construction company decision-makers. Sell ad placements in the web portal and mobile app. |
| 34  | **Sponsored categories**            | A concrete supplier pays to own the "Concrete" category banner for a month across the whole Baltic market. High-value, low-volume deals.                                            |

---

### Prioritized by when to build

| Phase          | Streams                                | Why now                                      |
| -------------- | -------------------------------------- | -------------------------------------------- |
| **Live now**   | 1–6                                    | Core GMV — get this right first              |
| **Q1–Q2 2026** | 7, 8, 9, 10, 11, 12, 23                | Low engineering effort, high yield           |
| **Q3–Q4 2026** | 13, 14, 15, 16, 18, 19, 24, 25         | Requires volume / data to be meaningful      |
| **2027**       | 17, 20, 21, 22, 26, 30, 31, 32, 33, 34 | Requires established user base               |
| **Future**     | 27, 28, 29                             | Capital-intensive, requires operational team |

---

## The Four Parties

### Buyers

Anyone who needs construction materials delivered or waste removed.

**B2B buyers (account required):**

- Construction companies — ordering materials per project site, managing procurement across multiple sites
- General contractors — bulk deliveries, framework contracts, recurring schedules
- Project managers — cost tracking, team access control, RFQ management

**B2C buyers (guest checkout available):**

- Private homeowners — skip for a bathroom reno, gravel for a garden path, soil for landscaping
- Small trades (plumbers, electricians, tilers) — one-off material drops, occasional skip hire
- Micro-contractors — no company account, low frequency, simple single-site jobs

**What they do on the platform:**

- Browse the material catalog and place delivery orders
- Order skip hire / waste container placement
- Book waste disposal (recycling centers)
- Track deliveries in real time
- Download invoices, delivery notes, and waste certificates
- Manage procurement projects (group orders by construction site)
- Issue RFQs (request quotes from multiple suppliers)
- Set up framework contracts for recurring supply

**How they register:** Self-serve — mobile app or web. Email or phone number. Account active immediately. No approval needed.

---

### Sellers (Suppliers)

Companies that have bulk construction materials to sell.

**Who they are:**

- Quarries — gravel, crushed stone, sand, limestone
- Concrete plants
- Soil and fill material suppliers
- Recycled material processors (recycled concrete, recycled asphalt)

**What they do on the platform:**

- List materials with prices, stock availability, and location
- Receive and confirm/reject incoming orders
- Confirm driver arrival at loading point (digital loading confirmation)
- Respond to RFQs with prices and ETAs
- View revenue analytics and earnings
- Manage long-term supply contracts (framework contracts)

**How they register:** Submit a provider application form. **Requires manual approval by B3Hub admin.** Cannot self-register.

---

### Carriers (Transport Providers)

Companies and individuals who move materials and waste.

**Who they are:**

- Trucking companies with dump trucks, hook lifts, flatbeds, semi-trailers
- Independent owner-operators
- Individual employed drivers belonging to a carrier company

**Note on roles within carriers:**

- **Dispatcher** (OWNER / MANAGER role) — manages the fleet, assigns jobs to drivers, monitors via GPS map
- **Driver** (DRIVER role) — executes jobs in the field via mobile app

**What dispatchers do:**

- View the job board and assign available transport jobs to drivers
- Monitor the full fleet on a live GPS map
- Manage driver schedules and vehicle registration
- Configure carrier settings (pricing, service zones, availability)
- Review SLA exceptions and incidents
- View carrier earnings and payout analytics

**What drivers do:**

- Browse the job board and self-accept jobs (owner-operators)
- Navigate to pickup and delivery locations
- Confirm loading complete at the seller's loading point
- Submit delivery proof (photo + signature)
- Report transport exceptions and incidents
- Track earnings

**How they register:** Submit a provider application form. **Requires manual approval by B3Hub admin.** Cannot self-register.

---

### Admins (B3Hub Platform Team)

Internal staff who operate the platform.

**What they do:**

- Review and approve or reject provider applications
- Create and manage user accounts (manually set capability flags)
- Suspend or deactivate accounts
- Monitor all orders, transport jobs, and disputes across the platform
- Configure platform-wide settings

**How they get access:** Created directly in the database by the technical team. Never exposed in any registration form.

---

## Account Model

Every user has **one account** with capability flags that determine their role:

```
User {
  userType:      BUYER | ADMIN         // BUYER = everyone; ADMIN = platform staff only
  isCompany:     boolean               // company (VAT invoices) vs personal (receipts)
  canSell:       boolean               // approved to list and sell materials
  canTransport:  boolean               // approved to take and execute transport jobs
  canSkipHire:   boolean               // approved to manage skip hire fleet
  companyId:     string?               // linked company account
  companyRole:   OWNER|MANAGER|DRIVER|MEMBER?
}
```

### Account type matrix

| Who                                 | `userType` | `canSell` | `canTransport` |
| ----------------------------------- | ---------- | --------- | -------------- |
| Private person ordering a skip      | BUYER      | false     | false          |
| Construction company (buyer)        | BUYER      | false     | false          |
| Material supplier                   | BUYER      | **true**  | false          |
| Transport company (dispatcher)      | BUYER      | false     | **true**       |
| Driver (employed)                   | BUYER      | false     | **true**       |
| Owner-operator (sells + transports) | BUYER      | **true**  | **true**       |
| B3Hub platform staff                | ADMIN      | —         | —              |

### Company roles

Members of a company carry a `CompanyRole` and five `perm*` flags for fine-grained access control:

| Role      | Who                                                   |
| --------- | ----------------------------------------------------- |
| `OWNER`   | Company account owner — full access                   |
| `MANAGER` | Senior team member — broad access, no billing         |
| `DRIVER`  | Field driver — sees job board and active jobs only    |
| `MEMBER`  | General team member — limited to assigned permissions |

Permission flags (independently toggleable):

| Flag                  | Grants access to                           |
| --------------------- | ------------------------------------------ |
| `permCreateContracts` | Create and manage framework contracts      |
| `permReleaseCallOffs` | Release orders against framework contracts |
| `permManageOrders`    | Confirm/reject orders, assign to projects  |
| `permViewFinancials`  | See earnings, invoices, cost analytics     |
| `permManageTeam`      | Invite, edit, remove team members          |

---

## Registration Flows

### B2C buyer — guest checkout (landing page)

```
Landing page wizard (skip hire or materials)
  → Phone or email at step 1
  → Complete order details (service-specific fields)
  → Review + pay (Paysera — card or bank transfer)
  → Order confirmed
  → Post-checkout prompt: "Create account to track order & reorder faster"
      → If accepted: account created, order linked
      → If skipped: order tracked via confirmation link in email/SMS
```

### B2B buyer — self-serve (web or mobile)

```
Mobile app or web
  → Name + phone/email + password
  → Personal or Company account
  → Account created, status = ACTIVE immediately
  → Redirected to buyer dashboard
```

### Provider — manual approval

```
Web app → /apply
  → Company details (name, reg number, tax ID)
  → Services: ☐ Sell materials  ☐ Transport
  → Description, fleet size (transport), material types (seller)
  → ProviderApplication created → status: PENDING
  → B3Hub admin notified
  → Admin reviews → approves or rejects with note
  → On approval:
      • Existing account → canSell / canTransport flags toggled
      • New user → account created, email with credentials sent
```

### Admin — manual creation

```
Admin panel → Create User
  → Set any flags directly
  → Send invitation email
```

---

## Mode Switcher

Users with only one capability see no switcher — just their role's UI.

Users with multiple capabilities (e.g. a company that both buys and transports) see a **mode switcher**:

- **Web:** pill switcher in the topbar
- **Mobile:** pill switcher at the top of the app

```
[ 🛒 Buyer ]  [ 🚛 Carrier ]   ← only shown when user has both roles
```

Switching mode changes the entire navigation and all visible features.

---

## Features by Role

### Guest (B2C, unauthenticated)

| Feature                               | Landing | Notes                                                   |
| ------------------------------------- | ------- | ------------------------------------------------------- |
| Price estimator widget                | ✅      | No order created; CTA to sign up                        |
| Skip hire guest wizard                | ✅      | Built — `apps/web/src/app/(marketing)/order/skip-hire/` |
| Materials quick-order guest wizard    | ✅      | Built — `apps/web/src/app/(marketing)/order/materials/` |
| Transport guest wizard                | ✅      | Built — `apps/web/src/app/(marketing)/order/transport/` |
| Disposal guest wizard                 | ✅      | Built — `apps/web/src/app/(marketing)/order/disposal/`  |
| Guest checkout (Paysera)              | ✅      | Card / bank transfer, no account required               |
| Order confirmation via email/SMS      | ✅      | Confirmation email sent on order creation               |
| Post-checkout account creation prompt | ❌      | Planned — link existing guest order to new account      |
| Waste transfer note auto-generation   | ✅      | Same doc generation as authenticated orders             |

### Buyer features

| Feature                           | Web       | Mobile  | Notes                                  |
| --------------------------------- | --------- | ------- | -------------------------------------- |
| Browse material catalog           | ✅        | ✅      |                                        |
| Place material delivery order     | ✅        | ✅      | Multi-step wizard                      |
| Place skip hire / container order | ✅        | ✅      | 4-step wizard with map point           |
| Place waste disposal booking      | ✅        | ✅      |                                        |
| Place freight transport order     | ✅        | ✅      |                                        |
| Track active delivery (live map)  | read-only | ✅ live |                                        |
| Order history & detail            | ✅        | ✅      | Full status timeline                   |
| Projects (group orders by site)   | ✅        | ✅      | Spend per project, P&L snapshot        |
| Framework contracts (call-offs)   | ✅        | ✅      | Pre-negotiated supply at agreed prices |
| RFQ / Quote requests              | ✅        | ✅      | Request prices from multiple suppliers |
| Invoices                          | ✅        | ✅      | Auto-generated from completed orders   |
| Documents & delivery notes        | ✅        | ✅      |                                        |
| Waste certificates                | ✅        | ✅      | Compliance certificates per disposal   |
| Reviews (rate suppliers/carriers) | ✅        | ✅      | Post-delivery rating                   |
| Chat (per-job thread)             | ✅        | ✅      | WebSocket                              |
| Company & team management         | ✅        | ✅      | Roles + perm flags                     |
| Push notifications                | ✅        | ✅ push |                                        |
| Profile & settings                | ✅        | ✅      |                                        |
| Payment (Paysera)                 | ✅        | ✅      | Redirect checkout + webhook            |

### Seller features (`canSell: true`)

| Feature                               | Web        | Mobile         | Notes |
| ------------------------------------- | ---------- | -------------- | ----- |
| Manage product catalog                | ✅ primary | ✅ lightweight |       |
| View incoming orders                  | ✅         | ✅             |       |
| Confirm / reject orders               | ✅         | ✅             |       |
| Loading confirmation (driver at yard) | ✅         | ✅             |       |
| Respond to RFQs with quotes           | ✅         | ✅             |       |
| Earnings & revenue analytics          | ✅         | ✅             |       |
| Documents & delivery notes            | ✅         | ❌             |       |
| Reviews received                      | ✅         | ❌             |       |
| Chat                                  | ✅         | ❌             |       |
| Push notifications                    | ✅         | ✅ push        |       |
| Profile & settings                    | ✅         | ✅             |       |

### Dispatcher features (`canTransport: true`, role: OWNER / MANAGER)

| Feature                                | Web | Mobile | Notes                 |
| -------------------------------------- | --- | ------ | --------------------- |
| Job board — view available jobs        | ✅  | ❌     | Web-only for dispatch |
| Assign job to driver + vehicle         | ✅  | ❌     |                       |
| Fleet GPS live map (all active trucks) | ✅  | ❌     |                       |
| Vehicle / garage management            | ✅  | ❌     |                       |
| Driver schedule management             | ✅  | ❌     |                       |
| Carrier settings (pricing, zones)      | ✅  | ❌     |                       |
| SLA exceptions & incident monitoring   | ✅  | ❌     |                       |
| Transport job history                  | ✅  | ❌     |                       |
| Earnings & payout analytics            | ✅  | ❌     |                       |
| Push notifications                     | ✅  | ❌     |                       |

### Driver features (`canTransport: true`, role: DRIVER or owner-operator)

| Feature                                | Web          | Mobile     | Notes                |
| -------------------------------------- | ------------ | ---------- | -------------------- |
| Job board — self-accept available jobs | ✅           | ✅ primary | Owner-operators only |
| Navigate to pickup                     | ❌           | ✅         | Mobile-only          |
| Advance job status step-by-step        | ❌           | ✅         | Mobile-only          |
| Confirm loading at seller yard         | ❌           | ✅         | Mobile-only          |
| Navigate to delivery address           | ❌           | ✅         | Mobile-only          |
| Confirm delivery (photo + signature)   | ❌           | ✅         | Mobile-only          |
| Report exception / incident            | ❌           | ✅         | Mobile-only          |
| Skip hire pickups & drops              | ❌           | ✅         | Mobile-only          |
| Job history                            | ✅ read-only | ✅         |                      |
| Earnings                               | ✅           | ✅         |                      |
| Vehicle management                     | ✅           | ✅         |                      |
| Schedule                               | ✅           | ✅         |                      |
| Profile                                | ✅           | ✅         |                      |

> **Architectural rule:** all active-job field controls (status progression, delivery proof, navigation, exception reporting) are **mobile-only**. The web never surfaces these. The driver's phone is the authoritative field device.

### Admin features (`userType: ADMIN`)

| Feature                                | Web | Notes |
| -------------------------------------- | --- | ----- |
| Platform overview statistics           | ✅  |       |
| Review & approve provider applications | ✅  |       |
| User management (create, edit, flags)  | ✅  |       |
| All orders across all companies        | ✅  |       |
| All transport jobs                     | ✅  |       |
| Platform settings                      | ✅  |       |

---

## Platform Split — Web vs Mobile

> **Core principle: Mobile owns real-time field operations. Web owns management, analytics, and administration.**

- **Mobile** — optimised for on-the-go, single-task, real-time: buyers ordering from a site, drivers navigating and confirming deliveries
- **Web** — optimised for management and oversight: dispatchers managing a fleet, sellers managing their catalog, companies reviewing financials

Neither platform replicates the other's primary domain.

---

## Order Flow (End to End)

```
1. BUYER places order
   └─ Material order OR Skip hire order created
   └─ Status: PENDING

2. SELLER sees incoming order notification
   └─ Confirms order
   └─ Status: CONFIRMED

3. System creates TransportJob (status: AVAILABLE)
   └─ Job appears on driver job board

4. DRIVER self-accepts (mobile) OR dispatcher assigns (web)
   └─ TransportJob: ASSIGNED → ACCEPTED

5. DRIVER navigates to seller's loading point            [mobile only]
   └─ Status: EN_ROUTE_PICKUP → AT_PICKUP

6. DRIVER confirms loading complete                      [mobile only]
   └─ Status: LOADED

7. DRIVER navigates to delivery address                  [mobile only]
   └─ Status: EN_ROUTE_DELIVERY → AT_DELIVERY

8. DRIVER confirms delivery: photo + signature           [mobile only]
   └─ Status: DELIVERED

9. System auto-generates documents
   └─ Delivery note, weighing slip, invoice
   └─ All parties download from their Documents section

10. Payment captured via Paysera webhook
    └─ Platform fee retained, seller + carrier paid out (manual/batch payout, or Stripe Connect for solo individual drivers)
    └─ Order status: COMPLETED
```

---

## Web App Navigation

### Buyer sidebar

```
Dashboard
Browse Materials
My Orders
Skip Hire
Projects
Framework Contracts
Quote Requests
Invoices & Documents
Certificates
Reviews
Chat
Notifications
Settings
```

### Seller sidebar (`canSell: true`)

```
Dashboard
My Products (catalog)
Incoming Orders
Quotes
Earnings
Reviews
Documents
Chat
Settings
```

### Carrier / Dispatcher sidebar (`canTransport: true`)

```
Dashboard
Job Board (with dispatch controls)
Active Tracking (fleet GPS map)
Transport History
Schedule
Garage (vehicles)
Fleet Management
Carrier Settings
Earnings
Settings
```

### Admin sidebar (`userType: ADMIN`)

```
Overview
Applications
Users
Settings
```

---

## Mobile App Screen Structure

### Buyer tabs

```
[ 🏠 Home ] [ 📦 Order ] [ 📋 My Orders ] [ 👤 Profile ]
```

**Home** — stats, quick-action tiles  
**Order** — order type selector (delivery / skip hire / waste disposal / freight)  
**My Orders** — active and past orders, live delivery tracking per job  
**Profile** — account, company, team, documents, notifications, settings

### Driver tabs

```
[ 📋 Jobs ] [ 🗺️ Active ] [ 💰 Earnings ] [ 👤 Profile ]
```

**Jobs** — job board: available transport jobs, filter by vehicle / distance, self-accept  
**Active** — current job: full status progression, navigation, loading/delivery confirmation, exceptions  
**Earnings** — completed jobs, daily/weekly totals, payout status  
**Profile** — driver profile, vehicle, schedule, documents

### Seller tabs

```
[ 🏠 Home ] [ 📦 Catalog ] [ 📋 Incoming ] [ 👤 Profile ]
```

**Home** — sales overview  
**Catalog** — product listings  
**Incoming** — orders to confirm/reject  
**Profile** — earnings, quotes, settings

---

## Roadmap Priorities

Features that are uniquely possible because B3Hub owns the transaction layer — highest strategic value:

| Priority | Feature                                      | Why                                                                  |
| -------- | -------------------------------------------- | -------------------------------------------------------------------- |
| **1**    | Budget per project (`budgetAmount` field)    | Buyers see actual vs planned spend per site                          |
| **2**    | Framework contract → auto-transport dispatch | Order released → transport job created and dispatched automatically  |
| **3**    | CO₂ reporting per order / project            | Calculated from distance × vehicle × load; EU tender requirement     |
| **4**    | Supplier performance scorecard               | On-time %, exception rate, avg rating — purely from platform data    |
| **5**    | Cost per tonne analytics                     | "You paid €12.40/t avg for gravel this year" — cross-buyer benchmark |
| **6**    | Recurring / standing orders                  | "200t gravel every Monday for 8 weeks to project X"                  |
| **7**    | Delivery material acceptance                 | Buyer site contact confirms material quality at point of delivery    |

### B2C Roadmap

| Priority  | Feature                                           | Why                                                                    |
| --------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| **B2C-1** | Landing price estimator widget                    | Conversion funnel; no backend needed; pure marketing                   |
| **B2C-2** | Skip hire guest wizard on landing                 | Highest-value B2C product; commodity transaction; 5 fields max         |
| **B2C-3** | Guest checkout via Paysera (card + bank transfer) | Revenue from B2C without forcing account creation                      |
| **B2C-4** | Order confirmation email/SMS with tracking link   | Operational necessity; carrier needs to confirm delivery slot          |
| **B2C-5** | Post-checkout account creation prompt             | Convert one-off buyers to repeat users; link existing order to account |
| **B2C-6** | Materials quick-order guest wizard on landing     | Second B2C product; slightly more complex (qty, specs) than skip hire  |
| **B2C-7** | Carrier order-type filter (B2C opt-in/out)        | Let carriers choose which order types they accept                      |
| **B2C-8** | Shareable draft order link                        | PM creates draft, shares with site foreman to fill in delivery details |

---

## Tech Stack

| Layer            | Technology                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Backend API      | NestJS (Node.js)                                                                              |
| Database         | PostgreSQL on Supabase, Prisma ORM                                                            |
| Authentication   | Supabase Auth (JWT)                                                                           |
| File storage     | Supabase Storage                                                                              |
| Mobile app       | React Native + Expo Router                                                                    |
| Web app          | Next.js 14 (App Router)                                                                       |
| Styling — web    | Tailwind CSS + shadcn/ui                                                                      |
| Styling — mobile | NativeWind (Tailwind for RN)                                                                  |
| Real-time        | WebSockets (NestJS Gateway)                                                                   |
| Payments         | Paysera (redirect checkout + webhook); Stripe Connect for solo individual driver payouts only |
| Email            | Resend                                                                                        |
| Monorepo         | npm workspaces                                                                                |

### API

- All routes prefixed: `/api/v1`
- Dev backend: `http://localhost:3000/api/v1`
- Mobile env: `EXPO_PUBLIC_API_URL`
- Web env: `NEXT_PUBLIC_API_URL`

### Monorepo structure

| Path               | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `apps/backend/`    | NestJS REST API, WebSockets, all business logic |
| `apps/web/`        | Next.js seller/admin web portal                 |
| `apps/mobile/`     | Expo buyer + driver mobile app                  |
| `packages/shared/` | Shared TypeScript types                         |

---

## Feature Status

See [STATUS.md](STATUS.md) for the full feature matrix — what is built end-to-end, what is partial, and what is planned.

---

## Key Files

| File                                                  | Purpose                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `PRODUCT.md`                                          | **This file** — single source of truth for product vision and features |
| `STATUS.md`                                           | Feature implementation status matrix                                   |
| `apps/backend/prisma/schema.prisma`                   | Database schema — source of truth for all models                       |
| `apps/backend/src/app.module.ts`                      | Root NestJS module — all features registered here                      |
| `apps/mobile/lib/api.ts`                              | All mobile API calls                                                   |
| `apps/mobile/lib/auth-context.tsx`                    | Mobile auth state                                                      |
| `.github/copilot-instructions.md`                     | Developer onboarding and coding conventions                            |
| `.github/instructions/backend-schema.instructions.md` | Auto-generated DB model reference                                      |
