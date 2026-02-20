/**
 * Brand Profile Remote Functions
 * Proxies to Go content-service brand endpoints.
 */
import { query, command } from "$app/server";
import * as v from "valibot";
import { contentFetch } from "$lib/server/content-fetch";
import type { BrandProfileResponse } from "./content-brand.types";

const ClientIdSchema = v.pipe(v.string(), v.uuid());

const UpdateBrandSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	profile: v.record(v.string(), v.unknown()),
});

/** Get active brand profile for a client */
export const getBrandProfile = query(ClientIdSchema, async (clientId) => {
	return contentFetch<BrandProfileResponse>(`/api/content/brand/${clientId}`);
});

/** Queue async brand profile generation */
export const generateBrandProfile = command(ClientIdSchema, async (clientId) => {
	return contentFetch<{ status: string; client_id: string }>(`/api/content/brand/${clientId}/generate`, {
		method: "POST",
	});
});

/** Update brand profile manually */
export const updateBrandProfile = command(UpdateBrandSchema, async ({ clientId, profile }) => {
	return contentFetch<{ status: string }>(`/api/content/brand/${clientId}`, {
		method: "PUT",
		body: JSON.stringify({ profile }),
	});
});
