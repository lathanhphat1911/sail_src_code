# Database Migration & Deployment Guide

## 🗄️ Migration Checklist

### Pre-Migration Steps

- [ ] Backup current database
- [ ] Verify no conflicts with other migrations
- [ ] Stop API server
- [ ] Review schema changes

### Run Migration

#### Development Environment
```bash
cd sail-node/pockit-api

# Create migration (generates files, doesn't apply yet)
npx prisma migrate dev --name add_casso_bank_connections_phase2

# This will:
# 1. Create migration file in prisma/migrations/
# 2. Apply migration to database
# 3. Generate Prisma Client types
```

#### Production Environment (if applicable)
```bash
# First, create migration in dev
npx prisma migrate dev --name add_casso_bank_connections_phase2

# Then deploy to production
npx prisma migrate deploy

# Or with direct push (if not using managed migrations)
npx prisma db push
```

### Post-Migration Steps

- [ ] Verify all tables created
- [ ] Check indexes are in place
- [ ] Test data migrations (if any)
- [ ] Verify foreign keys
- [ ] Start API server
- [ ] Run endpoint tests

---

## 🔍 Verification Steps

### 1. Verify Tables Created
```bash
npx prisma studio
# Check these tables exist:
# - bank_connections
# - contributions
# - payment_events
# - crews (updated)
# - users (updated)
```

### 2. Verify Enums Added
```sql
-- In psql or database viewer
SELECT * FROM pg_type WHERE typname = 'contribution_status';
-- Should return enum with values: PENDING, SUCCESS, FAILED, EXPIRED
```

### 3. Verify Indexes
```sql
-- Check unique constraints
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE table_name IN ('bank_connections', 'contributions', 'payment_events');

-- Should include:
-- - bank_connections.casso_connection_id (UNIQUE)
-- - contributions.memo (UNIQUE)
-- - payment_events.transaction_id (UNIQUE)
```

### 4. Verify Foreign Keys
```sql
SELECT * FROM information_schema.referential_constraints 
WHERE table_name IN ('bank_connections', 'contributions', 'payment_events');
```

### 5. Test Data Integrity
```bash
# Generate Prisma Client
npx prisma generate

# Test with Node.js REPL
node
> const { PrismaClient } = require('@prisma/client');
> const prisma = new PrismaClient();
> await prisma.bank_connections.count();  // Should return 0
> await prisma.contributions.count();       // Should return 0
> await prisma.payment_events.count();      // Should return 0
> process.exit();
```

---

## 📋 Migration File Contents Reference

The migration should include:

### 1. Add contribution_status Enum
```sql
CREATE TYPE "contribution_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');
```

### 2. Create bank_connections Table
```sql
CREATE TABLE "bank_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "bank_name" VARCHAR(255) NOT NULL,
    "bank_bin" VARCHAR(50) NOT NULL,
    "account_number" VARCHAR(100) NOT NULL,
    "account_name" VARCHAR(255) NOT NULL,
    "casso_connection_id" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_connections_casso_connection_id_key" UNIQUE ("casso_connection_id"),
    CONSTRAINT "bank_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
```

### 3. Create contributions Table
```sql
CREATE TABLE "contributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "crew_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "memo" VARCHAR(255) NOT NULL,
    "status" "contribution_status" NOT NULL DEFAULT 'PENDING',
    "bank_connection_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contributions_memo_key" UNIQUE ("memo"),
    CONSTRAINT "contributions_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE,
    CONSTRAINT "contributions_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "contributions_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE RESTRICT
);
```

### 4. Create payment_events Table
```sql
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" VARCHAR(255) NOT NULL,
    "contribution_id" UUID NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_events_transaction_id_key" UNIQUE ("transaction_id"),
    CONSTRAINT "payment_events_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE CASCADE
);
```

### 5. Update crews Table
```sql
ALTER TABLE "crews" ADD COLUMN "bank_connection_id" UUID;
ALTER TABLE "crews" ADD CONSTRAINT "crews_bank_connection_id_fkey" 
  FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE SET NULL;
```

### 6. Update users Table Relations
- `bank_connections` relation added automatically by Prisma
- `contributions` relation added automatically by Prisma

---

## 🔄 Migration Strategies

### Strategy 1: Zero-Downtime (Recommended)
```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%s).sql

# 2. Create & apply migration
npx prisma migrate dev --name add_casso_bank_connections_phase2

# 3. Verify migration
npx prisma studio

# 4. Deploy code changes
# Update production API code

# 5. Restart services
# Only downtime = code restart (seconds)
```

### Strategy 2: Managed Migration (Hosting Specific)
```bash
# If using Heroku
heroku run "npx prisma migrate deploy" --exit-code

# If using Railway
railway run "npx prisma migrate deploy"

# If using AWS Lambda/RDS
# Update Lambda function code
# Lambda automatically runs migrations on startup
```

### Strategy 3: Manual SQL (Not Recommended)
```bash
# Get migration SQL
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script

# Execute manually in database client
# psql $DATABASE_URL < migration.sql
```

---

## ⚠️ Rollback Procedure (If Needed)

### Safe Rollback
```bash
# 1. Create rollback migration
npx prisma migrate resolve --rolled-back add_casso_bank_connections_phase2

# 2. Restore from backup if data was corrupted
pg_restore -d $DATABASE_URL backup_timestamp.sql
```

### Quick Rollback (No Data Loss)
```bash
# Drop new tables (careful!)
npx prisma db execute --stdin <<EOF
DROP TABLE IF EXISTS payment_events CASCADE;
DROP TABLE IF EXISTS contributions CASCADE;
DROP TABLE IF EXISTS bank_connections CASCADE;
DROP TYPE IF EXISTS contribution_status;
ALTER TABLE crews DROP COLUMN IF EXISTS bank_connection_id;
EOF

# Resolve migration
npx prisma migrate resolve --rolled-back add_casso_bank_connections_phase2
```

---

## 📊 Migration Validation Script

```bash
#!/bin/bash
# save as: validate_migration.sh

echo "🔍 Validating Migration..."

# Check tables exist
echo "Checking tables..."
npx prisma db execute --stdin <<'EOF' | grep "bank_connections\|contributions\|payment_events"
SELECT table_name FROM information_schema.tables WHERE table_schema='public';
EOF

# Check enums exist
echo "Checking enums..."
npx prisma db execute --stdin <<'EOF' | grep "contribution_status"
SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
EOF

# Check foreign keys
echo "Checking foreign keys..."
npx prisma db execute --stdin <<'EOF'
SELECT constraint_name, table_name FROM information_schema.table_constraints 
WHERE table_name IN ('bank_connections', 'contributions', 'payment_events') 
AND constraint_type = 'FOREIGN KEY';
EOF

# Check unique constraints
echo "Checking unique constraints..."
npx prisma db execute --stdin <<'EOF'
SELECT constraint_name, table_name FROM information_schema.table_constraints 
WHERE table_name IN ('bank_connections', 'contributions', 'payment_events') 
AND constraint_type = 'UNIQUE';
EOF

echo "✅ Migration validation complete!"
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All migrations tested in development
- [ ] Database backed up
- [ ] Rollback procedure documented
- [ ] Team notified
- [ ] Maintenance window scheduled (if needed)

### Deployment
- [ ] Pull latest code
- [ ] Run `npm install`
- [ ] Run `npx prisma migrate deploy`
- [ ] Run validation script
- [ ] Start/restart server
- [ ] Test endpoints in production
- [ ] Monitor error logs

### Post-Deployment
- [ ] Verify all endpoints working
- [ ] Check database performance
- [ ] Monitor webhook endpoint (when ready)
- [ ] Update monitoring alerts
- [ ] Document any issues
- [ ] Communicate status to team

---

## 🐛 Common Migration Issues

### Issue: "Column already exists"
```
Error: column "bank_connection_id" of relation "crews" already exists
```
**Solution**: The migration was already applied. Check with:
```bash
npx prisma migrate status
```

### Issue: "Foreign key constraint violation"
```
Error: violate foreign key constraint
```
**Solution**: 
1. Check referenced data exists
2. May need data migration first
3. Use CASCADE or SET NULL carefully

### Issue: "Unique constraint violation"
```
Error: duplicate key violates unique constraint
```
**Solution**:
1. Migration applied but data invalid
2. Check for duplicate values in unique columns
3. Data cleanup may be needed

### Issue: "Type already exists"
```
Error: type "contribution_status" already exists
```
**Solution**: Migration already applied. Check:
```bash
npx prisma migrate status
```

---

## 📈 Performance Tips

### Index Creation
```sql
-- Indexes are automatically created by Prisma
-- Manual index creation (optional):
CREATE INDEX idx_bank_connections_user_id ON bank_connections(user_id);
CREATE INDEX idx_contributions_crew_id ON contributions(crew_id);
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_payment_events_contribution_id ON payment_events(contribution_id);
```

### Query Optimization
- Use `select` to limit returned fields
- Use `include` for required relations only
- Avoid N+1 queries
- Use pagination for large result sets

---

## 📚 Related Commands

```bash
# View migration history
npx prisma migrate status

# List all migrations
ls -la prisma/migrations/

# Generate types after schema change
npx prisma generate

# Open database viewer
npx prisma studio

# Validate schema syntax
npx prisma validate

# Format schema
npx prisma format

# Reset database (DEV ONLY!)
npx prisma migrate reset

# Create empty migration
npx prisma migrate create_deployed
```

---

## ✅ Final Verification Checklist

After migration completes:

- [ ] All 5 tables/updates created
- [ ] Enums working (contribution_status)
- [ ] Foreign keys functional
- [ ] Unique constraints enforced
- [ ] Indexes created
- [ ] Prisma Client generated
- [ ] API starts without errors
- [ ] Can create records
- [ ] Can query records
- [ ] Database constraints working

---

**Migration Status**: Ready to Deploy  
**Last Updated**: May 17, 2026  
**Next Phase**: Phase 4 - Webhook Integration
