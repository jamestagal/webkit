import type { PageServerLoad } from "./$types";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { clients } from "$lib/server/schema";
import { getContentPages } from "$lib/api/content.remote";
import { getClientContentOverview } from "$lib/api/content-overview.remote";

export const load: PageServerLoad = async ({ params }) => {
	const [pages, overview, client] = await Promise.all([
		getContentPages(params.clientId),
		getClientContentOverview(params.clientId).catch(() => null),
		db
			.select({ website: clients.website })
			.from(clients)
			.where(eq(clients.id, params.clientId))
			.limit(1)
			.then(([row]) => row ?? null),
	]);

	// Prefer the URL from the most recent crawl (it's what the user last
	// confirmed). Fall back to the client's stored website so a brand-new
	// client with no crawl history can still trigger their first crawl.
	const sourceUrl = overview?.crawl?.source_url || client?.website || "";

	return {
		pages,
		sourceUrl,
		hasPriorCrawl: Boolean(overview?.crawl?.source_url),
	};
};
