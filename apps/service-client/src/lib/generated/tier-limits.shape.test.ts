/**
 * Runtime shape validation for the generated tier-limits.ts file.
 * Catches drift between the UI's expectations and the generator output —
 * e.g. a renamed key or dropped field on the Go side.
 */
import { describe, it, expect } from "vitest";
import { TIER_LIMITS, FEATURE_GATES } from "./tier-limits";

const REQUIRED_TIERS = ["free", "starter", "growth", "agency_pro"] as const;
const REQUIRED_KEYS = [
	"seo_audit",
	"crawl",
	"ai_generation",
	"pdf_export",
	"social_profile",
	"form",
	"max_clients",
	"max_members",
	"storage_gb",
] as const;

describe("TIER_LIMITS shape", () => {
	it("has exactly the four self-serve tiers", () => {
		expect(Object.keys(TIER_LIMITS).sort()).toEqual([...REQUIRED_TIERS].sort());
	});

	it("every tier has every required numeric key", () => {
		for (const tier of REQUIRED_TIERS) {
			const row = TIER_LIMITS[tier];
			for (const key of REQUIRED_KEYS) {
				expect(row, `${tier} missing ${key}`).toHaveProperty(key);
				expect(typeof row[key], `${tier}.${key} must be number`).toBe("number");
			}
		}
	});

	it("does not expose enterprise as a self-serve tier", () => {
		expect(TIER_LIMITS).not.toHaveProperty("enterprise");
	});
});

describe("FEATURE_GATES shape", () => {
	it("has citation_check gated to Growth+", () => {
		expect(FEATURE_GATES.citation_check).toEqual([
			"growth",
			"agency_pro",
			"enterprise",
		]);
	});
});
