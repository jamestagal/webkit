<script lang="ts">
	interface Section {
		id: string;
		label: string;
		score?: number | null;
	}

	interface Props {
		sections: Section[];
	}

	let { sections }: Props = $props();

	let activeId = $state<string>('');

	function pillClass(score: number | null | undefined): string {
		if (score == null) return 'r-pill r-pill--neutral';
		if (score >= 80) return 'r-pill r-pill--success';
		if (score >= 60) return 'r-pill r-pill--info';
		if (score >= 40) return 'r-pill r-pill--warning';
		return 'r-pill r-pill--error';
	}

	function avatarColor(score: number | null | undefined): string {
		if (score == null) return 'var(--report-gray-400, #98a2b3)';
		if (score >= 80) return 'var(--report-success-600, #039855)';
		if (score >= 60) return 'var(--report-primary-600, #155eef)';
		if (score >= 40) return 'var(--report-warning-600, #dc6803)';
		return 'var(--report-error-600, #d92d20)';
	}

	function scrollTo(id: string) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	$effect(() => {
		const targets = sections
			.map((s) => document.getElementById(s.id))
			.filter((el): el is HTMLElement => el != null);

		if (targets.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id;
						break;
					}
				}
			},
			{ threshold: 0.4 },
		);

		for (const t of targets) observer.observe(t);
		return () => observer.disconnect();
	});
</script>

<!-- Desktop: sticky sidebar (≥1024px / lg) -->
<nav class="report-sidebar-desktop">
	<ul>
		{#each sections as section (section.id)}
			<li>
				<button
					type="button"
					onclick={() => scrollTo(section.id)}
					class="r-nav-item {activeId === section.id ? 'r-nav-item--active' : ''}"
				>
					<span>{section.label}</span>
					<span class={pillClass(section.score)}>
						{section.score ?? '—'}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</nav>

<!-- Mobile: vertical grading list (≤1024px) — matches §7.mobile_grading_list -->
<nav class="report-sidebar-mobile">
	<ul>
		{#each sections as section (section.id)}
			<li>
				<button
					type="button"
					onclick={() => scrollTo(section.id)}
					class="r-mobile-grade-row"
				>
					<span
						class="r-mobile-grade-avatar"
						style="background: {avatarColor(section.score)};"
					>
						{section.label.charAt(0)}
					</span>
					<span class="report-mobile-label">{section.label}</span>
					<span class={pillClass(section.score)}>{section.score ?? '—'}</span>
				</button>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.report-sidebar-desktop {
		display: none;
	}
	.report-sidebar-desktop ul {
		position: sticky;
		top: 80px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px;
		background: var(--report-sidebar-bg, #fcfcfd);
		border: 1px solid var(--report-sidebar-border, #e5e7eb);
		border-radius: var(--report-radius-xl, 16px);
		list-style: none;
		margin: 0;
	}
	.report-sidebar-desktop li {
		margin: 0;
	}

	.report-sidebar-mobile {
		display: block;
		margin-bottom: 24px;
		padding: 4px 16px;
		background: #ffffff;
		border: 1px solid var(--report-card-border, #eaecf0);
		border-radius: var(--report-radius-lg, 12px);
	}
	.report-sidebar-mobile ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.report-mobile-label {
		flex: 1;
		min-width: 0;
		font-size: 14px;
		font-weight: 500;
		color: var(--report-text-heading, #101828);
	}

	@media (min-width: 1024px) {
		.report-sidebar-desktop {
			display: block;
		}
		.report-sidebar-mobile {
			display: none;
		}
	}
</style>
