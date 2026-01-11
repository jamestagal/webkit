<script lang="ts">
	import { goto } from '$app/navigation';
	import { Building2, ArrowLeft, Check, X } from 'lucide-svelte';
	import { createAgency, checkSlugAvailable } from '$lib/api/agency.remote';
	import { env } from '$env/dynamic/public';

	// Get app domain from environment (defaults to webkit.au)
	const appDomain = env.PUBLIC_APP_DOMAIN || 'webkit.au';

	let name = $state('');
	let slug = $state('');
	let autoSlug = $state(true);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Slug validation state
	let slugChecking = $state(false);
	let slugAvailable = $state<boolean | null>(null);
	let slugValid = $state<boolean | null>(null);

	// Generate slug from name
	function generateSlug(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50);
	}

	// Auto-generate slug when name changes
	$effect(() => {
		if (autoSlug && name) {
			slug = generateSlug(name);
		}
	});

	// Check slug availability when it changes
	let slugCheckTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (slug && slug.length >= 3) {
			slugAvailable = null;
			slugValid = null;
			slugChecking = true;

			clearTimeout(slugCheckTimeout);
			slugCheckTimeout = setTimeout(async () => {
				try {
					const result = await checkSlugAvailable(slug);
					slugAvailable = result.available;
					slugValid = result.valid;
				} catch {
					slugAvailable = null;
					slugValid = null;
				} finally {
					slugChecking = false;
				}
			}, 300);
		} else {
			slugAvailable = null;
			slugValid = null;
			slugChecking = false;
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (isSubmitting) return;

		if (!name.trim()) {
			error = 'Agency name is required';
			return;
		}

		if (slug && slugAvailable === false) {
			error = 'This slug is not available';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const result = await createAgency({
				name: name.trim(),
				slug: slug || undefined
			});

			// Redirect to the new agency
			goto(`/${result.slug}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create agency';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Create Agency</title>
</svelte:head>

<div class="mx-auto max-w-xl">
	<!-- Back link -->
	<a href="/agencies" class="btn btn-ghost btn-sm mb-6">
		<ArrowLeft class="h-4 w-4" />
		Back to agencies
	</a>

	<!-- Header -->
	<div class="mb-8 text-center">
		<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
			<Building2 class="h-8 w-8 text-primary" />
		</div>
		<h1 class="text-2xl font-bold">Create New Agency</h1>
		<p class="text-base-content/70 mt-1">
			Set up your agency to start creating consultations and proposals.
		</p>
	</div>

	<!-- Form -->
	<form onsubmit={handleSubmit} class="space-y-6">
		{#if error}
			<div class="alert alert-error">
				<span>{error}</span>
			</div>
		{/if}

		<!-- Agency Name -->
		<div class="form-control">
			<label class="label" for="name">
				<span class="label-text font-medium">Agency Name</span>
			</label>
			<input
				type="text"
				id="name"
				bind:value={name}
				class="input input-bordered w-full"
				placeholder="My Agency"
				required
			/>
			<span class="label">
				<span class="label-text-alt text-base-content/60">
					This is how your agency will appear to clients.
				</span>
			</span>
		</div>

		<!-- Slug -->
		<div class="form-control">
			<label class="label" for="slug">
				<span class="label-text font-medium">Agency URL</span>
				<span class="label-text-alt">
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={autoSlug} class="checkbox checkbox-xs" />
						<span class="text-xs">Auto-generate</span>
					</label>
				</span>
			</label>
			<div class="join w-full">
				<span class="join-item flex items-center bg-base-200 px-3 text-sm text-base-content/60">
					{appDomain}/
				</span>
				<input
					type="text"
					id="slug"
					bind:value={slug}
					class="input input-bordered join-item flex-1"
					placeholder="my-agency"
					disabled={autoSlug}
					minlength="3"
					maxlength="50"
				/>
				<div class="join-item flex items-center px-3 bg-base-200">
					{#if slugChecking}
						<span class="loading loading-spinner loading-xs"></span>
					{:else if slug.length >= 3}
						{#if slugAvailable && slugValid}
							<Check class="h-4 w-4 text-success" />
						{:else if slugAvailable === false || slugValid === false}
							<X class="h-4 w-4 text-error" />
						{/if}
					{/if}
				</div>
			</div>
			<span class="label">
				{#if slug.length >= 3 && !slugChecking}
					{#if slugValid === false}
						<span class="label-text-alt text-error">
							Invalid format. Use only lowercase letters, numbers, and hyphens.
						</span>
					{:else if slugAvailable === false}
						<span class="label-text-alt text-error">
							This URL is already taken. Try a different one.
						</span>
					{:else if slugAvailable && slugValid}
						<span class="label-text-alt text-success">This URL is available!</span>
					{/if}
				{:else}
					<span class="label-text-alt text-base-content/60">
						This will be your agency's unique URL.
					</span>
				{/if}
			</span>
		</div>

		<!-- Submit -->
		<button
			type="submit"
			class="btn btn-primary w-full"
			disabled={isSubmitting || (slug.length >= 3 && !slugAvailable)}
		>
			{#if isSubmitting}
				<span class="loading loading-spinner loading-sm"></span>
				Creating...
			{:else}
				Create Agency
			{/if}
		</button>
	</form>
</div>
