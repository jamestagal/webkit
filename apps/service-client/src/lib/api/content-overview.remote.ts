import { query } from "$app/server";
import * as v from "valibot";
import { contentFetch } from "$lib/server/content-fetch";
import type { ContentOverview } from "./content-overview.types";

const ClientIdSchema = v.pipe(v.string(), v.uuid());

export const getClientContentOverview = query(ClientIdSchema, async (clientId) => {
	return contentFetch<ContentOverview>(`/api/content/overview/${clientId}`);
});
