# Phase 2: Bank Connection + Assign Bank to Crew

## Overview
This phase implements bank connection management for group leaders and the ability to assign connected bank accounts to crews for automatic transaction tracking via Casso webhooks.

## What's Been Implemented

### 1. Database Schema
✅ **bank_connections** table
- Stores Casso-monitored bank accounts for each user
- Fields: id, user_id, bank_name, bank_bin, account_number, account_name, casso_connection_id (UNIQUE), is_active, created_at, updated_at

✅ **contributions** table
- Tracks pending/completed contribution payments
- Fields: id, crew_id, payer_id, amount, memo (UNIQUE), status, bank_connection_id, created_at, paid_at, updated_at

✅ **payment_events** table
- Prevents duplicate webhook processing
- Fields: id, transaction_id (UNIQUE), contribution_id, raw_payload, created_at

✅ **crews** table updates
- Added `bank_connection_id` field to link crews to bank connections

---

## API Endpoints - Phase 2

### Bank Connections Management

#### 1. Create Bank Connection (Casso Callback)
```
POST /bank-connections/connect
Authorization: Bearer {jwt_token}

Request:
{
  "bank_name": "Vietcombank",
  "bank_bin": "970436",
  "account_number": "1012345678",
  "account_name": "NGUYEN VAN A",
  "casso_connection_id": "unique_casso_id_from_callback"
}

Response:
{
  "id": "uuid",
  "bank_name": "Vietcombank",
  "bank_bin": "970436",
  "account_number": "1012345678",
  "account_name": "NGUYEN VAN A",
  "casso_connection_id": "unique_casso_id_from_callback",
  "is_active": true,
  "created_at": "2026-05-17T10:00:00Z"
}
```

#### 2. Get All Bank Connections for User
```
GET /bank-connections
Authorization: Bearer {jwt_token}

Response:
[
  {
    "id": "uuid",
    "bank_name": "Vietcombank",
    "bank_bin": "970436",
    "account_number": "1012345678",
    "account_name": "NGUYEN VAN A",
    "is_active": true,
    "created_at": "2026-05-17T10:00:00Z"
  },
  ...
]
```

#### 3. Get Specific Bank Connection
```
GET /bank-connections/:id
Authorization: Bearer {jwt_token}

Response:
{
  "id": "uuid",
  "user_id": "uuid",
  "bank_name": "Vietcombank",
  "bank_bin": "970436",
  "account_number": "1012345678",
  "account_name": "NGUYEN VAN A",
  "is_active": true,
  "created_at": "2026-05-17T10:00:00Z"
}
```

#### 4. Deactivate Bank Connection
```
DELETE /bank-connections/:id
Authorization: Bearer {jwt_token}

Response:
{
  "id": "uuid",
  "bank_name": "Vietcombank",
  "is_active": false
}
```

---

### Crew Bank Connection Management

#### 5. Link Bank Connection to Crew
```
POST /crews/:crew_id/link-bank
Authorization: Bearer {jwt_token}

Request:
{
  "bank_connection_id": "uuid"
}

Response:
{
  "crew_id": "uuid",
  "crew_name": "My Crew",
  "bank_connection": {
    "id": "uuid",
    "bank_name": "Vietcombank",
    "bank_bin": "970436",
    "account_number": "1012345678",
    "account_name": "NGUYEN VAN A"
  }
}
```

Requirements:
- Only crew leader can link bank
- Bank connection must belong to leader
- Only one active bank per crew (updating replaces previous)

#### 6. Get Crew's Current Bank Connection
```
GET /crews/:crew_id/bank-connection
Authorization: Bearer {jwt_token}

Response:
{
  "id": "uuid",
  "bank_name": "Vietcombank",
  "bank_bin": "970436",
  "account_number": "1012345678",
  "account_name": "NGUYEN VAN A",
  "is_active": true
}
```

---

## Implementation Steps

### Step 1: Run Database Migration
```bash
cd sail-node/pockit-api

# Generate migration
npx prisma migrate dev --name add_casso_bank_connections_phase2

# Or push directly (if using db push strategy)
npx prisma db push
```

### Step 2: Verify Module Structure
```
src/
├── bank-connections/
│   ├── dto/
│   │   ├── create-bank-connection.dto.ts
│   │   └── link-bank-to-crew.dto.ts
│   ├── bank-connections.controller.ts
│   ├── bank-connections.service.ts
│   └── bank-connections.module.ts
├── crews/
│   ├── crews.controller.ts (updated)
│   └── crews.module.ts (updated)
└── app.module.ts (updated)
```

### Step 3: Test Endpoints
Use Postman or similar to test:
1. Create bank connection
2. List user's bank connections
3. Link bank to crew
4. Get crew's bank connection
5. Deactivate bank connection

---

## Frontend Integration (Next Phase)

The frontend will need to:

1. **Bank Connection Flow**
   - Redirect to Casso auth page
   - Receive callback with bank details
   - Call POST /bank-connections/connect
   - Display connected banks list from GET /bank-connections

2. **Crew Bank Assignment**
   - Show dropdown of available banks
   - Call POST /crews/:id/link-bank
   - Display current bank via GET /crews/:id/bank-connection

---

## Security Notes

✅ **Phase 2 Security**
- JWT authentication on all endpoints
- Owner/leader verification on link-bank endpoint
- Bank connection ownership verified
- No internal balance storage
- Backend is single source of truth

⚠️ **Not Yet Implemented (Phase 4)**
- Casso webhook signature verification
- Webhook processing idempotency
- Contribution status immutability from frontend

---

## Next Phase: Phase 3

Phase 3 will implement:
- POST /contributions/create - Generate pending contributions
- VietQR generation
- Contribution tracking and status management

See PHASE_3_PLAN.md for details.
