/**
 * Copy Generation & Management Remote Functions
 * Proxies to Go content-service copy and generate endpoints.
 */
import { query, command } from "$app/server";
import * as v from "valibot";
import { contentFetch } from "$lib/server/content-fetch";
import type { CopyResponse, CopyResult, MetaResult } from "./content-copy.types";

const GenerateCopySchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	pageId: v.optional(v.pipe(v.string(), v.uuid())),
	copyType: v.string(),
	targetKeyword: v.optional(v.string()),
	targetWordCount: v.optional(v.number()),
	notes: v.optional(v.string()),
});

const GenerateMetaSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	pageId: v.pipe(v.string(), v.uuid()),
	targetKeyword: v.optional(v.string()),
});

const GenerateBulkSchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	pageIds: v.array(v.pipe(v.string(), v.uuid())),
	copyType: v.string(),
	targetKeywords: v.optional(v.array(v.string())),
});

const GetCopySchema = v.object({
	clientId: v.pipe(v.string(), v.uuid()),
	copyType: v.optional(v.string()),
	status: v.optional(v.string()),
	pageId: v.optional(v.pipe(v.string(), v.uuid())),
});

const UpdateCopySchema = v.object({
	copyId: v.pipe(v.string(), v.uuid()),
	content: v.optional(v.string()),
	title: v.optional(v.string()),
	status: v.optional(v.string()),
});

const CopyIdSchema = v.pipe(v.string(), v.uuid());

/** Generate copy (sync, returns CopyResult) */
export const generateCopy = command(GenerateCopySchema, async (data) => {
	return contentFetch<CopyResult>("/api/content/generate/copy", {
		method: "POST",
		body: JSON.stringify({
			client_id: data.clientId,
			page_id: data.pageId,
			copy_type: data.copyType,
			target_keyword: data.targetKeyword ?? "",
			target_word_count: data.targetWordCount ?? 0,
			notes: data.notes ?? "",
		}),
	});
});

/** Generate meta title + description (sync) */
export const generateMeta = command(GenerateMetaSchema, async (data) => {
	return contentFetch<MetaResult>("/api/content/generate/meta", {
		method: "POST",
		body: JSON.stringify({
			client_id: data.clientId,
			page_id: data.pageId,
			target_keyword: data.targetKeyword ?? "",
		}),
	});
});

/** Queue bulk copy generation (async via NATS) */
export const generateBulk = command(GenerateBulkSchema, async (data) => {
	return contentFetch<{ message: string; page_count: number }>("/api/content/generate/bulk", {
		method: "POST",
		body: JSON.stringify({
			client_id: data.clientId,
			page_ids: data.pageIds,
			copy_type: data.copyType,
			target_keywords: data.targetKeywords,
		}),
	});
});

/** Get copy items for a client with optional filters */
export const getClientCopy = query(GetCopySchema, async ({ clientId, copyType, status, pageId }) => {
	const params = new URLSearchParams();
	if (copyType) params.set("copy_type", copyType);
	if (status) params.set("status", status);
	if (pageId) params.set("page_id", pageId);
	const qs = params.toString();
	return contentFetch<CopyResponse[]>(`/api/content/copy/${clientId}${qs ? `?${qs}` : ""}`);
});

/** Update a copy item (content, title, and/or status) */
export const updateCopy = command(UpdateCopySchema, async ({ copyId, content, title, status }) => {
	return contentFetch<CopyResponse>(`/api/content/copy/${copyId}`, {
		method: "PATCH",
		body: JSON.stringify({ content, title, status }),
	});
});

/** Delete a copy item (draft only) */
export const deleteCopy = command(CopyIdSchema, async (copyId) => {
	return contentFetch<{ status: string }>(`/api/content/copy/${copyId}`, {
		method: "DELETE",
	});
});
