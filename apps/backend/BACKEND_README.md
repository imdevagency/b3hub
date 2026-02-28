# B3Hub Backend - Installation & Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Installation

1. **Install dependencies:**
   ```bash
   cd apps/backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Then update `.env` with your actual database credentials:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/b3hub?schema=public"
   JWT_SECRET="your-secret-key"
   ```

3. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

4. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```
   
   Or push schema directly:
   ```bash
   npm run prisma:push
   ```

5. **Start the development server:**
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3000/api/v1`

## Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:push` - Push schema changes to database
- `npm run test` - Run tests

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user profile

### Materials
- `GET /api/v1/materials` - List all materials
- `GET /api/v1/materials/:id` - Get material details
- `POST /api/v1/materials` - Create material (Supplier/Admin only)
- `PATCH /api/v1/materials/:id` - Update material
- `DELETE /api/v1/materials/:id` - Delete material
- `GET /api/v1/materials/categories` - Get all categories
- `GET /api/v1/materials/search?q=query` - Search materials

### Orders
- `GET /api/v1/orders` - List all orders
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders` - Create new order
- `PATCH /api/v1/orders/:id` - Update order
- `POST /api/v1/orders/:id/confirm` - Confirm order
- `POST /api/v1/orders/:id/cancel` - Cancel order

## Database Schema

The application uses the following main entities:
- **Users** - Platform users (buyers, suppliers, carriers, drivers, recyclers, admins)
- **Companies** - Organizations operating on the platform
- **Materials** - Construction materials catalog
- **Containers** - Container inventory for rental
- **Orders** - Material orders and container rentals
- **OrderItems** - Individual items in an order
- **ContainerOrders** - Container rental details
- **TransportJobs** - Logistics and delivery jobs
- **Vehicles** - Fleet management
- **RecyclingCenters** - Waste processing facilities
- **WasteRecords** - Waste tracking for circular economy
- **DriverProfiles** - Driver-specific information
- **BuyerProfiles** - Buyer preferences and credit info
- **Notifications** - User notifications
- **Invoices** - Billing and invoicing

## User Types & Roles

1. **BUYER** - Construction companies ordering materials
2. **SUPPLIER** - Material suppliers
3. **CARRIER** - Transport companies
4. **DRIVER** - Individual drivers
5. **RECYCLER** - Waste management companies
6. **ADMIN** - Platform administrators

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Next Steps

### Remaining Modules to Implement:
1. Companies module
2. Containers module
3. Transport module
4. Recycling module
5. Users module (full CRUD)
6. Notifications module
7. Analytics module

### Features to Add:
- File upload for images/documents
- Email notifications
- Real-time updates via WebSockets
- Payment integration
- Advanced search and filtering
- Reporting and analytics
- Rate limiting
- API documentation (Swagger/OpenAPI)

## Development Tips

- Use Prisma Studio to view/edit database: `npm run prisma:studio`
- Check API health: `GET http://localhost:3000`
- All validation is handled automatically via class-validator DTOs
- Role-based access control is enforced via guards

## Production Deployment

1. Set `NODE_ENV=production` in environment variables
2. Update `JWT_SECRET` to a strong secret
3. Configure production database
4. Run `npm run build`
5. Start with `npm run start:prod`
6. Set up reverse proxy (nginx/Apache)
7. Enable SSL/TLS
8. Configure monitoring and logging
