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
- Order skip hire / waste containers
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
- Confirm loading when a driver arrives
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

- Browse the job board — open transport jobs
- Self-assign available jobs (pull model, like Uber)
- Navigate to pickup and delivery locations
- Confirm loading at seller's yard
- Confirm delivery with photo + signature
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

Company members additionally carry a `CompanyRole` (`OWNER` | `MANAGER` | `DRIVER` | `MEMBER`) and five `perm*` flags for fine-grained access.

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
Web app → "Become a provider" page (/apply)
  → Fill form:
      - Company name, registration number, tax ID
      - What services: ☐ Sell materials  ☐ Transport
      - Description, fleet size (if transport), materials (if seller)
      - Contact person, phone, email
  → ProviderApplication created with status = PENDING
  → Admin receives notification
  → Admin reviews application in /admin/applications
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

## Platform split — Web vs Mobile

### Core principle

> **Mobile owns real-time field operations. Web owns management, analytics, and administration.**

- The **mobile app** is optimised for on-the-go, single-task, real-time use: buyers ordering from a construction site, drivers navigating and confirming deliveries in the field.
- The **web app** is optimised for management, oversight, and high-volume B2B workflows: dispatchers managing a fleet, sellers administering a product catalog, companies reviewing invoices and documents.
- **Neither platform replicates the other's primary domain.** Field operations (navigation, status progression, delivery proof) are not available on web. High-level management tools (fleet GPS map, dispatcher panel, admin) are not available on mobile.

---

### 🛒 Buyers

| Feature                           |  Web app  | Mobile app |
| --------------------------------- | :-------: | :--------: |
| Register / Log in                 |    ✅     |     ✅     |
| Browse material catalog           |    ✅     |     ✅     |
| Place material delivery order     |    ✅     |     ✅     |
| Place skip hire / container order |    ✅     |     ✅     |
| Place waste disposal booking      |    ✅     |     ✅     |
| Track active delivery (live map)  | read-only |  ✅ live   |
| Order history & detail            |    ✅     |     ✅     |
| Invoices & documents              |    ✅     |     ✅     |
| Compliance certificates           |    ✅     |     ✅     |
| Active containers overview        |    ✅     |     ✅     |
| Projects (grouped orders)         |    ✅     |     ✅     |
| Framework contracts               |    ✅     |     ✅     |
| RFQ / Quote requests              |    ✅     |     ✅     |
| Company & team management         |    ✅     |     ✅     |
| Submit reviews                    |    ✅     |     ✅     |
| Chat (per job thread)             |    ✅     |     ✅     |
| Notifications                     |    ✅     |  ✅ push   |
| Profile & settings                |    ✅     |     ✅     |

**Primary platform:** Both — mobile for on-site ordering and tracking, web for B2B companies managing multiple projects, documents, and teams.

---

### 📦 Sellers (`canSell: true`)

| Feature                                  |  Web app   |   Mobile app   |
| ---------------------------------------- | :--------: | :------------: |
| Manage product catalog (add/edit/delete) | ✅ primary | ✅ lightweight |
| View incoming orders                     |     ✅     |       ✅       |
| Confirm / reject incoming orders         |     ✅     |       ✅       |
| Manage RFQ / quote requests              |     ✅     |       ✅       |
| Earnings & revenue analytics             |     ✅     |       ✅       |
| Reviews received                         |     ✅     |       ❌       |
| Documents & delivery notes               |     ✅     |       ❌       |
| Chat                                     |     ✅     |       ❌       |
| Notifications                            |     ✅     |    ✅ push     |
| Profile & settings                       |     ✅     |       ✅       |

**Primary platform:** **Web** — catalog management and order intake require a proper desktop surface. Mobile provides quick incoming-order notifications and lightweight confirmations on the go.

---

### 🚛 Carrier dispatchers (`canTransport: true`, role: OWNER / MANAGER)

Dispatchers manage the fleet from the office.

| Feature                                      | Web app | Mobile app |
| -------------------------------------------- | :-----: | :--------: |
| Job board — view available jobs              |   ✅    |     ❌     |
| Dispatch: assign job to driver + vehicle     |   ✅    |     ❌     |
| Fleet GPS live map (track all active trucks) |   ✅    |     ❌     |
| Fleet / garage management (vehicles)         |   ✅    |     ❌     |
| Driver schedule management                   |   ✅    |     ❌     |
| Carrier settings & preferences               |   ✅    |     ❌     |
| SLA exception monitoring & resolution        |   ✅    |     ❌     |
| Transport job history                        |   ✅    |     ❌     |
| Earnings & payout analytics                  |   ✅    |     ❌     |
| Notifications                                |   ✅    |     ❌     |

**Primary platform:** **Web only.** Dispatchers do not use the mobile app for management.

---

### 🧑‍✈️ Drivers (`canTransport: true`, role: DRIVER / owner-operator)

Drivers work in the field.

| Feature                                        |   Web app    | Mobile app |
| ---------------------------------------------- | :----------: | :--------: |
| Job board — self-accept jobs (owner-operators) |      ✅      | ✅ primary |
| Accept active job → navigate to pickup         |      ❌      |     ✅     |
| Advance job status (step-by-step progression)  |      ❌      |     ✅     |
| Confirm loading at seller yard                 |      ❌      |     ✅     |
| In-transit navigation                          |      ❌      |     ✅     |
| Confirm delivery (photo + signature)           |      ❌      |     ✅     |
| Report exceptions / incidents                  |      ❌      |     ✅     |
| Skip hire pickups & drops                      |      ❌      |     ✅     |
| Job history & completed routes                 | ✅ read-only |     ✅     |
| Earnings                                       |      ✅      |     ✅     |
| Vehicle management                             |      ✅      |     ✅     |
| Schedule                                       |      ✅      |     ✅     |
| Profile & settings                             |      ✅      |     ✅     |

**Primary platform:** **Mobile** for all active-job work. Web provides read-only history and management for owner-operators and company drivers who also access the dispatcher tools.

> **Architectural rule:** Status progression, delivery proof submission, navigation, and exception reporting are **mobile-only**. The web never surfaces these controls — the driver's phone is the authoritative field device.

---

### 🔧 Admin (`userType: ADMIN`)

| Feature                                | Web app | Mobile app |
| -------------------------------------- | :-----: | :--------: |
| Overview statistics                    |   ✅    |     ❌     |
| Review & approve provider applications |   ✅    |     ❌     |
| User management (create, edit, flags)  |   ✅    |     ❌     |
| All orders & transport jobs            |   ✅    |     ❌     |
| Platform settings                      |   ✅    |     ❌     |

**Primary platform:** **Web only.**

---

## Mode switcher

Users with only one capability see no switcher — just their role's UI.  
Users with multiple capabilities (e.g. a company that both buys and transports) see a **mode switcher** in the topbar (web) or at the top of the app (mobile):

```
[ 🛒 Buyer ] [ 🚛 Carrier ]   ← pill switcher shown only when user has multiple roles
```

Switching mode changes the entire navigation and visible features.

---

## Web app — navigation structure

### Buyer sidebar

```
Dashboard
Browse Materials
My Orders
Skip Hire
Containers
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

### Carrier sidebar (`canTransport: true`)

```
Dashboard
Job Board (available jobs, dispatch)
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

## Mobile app — screen structure

### Buyer tabs

```
[ 🏠 Home ] [ 📦 Order ] [ 📋 My Orders ] [ 👤 Profile ]
```

**Home** — stats, quick-action tiles (delivery, skip, disposal, freight)  
**Order** — place new order (material delivery / skip hire / waste disposal / freight)  
**My Orders** — list + detail for all orders, live tracking per job  
**Profile** — account, company, team, documents, notifications, settings

### Driver tabs

```
[ 📋 Jobs ] [ 🗺️ Active ] [ 💰 Earnings ] [ 👤 Profile ]
```

**Jobs** — job board: available transport jobs, filter by vehicle type / distance, self-accept  
**Active** — current job: full status progression, navigation CTAs, loading/delivery confirmation, exception reporting  
**Earnings** — completed jobs, daily/weekly summary, payout status  
**Profile** — vehicle, schedule, documents, settings

### Seller tabs

```
[ 🏠 Home ] [ 📦 Catalog ] [ 📋 Incoming ] [ 👤 Profile ]
```

**Home** — sales overview  
**Catalog** — product listings  
**Incoming** — orders to confirm/reject  
**Profile** — earnings, quotes, settings

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

4. DRIVER self-accepts job (mobile) OR dispatcher assigns (web)
   └─ TransportJob status: ASSIGNED → ACCEPTED

5. DRIVER navigates to seller's loading point   [mobile only]
   └─ Status: EN_ROUTE_PICKUP → AT_PICKUP

6. DRIVER confirms loading complete             [mobile only]
   └─ Status: LOADED

7. DRIVER navigates to delivery address         [mobile only]
   └─ Status: EN_ROUTE_DELIVERY → AT_DELIVERY

8. DRIVER confirms delivery (photo + signature) [mobile only]
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
- **CompanyMember** — links users to companies with roles and permission flags
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

### Communication models

- **Message** — per-job chat thread (WebSocket)
- **Notification** — in-app + push notifications
- **Review** — buyer rating after completed order

---

## Tech stack

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| Backend API      | NestJS (Node.js)             |
| Database         | PostgreSQL via Prisma ORM    |
| Authentication   | Supabase Auth (JWT)          |
| File storage     | Supabase Storage             |
| Mobile app       | React Native + Expo Router   |
| Web app          | Next.js 15 (App Router)      |
| Styling (web)    | Tailwind CSS + shadcn/ui     |
| Styling (mobile) | NativeWind (Tailwind for RN) |
| Real-time        | WebSockets (NestJS Gateway)  |
| Email            | Resend                       |
| Monorepo         | npm workspaces               |

### API base URL

- Development: `http://localhost:3000/api/v1`
- Mobile reads from: `EXPO_PUBLIC_API_URL` env variable
- Web reads from: `NEXT_PUBLIC_API_URL` env variable

---

## What's built

All major features are implemented end-to-end. See [STATUS.md](STATUS.md) for the complete feature matrix.

### ✅ Fully operational

- Auth (register, login, password reset, provider application + approval)
- Material catalog (seller CRUD, buyer browse)
- Orders (create, list, detail, status timeline, seller confirm/reject)
- Skip hire ordering (4-step wizard, container management)
- Waste disposal booking
- Transport jobs (job board, driver active flow, GPS tracking, delivery proof)
- Skip driver flow (pickup/drop management)
- Documents (auto-generated, downloadable)
- Invoices (auto-generated from completed orders)
- Chat (per-job WebSocket threads)
- Notifications (in-app + push via Expo)
- Reviews (post-delivery rating)
- Carrier dispatch (web: fleet map, job assignment, SLA monitoring)
- Framework contracts + call-offs
- Quote requests (RFQ)
- Projects (grouped order management)
- Certificates
- Earnings analytics (seller + carrier)
- Company & team management
- Admin panel (applications, users, overview)
- Email notifications (Resend)

### 🔲 Planned

- Stripe payment integration
- Mixed-supplier cart splitting (multi-supplier orders in one checkout)

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
