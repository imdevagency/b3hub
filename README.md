# B3Hub Monorepo

A full-stack monorepo containing backend, web, and mobile applications.

## Project Structure

```
b3hub/
├── apps/
│   ├── backend/      # NestJS backend API
│   ├── web/          # Next.js web application
│   └── mobile/       # Expo mobile application
├── packages/         # Shared packages (future)
└── package.json      # Root workspace configuration
```

## Tech Stack

- **Backend**: NestJS - A progressive Node.js framework with Prisma ORM and Supabase
- **Web**: Next.js - React framework with TypeScript, Tailwind CSS, and shadcn/ui
- **Mobile**: Expo - React Native framework with TypeScript, NativeWind, and shadcn-style components
- **Database**: Supabase (PostgreSQL) with Prisma ORM

## Prerequisites

- Node.js 18+ and npm
- For mobile development: Expo Go app on your phone or iOS Simulator/Android Emulator

## Getting Started

### Installation

Install all dependencies for the monorepo:

```bash
npm install
```

### Database Setup (Supabase + Prisma)

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Configure environment variables** in `apps/backend/.env`:
   ```bash
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   SUPABASE_URL="https://[PROJECT-REF].supabase.co"
   SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
   SUPABASE_SERVICE_ROLE_KEY="[YOUR-SERVICE-ROLE-KEY]"
   ```

3. **Generate Prisma Client**:
   ```bash
   cd apps/backend
   npm run prisma:generate
   ```

4. **Run migrations**:
   ```bash
   npm run prisma:migrate
   # or push schema without migrations
   npm run prisma:push
   ```

### Development

Run each application in development mode:

**Backend (NestJS)**
```bash
npm run dev:backend
```
The API will run on http://localhost:3000

**Web (Next.js)**
```bash
npm run dev:web
```
The web app will run on http://localhost:3000 (or next available port)

**Mobile (Expo)**
```bash
npm run dev:mobile
```
Then scan the QR code with Expo Go app on your phone

### Building for Production

```bash
# Build backend
npm run build:backend

# Build web
npm run build:web

# Build mobile
npm run build:mobile
```

## Workspace Commands

- `npm run lint` - Run linting across all projects
- `npm run format` - Format code with Prettier

## Project Details

### Backend (apps/backend)
- Built with NestJS
- RESTful API structure
- Prisma ORM for database access
- Supabase PostgreSQL database
- Global PrismaModule and SupabaseModule
- TypeScript enabled
- Hot-reload in development

**Prisma Commands:**
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Create and run migrations
- `npm run prisma:studio` - Open Prisma Studio GUI
- `npm run prisma:push` - Push schema to database

### Web (apps/web)
- Built with Next.js 15
- App Router
- TypeScript and Tailwind CSS
- shadcn/ui components
- ESLint configured

### Mobile (apps/mobile)
- Built with Expo
- TypeScript template
- NativeWind (Tailwind for React Native)
- shadcn-style UI components
- Cross-platform (iOS/Android)
- Expo Go for quick testing

## Contributing

This is a monorepo managed with npm workspaces. Each app maintains its own dependencies while sharing common dev dependencies at the root level.

## License

MIT
