# B3Hub — Platform Requirements

> **What a fully automated construction logistics marketplace must do.**
> This document defines functional requirements from first principles — not what is built, but what must work for the platform to be a real, self-sustaining marketplace.
> For implementation status, see [STATUS.md](STATUS.md). For product vision and business model, see [PRODUCT.md](PRODUCT.md).

---

## Table of Contents

1. [User Types & Access Model](#1-user-types--access-model)
2. [Identity & Authentication](#2-identity--authentication)
3. [Materials Catalog](#3-materials-catalog)
4. [Order Lifecycle](#4-order-lifecycle)
5. [Transport & Logistics](#5-transport--logistics)
6. [Skip Hire & Container Rental](#6-skip-hire--container-rental)
7. [Waste Disposal](#7-waste-disposal)
8. [Quote Requests (RFQ)](#8-quote-requests-rfq)
9. [Framework Contracts](#9-framework-contracts)
10. [Projects](#10-projects)
11. [Payments & Payouts](#11-payments--payouts)
12. [Documents & Compliance](#12-documents--compliance)
13. [Reviews & Ratings](#13-reviews--ratings)
14. [Notifications](#14-notifications)
15. [Team & Company Management](#15-team--company-management)
16. [Fleet & Vehicle Management](#16-fleet--vehicle-management)
17. [Admin Operations](#17-admin-operations)
18. [Automation & Cron Jobs](#18-automation--cron-jobs)
19. [Analytics & Reporting](#19-analytics--reporting)
20. [Non-Functional Requirements](#20-non-functional-requirements)

---

## 1. User Types & Access Model

The platform has four functional roles. All non-staff users share `userType = BUYER` — access is controlled by capability flags, not by a role enum.

### 1.1 Buyer

A buyer is any person or company that purchases materials, hires containers, books waste disposal, or commissions transport.

**Must be able to:**

- Register without any approval — account active immediately
- Browse public material catalog without logging in; all pricing visible
- Place orders for materials with delivery (MATERIAL), transport-only (TRANSPORT), disposal (DISPOSAL), combined material + transport (COMBINED), or container hire (CONTAINER)
- Track all orders in real time from placement to invoice
- Receive push notification and email at each order status transition
- Download invoices, delivery notes, weighing slips, and waste certificates as PDF
- Submit RFQs to multiple suppliers simultaneously
- Accept a quote response and convert it directly to an order
- Create and manage procurement projects; assign orders to projects; see live project P&L
- Set up framework contracts with preferred suppliers for recurring supply
- Release call-off orders against active framework contracts
- Manage a team (invite members, set roles, toggle permissions)
- Pay via card (web) or in-app payment sheet (mobile) — Stripe
- Cancel orders with the cancellation guard: DRAFT and PENDING free; CONFIRMED and later requires seller consent or admin intervention
- Save frequently used delivery addresses
- Request a review window after delivery before funds are released
- Write a review for the supplier and carrier after order completion
- Chat with the driver on active transport jobs

**May not:**

- List materials for sale (requires `canSell` flag)
- Accept or execute transport jobs (requires `canTransport` flag)
- Access the admin panel

---

### 1.2 Seller (Supplier)

A seller is a company approved to list and sell construction materials.

**Must be able to:**

- Apply for seller access via a provider application form; account only activated after admin approval
- Create, edit, and deactivate material listings with: category, unit, base price, stock quantity, minimum order, description, photos, and their loading address with geo-coordinates
- Receive notifications when new orders come in for their materials
- Confirm or reject incoming orders within a seller-defined SLA window
- Confirm driver arrival at loading point (digital loading confirmation)
- See exactly which driver is on their loading point and the estimated arrival time
- Respond to RFQs with a quote that includes price, quantity, and ETA
- Manage long-term supply contracts (framework contracts) — see call-off volumes and remaining balances
- View earnings dashboard: transactions per period, payout history, pending payouts
- Receive payouts automatically via Stripe Connect when orders are completed
- Configure material stock; system automatically sets `inStock = false` when stock reaches 0

**May not:**

- View other sellers' orders or pricing
- Accept transport jobs unless also approved as a carrier

---

### 1.3 Carrier / Driver

A carrier is a company or individual approved to execute transport jobs.

Carriers have two sub-roles:

**Dispatcher** (`companyRole: OWNER | MANAGER`):

- View the full job board (all available transport jobs in their service zone)
- Assign transport jobs to drivers and vehicles
- Monitor the full fleet on a live GPS map
- View SLA exceptions raised by drivers
- Manage driver schedules and vehicle availability
- Configure carrier settings: pricing, service areas, availability windows
- View carrier earnings and payout breakdown by driver and vehicle

**Driver** (`companyRole: DRIVER`, or an independent owner-operator):

- Browse and self-accept available transport jobs (owner-operators; employed drivers see pre-assigned jobs)
- Navigate to pickup location; confirm arrival at loading point
- Confirm loaded and depart
- Navigate to delivery location; confirm arrival
- Submit delivery proof: photo of delivered material + buyer/site signature
- Report transport exceptions (driver no-show, supplier not ready, wrong material, partial delivery, site closed, overweight, etc.)
- Track personal earnings: gross, net after platform fee, per-job breakdown

**Both must be able to:**

- Chat with buyer on active jobs
- View job details: cargo type, weight, distance, pickup and delivery addresses, rate

**Must not:**

- Access other carriers' fleet data
- Modify order details (transport is execution-only)

---

### 1.4 Admin (B3Hub Platform Staff)

**Must be able to:**

- Review, approve, or reject provider applications with a written decision note
- Create and manage user accounts; set capability flags (`canSell`, `canTransport`, `canSkipHire`) directly
- Suspend or deactivate accounts with reason
- View all orders, transport jobs, skip hire orders, and disposal records across the entire platform
- Force-reassign a transport job to a different driver when a driver goes missing
- Monitor all active transport jobs on a live map
- Resolve transport exceptions
- View all payments: authorized, captured, released, failed, refunded
- Trigger manual refunds or payouts when automation fails
- Verify companies and toggle `payoutEnabled` per company
- Set per-company commission rates
- Access all documents and delivery proofs
- Configure and view platform-wide analytics
- Receive system alerts for all critical events that require human intervention

**Must not:**

- Appear in any buyer-facing or seller-facing data

---

## 2. Identity & Authentication

### 2.1 Registration

| Buyer                       | Provider (Seller / Carrier) | Admin                  |
| --------------------------- | --------------------------- | ---------------------- |
| Self-serve — web or mobile  | Application form — web only | Created in admin panel |
| Instant account activation  | Manual admin approval       | No public registration |
| Personal or company account | Company account required    | Internal only          |

- All registration paths must capture T&C acceptance with a timestamp (`termsAcceptedAt`)
- Company registration must capture: legal company name, registration number, VAT number, legal address
- Email must be unique across all accounts

### 2.2 Sessions

- Auth provider: **Supabase Auth** (email + password, phone OTP optional)
- Backend validates JWTs issued by Supabase
- Web session stored in an **HttpOnly server-side cookie** (not accessible via JavaScript)
- Mobile session stored in secure storage
- JWT payload must include all capability flags (`canSell`, `canTransport`, `canSkipHire`, `companyId`, `companyRole`, `perm*`) — no extra fetch needed on every request
- Refresh tokens must rotate on use

### 2.3 Password reset

- Email-based reset link via Supabase
- Reset links expire after 24 hours
- Old sessions must be invalidated after password change

### 2.4 Account status lifecycle

```
PENDING → ACTIVE → SUSPENDED → DEACTIVATED
```

- SUSPENDED: user can log in but cannot create orders
- DEACTIVATED: login blocked; data retained

---

## 3. Materials Catalog

### 3.1 Listing management (Seller)

Every material listing must include:

- Category (SAND, GRAVEL, STONE, CONCRETE, SOIL, RECYCLED_CONCRETE, RECYCLED_SOIL, ASPHALT, CLAY, OTHER)
- Unit (TONNE, M3, PIECE, LOAD)
- Price per unit (EUR, excl. VAT)
- Minimum order quantity
- Available stock quantity
- Supplier loading address with GPS coordinates
- Photos (at least one required for active listings)
- Description and quality specifications
- `inStock` flag — automatically set to `false` when `stockQuantity` reaches 0; can be manually overridden by seller

### 3.2 Catalog browsing (Buyer)

- Catalog browsable without login
- Filterable by: category, location (radius), unit, price range, in-stock only
- Sortable by: price, distance from buyer, newest
- Distance from buyer's location calculated using haversine from supplier GPS coordinates
- Each listing shows: supplier name, distance, price, unit, minimum order, stock status, average supplier rating
- Pagination: 20 items per page default; buyer-configurable up to 100

### 3.3 Inventory rules

- Selling more than available stock is blocked at the order confirmation step
- System reserves stock when an order moves to CONFIRMED; releases if order is CANCELLED
- When stock hits 0: `inStock = false` automatically set; seller notified
- Seller can re-list by updating stock quantity (resets `inStock = true`)

---

## 4. Order Lifecycle

### 4.1 Order types

| Type        | Description                                        |
| ----------- | -------------------------------------------------- |
| `MATERIAL`  | Material purchase with platform-arranged delivery  |
| `TRANSPORT` | Transport-only (buyer provides or owns material)   |
| `DISPOSAL`  | Waste taken to a recycling center                  |
| `COMBINED`  | Material + transport in one order (single payment) |
| `CONTAINER` | Skip bin or roll-off container hire                |

### 4.2 Status flow

```
DRAFT → PENDING → CONFIRMED → IN_PROGRESS → DELIVERED → COMPLETED
                                                        ↓
                                                    CANCELLED (any stage)
```

| Transition              | Who triggers it               | What happens                                                                 |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| DRAFT → PENDING         | Buyer submits order           | Payment authorized (Stripe pre-auth); seller notified; transport job created |
| PENDING → CONFIRMED     | Seller accepts                | Buyer notified; driver assigned or job posted to job board                   |
| PENDING → CANCELLED     | Seller rejects / auto-expiry  | Payment authorization voided; buyer notified                                 |
| CONFIRMED → IN_PROGRESS | Driver departs pickup         | Buyer notified with live tracking link                                       |
| IN_PROGRESS → DELIVERED | Driver submits delivery proof | Delivery note PDF generated; buyer review window starts                      |
| DELIVERED → COMPLETED   | Review window expires (48h)   | Payment captured and released to seller + carrier                            |
| Any status → CANCELLED  | Buyer / seller / admin        | See cancellation rules below                                                 |

### 4.3 Cancellation rules

| Order status | Buyer can cancel?                        | Seller can cancel?        | Admin can cancel?     |
| ------------ | ---------------------------------------- | ------------------------- | --------------------- |
| DRAFT        | ✅ Free                                  | —                         | ✅ Free               |
| PENDING      | ✅ Free                                  | ✅ (treated as rejection) | ✅ Free               |
| CONFIRMED    | ✅ With penalty (if >1h before delivery) | ✅ Admin alerted          | ✅ Free               |
| IN_PROGRESS  | ❌                                       | ✅ Admin alerted          | ✅ Free               |
| DELIVERED    | ❌                                       | ❌                        | ✅ Manual review only |

- Seller cancelling a CONFIRMED or IN_PROGRESS order must trigger an admin SYSTEM_ALERT — it disrupts buyer operations
- Buyer cancelling a CONFIRMED order: platform may charge a cancellation fee (configurable; not yet enforced)

### 4.4 Mixed-supplier cart

- A buyer may add materials from different suppliers in one session
- At checkout, orders are split per supplier automatically — one `Order` per supplier
- Payment is taken as a single Stripe charge; splits are handled by Stripe Connect transfer groups
- Buyer sees a split confirmation dialog before placing

### 4.5 Delivery time selection

- Buyer must be able to specify preferred delivery date
- Optional: preferred delivery window (morning / afternoon / specific time slot)
- Seller confirms or proposes an alternative window on acceptance

---

## 5. Transport & Logistics

### 5.1 Transport job creation

A transport job is created automatically when:

- A material order (MATERIAL or COMBINED) moves to PENDING
- A disposal order is confirmed
- An admin or dispatcher creates it manually

Each transport job must record:

- `jobType`: MATERIAL_DELIVERY, CONTAINER_DELIVERY, CONTAINER_PICKUP, WASTE_COLLECTION, EQUIPMENT_TRANSPORT, TRANSPORT
- Pickup address (supplier or B3 Field) with GPS coordinates
- Delivery address (buyer's site) with GPS coordinates
- Cargo: type, weight (tonnes), volume (m³)
- Required vehicle type
- Rate charged to buyer; driver payout amount
- Distance (km) — calculated at creation

### 5.2 Job assignment flow

```
Job created (AVAILABLE)
  → Dispatcher assigns to driver (ASSIGNED)   — OR —
  → Driver self-accepts from job board (ACCEPTED)
  → Driver departs pickup (EN_ROUTE_PICKUP)
  → Driver arrives at pickup (AT_PICKUP)
  → Seller confirms loading; driver confirms loaded (LOADED)
  → Driver departs to site (EN_ROUTE_DELIVERY)
  → Driver arrives at site (AT_DELIVERY)
  → Driver submits proof; buyer signs (DELIVERED)
  → Payment released; job closed (COMPLETED)
```

### 5.3 Vehicle conflict guard

- A vehicle may not be assigned to two active jobs simultaneously
- "Active" = any status from ASSIGNED to AT_DELIVERY inclusive
- System must reject the assignment with a clear error if a conflict is detected

### 5.4 Driver conflict guard

- A driver may not accept a new job if they already have a job in status ACCEPTED through AT_DELIVERY
- Independent owner-operators: blocked by the system
- Employed drivers: dispatcher warning but override allowed (split shifts)

### 5.5 GPS tracking

- Driver app transmits GPS position while a job is in EN*ROUTE*\* status
- Buyer and dispatcher see live position on map
- Position history stored per job for audit purposes
- Tracking must degrade gracefully when device is offline — queue updates and flush when reconnected

### 5.6 Delivery proof

Submission requires:

- At least one photo of delivered material / site
- Recipient signature (on-screen)
- Optional: note from driver

Proof must:

- Be timestamped and GPS-tagged at moment of capture
- Trigger delivery note PDF generation immediately
- Be immutable after submission — no edit or delete

### 5.7 Transport exceptions

When something goes wrong the driver must be able to raise an exception:

- Types: DRIVER_NO_SHOW, SUPPLIER_NOT_READY, WRONG_MATERIAL, PARTIAL_DELIVERY, REJECTED_DELIVERY, SITE_CLOSED, OVERWEIGHT, OTHER
- Exception creates an `OPEN` record; dispatcher and admin are notified
- Admin or dispatcher marks as RESOLVED with a note
- On PARTIAL_DELIVERY: platform must automatically generate a partial delivery note for the tonnes actually moved; buyer invoiced only for tonnage confirmed by weighing slip or driver declaration

### 5.8 No-driver escalation

- If a job remains AVAILABLE for 24 hours: admin receives a SYSTEM_ALERT
- If a job remains AVAILABLE for 48 hours: admin receives a critical SYSTEM_ALERT and job is flagged for manual intervention
- Platform must never leave a confirmed order without a driver indefinitely

---

## 6. Skip Hire & Container Rental

### 6.1 Skip hire order flow

```
Buyer selects size + delivery date + location (tap on map)
  → PENDING
  → Carrier confirms collection date + driver assigned (CONFIRMED)
  → Driver delivers skip to site (DELIVERED)
  → Buyer requests collection when full
  → Driver collects (COLLECTED)
  → Platform invoice generated (COMPLETED)
```

- Buyer must be able to pin exact drop point on a map (lat/lng precision)
- Optional: photo of the intended placement location uploaded at order time
- Platform must auto-cancel PENDING skip orders whose delivery date passes without confirmation (daily cron)

### 6.2 Container rental

- Container inventory tracked per container unit: `AVAILABLE → RENTED → IN_TRANSIT → MAINTENANCE`
- `ContainerOrder` lifecycle: `SCHEDULED → DELIVERED → IN_USE → PICKED_UP → COMPLETED`
- Rental period tracked in days; daily rate applied automatically
- Platform must alert admin if a container remains `IN_USE` beyond agreed rental period + 2 days without a pickup scheduled

### 6.3 Skip sizes and waste categories

| Size     | Volume |
| -------- | ------ |
| MINI     | ~2 m³  |
| MIDI     | ~4 m³  |
| BUILDERS | ~6 m³  |
| LARGE    | ~8 m³  |

Accepted waste categories: MIXED, GREEN_GARDEN, CONCRETE_RUBBLE, WOOD, METAL_SCRAP, ELECTRONICS_WEEE

---

## 7. Waste Disposal

- Buyer selects a licensed recycling center from the map
- Buyer specifies waste type, estimated tonnage, and preferred drop-off date/time
- Transport job created to move waste from site to recycling center
- On completion: **waste transfer certificate** auto-generated as PDF
  - Must include: waste type, tonnage, generator (buyer), transporter, receiving facility, date, regulatory reference
  - Certificate linked to the order and downloadable from buyer's account indefinitely
- ADR (hazardous) loads must be flagged; system must block standard vehicles and require ADR-certified driver assignment

---

## 8. Quote Requests (RFQ)

### 8.1 Buyer creates RFQ

Fields:

- Material category and specifications
- Required quantity and unit
- Delivery address
- Required delivery date
- Notes / special requirements

On creation:

- All active suppliers with the matching material category are notified (email + in-app)
- RFQ visible to suppliers on their quotes dashboard
- Buyer sees status: PENDING → QUOTED (when at least one quote received) → ACCEPTED

### 8.2 Supplier responds

- Supplier submits a `QuoteResponse` with: price per unit, delivery fee, earliest delivery date, validity period
- Multiple suppliers can respond to the same RFQ
- Buyer notified when each new quote arrives

### 8.3 Buyer accepts

- Buyer accepts one `QuoteResponse`; all others auto-expire
- Accepted quote is converted directly to a PENDING order
- Order follows the standard order lifecycle from here

### 8.4 Expiry

- RFQ auto-expires if validity period passes with no acceptance: status → EXPIRED
- All open `QuoteResponse` records on an expired RFQ also expire
- Buyer notified on expiry

---

## 9. Framework Contracts

Framework contracts formalize a long-term supply relationship between a buyer and supplier.

### 9.1 Contract structure

A `FrameworkContract` has one or more `FrameworkPosition` entries, each representing a supply line:

- Position type: MATERIAL_DELIVERY, WASTE_DISPOSAL, FREIGHT_TRANSPORT
- Material, unit, total contracted volume
- Agreed unit price
- Validity period (start date → end date)

### 9.2 Lifecycle

```
DRAFT → ACTIVE → COMPLETED | EXPIRED | CANCELLED
```

- `ACTIVE` contracts: buyer can release call-off orders against any position
- A call-off deducts from the remaining balance of that position
- Platform blocks call-offs if remaining balance would go negative relative to contracted volume

### 9.3 Notifications

- When a position reaches 10% remaining volume: buyer notified
- When a position is fully consumed (100%): buyer and supplier notified
- When a contract approaches expiry (7 days before): buyer and supplier notified
- When a contract expires: status auto-updated to EXPIRED by cron; both parties notified

### 9.4 Auto-expiry cron

- Daily cron checks all ACTIVE contracts with `endDate < now`
- Marks them EXPIRED; sends notifications to buyer + all supplier company members
- Call-offs cannot be released against an EXPIRED contract

---

## 10. Projects

- Buyers can create projects to group orders by construction site
- Each project has: name, site address, status (PLANNING, ACTIVE, COMPLETED, ON_HOLD), start date, optional end date, budget
- Orders are assigned to a project at order creation or retroactively
- Project detail page must show:
  - Total spend (sum of completed order values)
  - Budget utilisation % and remaining budget
  - Per-material cost breakdown
  - Order list with status
  - Linked documents (invoices, delivery proofs, waste certificates)
- Multiple team members can be granted access to a project

---

## 11. Payments & Payouts

### 11.1 Payment flow

```
Buyer pays → Stripe (full order total, pre-authorised)
  On CONFIRMED:  Payment captured
  On COMPLETED:  Seller payout + carrier payout released via Stripe Connect
  On CANCELLED:  Pre-auth voided (or refund if already captured)
```

- Payment held in Stripe pre-auth (`capture_method: 'manual'`) from PENDING to CONFIRMED
- Pre-auths expire after 7 days (Stripe max); cron must warn admin at day 6 to force confirmation or cancel

### 11.2 Stripe Connect payouts

Each payout release must atomically:

1. Transfer `sellerPayout` to seller's Stripe Connect account
2. Transfer `driverPayout` to carrier's Stripe Connect account
3. Retain `platformFee` (= total − sellerPayout − driverPayout)
4. Mark `Payment.status = RELEASED`

Failure modes that must be handled explicitly (no silent failures):

- Supplier has no Stripe Connect account: admin SYSTEM_ALERT
- Supplier payout skipped for any reason: admin SYSTEM_ALERT
- Driver transfer fails: admin SYSTEM_ALERT
- Driver has no Stripe Connect account: admin SYSTEM_ALERT
- `voidOrRefund` called on an already-RELEASED payment: admin SYSTEM_ALERT ("manual refund needed")

### 11.3 Commission and platform fee

- Default commission: 10% retained by platform
- Per-company override via `Company.commissionRate` field
- Commission applied at payout calculation time, not at payment time
- VAT rate: 21% (defined as `VAT_RATE` constant; never hardcoded)

### 11.4 Invoices

- Invoice auto-generated for every COMPLETED order
- Invoice must include: buyer details, seller details, order line items, subtotal, VAT amount, total, payment reference, invoice number
- If buyer is a company: VAT invoice with buyer VAT number
- If buyer is a private person: receipt without VAT breakdown
- PDF downloadable from buyer account and seller earnings dashboard
- Invoice overdue cron: if an invoice payment (for credit/net payment scenarios) is past due date, mark as overdue and notify buyer

### 11.5 Buyer credit

- Construction companies may have a credit limit (`creditLimit`) on their account
- At order creation: `creditUsed` incremented by order total
- At order COMPLETED: `creditUsed` decremented (funds already captured)
- At order CANCELLED: `creditUsed` must be rolled back
  - If rollback fails: admin SYSTEM_ALERT (phantom debt — buyer's creditUsed is overstated)

### 11.6 Review window before capture

- After DELIVERED, a configurable review window (default: 48 hours) opens
- Buyer can raise a dispute during this window; payment capture is blocked
- If no dispute: order auto-transitions to COMPLETED and payment captured
- Dispute flow requires admin intervention to resolve

---

## 12. Documents & Compliance

Every document is a `Document` record with a type, status, storage URL, and links to the entity it belongs to.

### Required document types

| Document            | Triggered by                     | Required fields                                                  |
| ------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `DELIVERY_NOTE`     | Order moves to DELIVERED         | Buyer, seller, driver, material, quantity, date, transaction ref |
| `DELIVERY_PROOF`    | Driver submits proof             | Photos, signature, GPS coordinates, timestamp, job ID            |
| `WEIGHING_SLIP`     | Weighbridge integration (future) | Gross, tare, nett weight; vehicle reg; date; facility            |
| `WASTE_CERTIFICATE` | Disposal order COMPLETED         | Waste type, tonnage, generator, transporter, facility, legal ref |
| `INVOICE`           | Order COMPLETED                  | See Section 11.4                                                 |
| `CONTRACT`          | Framework contract ACTIVE        | Signed by both parties                                           |

### Document rules

- All documents are immutable once `status = ISSUED` — no edit or delete
- Documents stored in Supabase Storage (never on local disk)
- Document generation failures must be logged with `logger.error` — silence is not acceptable; admin notified if generation fails for a critical document type (delivery note, waste certificate)
- Retention: documents must be retained for minimum 5 years (regulatory)
- All documents accessible to: the creating party, the counter-party, and admins

---

## 13. Reviews & Ratings

### 13.1 When reviews are allowed

- A buyer may submit one review per completed order
- Review window opens when order moves to COMPLETED
- Review window closes 30 days after COMPLETED; after that, review screen is hidden

### 13.2 Review content

- Star rating: 1–5 for the supplier (material quality, loading accuracy, communication)
- Star rating: 1–5 for the carrier (on-time, communication, professionalism)
- Optional text comment (max 1000 chars)
- Platform may moderate text comments before they appear publicly

### 13.3 Ratings recalculation

- On every new review: `Company.averageRating` recalculated as rolling average
- Rating displayed on catalog listings and supplier profiles

### 13.4 Notifications

- Reviewed company (supplier or carrier) must be notified when a review is submitted about them
- If rating ≤ 2 stars: admin SYSTEM_ALERT (potential service quality issue)

---

## 14. Notifications

### 14.1 Channels

| Channel                        | Used for                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------- |
| **In-app push** (Expo)         | Real-time events while mobile app is running                                 |
| **In-app notification centre** | Persisted notifications; read/unread state                                   |
| **Email** (Resend)             | Order confirmations, approvals, important events                             |
| **Admin SYSTEM_ALERT**         | Any event that requires human intervention — stored as Notification + logged |

### 14.2 Required notification triggers

**Buyer receives notification when:**

- Order is confirmed / rejected by seller
- Driver is assigned and en route
- Delivery completed — proof available
- Order cancelled by any party
- Invoice issued
- Invoice is overdue
- RFQ receives a new quote
- Their review window opens (COMPLETED)
- Framework contract position is 10% remaining / fully consumed
- Framework contract is expiring (7 days)

**Seller receives notification when:**

- New order arrives (email + in-app)
- Driver arrives at loading point
- Order is cancelled
- Framework contract position is fully consumed
- Framework contract is expiring
- A new review is submitted about them

**Driver receives notification when:**

- Job is assigned to them
- Job is auto-released (stale accepted job cron)
- Transport exception is resolved

**Admin receives SYSTEM_ALERT when:**

- New provider application submitted
- Any payment transfer fails
- Any payout is skipped (seller or driver has no Stripe Connect)
- Credit rollback fails (phantom debt)
- `voidOrRefund` is called on an already-released payment
- Seller cancels a CONFIRMED or IN_PROGRESS order
- Transport job has no driver for 24h (warning) / 48h (critical)
- A review of ≤ 2 stars is submitted
- Order auto-completion fails (TOCTOU guard fired — indicates a concurrent state change)
- Container overdue past pickup date
- Any document generation fails for a critical document type

### 14.3 Notification payload

Every notification must include:

- `type` (from `NotificationType` enum)
- `title` (short, display-ready string)
- `message` (1–2 sentence explanation)
- `data` (structured object: entity type + ID for deep linking)
- `createdAt` timestamp

---

## 15. Team & Company Management

### 15.1 Company account

- A company is a separate entity (`Company` model) with: name, registration number, VAT number, address, `CompanyType`, `stripeConnectId`, `payoutEnabled`, `commissionRate`
- Users link to a company via `companyId` and hold a `CompanyRole` (OWNER, MANAGER, DRIVER, MEMBER)
- One OWNER per company; OWNER cannot be demoted without ownership transfer

### 15.2 Team management permissions

Only users with `permManageTeam = true` may:

- Invite new members (generates invite email with accept link)
- Edit roles and permissions of existing members
- Remove members from the company

### 15.3 Permission flags

| Flag                  | Controls                                            |
| --------------------- | --------------------------------------------------- |
| `permCreateContracts` | Create and manage framework contracts               |
| `permReleaseCallOffs` | Release call-off orders against framework contracts |
| `permManageOrders`    | Confirm, reject, assign orders to projects          |
| `permViewFinancials`  | See earnings, invoices, cost analytics              |
| `permManageTeam`      | Invite, edit, remove team members                   |

### 15.4 Invite flow

```
Inviter sends invite → email with one-time link
  → New user: registration form pre-filled with company, role
  → Existing user: company join prompt
  → Account linked; invite link expires after 72 hours
```

---

## 16. Fleet & Vehicle Management

### 16.1 Vehicle registration

Each vehicle must record:

- Make, model, year
- Registration plate (unique)
- Type: DUMP_TRUCK, FLATBED_TRUCK, SEMI_TRAILER, HOOK_LIFT, SKIP_LOADER, TANKER, VAN
- Max payload (tonnes)
- ADR-certified (bool)
- Status: ACTIVE, IN_USE, MAINTENANCE, INACTIVE

### 16.2 Vehicle safety rules

- **Delete guard**: a vehicle cannot be deleted if it is currently assigned to an active transport job (status ASSIGNED through AT_DELIVERY)
- **Assignment guard**: a vehicle cannot be assigned to a new job if it is already on a job in any active status (see Section 5.3)
- **Maintenance mode**: vehicle set to MAINTENANCE is removed from the assignable pool automatically

### 16.3 Driver schedule

- Drivers can mark themselves as available or unavailable for specific dates/times
- Schedule visible to dispatcher
- Dispatcher cannot assign a job to an unavailable driver without an override confirmation

---

## 17. Admin Operations

### 17.1 Provider application review

- Admin sees all PENDING applications with: company details, application date, service type applied for
- Admin can approve or reject; rejection requires a reason note
- On approval:
  - If email matches existing user: capability flags toggled on that account
  - If new user: account created and welcome email sent
- Both paths must trigger a notification to the applicant

### 17.2 Company management

- Verify company: toggle `verified` flag on `Company`
- Enable payouts: toggle `payoutEnabled` — disabling blocks all future Stripe transfers for that company
- Set commission rate: override `commissionRate` per company (allows negotiated rates)
- View company members and their roles

### 17.3 Order oversight

- View all orders with filters: status, buyer, seller, date range, order type
- Force-cancel any order at any status with a reason
- Force-assign a transport job to any driver
- Trigger manual payout for a specific order (if auto-payout failed)

### 17.4 Audit trail

Every admin action must be logged with:

- Which admin performed it (`adminId`)
- What action was taken (action type + entity type + entity ID)
- Timestamp
- Any changed values (before/after)

This is required for financial compliance and dispute resolution.

### 17.5 Admin dashboard KPIs

- Active orders count
- Transport jobs in exception state
- Open provider applications
- Failed payments in last 24h
- Revenue (GMV) for current month vs. previous month

---

## 18. Automation & Cron Jobs

These jobs run in the background and are required for the platform to function unattended. All cron updates must use `updateMany` with a status guard (`where: { id, status: expectedStatus }`) to prevent race conditions.

| Job                                       | Schedule             | Action                                                                                       |
| ----------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| **Stale PENDING orders**                  | Daily 8am            | Auto-cancel material/transport orders in PENDING with `createdAt` > SLA window; notify buyer |
| **Stale accepted transport jobs**         | Every 4h             | Release ACCEPTED jobs untouched for >2h back to AVAILABLE; notify dispatcher/admin           |
| **No-driver escalation**                  | Every hour           | Warn (24h) / alert (48h) admin if a job has been AVAILABLE with no accepted driver           |
| **Auto-complete delivered orders**        | Every 2h             | Move DELIVERED orders to COMPLETED when review window has expired; trigger payment capture   |
| **Pre-auth expiry warning**               | Daily 7am            | Alert admin for any Stripe pre-auths that will expire within 24 hours                        |
| **Invoice overdue cron**                  | Daily 9am            | Mark overdue invoices; email and notify buyer                                                |
| **Framework contract expiry**             | Daily 6am            | Move ACTIVE contracts past end date to EXPIRED; notify buyer + supplier                      |
| **Skip hire stale PENDING**               | Daily 8am            | Auto-cancel PENDING skip orders whose delivery date has passed; notify buyer                 |
| **Container overdue alert**               | Daily 10am           | Alert admin for containers in IN_USE beyond agreed return date + 2 days                      |
| **RFQ expiry**                            | Daily 6am            | Mark RFQs past validity as EXPIRED; expire all open quotes for them; notify buyer            |
| **Framework position consumption alerts** | On call-off creation | Check position balance; fire 10% and 100% notifications                                      |

All crons must:

- Log a summary with the count of records processed and any errors
- Not throw unhandled exceptions (errors caught per-record; processing continues)
- Be idempotent (safe to run twice in a row without double-effects)

---

## 19. Analytics & Reporting

### 19.1 Buyer analytics

- Total spend per period (week / month / year)
- Spend breakdown by order type (materials, transport, disposal)
- Spend per project (project P&L)
- Most ordered materials and suppliers
- Cost per tonne by material category over time

### 19.2 Seller analytics

- Total revenue per period
- Top buyers by volume
- Order fulfilment rate (accepted / total received)
- On-time delivery rate (calculated from transport job timestamps)
- Average rating over time
- Material sales breakdown by category

### 19.3 Carrier analytics

- Total completed jobs per period
- Total gross earnings and net (after platform fee)
- Earnings breakdown per driver
- Average job distance
- Exception rate

### 19.4 Admin analytics

- GMV (gross merchandise value) total and by type
- Platform fee collected per period
- Registered users (total, new, active in period)
- Active vs. churned suppliers and carriers
- Order completion rate and cancellation rate
- Average order value
- Top buyers, top suppliers, top carriers

---

## 20. Non-Functional Requirements

### 20.1 Security

- **Authentication**: All endpoints protected by JWT; no unauthenticated mutations
- **Authorization**: Every service method must verify that the calling user has permission for the resource (owner check, capability flag check, or admin check)
- **OWASP Top 10**: No SQL injection (Prisma parameterized queries only), no XSS (validation on all inputs), no IDOR (owner checks on every resource fetch)
- **Rate limiting**: 120 req/min per IP globally; sensitive endpoints (auth, payment) stricter
- **Secrets**: Never in source code; loaded from environment variables only
- **HttpOnly cookies**: Web session cookies must use HttpOnly + Secure + SameSite=Strict
- **File uploads**: Validated for type and size; stored in Supabase Storage, never local disk; access via signed URLs only

### 20.2 Reliability

- All background jobs (cron) must use TOCTOU-safe database writes (`updateMany` with status guard)
- All external API calls (Stripe, Supabase, Resend, maps) must have try/catch; failures must be logged and, for money-critical operations, must trigger admin alerts
- Silent `catch(() => {})` is never acceptable on financial or document-generating code paths
- Offline delivery proof: queue proof capture locally if signal drops; flush on reconnect

### 20.3 Performance

- All list endpoints paginated (default 20, max 100)
- Material catalog: ≤ 500ms response time with geo-filtering
- Transport live map: GPS position updates ≤ 5 seconds delay
- Invoice PDF generation: ≤ 10 seconds; async with polling or push notification when complete

### 20.4 Scalability targets (Baltic market initial)

- 1,000 concurrent users
- 10,000 orders/month
- 50,000 transport job GPS pings/hour
- 500 active fleet vehicles

### 20.5 Availability

- Target: 99.5% uptime (≤ 3.6h downtime/month)
- Payment webhooks: must be idempotent and respond within 5 seconds to Stripe
- Webhook receipt must be acknowledged before processing to prevent Stripe retries causing double-processing

### 20.6 Data retention

- All transaction documents: minimum 5 years (EU regulatory requirement)
- User data: retained while account is active; deletion handled on request per GDPR
- GPS tracking history: 90 days rolling window
- Audit logs: minimum 2 years

### 20.7 Internationalisation

- Primary language: Latvian
- Secondary language: Russian (significant Baltic market segment)
- All monetary values: EUR with 2 decimal places
- All dates: ISO 8601 UTC storage; displayed in Europe/Riga timezone
- VAT rate: 21% (Latvia) — defined as a constant, never hardcoded

### 20.8 Mobile-specific

- Android and iOS (Expo managed workflow)
- Offline mode for driver essentials: job details, pickup/delivery address, proof capture
- Push notifications via Expo push service (APNs + FCM)
- Camera required for delivery proof; GPS required for job tracking
- App must work acceptably on a 3G mobile data connection at construction sites

---

## Appendix A — Automated Construction Marketplace Checklist

> A platform can only call itself a "fully automated marketplace" when **every transaction completes end-to-end without manual intervention** under happy-path conditions. The following checklist defines what that means.

| #   | Requirement                                                                                             | Why it matters                       |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Buyer can register, browse, place, pay, and receive an order without contacting anyone                  | Core automation                      |
| 2   | Seller receives incoming orders, confirms, and that confirmation triggers driver dispatch automatically | Removes seller-dispatcher dependency |
| 3   | Driver is notified, navigates, submits proof — all in the mobile app without phone calls                | Field automation                     |
| 4   | Payment captured and split to seller + driver automatically on delivery                                 | Financial automation                 |
| 5   | Invoice generated and sent automatically on completion                                                  | Document automation                  |
| 6   | Waste certificate generated automatically on disposal order completion                                  | Compliance automation                |
| 7   | Review window opens and closes automatically; funds released on expiry                                  | Review automation                    |
| 8   | Stale orders and expired contracts cleaned up automatically by crons                                    | Data hygiene automation              |
| 9   | Pre-auth expirations warned before they lapse                                                           | Payment safety automation            |
| 10  | Every failure mode that requires human intervention fires an explicit admin alert                       | Ops observability                    |
| 11  | No construction company can double-book a truck or oversell stock                                       | Marketplace integrity                |
| 12  | All documents stored, immutable, and retrievable for 5 years                                            | Legal compliance                     |

All 12 must be true for the platform to operate unattended at scale.

---

_Last updated: April 2026_
