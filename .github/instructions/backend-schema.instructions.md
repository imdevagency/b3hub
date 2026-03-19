---
applyTo: "apps/backend/**"
---

# Backend — DB Schema & Prisma Workflow

> **Auto-generated** from `apps/backend/prisma/schema.prisma` by `scripts/generate-instructions.mjs`.
> Do not edit manually — run `npm run docs:generate` (or `prisma:generate`) to refresh.
>
> **Trust contract:** regenerated automatically on every `prisma:generate` and `prisma:push`.
> Treat as accurate. Only regenerate manually if a field looks missing (means schema was edited without running generate).

Schema: `apps/backend/prisma/schema.prisma` (1248 lines, 30 models, 30 enums).
API prefix: `/api/v1` — all routes start with this (e.g. `POST /api/v1/orders`).
ORM: **Prisma**. Always inject `PrismaService` from `src/prisma/prisma.module.ts` — never import `@prisma/client` directly.
DB: PostgreSQL on Supabase. `DATABASE_URL` = pooler (transactions), `DIRECT_URL` = direct (migrations only).

---

## Registered feature modules

- `AuthModule`
- `MaterialsModule`
- `OrdersModule`
- `SkipHireModule`
- `DocumentsModule`
- `ProviderApplicationsModule`
- `VehiclesModule`
- `TransportJobsModule`
- `NotificationsModule`
- `InvoicesModule`
- `CompanyModule`
- `CarrierSettingsModule`
- `DriverScheduleModule`
- `AdminModule`
- `QuoteRequestsModule`
- `ReviewsModule`
- `ChatModule`
- `ContainersModule`
- `RecyclingCentersModule`
- `EmailModule`
- `FrameworkContractsModule`
- `CompanyMembersModule`

---

## Prisma workflow commands (run from `apps/backend/`)

```bash
npm run prisma:generate   # regenerates client typings + this docs file
npm run prisma:migrate    # creates migration file + applies to DB (you name it)
npm run prisma:push       # dev shortcut — sync schema without a migration file
npm run prisma:studio     # visual database browser
npm run db:seed           # reseed demo data
```

**Rule:** always run `prisma:generate` after editing `schema.prisma`.

---

## Enums quick-reference

| Enum | Values |
|------|--------|
| `UserType` | BUYER ADMIN |
| `ApplicationStatus` | PENDING APPROVED REJECTED |
| `UserStatus` | PENDING ACTIVE SUSPENDED DEACTIVATED |
| `CompanyType` | CONSTRUCTION SUPPLIER RECYCLER CARRIER HYBRID |
| `CompanyRole` | OWNER MANAGER DRIVER MEMBER |
| `MaterialCategory` | SAND GRAVEL STONE CONCRETE SOIL RECYCLED_CONCRETE RECYCLED_SOIL ASPHALT CLAY OTHER |
| `MaterialUnit` | TONNE M3 PIECE LOAD |
| `ContainerType` | SKIP ROLL_OFF COMPACTOR ENCLOSED |
| `ContainerSize` | SMALL_3M3 MEDIUM_5M3 LARGE_7M3 XLARGE_10M3 XXLARGE_15M3 XXXLARGE_20M3 |
| `ContainerStatus` | AVAILABLE RENTED IN_TRANSIT MAINTENANCE RETIRED |
| `OrderType` | MATERIAL CONTAINER DISPOSAL TRANSPORT COMBINED |
| `OrderStatus` | DRAFT PENDING CONFIRMED IN_PROGRESS DELIVERED COMPLETED CANCELLED |
| `PaymentStatus` | PENDING PAID PARTIALLY_PAID REFUNDED FAILED |
| `WastePurpose` | CONSTRUCTION_WASTE DEMOLITION_WASTE EXCAVATION_SOIL MIXED_WASTE RECYCLABLE_MATERIALS HAZARDOUS_WASTE GREEN_WASTE OTHER |
| `WasteType` | CONCRETE BRICK WOOD METAL PLASTIC SOIL MIXED HAZARDOUS |
| `SkipWasteCategory` | MIXED GREEN_GARDEN CONCRETE_RUBBLE WOOD METAL_SCRAP ELECTRONICS_WEEE |
| `SkipSize` | MINI MIDI BUILDERS LARGE |
| `SkipHireStatus` | PENDING CONFIRMED DELIVERED COLLECTED COMPLETED CANCELLED |
| `ContainerOrderStatus` | SCHEDULED DELIVERED IN_USE PICKED_UP COMPLETED CANCELLED |
| `TransportJobType` | MATERIAL_DELIVERY CONTAINER_DELIVERY CONTAINER_PICKUP WASTE_COLLECTION EQUIPMENT_TRANSPORT TRANSPORT |
| `TransportJobStatus` | AVAILABLE ASSIGNED ACCEPTED EN_ROUTE_PICKUP AT_PICKUP LOADED EN_ROUTE_DELIVERY AT_DELIVERY DELIVERED CANCELLED |
| `VehicleType` | DUMP_TRUCK FLATBED_TRUCK SEMI_TRAILER HOOK_LIFT SKIP_LOADER TANKER VAN |
| `VehicleStatus` | ACTIVE IN_USE MAINTENANCE INACTIVE |
| `NotificationType` | ORDER_CREATED ORDER_CONFIRMED ORDER_CANCELLED ORDER_DELIVERED TRANSPORT_ASSIGNED TRANSPORT_STARTED TRANSPORT_COMPLETED PAYMENT_RECEIVED QUOTE_RECEIVED QUOTE_ACCEPTED SYSTEM_ALERT |
| `QuoteRequestStatus` | PENDING QUOTED ACCEPTED CANCELLED EXPIRED |
| `FrameworkContractStatus` | ACTIVE COMPLETED EXPIRED CANCELLED |
| `FrameworkPositionType` | MATERIAL_DELIVERY WASTE_DISPOSAL FREIGHT_TRANSPORT |
| `QuoteResponseStatus` | PENDING ACCEPTED REJECTED EXPIRED |
| `DocumentType` | INVOICE WEIGHING_SLIP DELIVERY_PROOF WASTE_CERTIFICATE DELIVERY_NOTE CONTRACT OTHER |
| `DocumentStatus` | DRAFT ISSUED SIGNED ARCHIVED |

---

## Model map

### User — `@@map("users")`  
**Fields:** `id`: String @id @default(cuid(), `email`: String? @unique, `phone`: String? @unique, `password`: String, `firstName`: String, `lastName`: String, `avatar`: String?, `isCompany`: Boolean @default(false), `canSell`: Boolean @default(false), `canTransport`: Boolean @default(false), `canSkipHire`: Boolean @default(false), `emailVerified`: Boolean @default(false), `phoneVerified`: Boolean @default(false), `pushToken`: String?, `resetToken`: String?, `resetTokenExpiry`: DateTime?, `refreshToken`: String?, `refreshTokenExpiry`: DateTime?, `notifPush`: Boolean @default(true), `notifOrderUpdates`: Boolean @default(true), `notifJobAlerts`: Boolean @default(true), `notifMarketing`: Boolean @default(false), `permCreateContracts`: Boolean @default(false), `permReleaseCallOffs`: Boolean @default(false), `permManageOrders`: Boolean @default(false), `permViewFinancials`: Boolean @default(false), `permManageTeam`: Boolean @default(false), `companyId`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `userType`: UserType (@default(BUYER)), `companyRole`?: CompanyRole, `status`: UserStatus (@default(ACTIVE))  
**Relations:** → Company?, DriverProfile?, BuyerProfile?, Order, TransportJob, TransportJob, Notification, Vehicle, QuoteRequest, Review, ChatMessage, FrameworkContract

---

### Company — `@@map("companies")`  
**Fields:** `id`: String @id @default(cuid(), `name`: String, `legalName`: String, `registrationNum`: String? @unique, `taxId`: String?, `email`: String, `phone`: String, `website`: String?, `street`: String, `city`: String, `state`: String, `postalCode`: String, `country`: String @default("DE"), `description`: String?, `logo`: String?, `verified`: Boolean @default(false), `rating`: Float?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `companyType`: CompanyType  
**Relations:** → User, Material, Container, Vehicle, Order, RecyclingCenter, TransportJob, QuoteResponse, CarrierPricing, CarrierServiceZone, CarrierAvailability, SkipHireOrder, Review, FrameworkContract

---

### Material — `@@map("materials")`  
**Fields:** `id`: String @id @default(cuid(), `name`: String, `description`: String?, `subCategory`: String?, `basePrice`: Float, `currency`: String @default("EUR"), `inStock`: Boolean @default(true), `minOrder`: Float?, `maxOrder`: Float?, `deliveryRadiusKm`: Int? @default(100), `isRecycled`: Boolean @default(false), `quality`: String?, `certificates`: String, `images`: String, `specifications`: Json?, `supplierId`: String, `active`: Boolean @default(true), `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `category`: MaterialCategory, `unit`: MaterialUnit  
**Relations:** → Company, OrderItem

---

### Container — `@@map("containers")`  
**Fields:** `id`: String @id @default(cuid(), `volume`: Float, `maxWeight`: Float, `rentalPrice`: Float, `deliveryFee`: Float, `pickupFee`: Float, `currency`: String @default("EUR"), `location`: String?, `ownerId`: String, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `containerType`: ContainerType, `size`: ContainerSize, `status`: ContainerStatus  
**Relations:** → Company, ContainerOrder

---

### Order — `@@map("orders")`  
**Fields:** `id`: String @id @default(cuid(), `orderNumber`: String @unique, `buyerId`: String, `createdById`: String, `deliveryAddress`: String, `deliveryCity`: String, `deliveryState`: String, `deliveryPostal`: String, `deliveryDate`: DateTime?, `deliveryWindow`: String?, `subtotal`: Float, `tax`: Float, `deliveryFee`: Float, `total`: Float, `currency`: String @default("EUR"), `siteContactName`: String?, `siteContactPhone`: String?, `notes`: String?, `internalNotes`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `orderType`: OrderType, `status`: OrderStatus, `paymentStatus`: PaymentStatus  
**Relations:** → Company, User, OrderItem, ContainerOrder, TransportJob, Invoice

---

### OrderItem — `@@map("order_items")`  
**Fields:** `id`: String @id @default(cuid(), `orderId`: String, `materialId`: String, `quantity`: Float, `unitPrice`: Float, `total`: Float, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `unit`: MaterialUnit  
**Relations:** → Order, Material

---

### ContainerOrder — `@@map("container_orders")`  
**Fields:** `id`: String @id @default(cuid(), `orderId`: String, `containerId`: String, `startDate`: DateTime, `endDate`: DateTime?, `actualEndDate`: DateTime?, `estimatedWeight`: Float?, `actualWeight`: Float?, `rentalDays`: Int, `dailyRate`: Float, `deliveryFee`: Float, `pickupFee`: Float, `disposalFee`: Float?, `total`: Float, `deliveryJobId`: String?, `pickupJobId`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `purpose`: WastePurpose, `wasteType`?: WasteType, `status`: ContainerOrderStatus  
**Relations:** → Order, Container, TransportJob?, TransportJob?, WasteRecord

---

### TransportJob — `@@map("transport_jobs")`  
**Fields:** `id`: String @id @default(cuid(), `jobNumber`: String @unique, `orderId`: String?, `pickupAddress`: String, `pickupCity`: String, `pickupState`: String, `pickupPostal`: String, `pickupDate`: DateTime, `pickupWindow`: String?, `deliveryAddress`: String, `deliveryCity`: String, `deliveryState`: String, `deliveryPostal`: String, `deliveryDate`: DateTime, `deliveryWindow`: String?, `cargoType`: String, `cargoWeight`: Float?, `cargoVolume`: Float?, `actualWeightKg`: Float?, `pickupPhotoUrl`: String?, `specialRequirements`: String?, `requiredVehicleType`: String?, `pickupLat`: Float?, `pickupLng`: Float?, `deliveryLat`: Float?, `deliveryLng`: Float?, `distanceKm`: Float?, `rate`: Float, `pricePerTonne`: Float?, `currency`: String @default("EUR"), `carrierId`: String?, `driverId`: String?, `vehicleId`: String?, `frameworkContractId`: String?, `frameworkPositionId`: String?, `requestedById`: String?, `currentLocation`: Json?, `estimatedArrival`: DateTime?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `jobType`: TransportJobType, `requiredVehicleEnum`?: VehicleType, `status`: TransportJobStatus  
**Relations:** → Order?, Company?, User?, Vehicle?, FrameworkContract?, FrameworkPosition?, User?, DeliveryProof?, ContainerOrder, ContainerOrder, ChatMessage

---

### DeliveryProof — `@@map("delivery_proofs")`  
**Fields:** `id`: String @id @default(cuid(), `transportJobId`: String @unique, `recipientName`: String, `recipientSignature`: String, `driverSignature`: String, `photos`: String, `deliveredAt`: DateTime, `notes`: String?, `createdAt`: DateTime @default(now()  
**Relations:** → TransportJob

---

### Vehicle — `@@map("vehicles")`  
**Fields:** `id`: String @id @default(cuid(), `make`: String, `model`: String, `year`: Int, `licensePlate`: String @unique, `vin`: String?, `imageUrl`: String?, `capacity`: Float, `maxGrossWeight`: Float?, `volumeCapacity`: Float?, `driveType`: String?, `ownerId`: String?, `companyId`: String?, `currentLocation`: Json?, `insuranceExpiry`: DateTime?, `inspectionExpiry`: DateTime?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `vehicleType`: VehicleType, `status`: VehicleStatus (@default(ACTIVE))  
**Relations:** → User?, Company?, TransportJob

---

### RecyclingCenter — `@@map("recycling_centers")`  
**Fields:** `id`: String @id @default(cuid(), `name`: String, `address`: String, `city`: String, `state`: String, `postalCode`: String, `coordinates`: Json?, `companyId`: String, `capacity`: Float, `certifications`: String, `operatingHours`: Json, `active`: Boolean @default(true), `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `acceptedWasteTypes`: WasteType  
**Relations:** → Company, WasteRecord

---

### WasteRecord — `@@map("waste_records")`  
**Fields:** `id`: String @id @default(cuid(), `containerOrderId`: String?, `recyclingCenterId`: String, `weight`: Float, `volume`: Float?, `processedDate`: DateTime?, `recyclableWeight`: Float?, `recyclingRate`: Float?, `producedMaterialId`: String?, `certificateUrl`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `wasteType`: WasteType  
**Relations:** → ContainerOrder?, RecyclingCenter

---

### DriverProfile — `@@map("driver_profiles")`  
**Fields:** `id`: String @id @default(cuid(), `userId`: String @unique, `licenseNumber`: String @unique, `licenseType`: String, `licenseExpiry`: DateTime, `certifications`: String, `rating`: Float?, `completedJobs`: Int @default(0), `available`: Boolean @default(true), `isOnline`: Boolean @default(false), `autoSchedule`: Boolean @default(false), `maxJobsPerDay`: Int?, `currentLocation`: Json?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Relations:** → User, DriverSchedule, DriverDateBlock

---

### BuyerProfile — `@@map("buyer_profiles")`  
**Fields:** `id`: String @id @default(cuid(), `userId`: String @unique, `preferredSuppliers`: String, `preferredCarriers`: String, `creditLimit`: Float?, `creditUsed`: Float @default(0), `paymentTerms`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Relations:** → User

---

### Notification — `@@map("notifications")`  
**Fields:** `id`: String @id @default(cuid(), `userId`: String, `title`: String, `message`: String, `data`: Json?, `read`: Boolean @default(false), `readAt`: DateTime?, `createdAt`: DateTime @default(now()  
**Enum fields:** `type`: NotificationType  
**Relations:** → User

---

### Invoice — `@@map("invoices")`  
**Fields:** `id`: String @id @default(cuid(), `invoiceNumber`: String @unique, `orderId`: String, `subtotal`: Float, `tax`: Float, `total`: Float, `currency`: String @default("EUR"), `dueDate`: DateTime, `paidDate`: DateTime?, `pdfUrl`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `paymentStatus`: PaymentStatus  
**Relations:** → Order

---

### Document — `@@map("documents")`  
**Fields:** `id`: String @id @default(cuid(), `title`: String, `fileUrl`: String?, `mimeType`: String?, `fileSize`: Int?, `orderId`: String?, `invoiceId`: String?, `transportJobId`: String?, `wasteRecordId`: String?, `skipHireId`: String?, `ownerId`: String, `issuedBy`: String?, `isGenerated`: Boolean @default(false), `notes`: String?, `expiresAt`: DateTime?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `type`: DocumentType, `status`: DocumentStatus (@default(ISSUED))

---

### SkipHireOrder — `@@map("skip_hire_orders")`  
**Fields:** `id`: String @id @default(cuid(), `orderNumber`: String @unique, `location`: String, `deliveryDate`: DateTime, `price`: Float, `currency`: String @default("EUR"), `contactName`: String?, `contactEmail`: String?, `contactPhone`: String?, `userId`: String?, `notes`: String?, `carrierId`: String?, `lat`: Float?, `lng`: Float?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `wasteCategory`: SkipWasteCategory, `skipSize`: SkipSize, `status`: SkipHireStatus (@default(PENDING))  
**Relations:** → Company?

---

### CarrierPricing — `@@map("carrier_pricing")`  
**Fields:** `id`: String @id @default(cuid(), `carrierId`: String, `price`: Float, `currency`: String @default("EUR"), `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `skipSize`: SkipSize  
**Relations:** → Company

---

### CarrierServiceZone — `@@map("carrier_service_zones")`  
**Fields:** `id`: String @id @default(cuid(), `carrierId`: String, `city`: String, `postcode`: String?, `surcharge`: Float @default(0), `createdAt`: DateTime @default(now()  
**Relations:** → Company

---

### CarrierAvailability — `@@map("carrier_availability")`  
**Fields:** `id`: String @id @default(cuid(), `carrierId`: String, `blockedDate`: DateTime, `reason`: String?, `createdAt`: DateTime @default(now()  
**Relations:** → Company

---

### ProviderApplication — `@@map("provider_applications")`  
**Fields:** `id`: String @id @default(cuid(), `email`: String, `firstName`: String, `lastName`: String, `phone`: String, `companyName`: String, `regNumber`: String?, `taxId`: String?, `website`: String?, `appliesForSell`: Boolean @default(false), `appliesForTransport`: Boolean @default(false), `description`: String?, `userId`: String?, `reviewedBy`: String?, `reviewNote`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `status`: ApplicationStatus (@default(PENDING))

---

### DriverSchedule — `@@map("driver_schedules")`  
**Fields:** `id`: String @id @default(cuid(), `driverProfileId`: String, `dayOfWeek`: Int, `enabled`: Boolean @default(true), `startTime`: String, `endTime`: String, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Relations:** → DriverProfile

---

### DriverDateBlock — `@@map("driver_date_blocks")`  
**Fields:** `id`: String @id @default(cuid(), `driverProfileId`: String, `blockedDate`: DateTime, `reason`: String?, `createdAt`: DateTime @default(now()  
**Relations:** → DriverProfile

---

### QuoteRequest — `@@map("quote_requests")`  
**Fields:** `id`: String @id @default(cuid(), `requestNumber`: String @unique, `buyerId`: String, `materialName`: String, `quantity`: Float, `deliveryAddress`: String, `deliveryCity`: String, `deliveryLat`: Float?, `deliveryLng`: Float?, `notes`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `materialCategory`: MaterialCategory, `unit`: MaterialUnit, `status`: QuoteRequestStatus (@default(PENDING))  
**Relations:** → User, QuoteResponse

---

### QuoteResponse — `@@map("quote_responses")`  
**Fields:** `id`: String @id @default(cuid(), `requestId`: String, `supplierId`: String, `pricePerUnit`: Float, `totalPrice`: Float, `etaDays`: Int, `notes`: String?, `validUntil`: DateTime?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `unit`: MaterialUnit, `status`: QuoteResponseStatus (@default(PENDING))  
**Relations:** → QuoteRequest, Company

---

### Review — `@@map("reviews")`  
**Fields:** `id`: String @id @default(cuid(), `rating`: Int, `comment`: String?, `reviewerId`: String, `companyId`: String, `orderId`: String? @unique, `skipOrderId`: String? @unique, `createdAt`: DateTime @default(now()  
**Relations:** → User, Company

---

### ChatMessage — `@@map("chat_messages")`  
**Fields:** `id`: String @id @default(cuid(), `transportJobId`: String, `senderId`: String, `senderName`: String, `body`: String, `createdAt`: DateTime @default(now()  
**Relations:** → TransportJob, User

---

### FrameworkContract — `@@map("framework_contracts")`  
**Fields:** `id`: String @id @default(cuid(), `contractNumber`: String @unique, `title`: String, `buyerId`: String, `createdById`: String, `startDate`: DateTime, `endDate`: DateTime?, `notes`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `status`: FrameworkContractStatus (@default(ACTIVE))  
**Relations:** → Company, User, FrameworkPosition, TransportJob

---

### FrameworkPosition — `@@map("framework_positions")`  
**Fields:** `id`: String @id @default(cuid(), `contractId`: String, `description`: String, `agreedQty`: Float, `unit`: String @default("t"), `unitPrice`: Float?, `pickupAddress`: String?, `pickupCity`: String?, `deliveryAddress`: String?, `deliveryCity`: String?, `createdAt`: DateTime @default(now(), `updatedAt`: DateTime  
**Enum fields:** `positionType`: FrameworkPositionType  
**Relations:** → FrameworkContract, TransportJob

---

## Common Prisma patterns

```typescript
// Include nested relations
const order = await this.prisma.order.findUnique({
  where: { id },
  include: { items: { include: { material: true } }, transportJobs: true },
});

// Filtered list with pagination
const jobs = await this.prisma.transportJob.findMany({
  where: { carrierId, status: { in: ['AVAILABLE', 'ASSIGNED'] } },
  orderBy: { pickupDate: 'asc' },
  skip: (page - 1) * limit,
  take: limit,
});

// Atomic multi-table write
await this.prisma.$transaction([
  this.prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } }),
  this.prisma.transportJob.create({ data: { ...jobData } }),
]);
```

---

## Adding a new feature — checklist

1. Add/alter models in `schema.prisma`
2. `npm run prisma:migrate` — name it meaningfully (e.g. `add_payment_method`)
3. `npm run prisma:generate` — regenerates client typings **and this docs file**
4. Create `src/<feature>/<feature>.module.ts|controller.ts|service.ts` + DTOs
5. Import the new module in `src/app.module.ts` → `imports: [...]`
6. If the feature emits notifications, add a `NotificationType` enum value before migrating
