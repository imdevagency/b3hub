# B3Hub — Real-World Construction Workflows

> How construction logistics actually works today, what breaks, and exactly what B3Hub does to fix it.

---

## Preface

Construction sites run on materials and movement. Every tonne of gravel placed, every load of waste removed, every delivery executed requires a chain of coordination between at minimum three parties: the **buyer** (contractor, foreman, or homeowner), the **supplier** (quarry, batch plant, merchant), and the **carrier** (trucking company or independent driver).

Today that chain is held together by phone calls, WhatsApp messages, handwritten delivery notes, paper weighing slips, and emailed PDF invoices. B3Hub replaces that entire chain with one platform — without changing the physical work.

---

## Workflow 1 — Bulk Materials Delivery (Gravel, Sand, Concrete)

### The most common transaction in Latvian construction. A site needs 50 tonnes of crushed stone delivered.

---

### How it works today (without B3Hub)

**Day before:**

1. Site foreman calls supplier A to ask about crushed stone availability and price. Supplier A is out of stock on the size required.
2. Foreman calls supplier B. Gets a price over the phone. Writes it in a notebook.
3. Foreman texts a trucking contact asking if they have a truck free tomorrow morning.
4. Trucker says yes but can't confirm until tonight because another job might overrun.
5. Foreman confirms supplier B verbally. No written contract. No confirmation email.

**Delivery day:** 6. Truck arrives at the quarry. Weighbridge operator weighs the truck empty (tare weight), truck loads, weighs again (gross weight). Paper weighing slip issued. Driver puts it in the cab. 7. Driver delivers to the site. Site foreman is not there — he's on the other side of the site. Driver waits 20 minutes. 8. Delivery takes place. Driver gets a signature on a handwritten delivery note. One copy stays with the driver, one copy goes to the site foreman. 9. That evening the foreman discovers the delivery note copy is missing — driver kept both.

**After delivery:** 10. Supplier sends a PDF invoice by email 3–5 days later. Company accountant receives it, cross-references with the delivery note — but the delivery note is missing. 11. Finance department puts the invoice on hold for verification. Payment delayed. 12. Supplier chases for payment. Relationship friction. 13. Total time from order to invoice settled: 15–25 days. Multiple people involved. Paper trail incomplete.

**What goes wrong regularly:**

- Wrong material grade delivered (driver went to wrong loading bay)
- Weight discrepancy — invoice says 52 tonnes, site says they received 47 tonnes. No way to prove either figure.
- No quality certificate attached to delivery — required under Latvian CE marking law but frequently missing
- Driver delivers to wrong address (two active sites in the same city)
- Buyer has no visibility until the truck physically arrives

---

### How it works on B3Hub

**Buyer places order (mobile app or web — 3 minutes):**

1. Buyer opens the catalog, selects Crushed Stone 0/16, enters 50 tonnes, selects delivery site and time window (e.g. Wednesday morning). Sets site contact name and phone number.
2. Order goes to the supplier. Supplier confirms in the app. Buyer gets a push notification.
3. Stripe payment authorised (funds held, not charged yet). Supplier knows payment is guaranteed.

**Transport assignment (automatic):** 4. System finds available drivers near the pickup location. Closest available driver is offered the job. Driver accepts on the mobile app — sees pickup address, delivery address, cargo type, required vehicle, and site contact. 5. Driver's vehicle details are sent to the buyer and the site contact automatically.

**Day of delivery:** 6. Driver marks EN_ROUTE_PICKUP. Buyer's app shows "Driver heading to pickup". 7. Driver arrives at quarry. Marks AT_PICKUP.

- **If the material has no quality certificate attached** → supplier gets an immediate push notification: "⚠️ Add quality cert before loading for order #XX". Seller uploads it in the app before the driver leaves.

8. Truck loads. Driver enters actual weight on the app (or reads it from the quarry's digital scale). Marks LOADED.
   - System generates a **weighing slip PDF** automatically with driver name, weight, order number, and a note confirming the pickup photo was captured.
   - If actual weight differs from ordered weight by more than 5% → buyer gets an alert instantly. Invoice is automatically adjusted to actual weight.
   - Driver optionally photographs the loaded truck / scale reading.
9. Driver marks EN_ROUTE_DELIVERY. Buyer's app shows live status.
10. Driver arrives at site. Marks AT_DELIVERY. Buyer gets push: "Driver has arrived."
11. Driver takes a delivery photo, gets a digital signature from site contact. Marks DELIVERED.
    - **CMR / kravas pavadzīme** is auto-generated and signed with GPS coordinates and timestamp.
    - Invoice is auto-generated. VAT invoice with supplier's VAT number and bank details.
    - Buyer gets all documents in the Documents section immediately.
12. Stripe captures the payment. Funds transferred to supplier and carrier via Stripe Connect. No invoice chasing.

**What B3Hub eliminated:**
| Manual step | B3Hub equivalent |
|---|---|
| Price negotiation call | Fixed catalog price or RFQ |
| Truck booking phone call | Automatic nearest-driver dispatch |
| Paper weighing slip | Auto-generated weighing slip PDF |
| Handwritten delivery note | Auto-generated signed CMR |
| Manual invoice 3–5 days later | Auto-generated at delivery |
| Payment chase | Stripe capture on delivery |
| Missing quality cert | Real-time seller alert at AT_PICKUP |
| Weight dispute | 5% tolerance alert, auto-reconciled invoice |

---

## Workflow 2 — Construction Waste Removal

### A renovation produces 8 tonnes of rubble. The contractor needs it collected and disposed of legally.

---

### How it works today (without B3Hub)

1. Contractor calls several waste carriers to get quotes. Takes 1–2 days to collect.
2. Agrees a price verbally. Books a truck.
3. Driver arrives, loads waste manually into the truck.
4. Driver takes waste to a licensed recycling centre or landfill.
5. Recycling centre issues a paper waste acceptance certificate — legally required to prove disposal.
6. Certificate is mailed or emailed to the contractor, sometimes weeks later.
7. Contractor must keep this certificate for **5 years** by Latvian environmental law. It gets filed in a folder, or lost.
8. If the contractor is audited and the certificate is missing → regulatory fine.

**Specific problem:** the waste acceptance certificate (atkritumu pieņemšanas akts) is a legal document. Every single disposal must have one. In practice, a large contractor running 10 sites handles hundreds of disposals per year. Keeping all certificates manually is a compliance burden.

---

### How it works on B3Hub

1. Contractor opens the **Disposal wizard** on mobile. Selects waste type (rubble, mixed construction waste, recyclable materials), estimated weight, pickup address, and preferred date.
2. System shows licensed recycling centres or carriers offering disposal in that area.
3. Contractor confirms. Payment captured.
4. Carrier driver accepts the job and collects the waste.
5. At delivery to the recycling centre, driver marks DELIVERED + submits proof.
6. **Waste processing certificate** auto-generated by the platform. Stored in the contractor's Documents section. Downloadable as PDF. Timestamped and tied to the order.
7. Contractor never needs to ask for the certificate. It is waiting in the app the moment the disposal is recorded.

**For a contractor running 50 disposals/year:** all certificates in one place, searchable, downloadable. Zero manual filing.

---

## Workflow 3 — Skip Hire (B2C — Homeowner)

### A homeowner is renovating a bathroom. Needs a 6m³ skip for a week.

---

### How it works today (without B3Hub)

1. Homeowner searches Google for "skip hire Rīga". Gets 5 different websites.
2. Calls two of them. One doesn't pick up. One gives a price but can't tell them if a skip is available for Thursday.
3. Books verbally. No written confirmation.
4. Skip arrives Thursday. Driver leaves it on the street.
5. Homeowner doesn't know if they need a permit for placing the skip on public road. No one told them.
6. Skip is collected a week later. Homeowner receives a paper invoice in the post 2 weeks later.
7. No documentation of what type of waste was in the skip. Legally the owner of the waste is responsible for its disposal.

---

### How it works on B3Hub

1. Homeowner goes to the B3Hub landing page (or mobile app — guest checkout, no account needed).
2. Skip hire wizard: choose skip size (2m³ / 4m³ / 6m³ / 8m³), waste type, address, delivery date, collection date.
3. Precise placement location selected on the map by tapping. Optional site photo attached.
4. Pays by card. Confirmation email sent immediately with booking reference.
5. Driver delivers skip on the confirmed date. Homeowner can track via the app.
6. When skip is collected, waste transfer note auto-generated. Proves legal disposal.
7. No phone call. No missing paperwork. Homeowner has a legal document proving their renovation waste was disposed of correctly.

**Why this matters legally:** in Latvia, the waste producer (homeowner) is legally responsible for ensuring construction waste is disposed of at a licensed facility. A waste transfer note is the proof. Most homeowners don't know they need one. B3Hub generates it automatically.

---

## Workflow 4 — Framework Contract (B2B — Construction Company)

### A general contractor is building a housing estate. They'll need 500 tonnes of sand, 200 tonnes of gravel, and 150 tonnes of topsoil delivered across 6 months, to two different sites.

---

### How it works today (without B3Hub)

1. Procurement manager negotiates a supply contract with a quarry. 6 hours of back-and-forth. Contract typed in Word.
2. Site foremen call or WhatsApp the procurement manager when they need a delivery.
3. Procurement manager calls the supplier, confirms quantities, arranges trucking.
4. This happens 3–4 times per week across the project.
5. At end of month, procurement manager reconciles delivery notes with invoices. Many don't match — wrong quantities, wrong delivery addresses.
6. Finance holds payment. Supplier chases. Relationship friction repeated.
7. At end of project, trying to calculate actual material cost per tonne/m³ requires manually digging through all paper delivery notes and invoices.

---

### How it works on B3Hub

**One-time contract setup:**

1. Procurement manager creates a **Framework Contract** in the web app. Specifies: supplier, material type and grade, agreed price per tonne, validity period, delivery sites, total tonnage cap.
2. Supplier confirms the contract terms in their portal.

**Ordering throughout the project (call-offs):** 3. Site foreman (on mobile app) places a **call-off** against the framework contract — "50 tonnes of 0/16 gravel to site B, Friday morning". 4. No price negotiation. No phone call. Price is locked in the framework. Order confirmed instantly. 5. Supplier sees the order, loads it, driver delivers, documents generated automatically.

**Reporting:** 6. Procurement manager sees a real-time dashboard: tonnes ordered vs contract cap, cost per site, delivery history. No manual reconciliation. 7. At project close, exports all delivery notes, weighing slips, and invoices in one PDF package for the client or auditor.

**What changed:**

- Framework contract negotiation: once, at the start
- Per-delivery coordination: 0 minutes (site foreman places call-offs directly)
- Monthly reconciliation: 0 minutes (everything auto-matched)
- Cost visibility: real-time instead of month-end

---

## Workflow 5 — Driver's Day (Multi-Stop Route)

### A driver has 4 deliveries to do on Tuesday. Different pickup points, different delivery sites.

---

### How it works today (without B3Hub)

1. Transport manager calls or texts the driver the night before with the job list.
2. Driver writes them down or saves the WhatsApp messages.
3. Driver plans the route themselves, guessing the most efficient order.
4. Between jobs, driver calls back to base to check if any new urgent jobs have come in nearby.
5. For each delivery, driver collects and returns paper documents.
6. At end of day, driver returns paperwork to the office. Office enters data manually.

---

### How it works on B3Hub

**Morning (before starting):**

1. Driver opens the **Jobs** screen. Sees all available jobs in their area.
2. Enables **Tour Mode**, selects 4 jobs.
3. Taps "Optimise Route" → Google Maps calculates the most efficient order. Shows total estimated km and time. Driver reviews and accepts all 4 at once.
4. Optimised stop sequence shown in the app. Each stop has pickup address, delivery address, cargo details, and site contact number.

**During the day:** 5. Driver advances status on each job as they go (EN_ROUTE_PICKUP → AT_PICKUP → LOADED → EN_ROUTE_DELIVERY → DELIVERED). 6. Each status advance sends a real-time notification to the buyer. No "where's my delivery?" calls. 7. After the last delivery, driver checks the **Return Trips** panel — automatically shows available loads departing from within 75 km of the delivery location. Driver can accept a backhaul immediately, eliminating a dead run.

**End of day:** 8. All documents generated. All deliveries logged. Driver's earnings calculated. Nothing to hand in to the office.

---

## Workflow 6 — Weight Discrepancy (Common Dispute)

### Buyer ordered 30 tonnes of concrete aggregate. Supplier invoices for 30 tonnes. Site foreman insists only 26 tonnes arrived.

---

### How it works today (without B3Hub)

This dispute has no clean resolution without evidence. Both sides argue from memory or incomplete paper records. It usually ends with the buyer paying under protest or the relationship breaking down.

---

### How it works on B3Hub

1. At LOADED, driver entered actual weight: 26.4 tonnes (from the quarry's digital scale).
2. Ordered quantity was 30 tonnes → 12% discrepancy.
3. System detected the >5% threshold and immediately:
   - Sent buyer a push notification: "⚠️ Weight discrepancy: 26.4t loaded vs 30t ordered (12%)"
   - Auto-adjusted the invoice to 26.4 tonnes
   - Sent email to buyer with both figures
4. Weighing slip PDF stored as a document, timestamped, with driver's name.
5. No dispute. Numbers were agreed at loading time. Invoice matched what was delivered.

---

## Workflow 7 — Dispute Resolution

### Buyer claims material quality was wrong. Supplier says it was correct.

---

### How it works today (without B3Hub)

1. Buyer refuses to pay. Calls supplier to complain.
2. Supplier says material was correct grade. Calls carrier to ask if something went wrong.
3. No evidence. No process. Escalates to threats, lawyers, or unpaid invoices.

---

### How it works on B3Hub

1. Buyer opens the order in the app. Taps **File Dispute**. Selects reason (wrong material), adds description and photos.
2. System immediately notifies all B3Hub admins.
3. Admin reviews: checks delivery proof photos, weighing slip, CMR, any quality certificates attached to the material listing, chat history between buyer and seller.
4. Admin resolves:
   - **In buyer's favour**: order cancelled, Stripe payment refunded. Buyer notified. Driver notified (dispute resolved, delivery was contested).
   - **In seller's favour**: order completed, payment released to seller and carrier. Buyer notified. Driver notified (dispute rejected, their delivery was validated).
5. Resolution message logged. Dispute history available if it recurs.

**Driver is never involved in the dispute itself** — they just get the outcome notification. The commercial conversation is handled by admin.

---

## Document Map

Every delivery on B3Hub produces a set of documents automatically. Here is what generates when, and what it proves.

| Document                         | When generated                           | What it proves                                             | Legal requirement?                                               |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| **CMR / Kravas pavadzīme**       | Job accepted (DRAFT), signed at delivery | Cargo was transported; sender and recipient confirmed      | Yes — for cross-border; standard for domestic commercial haulage |
| **Weighing slip**                | Driver marks LOADED                      | Actual weight loaded at source                             | Required to invoice correctly; evidence in weight disputes       |
| **Delivery proof**               | Driver marks DELIVERED                   | GPS-stamped time, location, delivery photo, site signature | Platform confirmation; protects driver and supplier              |
| **Invoice (VAT)**                | Order completed                          | Full tax invoice with supplier VAT number                  | Required for B2B tax compliance                                  |
| **Waste transfer note**          | Disposal job completed                   | Waste was legally disposed of at a licensed facility       | Yes — Latvian waste law requires this for all construction waste |
| **Waste processing certificate** | Generated at recycling centre            | Certificate of waste processing/recycling                  | Yes — certificate required as proof of compliant disposal        |
| **Quality certificate**          | Uploaded by supplier before loading      | Material meets grade specification                         | Required for CE-marked construction materials                    |

---

## Platform Roles and What They See

| Role                            | What they use            | Key daily actions                                                                            |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| **Buyer (B2C homeowner)**       | Mobile or web (guest OK) | Order a skip, track delivery, download waste transfer note                                   |
| **Buyer (B2B project manager)** | Web portal               | Create framework contracts, release call-offs, track project spend, review all documents     |
| **Buyer (B2B site foreman)**    | Mobile app               | Place call-off orders, confirm deliveries, report issues                                     |
| **Supplier (quarry operator)**  | Web portal + mobile      | Confirm incoming orders, manage catalog prices and stock, upload quality certs, see earnings |
| **Carrier dispatcher**          | Web portal               | Assign jobs to drivers, monitor fleet on GPS map, handle SLA exceptions                      |
| **Driver**                      | Mobile app only          | Accept jobs, advance status, enter weight, submit delivery proof                             |
| **B3Hub admin**                 | Web portal               | Review applications, resolve disputes, monitor all platform activity                         |

---

## Why the Three-Sided Marketplace is Hard to Replicate

Most software solves one side of this problem:

- Supplier portals let buyers order from one specific supplier — no marketplace, no price comparison.
- Fleet management software tracks trucks but doesn't handle the order, documents, or payment.
- Accounting software handles invoices but only after the delivery has happened.

B3Hub connects all three sides under one transaction model. The value increases with every new supplier, carrier, and buyer because they all benefit from the same network. A new driver on the platform can immediately see orders from all buyers. A new supplier is immediately reachable by all buyers. That is the network effect that makes the marketplace defensible.

---

## Summary: What B3Hub Automates

| Manual today                        | B3Hub                                               |
| ----------------------------------- | --------------------------------------------------- |
| Phone calls to find availability    | Catalog with real-time stock                        |
| Price negotiation per delivery      | Framework contracts, fixed catalog prices           |
| WhatsApp coordination with truckers | Automatic nearest-driver dispatch                   |
| Paper weighing slip                 | Auto-generated PDF, stored permanently              |
| Handwritten CMR / delivery note     | Auto-generated, GPS-signed on delivery              |
| Chasing quality certificates        | Alert to seller the moment driver arrives at pickup |
| Manual invoice 3–5 days later       | Generated at the moment of delivery                 |
| Payment chase                       | Stripe captures automatically on completion         |
| Paper waste certificates            | Auto-generated, stored in the platform              |
| Monthly reconciliation              | Real-time P&L per project                           |
| Dispute with no evidence            | Full document trail + admin mediation               |
| Driver dead runs                    | Return trip suggestions within 75 km, live          |
