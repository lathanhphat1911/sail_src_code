# Quick Start Guide - Phase 1-3 Implementation

## 🚀 Getting Started

### 1. Database Setup
```bash
cd sail-node/pockit-api

# Apply migrations
npx prisma migrate dev --name add_casso_bank_connections_phase2

# View database
npx prisma studio  # Opens http://localhost:5555
```

### 2. Start Development Server
```bash
npm run start:dev
# Server runs on http://localhost:3000
```

### 3. Test First Endpoint
```bash
# Make sure you have a valid JWT token first!
curl -X GET http://localhost:3000/bank-connections \
  -H "Authorization: Bearer {your_jwt_token}"
```

---

## 📋 Complete Flow - Step by Step

### Scenario: User contributes to crew

**Step 1: User authenticates & gets JWT token**
- Already implemented in Phase 0 (auth module)
- JWT stored in Authorization header

**Step 2: User connects bank account**
```bash
POST /bank-connections/connect
{
  "bank_name": "Vietcombank",
  "bank_bin": "970436",
  "account_number": "1012345678",
  "account_name": "NGUYEN VAN A",
  "casso_connection_id": "casso_abc123"
}
```
Response:
```json
{
  "id": "bc-uuid-1",
  "bank_name": "Vietcombank",
  "is_active": true
}
```

**Step 3: Crew leader assigns bank to crew**
```bash
POST /crews/{crew_uuid}/link-bank
{
  "bank_connection_id": "bc-uuid-1"
}
```
Response:
```json
{
  "crew_id": "crew-uuid",
  "bank_connection": {
    "bank_name": "Vietcombank",
    "account_number": "1012345678"
  }
}
```

**Step 4: Member creates contribution**
```bash
POST /contributions/create
{
  "crewId": "crew-uuid",
  "amount": 500000
}
```
Response:
```json
{
  "contributionId": "ctr-uuid-1",
  "amount": 500000,
  "memo": "SAIL-01JXYZABCDEF",
  "status": "PENDING",
  "qrUrl": "https://img.vietqr.io/image/970436-1012345678.png?amount=500000&addInfo=SAIL-01JXYZABCDEF",
  "bankInfo": {
    "bankName": "Vietcombank",
    "accountNumber": "1012345678",
    "accountName": "NGUYEN VAN A"
  }
}
```

**Step 5: Frontend displays QR**
- Show QR image from `qrUrl`
- Display `memo` prominently
- Show bank account details
- Include ⚠️ warning about not modifying memo

**Step 6: User transfers money via bank app**
- Scan QR or manually enter details
- Amount: 500000
- Memo: SAIL-01JXYZABCDEF
- To: Vietcombank account 1012345678

**Step 7: Casso webhook detects transfer** (Phase 4)
- POST /webhooks/casso from Casso infrastructure
- Backend finds contribution by memo
- Updates status to SUCCESS
- Emits Socket.IO event

**Step 8: Frontend updates UI** (Phase 5)
- Receives realtime notification
- Updates contribution status to SUCCESS
- Refreshes crew balance
- Shows success message

---

## 🧪 Testing with Postman

### Setup Collection Variables
1. Create Postman collection
2. Add variables:
   - `base_url` = `http://localhost:3000`
   - `jwt_token` = `{your_jwt_token}`
   - `crew_id` = `{your_crew_uuid}`
   - `bank_id` = (will be set from response)
   - `contribution_id` = (will be set from response)

### Test Requests

**1. List Bank Connections**
```
GET {{base_url}}/bank-connections
Headers: Authorization: Bearer {{jwt_token}}
```

**2. Create Bank Connection**
```
POST {{base_url}}/bank-connections/connect
Headers: 
  Authorization: Bearer {{jwt_token}}
  Content-Type: application/json
Body:
{
  "bank_name": "Vietcombank",
  "bank_bin": "970436",
  "account_number": "1012345678",
  "account_name": "NGUYEN VAN A",
  "casso_connection_id": "casso_test_{{$randomInt}}"
}

Tests:
pm.environment.set("bank_id", pm.response.json().id);
```

**3. Link Bank to Crew**
```
POST {{base_url}}/crews/{{crew_id}}/link-bank
Headers: 
  Authorization: Bearer {{jwt_token}}
  Content-Type: application/json
Body:
{
  "bank_connection_id": "{{bank_id}}"
}
```

**4. Create Contribution**
```
POST {{base_url}}/contributions/create
Headers: 
  Authorization: Bearer {{jwt_token}}
  Content-Type: application/json
Body:
{
  "crewId": "{{crew_id}}",
  "amount": 500000
}

Tests:
pm.environment.set("contribution_id", pm.response.json().contributionId);
pm.environment.set("memo", pm.response.json().memo);
```

**5. Get Contribution**
```
GET {{base_url}}/contributions/{{contribution_id}}
Headers: Authorization: Bearer {{jwt_token}}
```

**6. List My Contributions**
```
GET {{base_url}}/contributions/user/me
Headers: Authorization: Bearer {{jwt_token}}
```

**7. List Crew Contributions**
```
GET {{base_url}}/contributions/crew/{{crew_id}}
Headers: Authorization: Bearer {{jwt_token}}
```

---

## 🐛 Common Issues & Solutions

### Issue: 404 Crew Not Found
**Solution**: Make sure crew_id is correct UUID format
```bash
# Verify crew exists
npx prisma studio  # Check crews table
```

### Issue: 400 Crew Has No Linked Bank
**Solution**: Follow step 3 above to link bank first
```bash
POST /crews/{crew_id}/link-bank
```

### Issue: 400 Invalid UUID Format
**Solution**: Check parameter is valid UUID
```bash
# Valid: 550e8400-e29b-41d4-a716-446655440000
# Invalid: crew_123 or not-a-uuid
```

### Issue: 401 Unauthorized
**Solution**: JWT token missing or expired
```bash
# Check token in Authorization header
Authorization: Bearer {token_here}
```

### Issue: 403 Forbidden (Linking Bank)
**Solution**: Only crew leader can link bank
```bash
# Make sure authenticated user is crew.owner_id
```

---

## 📊 Database Inspection

### View All Data
```bash
npx prisma studio
```

### Query Specific Table
```bash
# In Node.js
const prisma = new PrismaClient();

// Get all bank connections for user
const banks = await prisma.bank_connections.findMany({
  where: { user_id: "user_uuid" }
});

// Get crew with bank
const crew = await prisma.crews.findUnique({
  where: { id: "crew_uuid" },
  include: { bank_connection: true }
});

// Get all contributions
const contributions = await prisma.contributions.findMany({
  include: { payer: true, crew: true }
});

await prisma.$disconnect();
```

---

## 📁 File Structure Reference

```
src/
├── app.module.ts (updated)
├── app.controller.ts
├── app.service.ts
├── main.ts
├── prisma.service.ts
├── prisma.module.ts
│
├── auth/
│   └── ... (existing)
│
├── users/
│   └── ... (existing)
│
├── crews/
│   ├── crews.controller.ts (updated)
│   ├── crews.service.ts (existing)
│   ├── crews.module.ts (updated)
│   └── ...
│
├── bank-accounts/
│   └── ... (existing - different from bank-connections!)
│
├── bank-connections/ (NEW - Phase 2)
│   ├── bank-connections.controller.ts
│   ├── bank-connections.service.ts
│   ├── bank-connections.module.ts
│   └── dto/
│       ├── create-bank-connection.dto.ts
│       └── link-bank-to-crew.dto.ts
│
├── contributions/ (NEW - Phase 3)
│   ├── contributions.controller.ts
│   ├── contributions.service.ts
│   ├── contributions.module.ts
│   └── dto/
│       └── create-contribution.dto.ts
│
├── crew-periods/
│   └── ... (existing)
│
├── stories/
│   └── ... (existing)
│
├── achievements/
│   └── ... (existing)
│
└── cloudinary/
    └── ... (existing)

prisma/
├── schema.prisma (updated - Phase 1)
└── migrations/
    └── [migration_files]
```

---

## 🔄 Development Workflow

### When Making Changes

1. **Edit files in src/**
2. **Server auto-reloads** (with npm run start:dev)
3. **Check errors** in terminal
4. **Test in Postman**

### When Adding Database Changes

1. **Update prisma/schema.prisma**
2. **Run**: `npx prisma migrate dev --name description_of_change`
3. **Prisma auto-generates client types**
4. **Restart server if needed**

### When Updating Dependencies

1. **Run**: `npm install package_name`
2. **Commit package.json & package-lock.json**
3. **Restart server**: `npm run start:dev`

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| IMPLEMENTATION_SUMMARY_PHASE_1_3.md | Complete overview of all 3 phases |
| PHASE_2_COMPLETE.md | Phase 2 specific details |
| PHASE_3_COMPLETE.md | Phase 3 specific details |
| API_REFERENCE_PHASE_1_3.md | All endpoints reference |
| QUICK_START.md | This file |

---

## 🎯 Next Phase: Phase 4

After confirming Phases 1-3 work:

1. **Implement Webhook Endpoint**
   - POST /webhooks/casso
   - Signature verification
   - Memo extraction

2. **Process Transfers**
   - Find contribution by memo
   - Validate amount matches
   - Update status to SUCCESS
   - Create payment_event record

3. **Emit Realtime Events**
   - Socket.IO integration
   - Notify all crew members
   - Update UI

4. **Add Expiration Job**
   - Scheduled task (cron)
   - Mark old contributions EXPIRED
   - Cleanup utility

---

## 🚨 Important Notes

### Security Reminders
- ⚠️ **Frontend cannot confirm payments** - Only webhook can
- ⚠️ **No internal balances held** - Backend is stateless
- ⚠️ **Not a custodial wallet** - Only routes transfers
- ⚠️ **JWT required** on all endpoints except webhook
- ⚠️ **Webhook needs signature** verification (Phase 4)

### Common Mistakes to Avoid
- ❌ Don't remove `@UseGuards(AuthGuard('jwt'))` from endpoints
- ❌ Don't let frontend create contributions without crew bank
- ❌ Don't accept manual confirmation - wait for webhook
- ❌ Don't expose bank_connection_id in frontend
- ❌ Don't allow updating contribution status via API

---

## 📞 Quick Reference Commands

```bash
# Start development
npm run start:dev

# Run tests
npm test

# Build for production
npm run build

# View database
npx prisma studio

# Check database connection
npx prisma db execute --stdin  # Type: SELECT 1;

# Generate Prisma client
npx prisma generate

# View migrations
ls prisma/migrations/

# Seed database (if setup)
npx prisma db seed
```

---

## ✅ Verification Checklist

Before moving to Phase 4:

- [ ] Database migrations applied
- [ ] Can connect bank account
- [ ] Can list connected banks
- [ ] Can link bank to crew
- [ ] Can create contribution
- [ ] Contribution has unique memo
- [ ] QR URL is valid format
- [ ] All errors handled gracefully
- [ ] Authorization checks working
- [ ] Documentation complete

---

**Ready?** Run your first test in Postman and let's go! 🚀
