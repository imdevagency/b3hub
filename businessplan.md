# B3 Group — Business Plan

---

## 1. What We Are Building

B3 Group is building Latvia's version of the **Schüttflix Group** — the German company that proved you can build a €190M business in construction logistics by combining a digital marketplace with licensed recycling infrastructure.

We are not doing anything original. We are doing what Schüttflix proved works, in a market where nobody has done it yet.

**The business has three physical units:**

| Unit                       | What it is                  | Role                                                                                         |
| -------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| **Bilt**                   | Digital marketplace app     | Connects buyers, suppliers, carriers, and recyclers on one transaction layer                 |
| **B3 Recycling — Gulbene** | Licensed recycling facility | Accepts construction waste, processes it, certifies and resells it as secondary raw material |
| **B3 Construction**        | Groundworks subcontractor   | First-party buyer and waste generator — feeds platform volume from day one                   |

The three units form a **closed loop**. Material goes in one direction, waste goes back, gets recycled, and becomes supply again. Every step generates revenue. No truck runs empty.

---

## 2. The MVP — How It Works End to End

The MVP is already built. This is how a complete transaction flows today.

### A full transaction cycle

```
1. BUYER places order
   ─────────────────
   A construction company or homeowner opens the Bilt app.
   They order 50 tonnes of crushed gravel, delivered to their site address.
   They pick a date. They see the price upfront. They confirm.

2. PLATFORM assigns supplier + carrier
   ────────────────────────────────────
   Bilt selects the nearest approved supplier that has stock.
   Bilt creates a transport job and assigns it to an available carrier/driver.
   The driver gets a push notification: new job available.

3. DRIVER accepts and executes
   ────────────────────────────
   Driver accepts the job in the mobile app.
   App shows pickup address (supplier) and delivery address (site).
   Driver updates status at each step: En Route → At Pickup → Loaded → Delivering → Delivered.
   Real-time GPS visible to the buyer throughout.

4. DELIVERY CONFIRMED
   ────────────────────
   On arrival, buyer signs on the driver's phone screen.
   Digital delivery note (E-CMR equivalent) is generated automatically.
   No paper, no stamp, no yellow copy.
   Payment to supplier and carrier is queued for next-day settlement via Paysera.

5. SITE GENERATES WASTE
   ─────────────────────
   The same construction site now has excavated soil and demolition concrete.
   The buyer opens Bilt again, books a waste disposal job.
   Same app, same interface — they declare waste type and weight estimate.

6. PLATFORM ROUTES TO B3 RECYCLING
   ──────────────────────────────────
   Bilt queries the nearest licensed facility that accepts the declared waste type.
   B3 Recycling Gulbene accepts it.
   A transport job is created: carrier picks up waste from site, delivers to Gulbene.
   Buyer pays a disposal fee. Gate pass (QR code) is generated for the carrier.

7. WASTE RECEIVED AT GULBENE
   ──────────────────────────
   Carrier arrives. Gate operator scans QR pass on their phone — pass validated instantly.
   Weighbridge records net weight. Weighing slip created in the system.
   Material is classified: recyclable or landfill. Most excavated soil and clean concrete is recyclable.

8. PROCESSING → CERTIFIED SECONDARY MATERIAL
   ────────────────────────────────────────────
   Gulbene processes the incoming waste: crush, screen, grade.
   Output: certified RC gravel, RC fill, processed soil.
   Admin creates a Material listing in the Bilt catalogue: "RC Grants — Gulbene", price €X/t.

9. SECONDARY MATERIAL SOLD TO NEXT BUYER
   ─────────────────────────────────────────
   New buyer on Bilt sees the RC material listing in the catalogue.
   They order. Driver delivers. Cycle repeats from step 1.
```

**This is the flywheel.** Every delivery generates waste. Every waste job feeds Gulbene. Gulbene produces supply. Supply enables more orders. More orders attract more carriers and suppliers to the platform.

---

## 3. The Four Sides — Who Is on the Platform

Bilt is a **four-sided marketplace**. All four sides exist in the current codebase.

| Side          | Who                                             | What they do on Bilt                                                |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| **Buyers**    | Construction companies, contractors, homeowners | Order materials, book disposal jobs, track deliveries               |
| **Suppliers** | Quarries, gravel/sand/concrete producers        | List materials, set prices, confirm orders, arrange loading         |
| **Carriers**  | Trucking companies, independent tipper drivers  | Accept and execute transport jobs (delivery and waste haulage)      |
| **Recyclers** | Licensed waste facilities, processing plants    | Receive waste jobs, issue certificates, produce secondary materials |

**B3 Recycling Gulbene sits in the Recyclers role** — it is one participant on its own platform. External recyclers can also be registered. This is intentional — Bilt must be a neutral marketplace that works even if B3 Recycling is at capacity.

**B3 Construction sits in the Buyers role** — it generates real order volume from day one and proves the platform works before external buyers are acquired.

---

## 4. Bilt as the Single Contractual Partner

This is the most important operational principle, copied directly from Schüttflix:

> _"No unnecessary discussions on the construction site and no hassle with customer accounts. We are your contractual and contact partner."_ — Schüttflix

**What this means in practice:**

- The buyer's contract is with **Bilt**, not with the supplier or the driver.
- The carrier's contract is with **Bilt** — they never invoice the buyer.
- When anything goes wrong — delayed delivery, weight discrepancy, damage — the call goes to **Bilt**, not to whoever the buyer thinks is responsible.
- Bilt pays suppliers and carriers on the **next working day**, regardless of when the buyer pays Bilt. The carrier's default risk is zero.
- There is **no direct messaging** between buyers and drivers, buyers and sellers, or carriers and suppliers. Everyone contacts Bilt through the in-app support chat or phone line.

This is not a limitation. It is a trust and efficiency feature. Carriers accept jobs with confidence because they know they will be paid on time. Buyers place orders confidently because they know Bilt handles any problem.

**In the product today:** the messages tab shows Bilt system communications and support replies. The `(shared)/support-chat` screen is the one contact channel for all roles.

---

## 5. Revenue Model

Every transaction creates multiple revenue events. This is the key structural advantage over a single-sided logistics company.

| Revenue stream                             | From                                                           | Rate             |
| ------------------------------------------ | -------------------------------------------------------------- | ---------------- |
| **Platform commission on material orders** | Supplier pays % on confirmed order value                       | ~8–12%           |
| **Transport job fee**                      | Charged per matched and completed transport job                | Fixed or %       |
| **Disposal booking fee**                   | Buyer pays per waste disposal job routed to a facility         | Fixed fee        |
| **Gate fee (waste intake)**                | B3 Recycling Gulbene charges per tonne of waste accepted       | €X/t             |
| **Secondary material sales**               | B3 Recycling sells RC material on the platform at market price | Margin per tonne |
| **B2C construction contracts**             | B3 Construction subcontracting revenue                         | Project-based    |

**The high-margin streams are Gulbene gate fees and RC material sales.** Once processing infrastructure is paid for, margin per tonne is structurally high. Platform commission scales with volume at near-zero marginal cost.

**A single trip from a B2B buyer to a construction site and back generates revenue four times:**

1. Platform commission on the material order
2. Transport job fee on the outbound delivery
3. Disposal booking fee on the return waste job
4. Gate fee when waste arrives at Gulbene

---

## 6. What Is Actually Built Today

The MVP is built and running. This is the honest current state.

### Mobile App (Expo / React Native)

| Feature                                                                       | Status  |
| ----------------------------------------------------------------------------- | ------- |
| Buyer: material order wizard (catalogue → specs → address → offers → payment) | ✅ Live |
| Buyer: disposal/waste collection wizard                                       | ✅ Live |
| Buyer: transport job booking                                                  | ✅ Live |
| Buyer: order tracking, order history, documents                               | ✅ Live |
| Buyer: framework contracts + call-offs                                        | ✅ Live |
| Driver: job feed, accept/reject, full status flow                             | ✅ Live |
| Driver: GPS tracking during active delivery                                   | ✅ Live |
| Driver: delivery proof (signature + photo)                                    | ✅ Live |
| Driver: earnings + payout screen                                              | ✅ Live |
| Seller: incoming orders, confirm/cancel                                       | ✅ Live |
| Seller: material catalogue management                                         | ✅ Live |
| Recycler: incoming waste jobs, records                                        | ✅ Live |
| All roles: Bilt support chat                                                  | ✅ Live |
| Guest checkout (B2C, no account required)                                     | ✅ Live |

### Web App (Next.js — Seller + Admin portal)

| Feature                                                          | Status  |
| ---------------------------------------------------------------- | ------- |
| Admin: orders, transport jobs, users, companies                  | ✅ Live |
| Admin: B3 Fields management + gate view                          | ✅ Live |
| Admin: B3 Recycling portal (jobs, waste records, APUS reporting) | ✅ Live |
| Admin: carrier management, payouts                               | ✅ Live |
| Admin: framework contracts                                       | ✅ Live |
| Admin: platform settings, integrations hub                       | ✅ Live |
| Seller: dashboard, orders, catalogue, earnings                   | ✅ Live |
| Marketing landing pages (Latvian)                                | ✅ Live |

### Backend (NestJS / Prisma / PostgreSQL)

All business logic is built. Material orders, transport jobs, disposal routing, FieldPass gate validation, digital delivery notes, Paysera payment processing, and the full APUS environmental reporting for VVD (Latvian waste authority) are all live.

### The One Gap: Closing the Circular Loop

Everything works except one admin workflow — converting a completed waste intake record at Gulbene into a new material listing on the platform. The data model is fully built (`WasteRecord.producedMaterialId` → `Material`). The missing piece is a single admin button:

> **"Create Supply Listing"** on a completed WasteRecord → pre-fills Material form with `category = RECYCLED_*`, `stock = recyclableWeight`, `isRecycled = true`, `supplierId = B3 Recycling` → admin sets price → listing goes live on marketplace.

Once this workflow exists, the loop is closed and Bilt is functionally equivalent to the Schüttflix Group's end-to-end model.

---

## 7. Why This Is Defensible

A pure marketplace (platform only) is easy to copy. What is hard to copy is the combination:

| Moat                                   | Why competitors can't replicate it quickly                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Licensed physical infrastructure**   | Gulbene's recycling licence took regulatory process to obtain. You cannot spin one up in months.                                                                                 |
| **Data advantage**                     | The platform knows what waste is generated, where, and when — Gulbene's intake is optimised. New entrants have no data.                                                          |
| **Network effects**                    | More carriers → faster deliveries → more buyers → more orders → more carriers want to join.                                                                                      |
| **Full-loop pricing**                  | B3 captures revenue on both the outbound delivery AND the return waste job. Can offer carriers better utilisation and lower per-trip costs than any single-direction competitor. |
| **First-mover in a fragmented market** | Construction logistics in Latvia is still coordinated by phone calls and paper CMRs. Anyone who digitises first owns the workflows.                                              |

---

## 8. The Schüttflix Benchmark

Schüttflix proves this model works at scale. Founded 2019 as a platform, merged with IK Umwelt (licensed recycler) in 2024 to form the Schüttflix Group.

**By 2024:** €190M revenue, >50% annual growth, 1.4M+ transports, operations in Germany, Austria, Poland, Czech Republic.

| Schüttflix Group                         | B3 Group                                         | Equivalent |
| ---------------------------------------- | ------------------------------------------------ | ---------- |
| Schüttflix digital platform              | Bilt marketplace                                 | ✅         |
| IK Umwelt licensed recycler (NRW)        | B3 Recycling Gulbene                             | ✅         |
| Unlicensed disposal sites (Hagedorn)     | B3 Fields                                        | ✅         |
| Platform transaction fee                 | Bilt commission                                  | ✅         |
| RC material sales                        | Gulbene secondary material                       | ✅         |
| "Smooth Contacts" — single partner model | Bilt is the sole contractual and contact partner | ✅         |
| Next-day payment to all partners         | Paysera-based payouts by Bilt                    | ✅         |
| Autonomous pricing                       | Suppliers set catalog prices                     | ✅         |
| Fully digital: order → note              | Order → GPS → auto delivery note                 | ✅         |

**Key advantage:** Schüttflix built the platform first, then acquired the physical recycling infrastructure. B3 Group already has both. The flywheel can turn from day one.

---

## 9. Growth Path

**Phase 1 — Build density in Riga region (now)**
Drive material order volume. Get enough suppliers, carriers, and buyers that prices are competitive and wait times are under 24 hours. Use B3 Construction's own projects as anchor volume to prove the platform works.

**Phase 2 — Activate the waste loop**
Once delivery volume is sufficient, market the disposal booking flow to buyers already using the platform. Route waste to Gulbene. Begin producing and listing RC material. Close the circular loop.

**Phase 3 — B3 Fields expansion**
Add field locations in Jelgava, Valmiera, Daugavpils to reduce carrier empty-return distances. Each new field increases waste catchment area and reduces last-mile costs.

**Phase 4 — Baltic expansion**
Extend platform to Lithuania and Estonia. The digital platform scales at near-zero marginal cost; physical infrastructure follows market density.

---

_Reference: Schüttflix Group (schuettflix.com), IK Umwelt (ik-umwelt.de), Schüttflix press release 21.01.2025_
