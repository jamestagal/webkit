import type { PageServerLoad } from './$types';
import { getClientContentOverview } from '$lib/api/content-overview.remote';
import type { Module, ProgressStep } from '$lib/types/content-intelligence';

export const load: PageServerLoad = async ({ params }) => {
	try {
		const overview = await getClientContentOverview(params.clientId);

		const analysisModules: Module[] = [
			{
				id: 'audit',
				label: 'SEO Audit',
				icon: 'BarChart3',
				color: '#a855f7',
				status: overview.seo.score > 0 ? 'complete' : 'not_started',
				score: overview.seo.score || null,
				summary:
					overview.seo.score > 0
						? `${overview.seo.critical} critical, ${overview.seo.warnings} warnings`
						: 'Run an audit to get started',
				items:
					overview.seo.score > 0
						? [
								`Critical: ${overview.seo.critical}`,
								`Warnings: ${overview.seo.warnings}`,
								`Notices: ${overview.seo.notices}`
							]
						: [],
				href: `/${params.agencySlug}/content/${params.clientId}/audit`
			},
			{
				id: 'brand',
				label: 'Brand Voice',
				icon: 'Palette',
				color: '#d946ef',
				status: overview.brand.has_profile ? 'complete' : 'not_started',
				summary: overview.brand.has_profile
					? `Source: ${overview.brand.source_type || 'configured'}`
					: 'Not configured',
				items: overview.brand.has_profile ? ['Profile: Active'] : [],
				href: `/${params.agencySlug}/content/${params.clientId}/brand`
			},
			{
				id: 'gbp',
				label: 'Google Business',
				icon: 'MapPin',
				color: '#22c55e',
				status: 'not_started',
				summary: 'Coming in Local SEO Phase 2',
				items: []
			},
			{
				id: 'pages',
				label: 'Crawled Pages',
				icon: 'Globe',
				color: '#06b6d4',
				status: overview.crawl.total_pages > 0 ? 'complete' : 'not_started',
				summary:
					overview.crawl.total_pages > 0
						? `${overview.crawl.total_pages} pages discovered`
						: 'Not crawled yet',
				items:
					overview.crawl.total_pages > 0
						? [
								`Total: ${overview.crawl.total_pages} pages`,
								`Status: ${overview.crawl.status}`
							]
						: [],
				href: `/${params.agencySlug}/content/${params.clientId}/pages`
			}
		];

		const copyByType = overview.copy.by_type || {};
		const socialCount = copyByType['social_post'] ?? 0;

		const contentModules: Module[] = [
			{
				id: 'copy',
				label: 'Page Copy',
				icon: 'FileEdit',
				color: '#ec4899',
				status: overview.copy.total - socialCount > 0 ? 'complete' : 'ready',
				summary:
					overview.copy.total - socialCount > 0
						? `${overview.copy.total - socialCount} pieces — ${overview.copy.drafts} drafts, ${overview.copy.finals} final`
						: 'Rewrite & optimise existing page content',
				items: Object.entries(copyByType)
					.filter(([key]) => key !== 'social_post')
					.map(([key, count]) => `${count} ${key.replace(/_/g, ' ')}`),
				href: `/${params.agencySlug}/content/${params.clientId}/copy`
			},
			{
				id: 'articles',
				label: 'SEO Articles',
				icon: 'Layers',
				color: '#f59e0b',
				status: 'not_started',
				summary: 'SERP-engineered blog & service page content',
				items: [],
				isNew: true
			},
			{
				id: 'social',
				label: 'Social Posts',
				icon: 'MessageSquare',
				color: '#6366f1',
				status: socialCount > 0 ? 'complete' : 'ready',
				summary:
					socialCount > 0
						? `${socialCount} posts generated`
						: 'Platform-specific social media content',
				items: socialCount > 0 ? [`${socialCount} posts`] : [],
				href: `/${params.agencySlug}/content/${params.clientId}/social`
			}
		];

		const progressSteps: ProgressStep[] = [
			{ label: 'Crawled', done: overview.crawl.total_pages > 0 },
			{ label: 'SEO Audit', done: overview.seo.score > 0 },
			{ label: 'Brand Analysis', done: overview.brand.has_profile },
			{ label: 'GBP Check', done: false },
			{
				label: 'Report Shared',
				done: false,
				active: overview.seo.score > 0 && overview.brand.has_profile
			},
			{ label: 'Content Sprint', done: false }
		];

		return { overview, analysisModules, contentModules, progressSteps };
	} catch {
		return {
			overview: null,
			analysisModules: [] as Module[],
			contentModules: [] as Module[],
			progressSteps: [] as ProgressStep[]
		};
	}
};
