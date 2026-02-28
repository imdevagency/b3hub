# Database Setup Guide

## Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned
3. Get your connection details from Project Settings > Database

## Environment Variables

Copy the `.env.example` file to `.env` in the backend directory:

```bash
cd apps/backend
cp .env.example .env
```

Update the following values in `.env`:

- `DATABASE_URL`: Connection pooler URL (use Transaction mode for Prisma)
- `DIRECT_URL`: Direct connection URL (for migrations)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Public anon key (safe to use in client)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-side only, never expose)

## Prisma Workflow

### 1. Generate Prisma Client
After modifying `prisma/schema.prisma`:
```bash
npm run prisma:generate
```

### 2. Create and Apply Migrations
```bash
npm run prisma:migrate
# Follow prompts to name your migration
```

### 3. Push Schema (Development)
Quick way to sync schema without creating migration files:
```bash
npm run prisma:push
```

### 4. Prisma Studio
Visual database browser:
```bash
npm run prisma:studio
```

## Using Prisma in Your Code

The `PrismaService` is globally available in all modules:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async create(data: { email: string; name?: string }) {
    return this.prisma.user.create({ data });
  }
}
```

## Using Supabase Storage

The `SupabaseService` is globally available for storage operations:

```typescript
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FileService {
  constructor(private supabase: SupabaseService) {}

  async uploadFile(file: Buffer, path: string) {
    await this.supabase.uploadFile('avatars', path, file);
    return this.supabase.getPublicUrl('avatars', path);
  }
}
```
