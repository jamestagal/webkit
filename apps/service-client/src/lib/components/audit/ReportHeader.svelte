<script lang="ts">
	import type { ReportAgencyBranding } from '$lib/server/share-tokens';

	interface Props {
		agency: ReportAgencyBranding;
		client?: { businessName?: string | null; website?: string | null } | null;
	}

	let { agency, client }: Props = $props();

	let initial = $derived(agency.name?.[0]?.toUpperCase() ?? 'A');
	let hasLogo = $derived(!!agency.logoUrl);
	let ctaHref = $derived(
		agency.email ? `mailto:${agency.email}` : agency.website || null,
	);
	let ctaIsExternal = $derived(!agency.email && !!agency.website);
	let hasClient = $derived(!!(client?.businessName || client?.website));
	let clientHost = $derived(
		client?.website ? client.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null,
	);
	let agencyHost = $derived(
		agency.website ? agency.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null,
	);
</script>

<header class="report-header">
	<div class="report-header-inner" class:has-client={hasClient}>
		<!-- Left — Agency block -->
		<div class="report-header-agency">
			{#if hasLogo}
				<img src={agency.logoUrl} alt={agency.name} class="report-header-logo" />
			{:else}
				<div class="report-header-agency-fallback">
					{#if agency.logoAvatarUrl}
						<img src={agency.logoAvatarUrl} alt={agency.name} class="report-header-avatar" />
					{:else}
						<div
							class="report-header-avatar-fallback"
							style="background: var(--agency-accent-gradient, var(--agency-accent, var(--agency-primary, #155eef)));"
						>
							{initial}
						</div>
					{/if}
					<p class="report-header-agency-name" style="color: var(--agency-primary, #101828);">
						{agency.name}
					</p>
				</div>
			{/if}

			{#if agency.website && agencyHost}
				<a
					class="report-header-website-link"
					style="color: var(--agency-primary, #155eef);"
					href={agency.website}
					target="_blank"
					rel="noopener noreferrer"
				>
					<span>{agencyHost}</span>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
						<polyline points="15 3 21 3 21 9" />
						<line x1="10" y1="14" x2="21" y2="3" />
					</svg>
				</a>
			{/if}
		</div>

		<!-- Middle — Client block -->
		{#if hasClient}
			<div class="report-header-client-block">
				<p class="report-header-client-label">Audit for</p>
				{#if client?.businessName}
					<p class="report-header-client-name">{client.businessName}</p>
				{/if}
				{#if client?.website && clientHost}
					<a
						class="report-header-client-link"
						style="color: var(--agency-primary, #155eef);"
						href={client.website}
						target="_blank"
						rel="noopener noreferrer"
					>
						<span>{clientHost}</span>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
							<polyline points="15 3 21 3 21 9" />
							<line x1="10" y1="14" x2="21" y2="3" />
						</svg>
					</a>
				{/if}
			</div>
		{/if}

		<!-- Right — CTA block -->
		{#if ctaHref}
			<div class="report-header-cta-block">
				<p class="report-header-cta-question">Have Questions About Your Audit?</p>
				<a
					href={ctaHref}
					target={ctaIsExternal ? '_blank' : undefined}
					rel={ctaIsExternal ? 'noopener noreferrer' : undefined}
					class="report-header-cta-button"
					style="background: var(--agency-accent-gradient, var(--agency-accent, var(--agency-primary, #155eef))); color: #ffffff;"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="10" />
						<line x1="2" y1="12" x2="22" y2="12" />
						<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
					</svg>
					Contact Now
				</a>
			</div>
		{/if}
	</div>
</header>

<style>
	.report-header {
		background: #ffffff;
		border-bottom: 1px solid var(--report-card-border, #eaecf0);
	}
	.report-header-inner {
		max-width: 72rem;
		margin: 0 auto;
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	/* Agency block */
	.report-header-agency {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding: 16px 0;
		text-align: center;
	}
	.report-header-logo {
		height: 48px;
		width: auto;
		max-width: 240px;
		object-fit: contain;
	}
	.report-header-agency-fallback {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.report-header-avatar {
		height: 40px;
		width: 40px;
		border-radius: 9999px;
		object-fit: cover;
	}
	.report-header-avatar-fallback {
		height: 40px;
		width: 40px;
		border-radius: 9999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 700;
		color: #ffffff;
	}
	.report-header-agency-name {
		font-size: 18px;
		font-weight: 700;
		line-height: 1.2;
		margin: 0;
	}
	.report-header-website-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 15px;
		font-weight: 500;
		text-decoration: none;
		width: fit-content;
	}
	.report-header-website-link svg {
		width: 15px;
		height: 15px;
	}
	.report-header-website-link:hover {
		text-decoration: underline;
	}

	/* Client block */
	.report-header-client-block {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		padding: 16px 0;
		border-top: 1px solid var(--report-card-border, #eaecf0);
	}
	.report-header-client-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--report-text-muted, #667085);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0;
	}
	.report-header-client-name {
		font-size: 16px;
		font-weight: 600;
		color: var(--report-text-heading, #101828);
		margin: 0;
		line-height: 1.3;
	}
	.report-header-client-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
		width: fit-content;
	}
	.report-header-client-link:hover {
		text-decoration: underline;
	}

	/* CTA block */
	.report-header-cta-block {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
		padding: 16px 0;
		border-top: 1px solid var(--report-card-border, #eaecf0);
	}
	.report-header-cta-question {
		font-size: 13px;
		font-weight: 500;
		color: var(--report-text-body, #475467);
		margin: 0;
	}
	.report-header-cta-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 40px;
		padding: 0 18px;
		border-radius: var(--report-radius-base, 8px);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		box-shadow: var(--report-shadow-xs, 0 1px 2px rgba(16, 24, 40, 0.05));
		transition: transform 150ms ease, opacity 150ms ease;
		width: 100%;
	}
	.report-header-cta-button:hover {
		transform: translateY(-1px);
		opacity: 0.95;
	}

	/* Desktop ≥768px — 3-column grid */
	@media (min-width: 768px) {
		.report-header-inner {
			display: grid;
			grid-template-columns: auto 1fr auto;
			align-items: center;
			gap: 32px;
			padding: 24px;
		}
		.report-header-inner:not(.has-client) {
			grid-template-columns: auto 1fr auto;
		}
		.report-header-agency,
		.report-header-client-block,
		.report-header-cta-block {
			padding: 0;
			border-top: none;
			align-self: stretch;
			display: flex;
			justify-content: center;
		}
		.report-header-client-block,
		.report-header-cta-block {
			padding-left: 32px;
			border-left: 1px solid var(--report-card-border, #eaecf0);
		}
		.report-header-logo {
			height: 56px;
		}
		.report-header-cta-block {
			align-items: flex-end;
		}
		.report-header-agency {
			align-items: center;
		}
		.report-header-client-block {
			align-items: flex-start;
		}
		.report-header-cta-button {
			width: auto;
		}
	}
</style>
