import type { PageServerLoad } from './$types';

const API_BASE_URL = 'http://webkit-core:4001';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
	try {
		// Get auth token from cookies (it's called 'access_token', not 'token')
		const token = cookies.get('access_token');

		if (!token) {
			throw new Error('Not authenticated - no access_token cookie found');
		}

		// Create or get consultation
		const consultationRes = await fetch(`${API_BASE_URL}/consultations`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': `access_token=${token}`
			},
			body: JSON.stringify({})
		});

		if (!consultationRes.ok) {
			throw new Error(`Failed to create consultation: ${consultationRes.statusText}`);
		}

		const consultation = await consultationRes.json();
		console.log('=== SERVER: Consultation loaded ===', JSON.stringify(consultation, null, 2));

		// Try to load existing draft
		let draft = null;
		try {
			const draftRes = await fetch(`${API_BASE_URL}/consultations/${consultation.id}/drafts`, {
				headers: {
					'Cookie': `access_token=${token}`
				}
			});

			if (draftRes.ok) {
				draft = await draftRes.json();
			}
		} catch (error) {
			// Draft not found is okay
			console.log('No draft found');
		}

		return {
			consultation,
			draft
		};
	} catch (error) {
		console.error('Failed to load consultation:', error);
		throw error;
	}
};
