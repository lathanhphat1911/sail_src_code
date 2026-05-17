# Phase 3: Create Contribution Transactions

## Overview
This phase implements the contribution creation flow with automatic VietQR generation and unique memo creation for automatic transfer detection.

## What's Been Implemented

### 1. Contributions Module
✅ **New Module**: `src/contributions/`
- Service with contribution lifecycle management
- Controller with endpoints for creation and retrieval
- DTOs for type safety

### 2. Core Features Implemented

#### Unique Memo Generation
- Format: `SAIL-{ULID}`
- ULID uses Crockford Base32 encoding
- 16 characters total (10 timestamp + 6 random)
- Properties:
  - Globally unique
  - Not predictable
  - Doesn't expose internal IDs
  - Sortable by timestamp
  - Collision probability: ~1 billion combinations

#### VietQR URL Generation
- Format: `https://img.vietqr.io/image/{bin}-{account}.png?amount={amount}&addInfo={memo}`
- Includes:
  - Bank BIN code
  - Account number
  - Transaction amount
  - Contribution memo

#### Contribution Creation Flow
1. ✅ Validate crew exists
2. ✅ Validate crew has linked bank connection
3. ✅ Verify bank connection is active
4. ✅ Generate unique memo
5. ✅ Create contribution with `status=PENDING`
6. ✅ Generate VietQR URL
7. ✅ Return all metadata to frontend

---

## API Endpoints - Phase 3

### Contribution Creation

#### 1. Create Contribution (Main Endpoint)
```
POST /contributions/create
Authorization: Bearer {jwt_token}

Request:
{
  "crewId": "crew-uuid",
  "amount": 500000
}

Response:
{
  "contributionId": "contrib-uuid",
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
  "createdAt": "2026-05-17T10:00:00Z"
}
```

Error Cases:
- `404 Not Found` - Crew doesn't exist
- `400 Bad Request` - Crew has no linked bank
- `400 Bad Request` - Linked bank is inactive

---

### Contribution Retrieval

#### 2. Get Contribution by ID
```
GET /contributions/:id
Authorization: Bearer {jwt_token}

Response:
{
  "id": "contrib-uuid",
  "crew_id": "crew-uuid",
  "payer_id": "user-uuid",
  "amount": "500000",
  "memo": "SAIL-0123456789ABCDEF",
  "status": "PENDING",
  "bank_connection_id": "bank-conn-uuid",
  "created_at": "2026-05-17T10:00:00Z",
  "paid_at": null,
  "crew": { "id": "...", "name": "..." },
  "payer": { "id": "...", "full_name": "..." },
  "bank_connection": { "bank_name": "...", ... }
}
```

#### 3. Get My Contributions
```
GET /contributions/user/me
Authorization: Bearer {jwt_token}

Response: Array of contributions for authenticated user
```

#### 4. Get Crew's Contributions
```
GET /contributions/crew/:crewId
Authorization: Bearer {jwt_token}

Response: Array of all contributions to the crew
```

#### 5. Get Contributions by Status
```
GET /contributions?status=PENDING
Authorization: Bearer {jwt_token}

Response: Array of contributions matching status
```

---

## Implementation Details

### Database Tables Used
- `contributions` - Main contribution records
- `crews` - For validation and linking
- `bank_connections` - For VietQR generation
- `users` - For payer information

### Key Service Methods

**Private Methods:**
- `generateMemo()` - Creates unique SAIL-{ULID} memo
- `generateVietQRUrl()` - Builds VietQR image URL

**Public Methods:**
- `create(userId, dto)` - Main endpoint handler
- `findById(id)` - Get contribution details
- `findByUser(userId)` - User's contributions
- `findByCrew(crewId)` - Crew's contributions
- `findByStatus(status)` - Filter by status

---

## Frontend Integration Guide

### Payment Screen Flow

```
1. User selects crew and amount
   ↓
2. Frontend calls POST /contributions/create
   ↓
3. Backend returns:
   - Contribution ID
   - Memo (for reference)
   - QR code URL
   - Bank info
   ↓
4. Frontend displays:
   - QR code image (from qrUrl)
   - Account number (for manual transfer)
   - Memo (for manual transfer)
   - Amount to transfer
   - ⚠️ WARNING: Do not modify transfer content/memo
```

### Required Frontend Changes

**Remove These (Manual Confirmation):**
- "I transferred" button
- `reportDeposit()` function
- Client-side payment confirmation logic

**Add These (Automatic Detection):**
- Display QR code
- Show memo prominently
- Show bank account details
- Copy buttons for memo/account
- Auto-refresh contribution status

### Example Frontend Implementation

```typescript
// React Native / Expo
const handlePayment = async () => {
  try {
    const response = await POST('/contributions/create', {
      crewId: selectedCrew.id,
      amount: transferAmount
    });
    
    // Display response data
    setContribution(response);
    setShowQRModal(true);
    
    // Poll for status updates (webhook will update in Phase 4)
    startStatusPolling(response.contributionId);
    
  } catch (error) {
    if (error.status === 404) {
      showError("Crew not found");
    } else if (error.status === 400) {
      showError("Crew hasn't set up bank connection yet");
    }
  }
};

// Display QR
<Image 
  source={{ uri: contribution.qrUrl }} 
  style={{ width: 300, height: 300 }} 
/>

// Display memo
<TouchableOpacity onPress={() => copyToClipboard(contribution.memo)}>
  <Text style={styles.memo}>{contribution.memo}</Text>
</TouchableOpacity>
```

---

## Verification Checklist

- ✅ Contributions module created
- ✅ Service implements all requirements
- ✅ Controller has main endpoint
- ✅ DTOs properly validated
- ✅ Module registered in app.module
- ✅ Unique memo generation working
- ✅ VietQR URL generation correct
- ✅ Error handling for missing bank
- ✅ Proper authorization checks

---

## Security Notes

✅ **Phase 3 Security**
- JWT authentication required
- Crew ownership validation (implicit via linking)
- Bank connection validation
- Contribution immutability (status set at creation)

⚠️ **Not Yet Implemented (Phase 4)**
- Webhook verification
- Automatic status updates
- Payment confirmation from Casso
- Double-spend prevention

---

## Next Phase: Phase 4

Phase 4 will implement:
- `POST /webhooks/casso` - Webhook endpoint
- Webhook signature verification
- Idempotent transaction processing
- Atomic contribution status updates
- Duplicate prevention via `payment_events` table

See the Feature Requirements document for Phase 4 details.

---

## Testing Endpoints

### Test in Postman

**1. Create Contribution**
```
POST http://localhost:3000/contributions/create
Headers:
  Authorization: Bearer {jwt_token}
  Content-Type: application/json

Body:
{
  "crewId": "crew-uuid-here",
  "amount": 500000
}
```

**2. Retrieve Contribution**
```
GET http://localhost:3000/contributions/{contribution-id}
Headers:
  Authorization: Bearer {jwt_token}
```

**3. List My Contributions**
```
GET http://localhost:3000/contributions/user/me
Headers:
  Authorization: Bearer {jwt_token}
```

---

## Files Created

1. `src/contributions/contributions.service.ts` - Business logic
2. `src/contributions/contributions.controller.ts` - HTTP endpoints
3. `src/contributions/contributions.module.ts` - NestJS module
4. `src/contributions/dto/create-contribution.dto.ts` - Request DTO

## Files Modified

1. `src/app.module.ts` - Added ContributionsModule import
