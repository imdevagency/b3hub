# Bilt — Product Documentation

> **This is the single source of truth** for what Bilt is, who it serves, and what it does.
> Keep it updated as the product evolves. All other documentation follows from this file.

---

## Vision

> **Build the end-to-end digital infrastructure for bulk construction materials and logistics in the Baltics — so that every tonne of material moved, every load disposed of, and every delivery executed is trackable, documented, and settled through one platform.**

---

## Mission

> Make it as simple to order, move, and dispose of bulk construction materials in Latvia and the Baltics as it is to book a taxi — whether you’re a homeowner getting gravel delivered or a construction company running 50 simultaneous deliveries across the country.

---

## North Star

The single metric that defines success:

> **Total value of transactions processed through Bilt** (materials orders + transport jobs + disposal jobs).

Every feature and every integration should either increase the number of transactions or increase the value of each one. If it doesn’t move this number, it’s not a priority.

---

## The Four Sides — Schüttflix Model

Bilt is a **4-sided construction logistics marketplace**. North star: connect these four sides on one transaction layer, nothing else.

| Side                  | Who                                                      | What they need from Bilt                                                               |
| --------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Contractors**       | Construction companies, contractors, homeowners          | Buy bulk materials, order transport jobs, book waste disposal — tracked and documented |
| **Materials Sellers** | Quarries, gravel/sand/concrete producers and wholesalers | List materials, set prices autonomously, fulfill confirmed orders from verified buyers |
| **Carriers**          | Trucking companies, independent tipper/flatbed drivers   | Accept and execute transport jobs — bulk materials delivery and waste haulage          |
| **Disposers**         | Landfills, dump sites, licensed waste processing plants  | Receive booked waste disposal jobs, issue legally compliant acceptance certificates    |

---

## B3 Group — Who We Are

**B3 Group** is the parent company behind Bilt. Bilt is the group's digital construction logistics marketplace — a single platform connecting four market sides on one transaction layer.

---

## What Bilt Is

Bilt is a **bulk construction materials and logistics marketplace** for the Latvian and Baltic market.

It connects **four market sides**:

- **Contractors** — construction companies, homeowners, and project managers who need bulk materials delivered or mineral waste removed
- **Materials Sellers** — quarries and bulk material producers/wholesalers (gravel, sand, concrete, soil) with full price autonomy
- **Carriers** — trucking companies and independent tipper/flatbed drivers who execute bulk delivery and waste haulage jobs
- **Disposers** — licensed landfills, dump sites, and waste processing plants that accept, weigh, and certify construction waste

The platform handles the **complete transaction lifecycle**: contractor places order → seller confirms loading → driver delivers → documents generated automatically → payment settled.

Every euro spent on materials and transport through Bilt is trackable, documented, and tied to a real delivery. That's the core product promise.

Bilt serves **two customer segments**:

- **B2B** — construction companies and contractors running complex multi-site procurement. Framework contracts, project cost tracking, invoicing, team management.
- **B2C** — homeowners and small trades: order gravel, book waste collection. Guest checkout with phone/email capture.

---

## B3 Fields — Physical Fulfillment Network

In addition to the digital marketplace, B3 Group operates **B3 Fields** — physical sites where customers can pick up materials or drop off construction waste.

### What B3 Fields do

- **Materials pickup** — customers buy materials on the platform and collect on-site (no delivery truck needed). Ideal for homeowners and small contractors with their own vehicle.
- **Waste drop-off** — clients drive in and leave construction waste. Waste is received, logged, and a receipt is issued.
- **Trailer rental** — rent a trailer tied to a material pickup order for self-haul.

### How B3 Fields fit the platform

Every transaction at a B3 Field flows through the Bilt platform. Payment, documents, and receipts are handled the same way as any other order.

B3 Fields are modelled as **fulfillment locations** in the system:

- Material orders: `fulfillmentType: PICKUP` at a B3 Field address
- Waste disposal: B3 Field registered as a `RecyclingCenter` with `licensed` flag, physical address, and opening hours
- Trailer rental: attached to a Bilt order (not available as a standalone rental)

---

## What Bilt Is NOT

These are out of scope by design. Adding them would dilute focus and pull Bilt away from its position as a focused bulk-materials transaction marketplace.

| Out of scope                                                    | Why                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skip hire / container hire**                                  | Removed from scope — not core to bulk materials market                                                                                            |
| **Toilet cabin hire**                                           | Removed from scope — not core to bulk materials market                                                                                            |
| **Metal scrap buyback**                                         | Removed from scope — not core to bulk materials market                                                                                            |
| **Equipment / plant hire**                                      | Not a Bilt transaction                                                                                                                            |
| **Project management** (Gantt, milestones, dependencies)        | That’s Procore / PlanRadar territory                                                                                                              |
| **On-site quality management** (punch lists, NCRs, inspections) | That’s Qualisflow / BIM tools — happens after delivery                                                                                            |
| **Labor / timesheet tracking**                                  | That’s payroll / HR software                                                                                                                      |
| **External cost tracking**                                      | We track only what moves through our platform                                                                                                     |
| **General ERP**                                                 | We are the procurement + logistics layer, not the full operating system                                                                           |
| **P2P messaging between market sides**                          | Bilt is the sole contractual and contact partner — no buyer↔driver, buyer↔seller, or carrier↔seller direct chat. All contact routes through Bilt. |
| **Quote requests / RFQ module**                                 | Removed from scope — framework contracts replace the negotiation workflow                                                                         |

**The rule:** if a feature requires data that doesn't originate from a Bilt transaction, it's out of scope.

---

## Communication Architecture — Bilt as the Single Contact Partner

This is a **core architectural principle** copied directly from the Schüttflix model:

> **"No unnecessary discussions on the construction site and no hassle with customer accounts. We are your contractual and contact partner."** — Schüttflix partner benefits

### What this means for Bilt

- **Bilt holds all contracts.** The buyer's contract is with Bilt. The carrier's contract is with Bilt. The supplier's contract is with Bilt. There is no direct contractual relationship between a buyer and a driver.
- **No P2P chat in the product.** Buyers do not message drivers directly. Drivers do not negotiate with sellers. No buyer↔seller communication channel exists in the app.
- **One contact for everyone.** Questions, problems, and disputes go to Bilt's service team — in-app support chat + phone line. B2B clients at scale get a regional account manager.
- **The platform mediates everything.** Special delivery instructions go on the order as notes. Weight discrepancies are a system record both sides see. Documents are auto-generated. No back-channel is needed for anything that matters.

### Technical rules that follow from this

- The `chat/` backend module and `support-chat` screen are **Bilt↔user support channels only** — not peer-to-peer.
- There must be **no chat thread** between a buyer and a driver, a buyer and a seller, or a carrier and a supplier.
- The `(shared)/chat/[jobId]` screen must route to a **Bilt support thread** for that job, not open a line between the two parties.
- The `messages` tab in buyer, seller, driver, and recycler layouts shows **Bilt communications** (order updates, system messages, support replies) — not inbox conversations with other users.

This is not a limitation — it is a **trust feature**. Buyers and carriers do not worry about off-platform negotiations or disputes going unrecorded. Everything is documented in the platform.

---

## B2C vs B2B — Platform Strategy

Both segments run on the same marketplace, the same supply network, and the same backend. The split is in the **buyer experience** and **checkout rules** only.

### Segment comparison

| Dimension             | B2C (homeowners, micro-contractors)                   | B2B (construction companies, contractors)                  |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Order complexity      | Low — 1 address, simple qty, no project               | High — site contacts, tonnage, timed windows, multi-drop   |
| Typical order value   | €50–500                                               | €500–50 000+                                               |
| Account required?     | No — guest checkout (phone/email at step 1)           | Yes — verified company account                             |
| Pricing               | Fixed displayed price                                 | Framework contracts, negotiated rates                      |
| Invoicing             | Email receipt + basic invoice                         | VAT invoice with company details, project codes            |
| Repeat orders         | Low                                                   | High — framework contracts, call-offs, recurring schedules |
| Document requirements | Waste transfer note auto-generated (legally required) | Full document suite: delivery notes, weighing slips, certs |
| Support path          | Self-serve, in-app support chat                       | Dedicated account management at scale                      |

### Entry points

**Landing page** (`apps/landing`) is the B2C entry point:

- Materials quick order — material type, quantity, delivery postcode → guest checkout
- Price estimator widget — no order created; shows indicative price + "Sign up to book" CTA

**Web app** (`apps/web`) and **mobile app** (`apps/mobile`) are the authenticated B2B entry points.

### Design rules that follow from this

1. **Fixed price must exist before B2C checkout** — suppliers listing materials must set a public retail price.
2. **Phone or email captured at wizard step 1** — not at the end. Carrier needs to confirm delivery slot; without contact detail the order cannot be executed.
3. **Waste transfer note triggers on every disposal order** — even guest orders. Legal requirement regardless of company status.
4. **Carriers can opt out of guest orders** — B2C orders are flagged so carriers can filter by order type if they prefer verified accounts.
5. **Post-checkout account prompt** — after guest order confirmation, show "Save your details for faster ordering next time" → account creation with order auto-linked.
6. **B2B features invisible to guests** — framework contracts, projects, team management, analytics never shown in guest flow.

---

## Why We Win

The features that make Bilt defensible are ones that **only work because we own the transaction**. A standalone ERP cannot do these things:

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

| #   | Stream                            | Mechanism                                                                                                      | Margin profile     |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | **Material order commission**     | % of subtotal + delivery fee, retained before seller payout                                                    | 8–15%              |
| 2   | **Transport job margin**          | `rate` charged to buyer minus `driverPayout` to carrier — Bilt acts as logistics broker, not just intermediary | 15–30%             |
| 3   | **Waste disposal commission**     | % on disposal fee when waste is routed to a recycling center through the platform                              | 8–12%              |
| 4   | **Gate fee (Gulbene)**            | Per-tonne fee charged when waste is accepted at B3 Recycling Gulbene                                           | €X/t               |
| 5   | **RC material sales**             | B3 Recycling sells certified secondary raw material on the platform at market price                            | Margin/t           |
| 6   | **Double-dip on combined orders** | `OrderType.COMBINED` = materials + transport in one order. Commission on both sides simultaneously.            | 2× per transaction |

---

#### TIER 1B — Logistics margin levers (squeeze more out of every truck run)

These all sit inside the transport layer. The spread between what Bilt charges the buyer and what Bilt pays the carrier is the logistics margin. Every lever below widens that spread without changing the carrier's rate.

| #   | Stream                              | Mechanism                                                                                                                                                                                                   | Notes                                                                                            |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 7   | **Backhaul / return load matching** | Driver delivers gravel north → Bilt matches a return load (waste collection, equipment) going south. Buyer 2 pays a full transport rate. Driver gets a small top-up. Bilt keeps the delta.                  | Empty truck on way back = pure waste. This is the single highest-margin opportunity in trucking. |
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

---

#### TIER 3 — Float & financial services (earn on money in motion)

| #   | Stream                         | Mechanism                                                                                                                                                                                  |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13  | **Payment float / interest**   | Paysera holds funds between buyer payment and platform-initiated seller payout. At volume, even 2–5 days of float on €1M/month GMV earns ~€3–5k/year. Modest but free.                     |
| 14  | **Trade credit for buyers**    | Verified construction companies buy now, pay in 30/60 days. Funded via a lending partner (Bilt earns referral + spread). Construction companies live on credit — this is extremely sticky. |
| 15  | **Early payout for suppliers** | Suppliers get paid instantly (for a 1–2% discount) instead of waiting for buyer payment cycle. Platform or factoring partner absorbs the receivable.                                       |
| 16  | **Cargo insurance**            | Bundle per-shipment transit insurance into transport orders. Zero effort for the user — opt-out rather than opt-in. Revenue split with insurer.                                            |
| 17  | **Driver/carrier credit**      | Carriers need vehicles and equipment. Bilt data (earnings history, job completion rate) makes creditworthiness transparent. Refer to lenders for a fee, or originate directly later.       |

---

#### TIER 4 — SaaS & data layer (earn on information and tools)

| #   | Stream                               | Mechanism                                                                                                                                                                                                           |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | **Analytics & reporting add-on**     | Free tier: basic order history. Paid tier: full P&L per project, budget alerts, supplier benchmarking, CSV/Excel export, custom date ranges. Monthly subscription per seat.                                         |
| 19  | **Market price intelligence**        | Bilt sees every material price transacted across the Baltic market. Aggregate and anonymize → sell as a "Construction Material Price Index" report to suppliers, buyers, and banks financing construction projects. |
| 20  | **API access / ERP integration**     | Large buyers want to push orders from SAP, Procountor, or their own ERP directly into Bilt without touching the web app. Charge a monthly API access fee + per-call volume pricing beyond a free tier.              |
| 21  | **White-label platform**             | Sell the entire Bilt stack (rebranded) to a logistics operator in Poland, Finland, or Germany who wants to run their own marketplace. SaaS licensing fee + revenue share.                                           |
| 22  | **Demand forecasting for suppliers** | Quarries need to plan quarry output 6–12 months ahead. Bilt order data = the best demand signal in the market. Sell forecast reports to suppliers.                                                                  |

---

#### TIER 5 — Compliance & documents (earn on regulation)

| #   | Stream                                   | Mechanism                                                                                                                                                                                         |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | **Waste certificate issuance**           | Every tonne of construction waste legally requires a waste transfer certificate (EU Waste Framework Directive). Platform auto-generates these. Charge per certificate above a free monthly quota. |
| 24  | **Document archiving**                   | Buyers and suppliers must store delivery/waste documents for 5 years (regulatory requirement). Charge a small annual archiving fee per company for long-term secure storage.                      |
| 25  | **ESG / carbon reporting**               | Construction companies under ESG reporting obligations need scope 3 data on waste disposal and material sourcing. Bilt data = automatic scope 3 emissions report. Sell as compliance add-on.      |
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
- Project managers — cost tracking, team access control

**B2C buyers (guest checkout available):**

- Private homeowners — gravel for a garden path, soil for landscaping, waste disposal booking
- Small trades (plumbers, electricians, tilers) — one-off material drops, occasional waste disposal
- Micro-contractors — no company account, low frequency, simple single-site jobs

**What they do on the platform:**

- Browse the material catalog and place delivery orders
- Book waste disposal (recycling centers)
- Track deliveries in real time
- Download invoices, delivery notes, and waste certificates
- Manage framework contracts for recurring supply

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
- View revenue analytics and earnings
- Manage long-term supply contracts (framework contracts)

**How they register:** Submit a provider application form. **Requires manual approval by Bilt admin.** Cannot self-register.

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

**How they register:** Submit a provider application form. **Requires manual approval by Bilt admin.** Cannot self-register.

---

### Admins (Bilt Platform Team)

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
  canSkipHire:   boolean               // legacy — skip hire removed from scope; field retained for schema compatibility
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
| Bilt platform staff                 | ADMIN      | —         | —              |

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
Landing page wizard (materials or disposal)
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
  → Bilt admin notified
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
| Place waste disposal booking      | ✅        | ✅      |                                        |
| Place freight transport order     | ✅        | ✅      |                                        |
| Track active delivery (live map)  | read-only | ✅ live |                                        |
| Order history & detail            | ✅        | ✅      | Full status timeline                   |
| Framework contracts (call-offs)   | ✅        | ✅      | Pre-negotiated supply at agreed prices |
| Invoices                          | ✅        | ✅      | Auto-generated from completed orders   |
| Documents & delivery notes        | ✅        | ✅      |                                        |
| Waste certificates                | ✅        | ✅      | Compliance certificates per disposal   |
| Reviews (rate suppliers/carriers) | ✅        | ✅      | Post-delivery rating                   |
| Support chat                      | ✅        | ✅      | Bilt↔user only, no P2P                 |
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
   └─ Material order OR Disposal booking OR Transport order created
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
Framework Contracts
Invoices & Documents
Certificates
Reviews
Support
Notifications
Settings
```

### Seller sidebar (`canSell: true`)

```
Dashboard
My Products (catalog)
Incoming Orders
Earnings
Reviews
Documents
Support
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
**Order** — order type selector (delivery / waste disposal / freight)  
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

Features that are uniquely possible because Bilt owns the transaction layer — highest strategic value:

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
| **B2C-2** | Materials quick-order guest wizard on landing     | Core B2C product; bulk delivery for homeowners and small trades        |
| **B2C-3** | Guest checkout via Paysera (card + bank transfer) | Revenue from B2C without forcing account creation                      |
| **B2C-4** | Order confirmation email/SMS with tracking link   | Operational necessity; carrier needs to confirm delivery slot          |
| **B2C-5** | Post-checkout account creation prompt             | Convert one-off buyers to repeat users; link existing order to account |
| **B2C-6** | Disposal guest wizard on landing                  | Waste booking for homeowners; generates waste transfer note legally    |
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
