# B3 Group — Business Plan

---

## 1. What B3 Group Is

B3 Group is a construction logistics business operating in Latvia and the Baltic region. It runs three interconnected units under one platform:

| Unit                       | What it is                               | Role in the group                                                                                        |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Bilt**                  | Digital marketplace platform             | Connects buyers, suppliers, and carriers for bulk material orders and waste disposal bookings            |
| **B3 Recycling (Gulbene)** | Licensed recycling and disposal facility | Accepts construction waste, processes it into certified secondary raw materials, sells it back to market |
| **B3 Construction**        | Groundworks subcontracting company       | Generates its own material orders and waste disposal needs; feeds the platform as a first-party buyer    |

The business is modelled on the **Schüttflix Group** in Germany — the closest proven template in the world for this exact combination of digital platform + licensed recycling operations in construction logistics.

---

## 2. How the Business Circle Operates

The three units are not separate businesses that happen to share a dashboard. They form a **closed loop** where value flows continuously between them:

```
Buyer (construction company, homeowner, B3 Construction itself)
       │
       │  1. Places order on Bilt app
       │     (gravel, sand, soil, concrete — or skip hire)
       ▼
   Bilt Platform
       │
       │  2. Matches order to nearest approved supplier
       │     + assigns carrier / driver
       ▼
  Supplier ──► Carrier / Driver
       │
       │  3. Full truck delivers material to construction site
       ▼
 Construction Site
       │
       │  4. Site generates waste:
       │     excavated soil, demolition concrete, rubble, asphalt
       │
       │  5. Buyer books waste disposal via Bilt
       │     (same app, same order flow)
       ▼
   Bilt Platform
       │
       │  6. Same carrier picks up waste on return trip
       │     (empty truck now loaded — doubles the trip value)
       ▼
  B3 Fields / B3 Recycling Gulbene
       │
       │  7. Unlicensed fields: sort and store for transfer
       │     Licensed Gulbene: test, classify, crush/screen,
       │     certify as RC (recycled) material
       ▼
Secondary Raw Material (RC gravel, RC soil, processed concrete)
       │
       │  8. Listed on Bilt as available supply
       ▼
Next Buyer (back to step 1)
```

**The flywheel effect**: more buyers → more deliveries → more waste bookings → more material through Gulbene → more secondary material supply → more competitive pricing on Bilt → more buyers.

Every step creates value for the next. No truck should run empty in either direction.

---

## 3. What Each Unit Does Day-to-Day

### Bilt (the platform)

Bilt is the digital operating layer for the entire group. It is a **neutral marketplace** — it does not favour B3's own suppliers over external ones; it connects all parties and takes a transaction fee.

**What it handles:**

- Buyer places material order (B2C: homeowner ordering a skip; B2B: contractor ordering 200 tonnes of gravel)
- Platform selects the best matching supplier from the network by price, availability, and distance
- Platform assigns a carrier and driver; driver gets job in the mobile app
- Real-time GPS tracking visible to the buyer during delivery
- Digital delivery note generated on completion (no paper)
- Waste disposal booking flow: buyer declares waste type → platform routes to the appropriate licensed facility (B3 Recycling Gulbene for licensable waste, B3 Fields for inert fill)
- Skip hire: platform manages skip fleet booking, delivery, collection, and disposal routing

**Who uses it:**

- Buyers: homeowners, small builders, construction companies, project managers, B3 Construction's own sites
- Suppliers: quarries, aggregate producers, material depots
- Carriers: trucking companies and independent drivers

### B3 Recycling — Gulbene (the licensed facility)

This is the physical hub that closes the circular loop. It is the B3 equivalent of **IK Umwelt** in the Schüttflix Group.

**What it does:**

- Accepts incoming construction waste booked through Bilt — excavated soil, demolition concrete, rubble, bricks, asphalt
- Tests and classifies waste: determines if material meets standards for recycling or must go to licensed landfill
- Processes recyclable material: crushing, screening, grading → produces certified secondary raw materials (RC gravel, RC fill, processed soil)
- Issues certification documents for each batch of output material (required by Latvian construction regulations for RC material to be used on public works)
- Sells processed secondary materials back to the market, listed on Bilt alongside primary quarry products
- Accepts walk-in drop-off from private customers and small builders (B2C waste disposal)

**Why the licence matters:**
Without the licence, B3 could only accept inert fill that requires no treatment. The Gulbene licence enables B3 to accept a much wider range of waste types, charge gate fees for disposal, and produce certified RC material that commands a market price. It is the asset that makes the circular economy model work.

### B3 Fields (standard sites)

B3 Fields are additional physical locations operated by the group. They do not hold a recycling licence.

**What they do:**

- Accept inert construction fill (clean excavated soil, stone) that does not require licensed treatment
- Store and sort material for onward transfer to Gulbene or for direct reuse as fill on projects
- Serve as local drop-off and pickup points for carriers, reducing empty return distances
- Operate as material staging areas for large nearby projects

**Modelled as:** `RecyclingCenter` in the platform with `licensed: false` — same booking flow, different processing capability.

### B3 Construction (the groundworks company)

B3 Construction is a subcontracting business doing groundworks, drainage, and earthworks across Latvia.

**Its role in the group:**

- Generates predictable, continuous demand for bulk materials (gravel, sand, hardcore) — feeds Bilt order volume
- Generates predictable, continuous construction waste (excavated soil, concrete) — feeds B3 Recycling Gulbene's intake
- Provides a real-world test case for every feature built into Bilt (internal dogfooding)
- Can be showcased to prospective B2B customers as proof that the platform works at scale

B3 Construction is not the growth driver — Bilt is. But it is a first-party anchor customer that ensures baseline utilisation of both the platform and the Gulbene facility.

---

## 4. Revenue Streams

| Stream                   | Source               | Model                                                |
| ------------------------ | -------------------- | ---------------------------------------------------- |
| Platform commission      | Bilt                | % of each completed material order                   |
| Transport brokerage      | Bilt                | Fee per transport job matched to a carrier           |
| Disposal booking fee     | Bilt                | Fee per waste disposal job routed to a facility      |
| Skip hire revenue        | Bilt                | Day rate for skip + collection + disposal handling   |
| Gate fees (waste intake) | B3 Recycling Gulbene | Fee per tonne of waste accepted                      |
| Secondary material sales | B3 Recycling Gulbene | Market price per tonne of certified RC material sold |
| B2C walk-in disposal     | B3 Recycling Gulbene | Fixed fee for private customers dropping off waste   |
| Construction contracts   | B3 Construction      | Subcontract project revenue                          |

The highest-margin streams are gate fees and secondary material sales at Gulbene — once the processing infrastructure is paid for, margin per tonne is high. The platform commission streams scale with volume at near-zero marginal cost.

---

## 5. The Schüttflix Comparison

Schüttflix is the German company that proved this exact model at scale. Formed in 2019 as a platform, it merged with IK Umwelt (licensed recycler, NRW) in mid-2024 to form the **Schüttflix Group**. By 2024 it generated €190 million in revenue with >50% annual growth, 1.4 million+ transports, and operations across Germany, Austria, Poland, and Czech Republic.

| Schüttflix Group                           | B3 Group equivalent                             |
| ------------------------------------------ | ----------------------------------------------- |
| Schüttflix digital platform                | Bilt marketplace                               |
| IK Umwelt (licensed recycler, NRW)         | B3 Recycling — Gulbene (licensed facility)      |
| Hagedorn / other unlicensed disposal sites | B3 Fields                                       |
| Schüttflix Hubs (Wertstoffzentren)         | B3 Recycling Gulbene + expanded B3 Fields       |
| Platform transaction fee                   | Bilt commission                                |
| RC material sales                          | B3 Recycling certified secondary material sales |
| Container hire                             | Bilt skip hire vertical                        |
| ~400–500 group employees at merger         | B3 Group at early growth stage                  |

The key Schüttflix lesson: **they built the platform first, then acquired the physical recycling infrastructure**. B3 Group already has both. That is a structural advantage — B3 does not need to go through the stage of platform-only operation without the circular loop closed. The flywheel can start turning from day one.

---

## 6. What Makes This Defensible

A pure marketplace (platform only) is easy to copy. What is hard to copy is the combination:

1. **Licensed physical infrastructure** — Gulbene's recycling licence took time and regulatory process to obtain. A competitor cannot spin one up overnight.
2. **Data advantage** — the platform knows exactly what waste is being generated, where, and when. That data optimises Gulbene's intake scheduling and secondary material production planning. A new entrant has no data.
3. **Network effects** — more carriers on the platform → faster deliveries → more buyers → more orders → more carriers want to join. Each side of the marketplace makes the other side more valuable.
4. **Full-loop pricing** — because B3 captures revenue at both ends of the trip (material delivery AND waste disposal), it can offer carriers better utilisation and lower per-trip costs than a platform that only handles one direction. That makes Bilt more attractive to carriers than any single-sided competitor.

---

## 7. Growth Path

**Phase 1 — Platform density (now)**
Build order volume in core geography. Get enough suppliers, carriers, and buyers on the platform that wait times and prices are competitive. Use B3 Construction's own projects as anchor volume.

**Phase 2 — Waste loop activation**
Once delivery volume is sufficient, activate waste disposal bookings as a second product layer. Route waste to B3 Recycling Gulbene. Begin producing and selling RC material on the platform.

**Phase 3 — B3 Fields expansion**
Add more field locations in secondary cities to reduce carrier empty-return distances. Each new field increases the catchment area for waste intake and reduces last-mile costs for material delivery.

**Phase 4 — Baltic expansion**
Extend platform to Lithuania and Estonia. The platform scales digitally at low cost; the physical infrastructure (fields and licensed facilities) follows market density.

---

## 8. Platform Operations Audit — What Is Built Today

This section maps the actual current state of the codebase against the business circle described above.

---

### Layer 1 — Data Model (Schema)

The schema fully models the closed-loop business. Every entity needed for the full circle exists:

| Model                  | Purpose                                                                                                                                                                | Status   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `B3Field`              | Physical site — GPS, services (`MATERIAL_PICKUP`, `WASTE_DISPOSAL`, `TRAILER_RENTAL`), opening hours, `recyclingCenterId` (1:1 optional link to a licensed facility)   | ✅ Built |
| `RecyclingCenter`      | Licensed facility — `licensed: boolean`, `acceptedWasteTypes[]`, `capacity`, `apusRegistrationId`, `certifications`                                                    | ✅ Built |
| `WasteRecord`          | Records waste intake at a facility — weight, volume, processedDate, recyclableWeight, recyclingRate, **`producedMaterialId`** (links recycled output back to Material) | ✅ Built |
| `FieldPass`            | QR-code gate pass for trucks entering a B3 Field — tied to a FrameworkContract, has `wasteClassCode`, `vehiclePlate`, `validFrom/To`, `weighingSlips[]`                | ✅ Built |
| `PickupSlot`           | Time-slot booking on a B3 Field for material pickup orders (slots have capacity, booking counter)                                                                      | ✅ Built |
| `B3FieldInventoryItem` | Stock of materials available at a field for buyer pickup (name, unit, qty, price)                                                                                      | ✅ Built |
| `WeighingSlip`         | Weighbridge record created at field gate (netTonnes, slipNumber, linked to FieldPass)                                                                                  | ✅ Built |

**The Gulbene model specifically:**
B3 Recycling Gulbene is modelled as a `RecyclingCenter` record with `licensed: true` and `acceptedWasteTypes[]` populated with the actual licence scope. A `B3Field` record points to it via `recyclingCenterId`. This is the same pattern as Schüttflix's Schüttflix Hubs pointing to IK Umwelt's processing capacity.

---

### Layer 2 — Backend API

| Capability                          | Endpoint                                            | Status  |
| ----------------------------------- | --------------------------------------------------- | ------- |
| List active B3 Fields (public)      | `GET /api/v1/b3-fields`                             | ✅ Live |
| Get field detail + recycling center | `GET /api/v1/b3-fields/:id`                         | ✅ Live |
| Available pickup slots for a date   | `GET /api/v1/b3-fields/:id/slots?date=`             | ✅ Live |
| Today's arrivals (gate view)        | `GET /api/v1/b3-fields/:id/today`                   | ✅ Live |
| QR pass scan (gate validation)      | `POST /api/v1/b3-fields/:id/passes/scan`            | ✅ Live |
| Field inventory (public)            | `GET /api/v1/b3-fields/:id/inventory/public`        | ✅ Live |
| Disposal order creation             | `POST /api/v1/orders/disposal`                      | ✅ Live |
| Admin CRUD for fields               | `POST/PATCH /api/v1/b3-fields`                      | ✅ Live |
| Admin inventory management          | `POST/PATCH/DELETE /api/v1/b3-fields/:id/inventory` | ✅ Live |
| Bulk slot generation                | `POST /api/v1/b3-fields/:id/slots/bulk`             | ✅ Live |
| Auto FieldPass on order confirm     | Internal (triggered by order confirmation)          | ✅ Live |
| Recycling jobs admin                | `GET /api/v1/admin/b3-recycling/jobs`               | ✅ Live |
| Waste records admin                 | `GET /api/v1/admin/b3-recycling/waste-records`      | ✅ Live |

**The disposal → recycling center routing is fully wired:**
When a buyer submits a disposal order, the backend automatically queries `RecyclingCenter` for the nearest active facility that has the declared `wasteType` in its `acceptedWasteTypes[]`. It then creates a `WASTE_COLLECTION` `TransportJob` with the delivery destination set to that center's address. The buyer never needs to know which specific facility — the platform routes it. This is exactly how Schüttflix routes waste jobs to IK Umwelt centers.

---

### Layer 3 — Admin Dashboard (Web)

| Screen                                                      | Path                                      | Status                                               |
| ----------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| B3 Fields list + create                                     | `/dashboard/admin/b3-fields`              | ✅ Built                                             |
| B3 Field detail (Inventory / Pickup Slots / Gate / Cameras) | `/dashboard/admin/b3-fields/[id]`         | ✅ Built                                             |
| B3 Recycling hub overview                                   | `/dashboard/b3-recycling`                 | ✅ Built (banner: inbound jobs UI pending)           |
| Inbound disposal jobs                                       | `/dashboard/b3-recycling/jobs`            | ✅ Built                                             |
| Waste log (waste records by type)                           | `/dashboard/b3-recycling/waste-log`       | ✅ Built                                             |
| Recycling certificates                                      | `/dashboard/b3-recycling/certificates`    | ✅ Built                                             |
| APUS reporting to VVD                                       | `/dashboard/b3-recycling/apus`            | ✅ Built (Latvian environmental authority reporting) |
| Recycling centers (external)                                | `/dashboard/(platform)/recycling-centers` | ✅ Built                                             |

The admin has a **4-tab scope switcher** in the sidebar: **Grupa | APP | Recycle | Būve**. The "Recycle" tab (`/dashboard/b3-recycling`) is the dedicated operational dashboard for Gulbene. The "APP" tab contains the marketplace management (orders, transport jobs, materials, carriers). Fields management is under "APP → B3 Lauki". This matches the business structure.

---

### Layer 4 — Mobile App

| Screen                                     | Path                                           | Status                                 |
| ------------------------------------------ | ---------------------------------------------- | -------------------------------------- |
| Gate operator — field list                 | `(gate)/fields.tsx`                            | ✅ Built                               |
| Gate QR scanner                            | `(shared)/gate-scan.tsx`                       | ✅ Built                               |
| Buyer disposal wizard                      | `(wizards)/disposal/` (3 steps + confirmation) | ✅ Built                               |
| Material order with pickup field selection | `(wizards)/material-order.tsx`                 | ✅ Built (pickup field + slot booking) |
| Recycler incoming jobs + detail            | `(recycler)/incoming.tsx`                      | ✅ Built                               |

The gate app is a separate **EAS build variant** (`gate`) — the same codebase but deployed as a dedicated app for B3 Field operators. Gate staff see today's arrivals, can scan QR passes, and the scan result tells them whether the declared waste type is accepted at that specific field.

---

### Integration Assessment — Is B3 Fields Integrated Like Schüttflix + IK Umwelt?

**Yes, at the infrastructure level. One gap remains at the loop closure.**

| Schüttflix + IK Umwelt                                                                         | Bilt + B3 Fields                                                                                                    | Status                                                                              |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Platform auto-routes disposal orders to nearest IK Umwelt facility that accepts the waste type | `createDisposalOrder` queries `RecyclingCenter` by `acceptedWasteTypes` and auto-assigns destination                 | ✅ Wired                                                                            |
| IK Umwelt gate validates truck passes via platform                                             | `scanPass` validates `FieldPass` against the field's `recyclingCenter.acceptedWasteTypes`                            | ✅ Wired                                                                            |
| IK Umwelt processes waste and produces certified secondary raw material                        | `WasteRecord` has `recyclableWeight`, `recyclingRate`, `producedMaterialId` (FK to Material)                         | ✅ Modelled                                                                         |
| Secondary material listed back on Schüttflix marketplace as available supply                   | `WasteRecord.producedMaterialId` → `Material` → appears on platform                                                  | ⚠️ Schema modelled, but no UI or workflow to create the Material from a WasteRecord |
| Schüttflix shows RC material availability to buyers                                            | Buyers see `isRecycled: true` materials in the catalogue (MaterialCategory has `RECYCLED_CONCRETE`, `RECYCLED_SOIL`) | ✅ Schema ready                                                                     |
| Environmental authority reporting (Germany)                                                    | APUS reporting to VVD (Latvia) — `/dashboard/b3-recycling/apus`                                                      | ✅ UI built                                                                         |

---

### The One Missing Step: Closing the Loop

Everything is built except the action that converts a completed `WasteRecord` into a new `Material` listing on the platform. The schema has `WasteRecord.producedMaterialId` ready — it just needs a UI workflow in the admin dashboard:

```
Admin opens completed WasteRecord in B3 Recycling portal
  → clicks "Create Supply Listing"
  → system pre-fills: category = RECYCLED_CONCRETE (or RECYCLED_SOIL),
    unit = TONNE, stock = recyclableWeight, isRecycled = true,
    supplierId = B3 Recycling company
  → admin confirms price
  → Material record created, immediately visible in marketplace catalogue
```

This one workflow closes the full circle and makes Bilt functionally equivalent to the Schüttflix Group's end-to-end model.

---

_Reference: Schüttflix Group (schuettflix.com), IK Umwelt (ik-umwelt.de), Schüttflix Group press release 21.01.2025_
