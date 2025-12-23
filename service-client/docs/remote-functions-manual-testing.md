# Manual Testing Guide for Remote Functions

This guide provides step-by-step instructions for manually testing the consultation remote functions (Task 2.7-2.8).

## Prerequisites

1. **Start Backend Services**
   ```bash
   docker compose up
   ```
   - Core service should be running on http://localhost:4001
   - PostgreSQL should be accessible
   - Ensure you have a test user account

2. **Start Frontend Dev Server**
   ```bash
   cd service-client
   npm run dev
   ```
   - Frontend should be running on http://localhost:3000

3. **Login to Test Account**
   - Navigate to http://localhost:3000/login
   - Login with test credentials
   - Verify `access_token` cookie is set (check DevTools > Application > Cookies)

## Testing Checklist

### Subtask 2.7: Cookie-Based Authentication Verification

Open browser DevTools (F12) and navigate to the **Network** tab. Keep it open during all tests.

#### Test 1: getOrCreateConsultation()

**Browser Console:**
```javascript
// Import the remote function
const { getOrCreateConsultation } = await import('/src/lib/api/consultation.remote.ts');

// Call the function
const consultation = await getOrCreateConsultation();
console.log('Created consultation:', consultation);
```

**Expected Network Request:**
- Method: POST
- URL: http://localhost:4001/consultations
- Headers should include: `Cookie: access_token=...`
- Request Credentials: include
- Status: 201 Created

**Expected Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "status": "draft",
  "completion_percentage": 0,
  "created_at": "2025-10-24T...",
  "updated_at": "2025-10-24T..."
}
```

**Verification:**
- ✅ Response contains valid consultation object
- ✅ Status is "draft"
- ✅ Cookie was sent with request
- ✅ No errors thrown

---

#### Test 2: getConsultation(id)

**Browser Console:**
```javascript
const { getConsultation } = await import('/src/lib/api/consultation.remote.ts');

// Use the ID from previous test
const consultationId = 'YOUR_CONSULTATION_ID_HERE';
const consultation = await getConsultation(consultationId);
console.log('Retrieved consultation:', consultation);
```

**Expected Network Request:**
- Method: GET
- URL: http://localhost:4001/consultations/{id}
- Headers should include: `Cookie: access_token=...`
- Status: 200 OK

**Verification:**
- ✅ Response matches consultation from Test 1
- ✅ Cookie was sent with request
- ✅ All fields properly parsed

---

#### Test 3: getDraft(id)

**Browser Console:**
```javascript
const { getDraft } = await import('/src/lib/api/consultation.remote.ts');

const consultationId = 'YOUR_CONSULTATION_ID_HERE';
const draft = await getDraft(consultationId);
console.log('Retrieved draft:', draft);
```

**Expected Network Request:**
- Method: GET
- URL: http://localhost:4001/consultations/{id}/drafts
- Status: 404 Not Found (expected - no draft exists yet)

**Verification:**
- ✅ Returns null (not an error)
- ✅ Cookie was sent with request
- ✅ 404 handled gracefully

---

#### Test 4: autoSaveDraft()

**Browser Console:**
```javascript
const { autoSaveDraft } = await import('/src/lib/api/consultation.remote.ts');

const consultationId = 'YOUR_CONSULTATION_ID_HERE';
const draftData = {
  contact_info: {
    business_name: 'Test Corporation',
    email: 'test@example.com'
  }
};

const savedDraft = await autoSaveDraft({
  consultationId,
  data: draftData
});
console.log('Saved draft:', savedDraft);
```

**Expected Network Request:**
- Method: POST
- URL: http://localhost:4001/consultations/{id}/drafts
- Headers: `Content-Type: application/json`, `Cookie: access_token=...`
- Status: 201 Created

**Expected Response:**
```json
{
  "id": "uuid",
  "consultation_id": "uuid",
  "user_id": "uuid",
  "parsed_contact_info": {
    "business_name": "Test Corporation",
    "email": "test@example.com"
  },
  "created_at": "2025-10-24T...",
  "updated_at": "2025-10-24T..."
}
```

**Verification:**
- ✅ Draft created successfully
- ✅ Cookie was sent with request
- ✅ Data properly saved

---

#### Test 5: getDraft() with existing draft

**Browser Console:**
```javascript
const { getDraft } = await import('/src/lib/api/consultation.remote.ts');

const consultationId = 'YOUR_CONSULTATION_ID_HERE';
const draft = await getDraft(consultationId);
console.log('Retrieved draft:', draft);
```

**Expected Network Request:**
- Method: GET
- URL: http://localhost:4001/consultations/{id}/drafts
- Status: 200 OK

**Verification:**
- ✅ Returns draft object (not null)
- ✅ Contains data from Test 4
- ✅ Cookie was sent with request

---

#### Test 6: completeConsultation()

**Browser Console:**
```javascript
const { completeConsultation } = await import('/src/lib/api/consultation.remote.ts');

const consultationId = 'YOUR_CONSULTATION_ID_HERE';
const completedConsultation = await completeConsultation({ consultationId });
console.log('Completed consultation:', completedConsultation);
```

**Expected Network Request:**
- Method: POST
- URL: http://localhost:4001/consultations/{id}/complete
- Headers: `Content-Type: application/json`, `Cookie: access_token=...`
- Status: 200 OK

**Expected Response:**
```json
{
  "id": "uuid",
  "status": "completed",
  "completion_percentage": 100,
  "completed_at": "2025-10-24T...",
  ...
}
```

**Verification:**
- ✅ Status changed to "completed"
- ✅ Completion percentage is 100
- ✅ completed_at timestamp set
- ✅ Cookie was sent with request
- ✅ **THIS IS THE CRITICAL BUG FIX** - endpoint is called

---

#### Test 7: listConsultations()

**Browser Console:**
```javascript
const { listConsultations } = await import('/src/lib/api/consultation.remote.ts');

const result = await listConsultations({
  page: 1,
  limit: 20,
  status: 'completed'
});
console.log('Consultation list:', result);
```

**Expected Network Request:**
- Method: GET
- URL: http://localhost:4001/consultations?page=1&limit=20&status=completed
- Headers should include: `Cookie: access_token=...`
- Status: 200 OK

**Expected Response:**
```json
{
  "consultations": [
    { "id": "uuid", "status": "completed", ... }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "has_more": false
}
```

**Verification:**
- ✅ Returns paginated list
- ✅ Query parameters properly serialized
- ✅ Cookie was sent with request

---

### Subtask 2.8: Error Response Verification

#### Test 8: 401 Unauthorized (Expired Token)

**Browser Console:**
```javascript
// Delete the access_token cookie
document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

const { getConsultation } = await import('/src/lib/api/consultation.remote.ts');

try {
  await getConsultation('123e4567-e89b-12d3-a456-426614174000');
} catch (error) {
  console.log('401 Error handled:', error.message);
}
```

**Expected:**
- ❌ Request fails with 401 status
- ✅ Error thrown with message
- ✅ Error message indicates authentication failure

**Re-login after this test!**

---

#### Test 9: 404 Not Found (Invalid ID)

**Browser Console:**
```javascript
const { getConsultation } = await import('/src/lib/api/consultation.remote.ts');

try {
  await getConsultation('00000000-0000-0000-0000-000000000000');
} catch (error) {
  console.log('404 Error handled:', error.message);
}
```

**Expected:**
- ❌ Request fails with 404 status
- ✅ Error thrown with message
- ✅ Error message indicates resource not found

---

#### Test 10: 400 Bad Request (Invalid UUID)

**Browser Console:**
```javascript
const { getConsultation } = await import('/src/lib/api/consultation.remote.ts');

try {
  await getConsultation('not-a-valid-uuid');
} catch (error) {
  console.log('Validation Error handled:', error.message);
}
```

**Expected:**
- ❌ Zod validation fails before API call
- ✅ Error thrown with validation message
- ✅ No network request made (pre-validation)

---

#### Test 11: 500 Internal Server Error (Simulated)

This test requires backend simulation. Skip if backend doesn't have error injection.

**Expected:**
- ❌ Request fails with 500 status
- ✅ Error thrown with message
- ✅ Error properly propagated to caller

---

## Database Verification

After completing all tests, verify in the database:

```sql
-- Check consultation status
SELECT id, status, completion_percentage, completed_at, created_at
FROM consultations
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;

-- Check draft
SELECT id, consultation_id, parsed_contact_info, updated_at
FROM consultation_drafts
WHERE consultation_id = 'YOUR_CONSULTATION_ID';
```

**Expected:**
- ✅ Consultation exists with status "completed"
- ✅ completed_at timestamp is set
- ✅ Draft exists with saved contact_info data

---

## Success Criteria

All tests should pass with:
- ✅ All API calls include `credentials: 'include'`
- ✅ All cookies properly sent with requests
- ✅ All successful responses properly validated with Zod
- ✅ All error responses properly handled
- ✅ Critical bug fix verified: completeConsultation() calls completion endpoint
- ✅ Database reflects expected state changes

## Troubleshooting

### Cookie Not Sent
**Symptom:** 401 Unauthorized despite being logged in
**Solution:**
- Check SameSite cookie settings in backend
- Verify CORS configuration allows credentials
- Ensure frontend and backend on same domain or proper CORS setup

### CORS Error
**Symptom:** Network request blocked by CORS policy
**Solution:**
- Verify backend CORS allows http://localhost:3000
- Check `Access-Control-Allow-Credentials: true` header
- Confirm OPTIONS preflight requests succeed

### Import Error
**Symptom:** Cannot find module in browser console
**Solution:**
- Use DevTools Sources tab to verify file path
- Check if TypeScript compilation succeeded
- Try refreshing page to clear module cache

---

## Next Steps

After all manual tests pass:
- ✅ Mark subtasks 2.7 and 2.8 complete in tasks.md
- ➡️ Proceed to Task 3: Implement form step remote functions
- 📝 Document any issues or edge cases discovered during testing
