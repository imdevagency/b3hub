# B3Hub - Construction Marketplace Platform Architecture

## Overview
B3Hub is a digital marketplace platform connecting construction companies, material suppliers, waste management companies, carriers, and drivers for efficient construction site supply, disposal, and circular economy management.

---

## System Architecture

### Technology Stack
- **Backend**: NestJS (TypeScript)
- **Web Frontend**: Next.js 14+ (App Router)
- **Mobile**: Expo (React Native)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Real-time**: WebSockets/Supabase Realtime
- **Payment**: Stripe (future)

---

## Database Schema

### Core Entities

#### 1. **Users & Authentication**
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  phone         String?
  firstName     String
  lastName      String
  avatar        String?
  userType      UserType // BUYER, SUPPLIER, CARRIER, DRIVER, RECYCLER, ADMIN
  status        UserStatus // ACTIVE, PENDING, SUSPENDED
  emailVerified Boolean  @default(false)
  phoneVerified Boolean  @default(false)
  
  // Relations
  company       Company? @relation(fields: [companyId], references: [id])
  companyId     String?
  
  // User-specific profiles
  driverProfile   DriverProfile?
  buyerProfile    BuyerProfile?
  
  // Activity
  orders        Order[]
  transportJobs TransportJob[]
  notifications Notification[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum UserType {
  BUYER          // Construction companies
  SUPPLIER       // Material suppliers
  RECYCLER       // Waste management companies
  CARRIER        // Transport companies
  DRIVER         // Individual drivers
  ADMIN          // Platform administrators
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DEACTIVATED
}
```

#### 2. **Companies**
```prisma
model Company {
  id              String      @id @default(cuid())
  name            String
  legalName       String
  registrationNum String?     @unique
  taxId           String?
  companyType     CompanyType
  
  // Contact
  email           String
  phone           String
  website         String?
  
  // Address
  street          String
  city            String
  state           String
  postalCode      String
  country         String     @default("DE")
  
  // Business info
  description     String?
  logo            String?
  verified        Boolean    @default(false)
  rating          Float?
  
  // Relations
  users           User[]
  materials       Material[]
  containers      Container[]
  vehicles        Vehicle[]
  orders          Order[]
  recyclingCenters RecyclingCenter[]
  
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

enum CompanyType {
  CONSTRUCTION    // Construction company
  SUPPLIER        // Material supplier
  RECYCLER        // Waste management
  CARRIER         // Transport company
  HYBRID          // Multiple services
}
```

#### 3. **Materials**
```prisma
model Material {
  id            String         @id @default(cuid())
  name          String
  description   String?
  category      MaterialCategory
  subCategory   String?
  
  // Pricing
  basePrice     Float
  unit          MaterialUnit   // TONNE, M3, PIECE
  currency      String         @default("EUR")
  
  // Stock & Availability
  inStock       Boolean        @default(true)
  minOrder      Float?
  maxOrder      Float?
  
  // Quality
  isRecycled    Boolean        @default(false)
  quality       String?        // Quality grade
  certificates  String[]       // Certification IDs
  
  // Media
  images        String[]
  specifications Json?
  
  // Relations
  supplier      Company        @relation(fields: [supplierId], references: [id])
  supplierId    String
  orderItems    OrderItem[]
  
  active        Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

enum MaterialCategory {
  SAND
  GRAVEL
  STONE
  CONCRETE
  SOIL
  RECYCLED_CONCRETE
  RECYCLED_SOIL
  ASPHALT
  CLAY
  OTHER
}

enum MaterialUnit {
  TONNE
  M3
  PIECE
  LOAD
}
```

#### 4. **Containers**
```prisma
model Container {
  id            String          @id @default(cuid())
  containerType ContainerType
  size          ContainerSize
  volume        Float           // in m3
  maxWeight     Float           // in tonnes
  
  // Pricing
  rentalPrice   Float           // per day
  deliveryFee   Float
  pickupFee     Float
  currency      String          @default("EUR")
  
  // Availability
  status        ContainerStatus
  location      String?         // Current location
  
  // Relations
  owner         Company         @relation(fields: [ownerId], references: [id])
  ownerId       String
  containerOrders ContainerOrder[]
  
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}

enum ContainerType {
  SKIP          // Open top container
  ROLL_OFF      // Roll-off dumpster
  COMPACTOR     // Compactor container
  ENCLOSED      // Enclosed container
}

enum ContainerSize {
  SMALL_3M3
  MEDIUM_5M3
  LARGE_7M3
  XLARGE_10M3
  XXLARGE_15M3
  XXXLARGE_20M3
}

enum ContainerStatus {
  AVAILABLE
  RENTED
  IN_TRANSIT
  MAINTENANCE
  RETIRED
}
```

#### 5. **Orders**
```prisma
model Order {
  id              String        @id @default(cuid())
  orderNumber     String        @unique
  orderType       OrderType
  
  // Customer info
  buyer           Company       @relation(fields: [buyerId], references: [id])
  buyerId         String
  createdBy       User          @relation(fields: [createdById], references: [id])
  createdById     String
  
  // Delivery details
  deliveryAddress String
  deliveryCity    String
  deliveryState   String
  deliveryPostal  String
  deliveryDate    DateTime?
  deliveryWindow  String?       // e.g., "8:00-12:00"
  
  // Pricing
  subtotal        Float
  tax             Float
  deliveryFee     Float
  total           Float
  currency        String        @default("EUR")
  
  // Status
  status          OrderStatus
  paymentStatus   PaymentStatus
  
  // Special instructions
  notes           String?
  internalNotes   String?
  
  // Relations
  items           OrderItem[]
  containerOrders ContainerOrder[]
  transportJobs   TransportJob[]
  invoices        Invoice[]
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum OrderType {
  MATERIAL        // Material purchase
  CONTAINER       // Container rental
  DISPOSAL        // Waste disposal
  TRANSPORT       // Transport only
  COMBINED        // Multiple services
}

enum OrderStatus {
  DRAFT
  PENDING
  CONFIRMED
  IN_PROGRESS
  DELIVERED
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  PARTIALLY_PAID
  REFUNDED
  FAILED
}

model OrderItem {
  id          String   @id @default(cuid())
  
  order       Order    @relation(fields: [orderId], references: [id])
  orderId     String
  
  material    Material @relation(fields: [materialId], references: [id])
  materialId  String
  
  quantity    Float
  unit        MaterialUnit
  unitPrice   Float
  total       Float
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### 6. **Container Orders**
```prisma
model ContainerOrder {
  id              String          @id @default(cuid())
  
  order           Order           @relation(fields: [orderId], references: [id])
  orderId         String
  
  container       Container       @relation(fields: [containerId], references: [id])
  containerId     String
  
  // Rental period
  startDate       DateTime
  endDate         DateTime?
  actualEndDate   DateTime?
  
  // Purpose
  purpose         WastePurpose
  wasteType       WasteType?
  estimatedWeight Float?
  actualWeight    Float?
  
  // Pricing
  rentalDays      Int
  dailyRate       Float
  deliveryFee     Float
  pickupFee       Float
  disposalFee     Float?
  total           Float
  
  // Status
  status          ContainerOrderStatus
  
  // Delivery & Pickup
  deliveryJob     TransportJob?   @relation("ContainerDelivery", fields: [deliveryJobId], references: [id])
  deliveryJobId   String?
  pickupJob       TransportJob?   @relation("ContainerPickup", fields: [pickupJobId], references: [id])
  pickupJobId     String?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

enum WastePurpose {
  CONSTRUCTION_WASTE
  DEMOLITION_WASTE
  EXCAVATION_SOIL
  MIXED_WASTE
  RECYCLABLE_MATERIALS
  HAZARDOUS_WASTE
  GREEN_WASTE
  OTHER
}

enum WasteType {
  CONCRETE
  BRICK
  WOOD
  METAL
  PLASTIC
  SOIL
  MIXED
  HAZARDOUS
}

enum ContainerOrderStatus {
  SCHEDULED
  DELIVERED
  IN_USE
  PICKED_UP
  COMPLETED
  CANCELLED
}
```

#### 7. **Transport & Logistics**
```prisma
model TransportJob {
  id              String            @id @default(cuid())
  jobNumber       String            @unique
  
  // Job details
  order           Order?            @relation(fields: [orderId], references: [id])
  orderId         String?
  
  jobType         TransportJobType
  
  // Pickup
  pickupAddress   String
  pickupCity      String
  pickupState     String
  pickupPostal    String
  pickupDate      DateTime
  pickupWindow    String?
  
  // Delivery
  deliveryAddress String
  deliveryCity    String
  deliveryState   String
  deliveryPostal  String
  deliveryDate    DateTime
  deliveryWindow  String?
  
  // Cargo
  cargoType       String
  cargoWeight     Float?
  cargoVolume     Float?
  specialRequirements String?
  
  // Pricing
  rate            Float
  currency        String            @default("EUR")
  
  // Assignment
  carrier         Company?          @relation(fields: [carrierId], references: [id])
  carrierId       String?
  driver          User?             @relation(fields: [driverId], references: [id])
  driverId        String?
  vehicle         Vehicle?          @relation(fields: [vehicleId], references: [id])
  vehicleId       String?
  
  // Status
  status          TransportJobStatus
  
  // Tracking
  currentLocation Json?
  estimatedArrival DateTime?
  
  // Proof of delivery
  deliveryProof   DeliveryProof?
  
  // Relations
  containerDeliveries ContainerOrder[] @relation("ContainerDelivery")
  containerPickups    ContainerOrder[] @relation("ContainerPickup")
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}

enum TransportJobType {
  MATERIAL_DELIVERY
  CONTAINER_DELIVERY
  CONTAINER_PICKUP
  WASTE_COLLECTION
  EQUIPMENT_TRANSPORT
}

enum TransportJobStatus {
  AVAILABLE       // Available for assignment
  ASSIGNED        // Assigned to carrier
  ACCEPTED        // Accepted by driver
  EN_ROUTE_PICKUP // On the way to pickup
  AT_PICKUP       // At pickup location
  LOADED          // Cargo loaded
  EN_ROUTE_DELIVERY // On the way to delivery
  AT_DELIVERY     // At delivery location
  DELIVERED       // Completed
  CANCELLED       // Cancelled
}

model DeliveryProof {
  id              String       @id @default(cuid())
  
  transportJob    TransportJob @relation(fields: [transportJobId], references: [id])
  transportJobId  String       @unique
  
  // Signatures
  recipientName   String
  recipientSignature String    // Base64 or URL
  driverSignature String       // Base64 or URL
  
  // Photos
  photos          String[]     // URLs
  
  // Timestamps
  deliveredAt     DateTime
  
  // Notes
  notes           String?
  
  createdAt       DateTime     @default(now())
}
```

#### 8. **Vehicles & Fleet**
```prisma
model Vehicle {
  id              String        @id @default(cuid())
  
  // Vehicle details
  make            String
  model           String
  year            Int
  licensePlate    String        @unique
  vin             String?
  
  // Type & Capacity
  vehicleType     VehicleType
  capacity        Float         // in tonnes
  volumeCapacity  Float?        // in m3
  
  // Owner
  company         Company       @relation(fields: [companyId], references: [id])
  companyId       String
  
  // Status
  status          VehicleStatus
  currentLocation Json?
  
  // Insurance & Compliance
  insuranceExpiry DateTime?
  inspectionExpiry DateTime?
  
  // Relations
  transportJobs   TransportJob[]
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum VehicleType {
  DUMP_TRUCK
  FLATBED_TRUCK
  SEMI_TRAILER
  HOOK_LIFT
  SKIP_LOADER
  TANKER
  VAN
}

enum VehicleStatus {
  ACTIVE
  IN_USE
  MAINTENANCE
  INACTIVE
}
```

#### 9. **Recycling & Circular Economy**
```prisma
model RecyclingCenter {
  id              String        @id @default(cuid())
  name            String
  
  // Location
  address         String
  city            String
  state           String
  postalCode      String
  coordinates     Json?         // {lat, lng}
  
  // Owner
  company         Company       @relation(fields: [companyId], references: [id])
  companyId       String
  
  // Capabilities
  acceptedWasteTypes WasteType[]
  capacity        Float         // tonnes per day
  certifications  String[]
  
  // Operating hours
  operatingHours  Json          // {monday: {open, close}, ...}
  
  // Status
  active          Boolean       @default(true)
  
  // Relations
  wasteRecords    WasteRecord[]
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model WasteRecord {
  id              String          @id @default(cuid())
  
  // Source
  containerOrder  ContainerOrder? @relation(fields: [containerOrderId], references: [id])
  containerOrderId String?
  
  // Recycling center
  recyclingCenter RecyclingCenter @relation(fields: [recyclingCenterId], references: [id])
  recyclingCenterId String
  
  // Waste details
  wasteType       WasteType
  weight          Float
  volume          Float?
  
  // Processing
  processedDate   DateTime?
  recyclableWeight Float?
  recyclingRate   Float?        // percentage
  
  // Output
  producedMaterialId String?    // If converted to recycled material
  
  // Compliance
  certificateUrl  String?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```

#### 10. **Driver Profiles**
```prisma
model DriverProfile {
  id              String   @id @default(cuid())
  
  user            User     @relation(fields: [userId], references: [id])
  userId          String   @unique
  
  // License info
  licenseNumber   String   @unique
  licenseType     String[] // ["B", "C", "CE"]
  licenseExpiry   DateTime
  
  // Certifications
  certifications  String[]
  
  // Performance
  rating          Float?
  completedJobs   Int      @default(0)
  
  // Status
  available       Boolean  @default(true)
  currentLocation Json?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### 11. **Buyer Profiles**
```prisma
model BuyerProfile {
  id              String   @id @default(cuid())
  
  user            User     @relation(fields: [userId], references: [id])
  userId          String   @unique
  
  // Preferences
  preferredSuppliers String[]
  preferredCarriers  String[]
  
  // Credit
  creditLimit     Float?
  creditUsed      Float    @default(0)
  paymentTerms    String?  // e.g., "NET30"
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### 12. **Notifications**
```prisma
model Notification {
  id          String           @id @default(cuid())
  
  user        User             @relation(fields: [userId], references: [id])
  userId      String
  
  type        NotificationType
  title       String
  message     String
  data        Json?            // Additional data
  
  read        Boolean          @default(false)
  readAt      DateTime?
  
  createdAt   DateTime         @default(now())
}

enum NotificationType {
  ORDER_CREATED
  ORDER_CONFIRMED
  ORDER_DELIVERED
  TRANSPORT_ASSIGNED
  TRANSPORT_STARTED
  TRANSPORT_COMPLETED
  PAYMENT_RECEIVED
  SYSTEM_ALERT
}
```

#### 13. **Invoices**
```prisma
model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique
  
  order         Order         @relation(fields: [orderId], references: [id])
  orderId       String
  
  // Amounts
  subtotal      Float
  tax           Float
  total         Float
  currency      String        @default("EUR")
  
  // Payment
  dueDate       DateTime
  paidDate      DateTime?
  paymentStatus PaymentStatus
  
  // Documents
  pdfUrl        String?
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

---

## Backend Architecture (NestJS)

### Module Structure

```
src/
├── app.module.ts
├── main.ts
├── common/                    # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/                    # Configuration
│   ├── database.config.ts
│   └── app.config.ts
├── auth/                      # Authentication & Authorization
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   └── guards/
│       ├── jwt-auth.guard.ts
│       └── roles.guard.ts
├── users/                     # User management
│   ├── users.module.ts
│   ├── users.service.ts
│   ├── users.controller.ts
│   └── dto/
├── companies/                 # Company management
│   ├── companies.module.ts
│   ├── companies.service.ts
│   └── companies.controller.ts
├── materials/                 # Materials catalog
│   ├── materials.module.ts
│   ├── materials.service.ts
│   └── materials.controller.ts
├── containers/                # Container management
│   ├── containers.module.ts
│   ├── containers.service.ts
│   └── containers.controller.ts
├── orders/                    # Order management
│   ├── orders.module.ts
│   ├── orders.service.ts
│   ├── orders.controller.ts
│   └── dto/
├── transport/                 # Transport & logistics
│   ├── transport.module.ts
│   ├── transport.service.ts
│   ├── transport.controller.ts
│   └── jobs/
│       ├── jobs.service.ts
│       └── jobs.controller.ts
├── recycling/                 # Recycling & waste management
│   ├── recycling.module.ts
│   ├── recycling.service.ts
│   └── recycling.controller.ts
├── fleet/                     # Vehicle management
│   ├── fleet.module.ts
│   ├── fleet.service.ts
│   └── fleet.controller.ts
├── notifications/             # Notifications system
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   └── notifications.gateway.ts
├── payments/                  # Payment processing
│   ├── payments.module.ts
│   ├── payments.service.ts
│   └── payments.controller.ts
├── analytics/                 # Analytics & reporting
│   ├── analytics.module.ts
│   ├── analytics.service.ts
│   └── analytics.controller.ts
└── prisma/                    # Database service
    ├── prisma.module.ts
    └── prisma.service.ts
```

---

## API Endpoints Structure

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
```

### Users
```
GET    /api/v1/users
GET    /api/v1/users/:id
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id
GET    /api/v1/users/:id/profile
PUT    /api/v1/users/:id/profile
```

### Companies
```
GET    /api/v1/companies
GET    /api/v1/companies/:id
POST   /api/v1/companies
PUT    /api/v1/companies/:id
DELETE /api/v1/companies/:id
POST   /api/v1/companies/:id/verify
```

### Materials
```
GET    /api/v1/materials
GET    /api/v1/materials/:id
POST   /api/v1/materials
PUT    /api/v1/materials/:id
DELETE /api/v1/materials/:id
GET    /api/v1/materials/categories
GET    /api/v1/materials/search
```

### Containers
```
GET    /api/v1/containers
GET    /api/v1/containers/:id
POST   /api/v1/containers
PUT    /api/v1/containers/:id
DELETE /api/v1/containers/:id
GET    /api/v1/containers/available
```

### Orders
```
GET    /api/v1/orders
GET    /api/v1/orders/:id
POST   /api/v1/orders
PUT    /api/v1/orders/:id
DELETE /api/v1/orders/:id
POST   /api/v1/orders/:id/confirm
POST   /api/v1/orders/:id/cancel
GET    /api/v1/orders/:id/invoice
```

### Transport Jobs
```
GET    /api/v1/transport/jobs
GET    /api/v1/transport/jobs/:id
POST   /api/v1/transport/jobs
PUT    /api/v1/transport/jobs/:id
POST   /api/v1/transport/jobs/:id/assign
POST   /api/v1/transport/jobs/:id/accept
POST   /api/v1/transport/jobs/:id/start
POST   /api/v1/transport/jobs/:id/complete
GET    /api/v1/transport/jobs/available
PUT    /api/v1/transport/jobs/:id/location
```

### Recycling
```
GET    /api/v1/recycling/centers
GET    /api/v1/recycling/centers/:id
POST   /api/v1/recycling/centers
PUT    /api/v1/recycling/centers/:id
POST   /api/v1/recycling/records
GET    /api/v1/recycling/records/:id
```

### Fleet
```
GET    /api/v1/fleet/vehicles
GET    /api/v1/fleet/vehicles/:id
POST   /api/v1/fleet/vehicles
PUT    /api/v1/fleet/vehicles/:id
DELETE /api/v1/fleet/vehicles/:id
GET    /api/v1/fleet/vehicles/:id/location
```

### Notifications
```
GET    /api/v1/notifications
GET    /api/v1/notifications/:id
PUT    /api/v1/notifications/:id/read
PUT    /api/v1/notifications/read-all
DELETE /api/v1/notifications/:id
```

### Analytics
```
GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/orders
GET    /api/v1/analytics/revenue
GET    /api/v1/analytics/transport
GET    /api/v1/analytics/recycling-rate
```

---

## Mobile App Architecture (Expo)

### Navigation Structure

```
App
├── (auth)                     # Authentication screens
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (onboarding)               # Onboarding flow
│   ├── welcome.tsx
│   ├── user-type.tsx
│   └── company-setup.tsx
├── (tabs)                     # Main app tabs
│   ├── (buyer)                # Buyer role
│   │   ├── index.tsx          # Home/Dashboard
│   │   ├── materials.tsx      # Browse materials
│   │   ├── containers.tsx     # Order containers
│   │   ├── orders.tsx         # My orders
│   │   └── profile.tsx        # Profile
│   ├── (supplier)             # Supplier role
│   │   ├── index.tsx          # Dashboard
│   │   ├── products.tsx       # My products
│   │   ├── orders.tsx         # Incoming orders
│   │   └── profile.tsx
│   ├── (carrier)              # Carrier role
│   │   ├── index.tsx          # Dashboard
│   │   ├── jobs.tsx           # Available jobs
│   │   ├── fleet.tsx          # Fleet management
│   │   └── profile.tsx
│   ├── (driver)               # Driver role
│   │   ├── index.tsx          # Active jobs
│   │   ├── available.tsx      # Available jobs
│   │   ├── history.tsx        # Job history
│   │   └── profile.tsx
│   └── (recycler)             # Recycler role
│       ├── index.tsx          # Dashboard
│       ├── centers.tsx        # Recycling centers
│       ├── waste.tsx          # Waste records
│       └── profile.tsx
└── (modals)                   # Modal screens
    ├── material-detail.tsx
    ├── order-detail.tsx
    ├── job-detail.tsx
    ├── delivery-proof.tsx
    └── settings.tsx
```

### Key Mobile Features

#### For Buyers (Construction Companies)
- Browse and order materials
- Rent containers
- Schedule deliveries
- Track orders in real-time
- View invoices and payments
- Rate suppliers and drivers

#### For Suppliers
- Manage product catalog
- View and process orders
- Update inventory
- Manage pricing
- View analytics

#### For Carriers
- Browse available transport jobs
- Assign drivers to jobs
- Track fleet in real-time
- Manage vehicles
- View earnings

#### For Drivers
- View available jobs
- Accept/reject jobs
- Navigate to pickup/delivery
- Update job status
- Upload delivery proof (signature, photos)
- Track earnings

#### For Recyclers
- Manage recycling centers
- Process waste records
- Track recycling rates
- Generate certificates
- Analytics on material flows

---

## Web Dashboard Architecture (Next.js)

### Page Structure

```
app/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── layout.tsx             # Dashboard layout
│   ├── page.tsx               # Overview dashboard
│   ├── materials/
│   │   ├── page.tsx           # Materials list
│   │   ├── [id]/page.tsx      # Material detail
│   │   └── new/page.tsx       # Add material
│   ├── containers/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── orders/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── transport/
│   │   ├── jobs/page.tsx
│   │   ├── jobs/[id]/page.tsx
│   │   └── fleet/page.tsx
│   ├── recycling/
│   │   ├── centers/page.tsx
│   │   └── records/page.tsx
│   ├── companies/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── users/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── analytics/
│   │   ├── page.tsx
│   │   ├── orders/page.tsx
│   │   ├── revenue/page.tsx
│   │   └── sustainability/page.tsx
│   └── settings/
│       ├── page.tsx
│       ├── company/page.tsx
│       ├── billing/page.tsx
│       └── team/page.tsx
└── api/                       # API routes (if needed)
    └── webhooks/
```

### Key Web Features

#### Admin Dashboard
- Platform overview and KPIs
- User management
- Company verification
- Content moderation
- System settings

#### Buyer Dashboard
- Order management
- Material catalog browsing
- Container booking
- Delivery tracking
- Invoice management

#### Supplier Dashboard
- Product management
- Order processing
- Inventory management
- Pricing management
- Customer analytics

#### Carrier Dashboard
- Job management
- Fleet tracking
- Driver management
- Route optimization
- Earnings reports

#### Recycler Dashboard
- Center management
- Waste processing
- Recycling analytics
- Compliance reporting
- Material flow tracking

---

## Authentication & Authorization

### Role-Based Access Control (RBAC)

```typescript
enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  BUYER = 'BUYER',
  SUPPLIER = 'SUPPLIER',
  CARRIER = 'CARRIER',
  DRIVER = 'DRIVER',
  RECYCLER = 'RECYCLER',
}

// Permissions matrix
const permissions = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['users:*', 'companies:*', 'orders:read', 'analytics:*'],
  BUYER: ['orders:create', 'orders:read', 'materials:read', 'containers:*'],
  SUPPLIER: ['materials:*', 'orders:read', 'orders:update'],
  CARRIER: ['transport:*', 'fleet:*', 'drivers:*'],
  DRIVER: ['transport:read', 'transport:update', 'delivery:*'],
  RECYCLER: ['recycling:*', 'waste:*'],
};
```

### Multi-Tenant Architecture
- Users can belong to one company
- Companies can have multiple users with different roles
- Cross-company visibility controlled by permissions
- Data isolation at company level

---

## Real-Time Features

### WebSocket Events

```typescript
// Order updates
'order:created'
'order:updated'
'order:status_changed'

// Transport tracking
'transport:assigned'
'transport:location_update'
'transport:status_changed'

// Notifications
'notification:new'
'notification:read'

// Chat (future)
'message:new'
'message:typing'
```

---

## File Storage Structure

```
storage/
├── companies/
│   ├── {companyId}/
│   │   ├── logo.png
│   │   └── documents/
├── materials/
│   └── {materialId}/
│       └── images/
├── vehicles/
│   └── {vehicleId}/
│       └── documents/
├── deliveries/
│   └── {deliveryId}/
│       ├── signatures/
│       └── photos/
└── invoices/
    └── {invoiceId}.pdf
```

---

## Key Workflows

### 1. Material Order Flow
1. Buyer browses materials
2. Adds items to cart
3. Selects delivery date/location
4. Places order
5. Supplier confirms order
6. System assigns transport job
7. Driver accepts and delivers
8. Buyer confirms delivery
9. Invoice generated
10. Payment processed

### 2. Container Rental Flow
1. Buyer requests container
2. Selects size, type, dates
3. System finds available container
4. Schedules delivery
5. Driver delivers container
6. Container in use (rental period)
7. Buyer requests pickup
8. Driver picks up container
9. Waste processed at recycling center
10. Invoice generated

### 3. Waste-to-Resource Flow
1. Container with waste picked up
2. Delivered to recycling center
3. Waste weighed and recorded
4. Waste processed/sorted
5. Recyclable materials extracted
6. Quality testing
7. Converted to new material product
8. Added to materials catalog
9. Available for sale

---

## Performance Considerations

### Caching Strategy
- Redis for session management
- API response caching for catalog data
- Real-time data: no caching
- CDN for static assets

### Database Optimization
- Proper indexing on foreign keys
- Composite indexes for common queries
- Pagination for list endpoints
- Database connection pooling

### API Rate Limiting
- Per-user rate limits
- Per-company rate limits
- Public endpoints: stricter limits

---

## Security Considerations

1. **Authentication**: JWT tokens with refresh mechanism
2. **Authorization**: Role-based access control
3. **Data Validation**: DTO validation on all inputs
4. **SQL Injection**: Prisma ORM protection
5. **XSS Protection**: Input sanitization
6. **CORS**: Configured for specific origins
7. **HTTPS**: Required for all connections
8. **Sensitive Data**: Encrypted at rest
9. **Audit Logs**: Track critical operations

---

## Monitoring & Analytics

### Application Metrics
- API response times
- Error rates
- Active users
- Order completion rates
- Transport efficiency

### Business Metrics
- Revenue tracking
- Order volume
- Material flow
- Recycling rates
- Customer satisfaction

---

## Future Enhancements

1. **AI/ML Features**
   - Route optimization
   - Demand forecasting
   - Dynamic pricing
   - Waste categorization

2. **Integrations**
   - ERP systems
   - Accounting software
   - Mapping services
   - Weather APIs

3. **Advanced Features**
   - Live chat support
   - Video consultations
   - AR material preview
   - Blockchain for traceability

---

This architecture provides a solid foundation for building a comprehensive construction marketplace platform similar to Schüttflix and IK Umwelt, with scalability, security, and user experience at its core.
