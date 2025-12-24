/**
 * Agency Data Export API Endpoint
 *
 * GET /api/agency/export - Download agency data as JSON file
 *
 * GDPR compliance endpoint for data portability.
 * Only accessible by agency owners.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportAgencyData } from '$lib/api/gdpr.remote';

export const GET: RequestHandler = async () => {
	try {
		const exportData = await exportAgencyData();

		const jsonString = JSON.stringify(exportData, null, 2);
		const filename = `agency-export-${exportData.agency.slug}-${new Date().toISOString().split('T')[0]}.json`;

		return new Response(jsonString, {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-store'
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Export failed';
		const status = (err as { status?: number })?.status || 500;

		return json({ error: message }, { status });
	}
};
