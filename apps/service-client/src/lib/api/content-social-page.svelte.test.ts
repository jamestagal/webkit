/**
 * Component render tests for the social posts page.
 *
 * These tests verify that route components render correctly with mocked
 * dependencies. Svelte 5 runes work with @testing-library/svelte + jsdom
 * as long as $app/state and other SvelteKit modules are mocked.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { SocialCopyResponse } from "$lib/api/content-social.types";

// Mock SvelteKit modules
vi.mock("$app/state", () => ({
	page: {
		params: {
			agencySlug: "test-agency",
			clientId: "550e8400-e29b-41d4-a716-446655440000",
		},
		url: new URL(
			"http://localhost:3000/test-agency/content/550e8400-e29b-41d4-a716-446655440000/social",
		),
	},
}));

vi.mock("$app/navigation", () => ({
	goto: vi.fn(),
	invalidateAll: vi.fn(),
}));

vi.mock("$lib/api/content-copy.remote", () => ({
	deleteCopy: vi.fn(),
}));

vi.mock("$lib/utils/formatting", () => ({
	formatDate: vi.fn(() => "Feb 22"),
}));

vi.mock("lucide-svelte", () => {
	// Stub icons as simple span-returning functions for Svelte component compat
	const stub = () => ({});
	return {
		Plus: stub,
		Share2: stub,
		Trash2: stub,
	};
});

vi.mock("$lib/api/content-social.types", () => ({
	SOCIAL_PLATFORMS: ["twitter", "linkedin", "facebook", "instagram"],
}));

/**
 * Build mock page data. Uses `as any` because PageData inherits from
 * multiple parent layouts (agency, content) and fully satisfying the
 * type here would be brittle and add no test value.
 */
function mockPageData(overrides: { posts: SocialCopyResponse[] }): any {
	return {
		...overrides,
		clientId: "550e8400-e29b-41d4-a716-446655440000",
	};
}

/** Helper to build a minimal mock SocialCopyResponse */
function mockSocialPost(overrides: Partial<SocialCopyResponse> = {}): SocialCopyResponse {
	return {
		id: "post-1",
		client_id: "550e8400-e29b-41d4-a716-446655440000",
		agency_id: "agency-1",
		generated_by: "claude-3-5-haiku-20241022",
		copy_type: "social_post",
		title: "Test Post",
		content: "Test content",
		status: "draft",
		actual_word_count: 50,
		prompt_tokens: 100,
		completion_tokens: 50,
		generation_config: JSON.stringify({ platform: "twitter", angle: "promotional" }),
		created_at: "2026-02-22T00:00:00Z",
		updated_at: "2026-02-22T00:00:00Z",
		...overrides,
	};
}

describe("Social Posts Page", () => {
	async function importPage() {
		const mod = await import(
			/* @vite-ignore */
			"/Users/benjaminwaller/Projects/GoFast/webkit/apps/service-client/src/routes/(app)/[agencySlug]/content/[clientId]/social/+page.svelte"
		);
		return mod.default;
	}

	it("renders empty state heading when no posts", async () => {
		const SocialPage = await importPage();

		render(SocialPage, {
			props: {
				data: mockPageData({ posts: [] }),
			},
		});

		expect(screen.getByText("Social Posts")).toBeTruthy();
		expect(screen.getByText("No Social Posts Generated")).toBeTruthy();
	});

	it("renders post count badge", async () => {
		const SocialPage = await importPage();

		render(SocialPage, {
			props: {
				data: mockPageData({
					posts: [
						mockSocialPost({
							id: "post-1",
							title: "Test Post Alpha",
							content: "Hello world content here",
						}),
					],
				}),
			},
		});

		// Badge should show "1" for one post
		expect(screen.getByText("1")).toBeTruthy();
		// Post title appears in both mobile card and desktop table layouts
		const titles = screen.getAllByText("Test Post Alpha");
		expect(titles.length).toBeGreaterThanOrEqual(1);
	});

	it("renders generate button link", async () => {
		const SocialPage = await importPage();

		render(SocialPage, {
			props: {
				data: mockPageData({ posts: [] }),
			},
		});

		const generateLink = screen.getByText("Generate New");
		expect(generateLink).toBeTruthy();
	});

	it("renders platform filter pills", async () => {
		const SocialPage = await importPage();

		render(SocialPage, {
			props: {
				data: mockPageData({ posts: [] }),
			},
		});

		// "All" filter button should exist
		const allButtons = screen.getAllByText("All");
		expect(allButtons.length).toBeGreaterThan(0);

		// Platform pills
		expect(screen.getByText("Twitter")).toBeTruthy();
		expect(screen.getByText("Linkedin")).toBeTruthy();
		expect(screen.getByText("Facebook")).toBeTruthy();
		expect(screen.getByText("Instagram")).toBeTruthy();
	});

	it("renders status filter tabs", async () => {
		const SocialPage = await importPage();

		render(SocialPage, {
			props: {
				data: mockPageData({ posts: [] }),
			},
		});

		expect(screen.getByText("Drafts")).toBeTruthy();
		expect(screen.getByText("Final")).toBeTruthy();
	});
});
