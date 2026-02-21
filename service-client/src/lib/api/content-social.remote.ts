/**
 * Social Media Generation & Management Remote Functions
 * Proxies to Go content-service social and copy endpoints.
 */
import { query, command } from "$app/server";
import * as v from "valibot";
import { contentFetch } from "$lib/server/content-fetch";
import type { SocialGenerateResult, SocialCopyResponse } from "./content-social.types";

const GenerateSocialSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	pageId: v.optional(v.pipe(v.string(), v.uuid())),
	platform: v.string(),
	topic: v.string(),
	postGoal: v.optional(v.string()),
	toneOverride: v.optional(v.string()),
});

const GetSocialSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	platform: v.optional(v.string()),
	pageId: v.optional(v.pipe(v.string(), v.uuid())),
	status: v.optional(v.string()),
	limit: v.optional(v.number()),
	offset: v.optional(v.number()),
});

/** Generate social media posts (returns variations) */
export const generateSocial = command(GenerateSocialSchema, async (data) => {
	return contentFetch<SocialGenerateResult>("/api/content/generate/social", {
		method: "POST",
		body: JSON.stringify({
			client_id: data.clientId,
			page_id: data.pageId,
			platform: data.platform,
			topic: data.topic,
			post_goal: data.postGoal ?? "",
			tone_override: data.toneOverride ?? "",
		}),
	});
});

/** Get social posts for a client with optional filters */
export const getSocialPosts = query(GetSocialSchema, async ({ clientId, platform, pageId, status, limit, offset }) => {
	const params = new URLSearchParams();
	if (platform) params.set("platform", platform);
	if (pageId) params.set("page_id", pageId);
	if (status) params.set("status", status);
	if (limit) params.set("limit", String(limit));
	if (offset) params.set("offset", String(offset));
	const qs = params.toString();
	return contentFetch<SocialCopyResponse[]>(`/api/content/social/${clientId}${qs ? `?${qs}` : ""}`);
});
