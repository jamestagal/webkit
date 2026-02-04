# Billing System Learnings

*Updated: 2026-02-01*

## Idempotent Billing Status Pattern

When implementing payment flows with async webhook updates, use the **idempotent status endpoint pattern**:

1. Accept optional `sessionId` parameter on status endpoints
2. If provided, check Stripe directly and sync to DB if behind
3. Return the now-correct data

This eliminates race conditions between checkout redirect and webhook processing.

**Why this pattern is best:**
- Server-side sync is simpler than client-side polling → sync → reload sequences
- Single endpoint that always returns truth
- Self-healing - works even if previous sync failed
- No frontend complexity - data is correct on first render

**Evolution of approaches tried:**
1. ❌ Wait for webhook with arbitrary delay - unreliable
2. ❌ Poll Stripe + call sync endpoint + reload - complex, race conditions
3. ✅ Idempotent endpoint with auto-sync - simple, robust

**Implementation:**
- `GetBillingInfo(ctx, agencyID, sessionID)` - auto-syncs if sessionID provided
- `syncIfNeeded()` - checks DB first, only queries Stripe if subscription missing
- Server-side load passes `session_id` from URL to endpoint
- Frontend just shows success toast - no API calls needed

**Files:**
- `app/service-core/domain/billing/service.go` - `syncIfNeeded()` helper
- `service-client/src/routes/(app)/[agencySlug]/settings/billing/+page.server.ts`
- `service-client/src/lib/api/billing.remote.ts`

## Stripe SDK Compatibility

The Stripe Go SDK v82 doesn't expose `CurrentPeriodEnd` directly on subscription structs. Use JSON marshaling to extract:

```go
subJSON, _ := json.Marshal(subscription)
var rawSub map[string]interface{}
_ = json.Unmarshal(subJSON, &rawSub)
if periodEnd, ok := rawSub["current_period_end"].(float64); ok {
    endDate = time.Unix(int64(periodEnd), 0)
}
```

## Success URL with Session ID

Stripe Checkout success URLs support the `{CHECKOUT_SESSION_ID}` placeholder:

```go
SuccessURL: stripe.String(fmt.Sprintf("%s/%s/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}", baseURL, agencySlug))
```

This is replaced by Stripe with the actual session ID on redirect.
