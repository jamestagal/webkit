<script lang="ts">
	import SvelteSeo from "svelte-seo";
	import {
		FileText,
		Send,
		Receipt,
		FileSignature,
		ClipboardList,
		Users,
		Sparkles,
		LayoutGrid,
		Palette,
		Zap,
		ArrowRight,
		Check,
		Shield,
		Globe,
		BarChart3,
		ChevronRight,
		Search,
	} from "lucide-svelte";

	const features = [
		{
			icon: ClipboardList,
			title: "Consultations",
			description:
				"Structured discovery sessions with customizable forms. Capture client needs, goals, and technical requirements in one place.",
		},
		{
			icon: FileText,
			title: "Proposals",
			description:
				"Professional proposals with executive summaries, scope breakdowns, and pricing. Rich text editing with PDF export.",
		},
		{
			icon: Receipt,
			title: "Quotations",
			description:
				"Detailed quotations with line items, optional packages, terms and conditions. Share via branded public links.",
		},
		{
			icon: FileSignature,
			title: "Contracts",
			description:
				"Digital contracts with e-signatures. Template system for reusable agreements. Track signing status in real-time.",
		},
		{
			icon: Send,
			title: "Invoices",
			description:
				"Generate invoices from quotations or scratch. Stripe integration for online payments. Automated email delivery.",
		},
		{
			icon: LayoutGrid,
			title: "Custom Forms",
			description:
				"Build branded intake forms with 14 configurable categories. Embed on your site or share direct links with clients.",
		},
		{
			icon: Users,
			title: "Client Management",
			description:
				"Centralized client directory with contact details, communication history, and linked documents across all workflows.",
		},
		{
			icon: Search,
			title: "Content Intelligence",
			description:
				"SEO audits with technical analysis, keyword rankings, competitor insights, and PageSpeed performance. Generate branded PDF reports for clients.",
		},
	];

	const steps = [
		{
			number: "01",
			title: "Create Your Agency",
			description: "Set up your agency profile with branding, logo, and team members. Free to get started.",
		},
		{
			number: "02",
			title: "Customize Your Workflow",
			description:
				"Configure forms, templates, and branding. Tailor dropdown options, colors, and document layouts to match your agency.",
		},
		{
			number: "03",
			title: "Engage Clients",
			description:
				"Send consultations, proposals, quotations, and contracts. Everything flows through branded, professional touchpoints.",
		},
	];

	const tiers = [
		{
			name: "Free",
			price: "$0",
			period: "forever",
			description: "Perfect for solo freelancers getting started",
			features: [
				"1 team member",
				"10 consultations/month",
				"5 AI generations/month",
				"3 templates",
				"Basic proposals",
			],
			cta: "Get Started Free",
			highlighted: false,
		},
		{
			name: "Starter",
			price: "$29",
			period: "/month",
			description: "For small agencies building their client base",
			features: [
				"3 team members",
				"25 consultations/month",
				"25 AI generations/month",
				"5 SEO audits/month",
				"5 templates",
				"PDF export",
				"Email delivery",
			],
			cta: "Start Free Trial",
			highlighted: false,
		},
		{
			name: "Growth",
			price: "$79",
			period: "/month",
			description: "For growing agencies that need more power",
			features: [
				"10 team members",
				"100 consultations/month",
				"100 AI generations/month",
				"15 SEO audits/month",
				"Backlink analysis",
				"20 templates",
				"Custom branding",
				"Analytics & white-label",
				"API access",
			],
			cta: "Start Free Trial",
			highlighted: true,
		},
		{
			name: "Enterprise",
			price: "$199",
			period: "/month",
			description: "For established agencies with advanced needs",
			features: [
				"Unlimited members",
				"Unlimited consultations",
				"Unlimited AI generations",
				"Unlimited SEO audits",
				"Backlink analysis",
				"Unlimited templates",
				"Priority support",
				"Custom domain & SSO",
				"Everything in Growth",
			],
			cta: "Get Started",
			highlighted: false,
		},
	];
</script>

<SvelteSeo
	title="Webkit — Client Consultation & Proposal Platform for Web Agencies"
	description="Create professional consultations, proposals, quotations, contracts and invoices for your web agency. Customizable forms, agency branding, AI-powered generation, and Content Intelligence with SEO audits. Free tier available."
	canonical="https://app.webkit.au"
	openGraph={{
		title: "Webkit — Proposals & Consultations for Web Agencies",
		type: "website",
		url: "https://app.webkit.au",
		site_name: "Webkit",
		images: [
			{
				url: "https://app.webkit.au/og-image.png",
				width: 1200,
				height: 630,
				alt: "Webkit — Client Consultation & Proposal Platform",
			},
		],
	}}
	twitter={{
		card: "summary_large_image",
		title: "Webkit — Proposals & Consultations for Web Agencies",
		description:
			"Create professional consultations, proposals, quotations, contracts and invoices. Free tier available.",
	}}
	jsonLd={{
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "Webkit",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web",
		description:
			"Multi-tenant SaaS platform for web agencies to create client consultations, proposals, quotations, contracts and invoices.",
		url: "https://app.webkit.au",
		offers: {
			"@type": "AggregateOffer",
			lowPrice: "0",
			highPrice: "199",
			priceCurrency: "AUD",
			offerCount: "4",
		},
		featureList:
			"Consultations, Proposals, Quotations, Contracts, Invoices, Custom Forms, Client Management, AI Generation, Content Intelligence, SEO Audits",
	}}
/>

<div data-theme="light" class="min-h-screen bg-base-100 text-base-content">
	<!-- Navigation -->
	<nav class="navbar bg-base-100/80 backdrop-blur-md sticky top-0 z-50 border-b border-base-200">
		<div class="mx-auto flex w-full max-w-7xl items-center justify-between px-4">
			<a href="/" class="flex items-center gap-2 text-xl font-bold">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-content"
				>
					<Globe class="h-5 w-5" />
				</div>
				Webkit
			</a>
			<div class="hidden items-center gap-6 md:flex">
				<a href="#features" class="text-sm font-medium text-base-content/70 hover:text-base-content transition-colors">Features</a>
				<a href="#how-it-works" class="text-sm font-medium text-base-content/70 hover:text-base-content transition-colors">How It Works</a>
				<a href="#pricing" class="text-sm font-medium text-base-content/70 hover:text-base-content transition-colors">Pricing</a>
			</div>
			<div class="flex items-center gap-3">
				<a href="/login" class="btn btn-ghost btn-sm">Log In</a>
				<a href="/login" class="btn btn-primary btn-sm">Get Started Free</a>
			</div>
		</div>
	</nav>

	<!-- Hero -->
	<section class="relative overflow-hidden px-4 pt-20 pb-28 lg:pt-32 lg:pb-40">
		<!-- Background decoration -->
		<div class="absolute inset-0 -z-10">
			<div
				class="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent blur-3xl"
			></div>
		</div>

		<div class="mx-auto max-w-4xl text-center">
			<div class="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
				<Sparkles class="h-4 w-4" />
				Now with AI-powered proposal generation
			</div>

			<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
				Everything your agency needs to
				<span class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
					win clients
				</span>
			</h1>

			<p class="mx-auto mt-6 max-w-2xl text-lg text-base-content/60 leading-relaxed">
				From first consultation to final invoice — Webkit gives web agencies a complete, branded
				workflow for proposals, quotations, contracts, and more. Start free.
			</p>

			<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
				<a href="/login" class="btn btn-primary btn-lg gap-2 shadow-lg shadow-primary/25">
					Get Started Free
					<ArrowRight class="h-5 w-5" />
				</a>
				<a href="#features" class="btn btn-ghost btn-lg gap-2">
					See Features
					<ChevronRight class="h-5 w-5" />
				</a>
			</div>

			<div class="mt-12 flex items-center justify-center gap-8 text-sm text-base-content/50">
				<span class="flex items-center gap-1.5"><Check class="h-4 w-4 text-success" /> Free forever plan</span>
				<span class="flex items-center gap-1.5"><Check class="h-4 w-4 text-success" /> No credit card required</span>
				<span class="flex items-center gap-1.5"><Check class="h-4 w-4 text-success" /> Set up in 2 minutes</span>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section id="features" class="scroll-mt-20 bg-base-200/50 px-4 py-20 lg:py-28">
		<div class="mx-auto max-w-7xl">
			<div class="mx-auto max-w-2xl text-center">
				<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
					One platform for your entire client workflow
				</h2>
				<p class="mt-4 text-base-content/60 text-lg">
					Stop juggling separate tools. Webkit connects every step from discovery to delivery.
				</p>
			</div>

			<div class="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{#each features as feature}
					<div
						class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md hover:border-primary/20 transition-all duration-200"
					>
						<div class="card-body gap-3">
							<div
								class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 text-primary"
							>
								<feature.icon class="h-5 w-5" />
							</div>
							<h3 class="card-title text-base">{feature.title}</h3>
							<p class="text-sm text-base-content/60 leading-relaxed">{feature.description}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- AI-Powered Section -->
	<section class="relative px-4 py-20 lg:py-28 overflow-hidden">
		<!-- Gradient background -->
		<div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-base-100 to-secondary/5"></div>
		<div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
		<div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/20 to-transparent"></div>

		<div class="relative mx-auto max-w-7xl">
			<div class="mx-auto max-w-2xl text-center">
				<div class="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
					<Sparkles class="h-4 w-4" />
					AI-Powered Platform
				</div>
				<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
					AI that works across your entire workflow
				</h2>
				<p class="mt-4 text-base-content/60 text-lg leading-relaxed">
					From generating proposals to analyzing SEO performance, AI is woven into every
					tool — saving your team hours on every project.
				</p>
			</div>

			<div class="mt-14 grid gap-6 lg:grid-cols-3">
				<div class="rounded-2xl border border-base-200 bg-base-100/80 p-6 backdrop-blur-sm">
					<div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
						<FileText class="h-5 w-5" />
					</div>
					<h3 class="text-lg font-bold">Proposal Generation</h3>
					<p class="mt-2 text-sm text-base-content/60 leading-relaxed">
						AI-generated executive summaries, scope recommendations, and pricing suggestions based on your consultation data.
					</p>
				</div>

				<div class="rounded-2xl border border-base-200 bg-base-100/80 p-6 backdrop-blur-sm">
					<div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 text-secondary">
						<Sparkles class="h-5 w-5" />
					</div>
					<h3 class="text-lg font-bold">Content Enhancement</h3>
					<p class="mt-2 text-sm text-base-content/60 leading-relaxed">
						Smart content analysis and optimization suggestions that help you deliver polished, professional deliverables.
					</p>
				</div>

				<div class="rounded-2xl border border-base-200 bg-base-100/80 p-6 backdrop-blur-sm">
					<div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 text-accent">
						<Search class="h-5 w-5" />
					</div>
					<h3 class="text-lg font-bold">SEO Intelligence</h3>
					<p class="mt-2 text-sm text-base-content/60 leading-relaxed">
						Automated technical audits, keyword research, and competitor analysis. Generate branded PDF reports for clients.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Agency Branding Highlight -->
	<section class="px-4 py-20 lg:py-28">
		<div class="mx-auto max-w-7xl">
			<div class="grid items-center gap-12 lg:grid-cols-2">
				<div>
					<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/5 px-3 py-1 text-sm font-medium text-secondary">
						<Palette class="h-4 w-4" />
						Your brand, everywhere
					</div>
					<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
						White-label everything with your agency branding
					</h2>
					<p class="mt-4 text-base-content/60 text-lg leading-relaxed">
						Every client touchpoint — forms, proposals, contracts, invoices — carries your agency's logo,
						colors, and identity. No "powered by" watermarks.
					</p>
					<ul class="mt-8 space-y-3">
						{#each ["Custom logo & color palette", "Branded public links for clients", "Customizable form categories & options", "Gradient accents for premium feel", "Per-agency document templates"] as item}
							<li class="flex items-center gap-3 text-base-content/80">
								<div class="flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success">
									<Check class="h-3.5 w-3.5" />
								</div>
								{item}
							</li>
						{/each}
					</ul>
				</div>
				<div class="relative">
					<div class="rounded-2xl border border-base-200 bg-base-200/30 p-6 lg:p-8">
						<!-- Simulated brand customization preview -->
						<div class="space-y-4">
							<div class="flex items-center gap-3">
								<div class="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-secondary"></div>
								<div>
									<div class="font-semibold">Your Agency Name</div>
									<div class="text-xs text-base-content/50">your-agency.webkit.au</div>
								</div>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<div class="rounded-lg bg-primary/10 p-3 text-center text-xs font-medium text-primary">Primary</div>
								<div class="rounded-lg bg-secondary/10 p-3 text-center text-xs font-medium text-secondary">Secondary</div>
								<div class="rounded-lg bg-accent/10 p-3 text-center text-xs font-medium text-accent">Accent</div>
							</div>
							<div class="space-y-2">
								<div class="h-3 w-full rounded bg-base-300"></div>
								<div class="h-3 w-4/5 rounded bg-base-300"></div>
								<div class="h-3 w-3/5 rounded bg-base-300"></div>
							</div>
							<div class="flex gap-2">
								<div class="btn btn-primary btn-sm flex-1">Send Proposal</div>
								<div class="btn btn-outline btn-sm flex-1">Preview</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- How It Works -->
	<section id="how-it-works" class="scroll-mt-20 bg-base-200/50 px-4 py-20 lg:py-28">
		<div class="mx-auto max-w-7xl">
			<div class="mx-auto max-w-2xl text-center">
				<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Up and running in minutes</h2>
				<p class="mt-4 text-base-content/60 text-lg">
					Three simple steps to transform how your agency handles client work.
				</p>
			</div>

			<div class="mt-16 grid gap-8 lg:grid-cols-3">
				{#each steps as step}
					<div class="relative">
						<div class="text-6xl font-black text-primary/10">{step.number}</div>
						<h3 class="mt-2 text-xl font-bold">{step.title}</h3>
						<p class="mt-2 text-base-content/60 leading-relaxed">{step.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Trust Signals -->
	<section class="px-4 py-16">
		<div class="mx-auto max-w-5xl">
			<div class="grid gap-6 sm:grid-cols-3">
				<div class="flex items-center gap-4 rounded-xl border border-base-200 bg-base-100 p-5">
					<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Shield class="h-6 w-6" />
					</div>
					<div>
						<div class="font-semibold">GDPR Compliant</div>
						<div class="text-sm text-base-content/60">Data export & deletion built in</div>
					</div>
				</div>
				<div class="flex items-center gap-4 rounded-xl border border-base-200 bg-base-100 p-5">
					<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
						<Zap class="h-6 w-6" />
					</div>
					<div>
						<div class="font-semibold">Stripe Payments</div>
						<div class="text-sm text-base-content/60">Accept payments on invoices</div>
					</div>
				</div>
				<div class="flex items-center gap-4 rounded-xl border border-base-200 bg-base-100 p-5">
					<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
						<BarChart3 class="h-6 w-6" />
					</div>
					<div>
						<div class="font-semibold">Analytics & Reports</div>
						<div class="text-sm text-base-content/60">Track revenue & conversion</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Pricing -->
	<section id="pricing" class="scroll-mt-20 bg-base-200/50 px-4 py-20 lg:py-28">
		<div class="mx-auto max-w-7xl">
			<div class="mx-auto max-w-2xl text-center">
				<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
				<p class="mt-4 text-base-content/60 text-lg">
					Start free. Upgrade as your agency grows. No hidden fees.
				</p>
			</div>

			<div class="mt-16 grid gap-6 lg:grid-cols-4">
				{#each tiers as tier}
					<div
						class="card bg-base-100 shadow-sm border {tier.highlighted
							? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20'
							: 'border-base-200'} relative"
					>
						{#if tier.highlighted}
							<div class="absolute -top-3 left-1/2 -translate-x-1/2">
								<span class="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-content">
									Most Popular
								</span>
							</div>
						{/if}
						<div class="card-body">
							<h3 class="text-lg font-bold">{tier.name}</h3>
							<div class="mt-2">
								<span class="text-3xl font-extrabold">{tier.price}</span>
								{#if tier.period}
									<span class="text-base-content/50 text-sm">{tier.period}</span>
								{/if}
							</div>
							<p class="mt-1 text-sm text-base-content/60">{tier.description}</p>
							<ul class="mt-6 space-y-2.5">
								{#each tier.features as feature}
									<li class="flex items-center gap-2 text-sm">
										<Check class="h-4 w-4 text-success shrink-0" />
										<span>{feature}</span>
									</li>
								{/each}
							</ul>
							<div class="card-actions mt-6">
								<a
									href="/login"
									class="btn w-full {tier.highlighted ? 'btn-primary' : 'btn-outline'}"
								>
									{tier.cta}
								</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section class="px-4 py-20 lg:py-28">
		<div class="mx-auto max-w-3xl text-center">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				Ready to streamline your agency workflow?
			</h2>
			<p class="mx-auto mt-4 max-w-xl text-base-content/60 text-lg">
				Join web agencies using Webkit to create professional client experiences.
				Start with our free plan — no credit card required.
			</p>
			<div class="mt-10">
				<a href="/login" class="btn btn-primary btn-lg gap-2 shadow-lg shadow-primary/25">
					Get Started Free
					<ArrowRight class="h-5 w-5" />
				</a>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-base-200 bg-base-100 px-4 py-12">
		<div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
			<div class="flex items-center gap-2 text-sm font-semibold">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary text-primary-content"
				>
					<Globe class="h-4 w-4" />
				</div>
				Webkit
			</div>
			<div class="flex items-center gap-6 text-sm text-base-content/50">
				<a href="#features" class="hover:text-base-content transition-colors">Features</a>
				<a href="#pricing" class="hover:text-base-content transition-colors">Pricing</a>
				<a href="/login" class="hover:text-base-content transition-colors">Log In</a>
			</div>
			<p class="text-sm text-base-content/40">
				&copy; {new Date().getFullYear()} Webkit. All rights reserved.
			</p>
		</div>
	</footer>
</div>
