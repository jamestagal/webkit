# UX Messaging Audit — Issues Identified

**Date:** 2026-04-06
**Priority:** Pre-beta launch

## Problem 1: Generic Error Messages

Client-side catch blocks discard the server's error detail and show generic messages like "Failed to create client" when the server actually sends "A client with this email already exists".

**Pattern in code:**
```typescript
catch (err) {
    toast.error("Failed to create client", err instanceof Error ? err.message : "");
}
```

The `error(400, "A client with this email already exists")` from SvelteKit remote functions throws an `HttpError` with the message in `err.body.message`, but the catch block only checks `err.message` (which is the HTTP status text, not the body).

**Fix needed:** Extract the actual error message from `err.body?.message` for SvelteKit HttpErrors across all remote function call sites.

## Problem 2: Silent Feature Gating

When a user's plan tier doesn't include a feature (e.g., SEO Audits on Starter plan), clicking the button does nothing — no message, no indication, no redirect to billing.

**Examples found:**
- SEO Audit button: silently does nothing on plans without SEO audit access
- Likely other tier-gated features have the same issue

**Fix needed:** When a tier check fails, show a clear message explaining what's needed and link to the billing/upgrade page. Could be:
- A toast with "Upgrade to Growth to access SEO Audits" + link
- A modal explaining the feature and showing upgrade options
- Disabling the button with a tooltip explaining why

## Scope

This is a systemic issue affecting the whole app. Needs an audit of:
1. All `catch` blocks that call `toast.error()` — fix error message extraction
2. All tier-gated features — add clear messaging when blocked
3. Form validation — surface field-level errors where applicable (e.g., duplicate email)
