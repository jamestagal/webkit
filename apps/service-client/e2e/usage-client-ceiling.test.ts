/**
 * E2E Test — Client Ceiling Enforcement (Free Tier)
 *
 * Verifies that creating clients beyond the tier's max_clients cap is blocked
 * with a visible 422 message, and that clients ≤ the cap succeed silently.
 *
 * Why E2E and not unit:
 * - The ceiling is enforced in a remote function (server-side) but the user
 *   sees it in a modal (client-side). Unit tests can't prove the message
 *   reaches the DOM, the status propagates as 422, or the form stays open.
 * - Equivalent flow must keep working after future refactors of either layer.
 *
 * Tag: @smoke — this is one of the critical-path journeys that runs before
 * every deploy. Other tests (full list pagination, editing, archival) go in
 * a separate untagged suite.
 *
 * Prerequisites (scaffold TODOs — not implemented in this sketch):
 *   1. A seeded test agency on Free tier with zero clients
 *   2. A seeded test user with member access to that agency
 *   3. A login helper that sets session cookies without going through the UI
 *      (UI-driven login burns 10+ seconds per test)
 *   4. A DB reset / truncation helper between tests for isolation
 */

import { expect, test } from "@playwright/test";

// Test fixture constants — these would come from a seed script in real use.
const TEST_AGENCY_SLUG = "test-agency";
const FREE_TIER_CLIENT_CAP = 3; // keep in sync with TIER_LIMITS.free.max_clients

/**
 * Helper — creates a client via the UI. A real implementation would also
 * offer a DB/API path for bulk seeding (used when the test only cares about
 * the "at cap" assertion and not the happy path).
 */
async function createClientViaUI(
	page: import("@playwright/test").Page,
	client: { businessName: string; email: string },
) {
	await page.click('button:has-text("New Client")');
	await page.fill('input[name="businessName"]', client.businessName);
	await page.fill('input[name="email"]', client.email);
	await page.click('button:has-text("Create")');
}

test.describe("Client ceiling — Free tier @smoke", () => {
	test.beforeEach(async ({ page }) => {
		// TODO: seed `${TEST_AGENCY_SLUG}` on Free tier with no clients
		// TODO: login helper that sets the access_token cookie directly
		await page.goto(`/${TEST_AGENCY_SLUG}/clients`);
	});

	test("creates clients up to the cap", async ({ page }) => {
		// Verify starting empty state
		await expect(page.locator("text=No clients yet")).toBeVisible();

		// Create exactly max_clients clients (cap = 3 on Free)
		for (let i = 1; i <= FREE_TIER_CLIENT_CAP; i++) {
			await createClientViaUI(page, {
				businessName: `Acme ${i}`,
				email: `acme${i}@example.com`,
			});
			// Each creation should close the modal and render the new row
			await expect(page.locator(`text=Acme ${i}`)).toBeVisible();
		}

		// Sanity — list should have exactly cap rows
		const rows = page.locator('[data-testid="client-row"]');
		await expect(rows).toHaveCount(FREE_TIER_CLIENT_CAP);
	});

	test("blocks the cap+1th client with a 422 and a visible upgrade message", async ({
		page,
	}) => {
		// Fast-path: seed 3 clients via API fixture (not UI — would take 15s+).
		// TODO: await seedClientsForAgency(TEST_AGENCY_SLUG, FREE_TIER_CLIENT_CAP);
		await page.reload();

		// Track the POST response so we can assert on the HTTP status
		const responsePromise = page.waitForResponse(
			(r) => r.request().method() === "POST" && r.url().includes("createClient"),
		);

		await createClientViaUI(page, {
			businessName: "Acme 4",
			email: "acme4@example.com",
		});

		const response = await responsePromise;

		// Contract assertion: the server returns 422, not 500 or 429
		expect(response.status()).toBe(422);

		// UX assertion: the user sees a message that explains the cap
		// and invites an upgrade — not a generic "something went wrong"
		await expect(page.locator(".alert-error, [role='alert']")).toContainText(
			/plan supports up to 3 clients/i,
		);
		await expect(page.locator('a:has-text("Upgrade plan")')).toBeVisible();

		// The new-client modal should STAY OPEN so the user's input isn't lost
		await expect(page.locator('input[name="businessName"]')).toHaveValue(
			"Acme 4",
		);

		// The list should still have exactly FREE_TIER_CLIENT_CAP rows —
		// proves no row leaked through on the failed create.
		await expect(page.locator('[data-testid="client-row"]')).toHaveCount(
			FREE_TIER_CLIENT_CAP,
		);
	});
});
