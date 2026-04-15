<script lang="ts">
	import type { ReportAgencyBranding } from '$lib/server/share-tokens';

	interface Props {
		agency: ReportAgencyBranding;
	}

	let { agency }: Props = $props();

	let ctaHref = $derived(
		agency.email ? `mailto:${agency.email}` : agency.website || '#',
	);
	let ctaIsExternal = $derived(!agency.email && !!agency.website);

	let agencyHost = $derived(
		agency.website ? agency.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null,
	);
	let hasAgencyContact = $derived(!!(agency.email || agency.phone || agency.website));
</script>

<section
	class="report-banner"
	style="background: var(--agency-accent-gradient, linear-gradient(135deg, var(--agency-primary, #155eef) 0%, var(--agency-accent, #004eeb) 100%));"
>
	<div class="report-banner-inner">
		<h2 class="report-banner-heading">See The Missed Opportunity? Spotlight Your Business</h2>
		<p class="report-banner-sub">
			We help improve your online presence and get found by more customers.
		</p>
		{#if ctaHref !== '#'}
			<a
				href={ctaHref}
				target={ctaIsExternal ? '_blank' : undefined}
				rel={ctaIsExternal ? 'noopener noreferrer' : undefined}
				class="report-banner-cta"
				style="color: var(--agency-primary, #155eef);"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="2" y1="12" x2="22" y2="12" />
					<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
				</svg>
				Connect Now
			</a>
		{/if}
	</div>

	<svg
		class="report-banner-wave"
		preserveAspectRatio="none"
		viewBox="0 0 1440 120"
		aria-hidden="true"
	>
		<path
			fill="#ffffff"
			fill-opacity="0.12"
			d="M0,64 C240,128 480,0 720,64 C960,128 1200,0 1440,64 L1440,120 L0,120 Z"
		/>
		<path
			fill="#ffffff"
			fill-opacity="0.22"
			d="M0,88 C240,48 480,128 720,88 C960,48 1200,128 1440,88 L1440,120 L0,120 Z"
		/>
	</svg>
</section>

{#if hasAgencyContact}
	<div class="report-footer-agency-strip">
		<span class="report-footer-agency-name">{agency.name}</span>
		{#if agency.email}
			<a class="report-footer-agency-item" href={`mailto:${agency.email}`}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<rect x="2" y="4" width="20" height="16" rx="2" />
					<path d="m22 6-10 7L2 6" />
				</svg>
				<span>{agency.email}</span>
			</a>
		{/if}
		{#if agency.phone}
			<a class="report-footer-agency-item" href={`tel:${agency.phone.replace(/\s+/g, '')}`}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
				</svg>
				<span>{agency.phone}</span>
			</a>
		{/if}
		{#if agency.website && agencyHost}
			<a class="report-footer-agency-item" href={agency.website} target="_blank" rel="noopener noreferrer">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
					<polyline points="15 3 21 3 21 9" />
					<line x1="10" y1="14" x2="21" y2="3" />
				</svg>
				<span>{agencyHost}</span>
			</a>
		{/if}
	</div>
{/if}

<p class="report-banner-microcopy">
	Powered by <a href="https://webkit.au" target="_blank" rel="noopener noreferrer">Webkit</a>
</p>

<style>
	.report-banner {
		position: relative;
		overflow: hidden;
		margin-top: 48px;
		border-radius: var(--report-radius-lg, 12px);
		min-height: 180px;
		color: #ffffff;
		box-shadow: var(--report-shadow-md, 0 1px 3px rgba(16, 24, 40, 0.1));
	}
	.report-banner-inner {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 16px;
		padding: 56px 24px 72px;
		max-width: 720px;
		margin: 0 auto;
	}
	.report-banner-heading {
		color: #ffffff;
		font-size: 28px;
		line-height: 1.2;
		font-weight: 700;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.report-banner-sub {
		color: rgba(255, 255, 255, 0.85);
		font-size: 15px;
		line-height: 1.5;
		margin: 0;
		max-width: 560px;
	}
	.report-banner-cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #ffffff;
		padding: 12px 20px;
		border-radius: var(--report-radius-base, 8px);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		box-shadow: var(--report-shadow-xs, 0 1px 2px rgba(16, 24, 40, 0.05));
		transition: transform 150ms ease, box-shadow 150ms ease;
	}
	.report-banner-cta:hover {
		transform: translateY(-1px);
		box-shadow: var(--report-shadow-sm, 0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.1));
	}
	.report-banner-wave {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		width: 100%;
		height: 60px;
		pointer-events: none;
	}
	.report-footer-agency-strip {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: 24px;
		padding: 0 16px;
	}
	.report-footer-agency-name {
		font-size: 13px;
		font-weight: 700;
		color: var(--report-text-body, #475467);
	}
	.report-footer-agency-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--report-text-muted, #667085);
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
	}
	.report-footer-agency-item:hover {
		color: var(--agency-primary, var(--report-primary-700, #004eeb));
	}
	.report-footer-agency-item svg {
		color: var(--agency-primary, var(--report-primary-600, #155eef));
	}

	@media (min-width: 768px) {
		.report-footer-agency-strip {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 8px 20px;
		}
	}

	.report-banner-microcopy {
		text-align: center;
		margin-top: 12px;
		padding-bottom: 32px;
		font-size: 11px;
		color: var(--report-gray-400, #98a2b3);
	}
	.report-banner-microcopy a {
		color: inherit;
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.report-banner {
			margin-top: 32px;
			min-height: 160px;
			border-radius: var(--report-radius-md, 10px);
		}
		.report-banner-heading {
			font-size: 22px;
		}
		.report-banner-sub {
			font-size: 14px;
		}
		.report-banner-inner {
			padding: 40px 20px 56px;
		}
	}
</style>
