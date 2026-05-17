# Phase 1-3 Complete API Reference

## Quick Start - Complete Flow

### 1. User connects bank (Phase 2)
```bash
POST /bank-connections/connect
{
  "bank_name": "Vietcombank",
  "bank_bin": "970436",
  "account_number": "1012345678",
  "account_name": "NGUYEN VAN A",
  "casso_connection_id": "casso_id_from_callback"
}
```

### 2. Crew leader assigns bank to crew (Phase 2)
```bash
POST /crews/{crew_id}/link-bank
{
  "bank_connection_id": "uuid-from-step-1"
}
```

### 3. Crew member creates contribution (Phase 3)
```bash
POST /contributions/create
{
  "crewId": "crew-uuid",
  "amount": 500000
}

Response:
{
  "contributionId": "uuid",
  "amount": 500000,
  "memo": "SAIL-0123456789ABCDEF",
  "status": "PENDING",
  "qrUrl": "https://img.vietqr.io/image/970436-1012345678.png?amount=500000&addInfo=SAIL-0123456789ABCDEF",
  "bankInfo": {
    "bankName": "Vietcombank",
    "bankBin": "970436",
    "accountNumber": "1012345678",
    "accountName": "NGUYEN VAN A"
  },
  "createdAt": "2026-05-17T..."
}
```

### 4. Webhook receives transfer confirmation (Phase 4)
```bash
POST /webhooks/casso
{
  "amount": 500000,
  "description": "SAIL-0123456789ABCDEF",
  "bank_sub_acc_id": "casso_connection_id",
  "transaction_id": "txn_unique_id"
}
```

---

## All Endpoints Summary

### Bank Connections (Phase 2)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/bank-connections/connect` | Register Casso bank | JWT |
| GET | `/bank-connections` | List user's banks | JWT |
| GET | `/bank-connections/:id` | Get specific bank | JWT |
| DELETE | `/bank-connections/:id` | Deactivate bank | JWT |

### Crew Bank Management (Phase 2)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/crews/:id/link-bank` | Assign bank to crew | JWT |
| GET | `/crews/:id/bank-connection` | Get crew's bank | JWT |

### Contributions (Phase 3)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/contributions/create` | Create contribution | JWT |
| GET | `/contributions/:id` | Get contribution | JWT |
| GET | `/contributions/user/me` | My contributions | JWT |
| GET | `/contributions/crew/:crewId` | Crew contributions | JWT |
| GET | `/contributions?status=...` | Filter by status | JWT |

### Webhook (Phase 4)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/webhooks/casso` | Receive transfers | Signature |

---

## Data Models Overview

### bank_connections
```typescript
{
  id: UUID,
  user_id: UUID,
  bank_name: string,
  bank_bin: string,
  account_number: string,
  account_name: string,
  casso_connection_id: string (UNIQUE),
  is_active: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

### contributions
```typescript
{
  id: UUID,
  crew_id: UUID,
  payer_id: UUID,
  amount: decimal,
  memo: string (UNIQUE),  // SAIL-{ULID}
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED',
  bank_connection_id: UUID,
  created_at: timestamp,
  paid_at: timestamp (nullable),
  updated_at: timestamp
}
```

### payment_events
```typescript
{
  id: UUID,
  transaction_id: string (UNIQUE),  // From Casso webhook
  contribution_id: UUID,
  raw_payload: JSON,
  created_at: timestamp
}
```

---

## Status Codes Reference

### Success
- `200 OK` - Request successful
- `201 Created` - Resource created

### Client Errors
- `400 Bad Request` - Invalid input (e.g., crew has no bank, inactive bank)
- `401 Unauthorized` - Missing JWT token
- `403 Forbidden` - Insufficient permissions (e.g., not crew leader)
- `404 Not Found` - Resource doesn't exist

### Server Errors
- `500 Internal Server Error` - Server error

---

## Environment Setup

### Database Migration
```bash
cd sail-node/pockit-api
npx prisma migrate dev --name add_casso_bank_connections_phase2
```

### Required Environment Variables
```
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
CASSO_WEBHOOK_SECRET=your_casso_secret  # Phase 4
```

### Dependencies
Already installed:
- @nestjs/* packages
- @prisma/client
- passport & jwt

Built-in (no npm install needed):
- ULID generation (Crockford Base32)

Optional for better ULID:
```bash
npm install ulid
```

---

## Development Tips

### Testing Endpoints
Use Postman or similar with:
```
Base URL: http://localhost:3000
Header: Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Database Inspection
```bash
npx prisma studio
```

### Rebuild & Run
```bash
npm run build
npm run start:dev
```

---

## Architecture Flow

```
React Native App
        ↓
   Crew Creation
        ↓
   Bank Connection
   (Casso Auth)
        ↓
   Link Bank to Crew
   (POST /crews/:id/link-bank)
        ↓
   Create Contribution
   (POST /contributions/create)
        ↓
   Display QR Code + Memo
        ↓
   User Transfers Via Bank App
        ↓
   Casso Webhook Detects Transfer
   (POST /webhooks/casso)
        ↓
   Backend Validates & Updates Status
        ↓
   Realtime Update to Frontend
   (Socket.IO in Phase 5)
        ↓
   Crew Balance Updated
```

---

## Security Checklist

### Phase 2-3 Implemented
- ✅ JWT authentication on all endpoints
- ✅ User ownership verification
- ✅ Crew leader verification for bank linking
- ✅ Bank connection validation
- ✅ Active status checks

### Phase 4 To Implement
- ⏳ Webhook signature verification
- ⏳ Idempotent webhook processing
- ⏳ Atomic transaction updates
- ⏳ Duplicate prevention

---

## Next Steps

1. **Run migration**: `npx prisma migrate dev --name add_casso_bank_connections_phase2`
2. **Test endpoints** in Postman
3. **Implement Phase 4**: Webhook handling & automatic status updates
4. **Implement Phase 5**: Realtime Socket.IO events
5. **Implement Phase 6**: Contribution expiration cleanup job
