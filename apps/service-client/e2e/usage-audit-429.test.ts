/**
 * E2E Test — SEO Audit Monthly Cap Enforcement (Free Tier, 429 path)
 *
 * Different shape from client-ceiling: the audit flow is modal-driven, the
 * cap is monthly-rolling (not a hard count), and the failure signal is 429
 * (transient this month) not 422 (tier-wide rule). Tests the modal state we
 * built in RegionSelectorModal.svelte.
 *
 * Also proves the end-to-end integration of:
 *   SvelteKit startAudit remote fn
 *     -> Go handleStartAudit handler
 *     -> usage.Consume(FeatureSEOAudit)
 *     -> SQL ConsumeIfUnderLimit
 *     -> sql.ErrNoRows -> usage.ErrLimitExceeded
 *     -> HTTP 429 with reset_date body
 *     -> classifyError in the modal
 *     -> visible alert + Upgrade CTA
 *
 * Tag: @smoke — high value because it covers the entire usage-tracking stack
 * in one assertion pass. If this test passes, most other 429s probably work.
 *
 * Prerequisites (same scaffold as usage-client-ceiling.test.ts):
 *   - Test agency on Free tier (SEO audit cap = 2/month)
 *   - One client with a crawled website (audit needs a source URL)
 *   - Login helper that skips the UI
 *   - A way to force-set agency_usage.count to reproduce the at-limit state
 *     fast — otherwise every run has to burn the full quota first
 */

import { expect, test } from "@playwright/test";

const TEST_AGENCY_SLUG = "test-agency";
const TEST_CLIENT_ID = "00000000-0000-4000-8000-000000000001"; // seeded
const FREE_TIER_AUDIT_CAP = 2; // keep in sync with TIER_LIMITS.free.seo_audit

/**
 * Seeds the current month's agency_usage row to `count` audits so the next
 * audit attempt is at/over the cap. Uses a test-only admin endpoint rather
 * than the UI — a full-cap-via-UI run would take ~90s and hit external APIs.
 *
 * TODO: implement POST /api/test-fixtures/set-usage  { agencyId, feature, count }
 * behind a `NODE_ENV === 'test'` guard.
 */
async function forceUsageCount(
	request: import("@playwright/test").APIRequestContext,
	args: { agencySlug: string; feature: string; count: number },
) {
	const res = await request.post("/api/test-fixtures/set-usage", {
		data: args,
	});
	if (!res.ok()) throw new Error(`set-usage fixture failed: ${res.status()}`);
}

test.describe("SEO audit monthly cap — Free tier @smoke", () => {
	test.beforeEach(async ({ page }) => {
		// TODO: login helper sets access_token cookie
		await page.goto(`/${TEST_AGENCY_SLUG}/content/${TEST_CLIENT_ID}`);
	});

	test("429 response surfaces upgrade CTA in the audit modal", async ({
		page,
		request,
	}) => {
		// Force agency to be at the audit cap without running real audits
		await forceUsageCount(request, {
			agencySlug: TEST_AGENCY_SLUG,
			feature: "seo_audit",
			count: FREE_TIER_AUDIT_CAP,
		});
		await page.reload();

		// Capture the POST to content-service so we can assert on status
		const responsePromise = page.waitForResponse(
			(r) => r.url().includes("/api/content/audit/") && r.request().method() === "POST",
		);

		// Open the audit modal (button label depends on prior audit history —
		// accept either because this test runs across both states)
		await page.click('button:has-text("Run Audit"), button:has-text("Re-run Audit")');
		await expect(page.locator("text=Start SEO Audit")).toBeVisible();

		// Submit with default region (au)
		await page.click('button:has-text("Start Audit")');

		const response = await responsePromise;
		expect(response.status()).toBe(429);

		// Response body includes the reset hint from app/pkg/usage
		const body = await response.json();
		expect(body).toMatchObject({
			success: false,
			message: expect.stringMatching(/limit.*reached/i),
		});

		// Modal stays open and renders the server message + CTA
		await expect(page.locator(".modal-open .alert-error")).toContainText(
			/limit.*reached/i,
		);
		const cta = page.locator('.modal-open a:has-text("Upgrade plan")');
		await expect(cta).toBeVisible();

		// CTA routes to the billing page (not a full reload — this test shouldn't
		// care about page content after navigation, just that the href is correct)
		await expect(cta).toHaveAttribute(
			"href",
			`/${TEST_AGENCY_SLUG}/settings/billing`,
		);

		// The Start Audit button should be re-enabled (not stuck in loading state)
		// so the user could adjust region and retry on next cycle
		await expect(page.locator('button:has-text("Start Audit")')).toBeEnabled();
	});

	test("audits at cap - 1 still succeed", async ({ page, request }) => {
		// At limit - 1 → one audit should complete cleanly
		await forceUsageCount(request, {
			agencySlug: TEST_AGENCY_SLUG,
			feature: "seo_audit",
			count: FREE_TIER_AUDIT_CAP - 1,
		});
		await page.reload();

		await page.click('button:has-text("Run Audit"), button:has-text("Re-run Audit")');
		await expect(page.locator("text=Start SEO Audit")).toBeVisible();

		const responsePromise = page.waitForResponse(
			(r) => r.url().includes("/api/content/audit/") && r.request().method() === "POST",
		);
		await page.click('button:has-text("Start Audit")');
		const response = await responsePromise;

		// 200 OK (or 202 Accepted — audits are async) either way: not 4xx
		expect(response.status()).toBeLessThan(400);

		// Modal closes, UI transitions to audit-in-progress state
		await expect(page.locator("text=Start SEO Audit")).not.toBeVisible();
		// TODO: assert on the audit-in-progress indicator once we know its selector
	});
});
