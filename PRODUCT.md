# B3Hub — Product Architecture

## What we're building

B3Hub is a **construction logistics marketplace** connecting three sides of the construction supply chain:

1. **Buyers** — contractors, construction companies, private homeowners who need materials delivered or waste removed
2. **Sellers** — quarries, material suppliers who have gravel, sand, concrete, soil to sell
3. **Transport providers** — trucking companies and independent drivers who move materials and collect waste

The platform handles the full order lifecycle: buyer places order → seller confirms loading → driver picks up and delivers → documents generated automatically.

Think **Schüttflix** but for the Latvian/Baltic market.

---

## The three sides explained

### 🛒 Demand side — Buyers

Anyone who needs construction materials delivered or waste removed.

**Who they are:**

- Construction companies ordering 50t of gravel
- Contractors ordering a skip container for a renovation site
- Private homeowners ordering a skip bin for garden waste

**What they do:**

- Browse material catalog and place orders
- Order skip hire / waste containers (4-step wizard)
- Track their deliveries in real time
- Download invoices and delivery documents

**How they register:** Self-serve via mobile app or web. Phone number OR email. **Immediately active.** No approval needed.

---

### 📦 Supply side — Sellers

Companies that have materials to sell.

**Who they are:**

- Quarries selling gravel, crushed stone, sand
- Concrete plants
- Soil and recycled material suppliers

**What they do:**

- List materials with prices, availability, location
- Receive incoming orders from buyers
- Confirm loading when a driver arrives (BeladeFLIX-style screen)
- Manage their product catalog
- View revenue analytics

**How they register:** Submit an application form on the web app. **Manual approval by B3Hub team.** Cannot self-register as a seller.

---

### 🚛 Transport side — Carriers & Drivers

Companies and individuals who move materials between seller and buyer.

**Who they are:**

- Trucking companies with fleets of dump trucks, hook lifts, etc.
- Independent owner-operators
- Individual drivers employed by transport companies

**What they do:**

- Browse the job board (Auftragsbörse) — open transport jobs
- Self-assign available jobs (pull model, like Uber)
- Navigate to pickup location
- Confirm loading at seller's yard
- Navigate to delivery location
- Confirm delivery (photo + signature)
- Track earnings

**How they register:** Submit an application form on the web app. **Manual approval by B3Hub team.** Cannot self-register as a carrier.

---

### 🔧 Platform side — Admin (B3Hub team)

The internal team operating the platform.

**What they do:**

- Review and approve/reject provider applications
- Manually create accounts for known companies
- Toggle `canSell` / `canTransport` flags on any user
- Suspend or deactivate accounts
- See all data across all companies
- Manage platform settings

**How they get access:** Created manually in the database. Never shown as an option in any registration form.

---

## Account model

Every user has a **single account** with capability flags:

```
User {
  userType: BUYER | ADMIN        ← everyone is a BUYER unless they're platform staff
  isCompany: boolean             ← company account (VAT invoices) or personal (receipts)
  canSell: boolean               ← approved to sell materials
  canTransport: boolean          ← approved to offer transport
}
```

### Capability combinations

| Account type                          | userType | canSell  | canTransport |
| ------------------------------------- | -------- | -------- | ------------ |
| Private person ordering a skip        | BUYER    | false    | false        |
| Construction company buying materials | BUYER    | false    | false        |
| Material supplier                     | BUYER    | **true** | false        |
| Transport company                     | BUYER    | false    | **true**     |
| Full-service company (all three)      | BUYER    | **true** | **true**     |
| B3Hub platform staff                  | ADMIN    | —        | —            |

---

## Registration flows

### Flow 1 — Demand side (self-serve)

```
Mobile app or web
  → Enter name + phone/email + password
  → Choose: Personal or Company account (isCompany flag)
  → Account created, status = ACTIVE
  → Redirected to buyer dashboard
```

### Flow 2 — Supply side (manual approval)

```
Web app → "Become a provider" page
  → Fill form:
      - Company name, registration number, tax ID
      - What services: ☐ Sell materials  ☐ Transport
      - Description, fleet size (if transport), materials (if seller)
      - Contact person, phone, email
  → ProviderApplication created with status = PENDING
  → Admin receives notification
  → Admin reviews application in admin panel
  → Admin clicks Approve:
      - If user already has a BUYER account → canSell/canTransport flags set
      - If new user → account created, credentials sent by email
  → Provider receives email: "Your account is ready"
```

### Flow 3 — Admin creates account manually

```
Admin panel
  → Create user form
  → Set any flags directly
  → Send invitation email
```

---

## Mobile app

### Who uses it

- **Buyers** — placing orders, tracking deliveries (primary use case)
- **Drivers** — job board, navigation, delivery confirmation (critical daily tool)
- Sellers mostly use the web app, not mobile

### Mode switcher

Users with only one capability see no switcher — just their tabs.  
Users with multiple capabilities (e.g. a company that both buys and transports) see a **mode switcher** at the top of the app.

```
[ 🛒 Buyer ] [ 🚛 Driver ]   ← pill switcher (only shown if user has both)
```

Switching mode changes the entire tab bar and all screens.

### Buyer mode tabs

```
[ 🏠 Home ] [ 📦 Order ] [ 📋 My Orders ] [ 👤 Profile ]
```

**Home** — overview stats, quick actions  
**Order** — place new order (4 order types: Delivery, Collection/Skip, Freight, Project)  
**My Orders** — track all active and past orders  
**Profile** — account settings, documents

### Driver mode tabs

```
[ 📋 Jobs ] [ 🗺️ Active ] [ 💰 Earnings ] [ 👤 Profile ]
```

**Jobs** — job board: browse available transport jobs, filter by vehicle type/distance  
**Active** — current job details: pickup address, delivery address, route, status progression  
**Earnings** — completed jobs, payment status, total earnings  
**Profile** — driver profile, vehicle, documents

### Job card (driver job board)

Inspired by Schüttflix Auftragsbörse:

```
┌─────────────────────────────────────┐
│ #JOB-001  🚛 26t Dump Truck  €169  │
│ Gravel 0/45mm — 26 tonnes           │
│                                     │
│ 📍 From: Quarry Meier, Riga         │
│ 📍 To:   Construction Site, Jūrmala │
│                                     │
│ 📅 29.04 – 29.04                    │
│                                     │
│ [View Details]  [Accept Job →]      │
└─────────────────────────────────────┘
```

### Active job screen (driver)

```
Status bar: Accepted → At Pickup → Loading → En Route → At Delivery → Done

Current status: Loading
┌─────────────────────────────────────┐
│ Order #005287-001           381 €   │
│ Standard order   ● In Loading       │
│                                     │
│ Service date: 28.04 at 16:00        │
│ Product: 26t Kalkschotter 0-45mm   │
│ Loading point: Werk 2               │
│ Carrier: Company Name               │
│ Vehicle: WAF JK 123 / Sattelkipper  │
│                                     │
│ [Confirm Loading Complete →]        │
└─────────────────────────────────────┘
```

---

## Web app

### Buyer web dashboard

Same capabilities as mobile buyer, better suited for companies managing multiple orders.

```
Sidebar: Dashboard | Browse Materials | Order Container | My Orders | Tracking | Documents
```

### Seller web dashboard (canSell: true)

```
Sidebar: Dashboard | My Products | Add Product | Incoming Orders | Analytics | Documents
```

**Mode switcher** in sidebar header for multi-role accounts.

### Transport web dashboard (canTransport: true)

```
Sidebar: Dashboard | Available Jobs | My Jobs | Route | Earnings | Documents
```

### Admin panel (userType: ADMIN)

```
Sidebar: Overview | Applications | Users | Orders | Materials | Transport Jobs | Settings
```

Key admin screens:

- **Applications** — pending provider applications with approve/reject actions
- **Users** — full user management, toggle flags
- **Overview** — platform-wide stats

---

## Order flow (end to end)

```
1. BUYER places order
   └─ Material order OR Skip hire order created
   └─ Status: PENDING

2. SELLER sees incoming order (if material order)
   └─ Confirms order
   └─ Status: CONFIRMED

3. System creates TransportJob (status: AVAILABLE)
   └─ Appears on driver job board

4. DRIVER accepts job
   └─ TransportJob status: ASSIGNED → ACCEPTED

5. DRIVER navigates to seller's loading point
   └─ Status: EN_ROUTE_PICKUP → AT_PICKUP

6. SELLER confirms driver arrived (BeladeFLIX screen)
   └─ DRIVER confirms loading complete
   └─ Status: LOADED

7. DRIVER navigates to delivery address
   └─ Status: EN_ROUTE_DELIVERY → AT_DELIVERY

8. DRIVER confirms delivery (photo + optional signature)
   └─ Status: DELIVERED

9. System generates documents automatically
   └─ Delivery note, weighing slip, invoice
   └─ All parties can download from Documents section

10. Payment processed
    └─ Order status: COMPLETED
```

---

## Data model overview

### Core models

- **User** — account with capability flags
- **Company** — business profile linked to users
- **ProviderApplication** — pending supplier/carrier applications

### Order models

- **Order** — material purchase order
- **OrderItem** — individual materials within an order
- **SkipHireOrder** — standalone skip/container rental (simpler flow)
- **TransportJob** — delivery job created from an order

### Supply models

- **Material** — product listing by a seller
- **Container** — physical skip/container units
- **Vehicle** — truck registered by a transport company

### Document models

- **Document** — invoices, delivery notes, weighing slips, CMR notes
- **Invoice** — financial invoice linked to order
- **DeliveryProof** — photo + signature from driver

---

## Tech stack

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| Backend API      | NestJS (Node.js)             |
| Database         | PostgreSQL via Prisma ORM    |
| Authentication   | JWT (access token)           |
| Mobile app       | React Native + Expo Router   |
| Web app          | Next.js 15 (App Router)      |
| Styling (web)    | Tailwind CSS + shadcn/ui     |
| Styling (mobile) | NativeWind (Tailwind for RN) |
| Monorepo         | npm workspaces               |

### API base URL

- Development: `http://localhost:3000/api/v1`
- Mobile reads from: `EXPO_PUBLIC_API_URL` env variable

---

## What's built vs what's planned

### ✅ Built

- User registration + JWT auth
- Role-based access (`canSell`, `canTransport` flags — schema done)
- Skip hire 4-step wizard (mobile + backend)
- Material catalog API
- Order management API with ownership checks
- Dashboard stats endpoint
- Document management API
- Web dashboard with role-specific UI
- Mobile buyer home + order screens

### 🔲 Next to build

- Provider application form (web) + approval flow (admin)
- Mode switcher (mobile + web)
- Driver job board (mobile)
- Active job tracking screen (mobile)
- Seller loading confirmation screen (BeladeFLIX equivalent)
- Admin panel
- Real-time job updates (WebSocket or polling)
- Document auto-generation
- Push notifications (driver gets notified of new matching jobs)
