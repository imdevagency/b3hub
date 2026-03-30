import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

const { Client } = pg;
const client = new Client({ connectionString: process.env.DIRECT_URL });

async function run() {
  await client.connect();
  console.log('Connected to DB');

  // Step 1: Create ProjectStatus enum
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD');
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'ProjectStatus enum already exists, skipping';
    END $$;
  `);
  console.log('✓ ProjectStatus enum');

  // Step 2: Create projects table
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      "clientName" TEXT,
      "siteAddress" TEXT,
      "contractValue" DOUBLE PRECISION NOT NULL,
      "budgetAmount" DOUBLE PRECISION,
      status "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
      "startDate" TIMESTAMP(3),
      "endDate" TIMESTAMP(3),
      "companyId" TEXT NOT NULL,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT projects_pkey PRIMARY KEY (id)
    );
  `);
  console.log('✓ projects table');

  // Step 3: Indexes on projects
  await client.query(`CREATE INDEX IF NOT EXISTS "projects_companyId_idx" ON projects("companyId");`);
  console.log('✓ projects index');

  // Step 4: FK from projects -> companies
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE projects ADD CONSTRAINT projects_companyId_fkey
        FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'projects_companyId_fkey already exists';
    END $$;
  `);
  console.log('✓ projects.companyId FK');

  // Step 5: FK from projects -> users
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE projects ADD CONSTRAINT projects_createdById_fkey
        FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'projects_createdById_fkey already exists';
    END $$;
  `);
  console.log('✓ projects.createdById FK');

  // Step 6: Add projectId column to orders
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "projectId" TEXT;`);
  console.log('✓ orders.projectId column');

  // Step 7: Index on orders.projectId
  await client.query(`CREATE INDEX IF NOT EXISTS "orders_projectId_idx" ON orders("projectId");`);
  console.log('✓ orders.projectId index');

  // Step 8: FK from orders -> projects
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE orders ADD CONSTRAINT orders_projectId_fkey
        FOREIGN KEY ("projectId") REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'orders_projectId_fkey already exists';
    END $$;
  `);
  console.log('✓ orders.projectId FK');

  await client.end();
  console.log('\nMigration complete ✓');
}

run().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
