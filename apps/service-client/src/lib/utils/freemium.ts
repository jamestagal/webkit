/**
 * Normalize a YYYY-MM-DD date input (or empty/null/undefined) into an ISO timestamp string
 * pinned to end-of-day UTC, or null when no expiry is set.
 *
 * End-of-day UTC matches typical billing/expiry semantics — the agency keeps access through
 * the chosen calendar day in any timezone. Shared between the modal (client-side conversion
 * before submit, since the wire schema is v.isoTimestamp()) and the server handler so date
 * math doesn't drift across two implementations.
 */
export function normalizeExpiry(input: string | null | undefined): string | null {
	if (!input) return null;
	return new Date(input + "T23:59:59.999Z").toISOString();
}
