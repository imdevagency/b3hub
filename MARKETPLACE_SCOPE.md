# Bilt — Marketplace Scope

> **The single question that determines whether something belongs in Bilt:**
>
> _Does this feature exist to connect the four market sides, or does it exist to run one party's internal operations?_
>
> If it's the latter, it's out of scope. Every company we connect already has — or will buy — their own management system. We are the transaction layer between them, not a replacement for what they already run.

---

## Why this document exists

SchüttFlix, Sennder, and every other construction logistics marketplace that has scaled did so by solving **one problem ruthlessly well**: connecting contractors, sellers, and carriers through a trusted transaction layer. None of them tried to become a project management system, HR platform, or full ERP. That’s the territory.

Bilt connects **four** sides: contractors (buyers), bulk materials sellers, carriers (drivers), and disposers (waste processors). That’s the defensible advantage. The moment Bilt becomes the internal management system for any one side, it loses focus and ends up competing with tools those parties already trust.

This document defines exactly what Bilt does and does not do for each market side. It is a decision tool. When a new feature is proposed, check it against this document first.

---

## The Four Sides

| Side           | Who                                                      | Primary need from Bilt                                                                    |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Contractor** | Construction companies, contractors, homeowners          | Buy bulk materials, book disposal jobs, order transport — tracked and documented          |
| **Seller**     | Quarries, gravel/sand/concrete producers and wholesalers | List materials, set prices autonomously, fulfil confirmed orders from verified buyers     |
| **Carrier**    | Trucking companies, independent tipper/flatbed drivers   | Accept and execute bulk delivery and waste haulage jobs — with earnings and documentation |
| **Disposer**   | Licensed landfills, dump sites, waste processing plants  | Receive booked waste disposal jobs and issue legally compliant acceptance certificates    |

All four sides share a single platform. A company can be a seller **and** a carrier (HYBRID). The roles are not mutually exclusive; the scope boundaries are.

---

## Side 1 — Contractor (Buyer)

### What Bilt provides

| Capability                                                                   | Notes                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Browse the materials catalog (public, no login required)                     | Prices visible without account                                  |
| Place orders: bulk materials delivery, transport-only, waste disposal        | Core transaction types                                          |
| Guest checkout for B2C one-off orders                                        | Phone + email capture at step 1                                 |
| Track every order from placement to invoice in real time                     | Push notification at each status change                         |
| Download invoices, delivery notes, weighing slips, waste certificates as PDF | Auto-generated from transaction data                            |
| Submit RFQs to multiple suppliers simultaneously                             | Convert winning quote directly to order                         |
| Framework contracts with preferred suppliers                                 | Call-off orders against agreed volumes and rates                |
| Assign orders to procurement projects; see project-level spend vs budget     | Spend is only what flows through Bilt                           |
| Manage a company team: invite members, set roles, toggle permissions         | Roles: OWNER, MANAGER, DRIVER, MEMBER                           |
| Pay via card or in-app payment sheet                                         | Paysera (primary); Stripe Connect for individual driver payouts |
| Save frequently used delivery addresses                                      | —                                                               |
| Write reviews for suppliers and carriers after delivery                      | —                                                               |
| Chat with driver on an active transport job                                  | Per-job thread only                                             |

### What Bilt does NOT provide

| Out of scope                                                                    | Who owns it instead                        |
| ------------------------------------------------------------------------------- | ------------------------------------------ |
| Internal project management (Gantt charts, milestones, task dependencies, RFIs) | Procore, PlanRadar, or buyer's own PM tool |
| On-site quality management (punch lists, defect logs, inspections)              | Qualisflow, BIM tools                      |
| Labour tracking, timesheets, crew clock in/out                                  | Payroll/HR software                        |
| Equipment and plant hire management                                             | Specialist rental platforms                |
| Cost tracking for items not purchased through Bilt                              | Buyer's accounting/ERP system              |
| Subcontractor contract management and invoicing                                 | Buyer's ERP                                |
| General company ERP                                                             | Not our layer                              |

**The rule for buyer features:** if the data originates from a Bilt transaction, it belongs here. If the data has to be entered manually and has no link to a Bilt order, it doesn't.

**The one exception — B3 Construction internal portal (`/dashboard/b3-construction`):** this is a B3 Group _internal_ operational tool for B3 Group's own groundworks business. It is explicitly **not** a marketplace feature and must never be offered as a feature to external buyer companies. DPRs, employee records, subcontractor registers, and labour cost tracking in that portal exist only because B3 Construction is an internal business unit, not because we're building project management software. The boundary is hard.

---

## Side 2 — Seller (Supplier)

### What Bilt provides

| Capability                                                                                            | Notes                               |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Create and manage material listings: category, unit, price, stock, min order, photos, loading address | —                                   |
| Receive order notifications and confirm or reject within SLA                                          | —                                   |
| Confirm driver arrival at loading point                                                               | Digital loading confirmation in-app |
| See which driver is on their loading point and their ETA                                              | —                                   |
| Respond to RFQs with a quoted price, quantity, and ETA                                                | —                                   |
| Manage framework contract volumes and call-offs                                                       | See remaining balances per contract |
| Earnings dashboard: transactions per period, payout history                                           | —                                   |
| Receive automatic payouts when orders complete                                                        | Via Stripe Connect                  |
| Upload quality certificates tied to specific materials or orders                                      | Triggered at AT_PICKUP if missing   |

### What Bilt does NOT provide

| Out of scope                                              | Who owns it instead            |
| --------------------------------------------------------- | ------------------------------ |
| Internal inventory / warehouse management system          | Supplier's ERP or WMS          |
| Production scheduling (when to crush, when to process)    | Supplier's internal operations |
| HR and staff management                                   | Supplier's HR system           |
| Procurement of inputs (fuel, machinery, raw aggregate)    | Not a Bilt transaction         |
| Customer CRM (relationship management beyond Bilt orders) | Supplier's CRM                 |
| Accounting and bookkeeping                                | Supplier's accounting system   |

**The rule for seller features:** Bilt is the window through which suppliers see demand and receive payment. Everything behind that window — stock production, staff management, accounts — stays in the supplier's own systems.

---

## Side 3 — Carrier

Carriers operate in two sub-roles on the same platform:

**Dispatcher** (company OWNER or MANAGER): sees the job board, assigns jobs to drivers, monitors fleet.

**Driver** (DRIVER role or independent owner-operator): accepts and executes individual jobs.

### What Bilt provides

| Capability                                                                                 | Notes                                          |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| View available transport jobs matching service zone and vehicle type                       | —                                              |
| Accept jobs (owner-operators) or receive assigned jobs (employed drivers)                  | —                                              |
| Navigate to pickup; confirm arrival; mark loaded; navigate to delivery; confirm delivery   | Full status lifecycle                          |
| Submit delivery proof: photo + digital signature                                           | Auto-generates CMR / delivery note             |
| Report transport exceptions (no-show, wrong material, partial delivery, site closed, etc.) | —                                              |
| Empty-run avoidance: see return-trip jobs near current location                            | Haversine radius query                         |
| Multi-stop route optimisation (Tour mode)                                                  | Google Directions API; ≥2 jobs                 |
| Driver schedule management                                                                 | Availability windows, online/offline toggle    |
| Earnings per job: gross, net after platform fee                                            | —                                              |
| Vehicle and fleet registration                                                             | Registered vehicles are visible to dispatchers |
| Dispatcher: assign jobs to drivers; monitor fleet on live GPS map                          | —                                              |
| Carrier pricing and service zone configuration                                             | —                                              |
| Chat with buyer on active jobs                                                             | —                                              |

### What Bilt does NOT provide

| Out of scope                                        | Who owns it instead                 |
| --------------------------------------------------- | ----------------------------------- |
| Fleet maintenance scheduling and service records    | TMS / fleet management software     |
| Fuel expense tracking                               | Carrier's expense/accounting system |
| Driver payroll and salary processing                | Payroll software                    |
| Driver HR records (contracts, sick leave, holidays) | HR system                           |
| Driver training and licensing compliance            | HR / fleet compliance tool          |
| Insurance management                                | Insurance provider's portal         |
| Load planning and manifesting beyond Bilt orders    | TMS                                 |
| Customer invoicing outside of Bilt transactions     | Carrier's accounting system         |

**The rule for carrier features:** Bilt is the job board plus the execution layer. A driver opens the app, sees the job, executes it, and gets paid. Everything about managing the carrier as a business — HR, fleet maintenance, insurance, payroll — stays in the carrier's own systems.

---

## Side 4 — Disposer

The fourth side is unique to Bilt’s market position. Construction waste disposal creates a mandatory documentation trail (Latvian and EU regulation), and Bilt closes the loop by connecting contractors who need disposal with licensed disposers who can accept and process mineral waste.

### What Bilt provides

| Capability                                                                                 | Notes                                    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| List recycling / waste drop-off sites with accepted waste types, operating hours, capacity | —                                        |
| Receive online booking requests from buyers                                                | Bilt disposal wizard → booked job        |
| View inbound job queue: waste type, estimated weight, source order                         | —                                        |
| Issue waste acceptance certificates per customer                                           | Legally required under Latvian waste law |
| Log actual received waste: type, weight, source                                            | Per-delivery record                      |
| APUS reporting module (VVD waste movement reports)                                         | Latvia-specific regulatory requirement   |
| Earnings dashboard and payouts                                                             | —                                        |

### What Bilt does NOT provide

| Out of scope                                                             | Who owns it instead            |
| ------------------------------------------------------------------------ | ------------------------------ |
| Disposal/processing operations management (sorting, processing, resale)  | Disposer's internal operations |
| Equipment and machinery maintenance                                      | Disposer's internal ops        |
| Regulatory licence management (beyond what the platform needs to verify) | Disposer's compliance function |
| Staff scheduling at the facility                                         | Disposer's HR system           |
| Resale of processed materials through channels other than Bilt           | Disposer's own sales channels  |

**The rule for disposer features:** Bilt manages the booking, documentation, and payment for the inbound waste job. The physical disposal/processing is not our concern.

---

## The Platform — Bilt Marketplace (Admin)

Bilt platform staff use a separate admin scope (`/dashboard/admin`) to operate the marketplace itself. This is not a fifth market side — it's the platform operator function.

### What the admin scope covers

- Approve / reject provider applications (sellers, carriers, disposers)
- Verify companies and toggle `payoutEnabled`
- Resolve transport exceptions and disputes
- Monitor all active jobs, orders, and payments
- Configure the materials catalog (categories, active/inactive)
- SLA monitoring and alerts
- Platform analytics (GMV, order volumes, transaction mix)
- Integration management (Lursoft company registry, BIS construction registry, payment processor, SMS, email)
- Feature flag assignment per company (which SaaS features they can access)

---

## The Scope Test — Decision Checklist

When a feature request comes in, ask these questions in order:

1. **Which of the four sides does it serve?**
   If it doesn't clearly serve a contractor, seller, carrier, or disposer in the context of a Bilt transaction, stop.

2. **Does the feature require data that originates from a Bilt transaction?**
   If yes → likely in scope.
   If the data has to be manually entered with no connection to an order → likely out of scope.

3. **Is this feature solving a connection problem between the sides, or an internal management problem for one side?**
   Connection problem → in scope.
   Internal management problem → out of scope. The other party has, or will buy, a system for that.

4. **Does building this feature require us to store data about things that don't go through our platform?**
   Storing non-transaction data at scale → out of scope. We'd be competing with ERP vendors.

5. **If we didn't build this, would the user leave the platform, or would they just use another tool alongside it?**
   Leave → possibly core to the marketplace.
   Use another tool alongside → out of scope by definition.

---

## Audit Flags — Current Codebase

These items were identified during the scope audit as potentially drifting toward internal management tooling. They are flagged for review, not necessarily for removal.

| Item                                                                       | Location                                   | Assessment                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DPR (Daily Production Reports)** for B3 Construction                     | `/dashboard/b3-construction`               | ✅ Intentionally internal — B3 Group only. Must never become a feature offered to external buyers.                                                                                                           |
| **Employee management** in B3 Construction portal                          | `/dashboard/b3-construction/employees`     | ✅ Intentionally internal — B3 Group only.                                                                                                                                                                   |
| **Labour hours and subcontractor spend tracking**                          | `admin.service.ts` B3 Construction methods | ✅ Internal B3 Group analytics. Not a marketplace feature.                                                                                                                                                   |
| **`CONSTRUCTION_MANAGEMENT` feature flag** (buyer projects, DPRs, budgets) | `CompanyFeature` enum                      | ⚠️ Projects + P&L tied to Bilt orders = in scope. GPS timesheets and field crew DPRs = drifting out of scope. If this becomes a full construction management SaaS, it competes with Procore, not SchüttFlix. |
| **Driver GPS timesheets**                                                  | Phase 2 in CONCEPT.md                      | ⚠️ If the purpose is to feed payroll or labour records, it's HR software. If the purpose is to confirm a driver was at the right place at the right time on a Bilt job, it's in scope.                       |
| **Carrier fleet maintenance records**                                      | Not yet built                              | 🚫 Do not build. Carriers have their own TMS.                                                                                                                                                                |
| **Supplier inventory / WMS**                                               | Not yet built                              | 🚫 Do not build. Suppliers have their own stock management.                                                                                                                                                  |
| **Buyer HR / crew management**                                             | Not yet built                              | 🚫 Do not build.                                                                                                                                                                                             |

---

## What Stays Out — Absolute

These will never be built in Bilt, regardless of how they are framed:

- Payroll processing for any market side
- Equipment or plant hire management (non-transport)
- Internal procurement (buying fuel, aggregate inputs, machinery)
- General accounting and bookkeeping
- On-site quality and defect management
- Gantt-chart project scheduling
- Workforce training and certification management

If a customer asks for one of these, the answer is: _"We don't do that. Use [relevant tool]. We integrate with it if necessary."_

---

## Integration Posture

Because every company we connect already runs their own systems, integrations are first-class citizens — not afterthoughts. The integration model is:

- **We are the transaction of record.** Order placed, delivery confirmed, document generated, payment settled — all in Bilt.
- **We push to their systems, not replace them.** A supplier's ERP gets a webhook when an order is confirmed. A carrier's TMS can pull their job queue. A buyer's accounting system gets the invoice via export.
- **We pull from authoritative sources.** Company registry data from Lursoft. Construction project registry from BIS. We don't build our own company registry.

This is how we stay in scope and become more valuable over time rather than less.
