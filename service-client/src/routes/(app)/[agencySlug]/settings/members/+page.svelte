<script lang="ts">
	import { Users, UserPlus } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Team Members</h1>
			<p class="text-base-content/70 mt-1">
				Manage who has access to {data.agency.name}
			</p>
		</div>
		<button class="btn btn-primary" disabled>
			<UserPlus class="h-4 w-4" />
			Invite Member
		</button>
	</div>

	<!-- Coming Soon -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body items-center text-center py-12">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
			>
				<Users class="h-8 w-8" />
			</div>
			<h3 class="text-lg font-semibold">Team Management Coming Soon</h3>
			<p class="text-base-content/60 max-w-sm">
				Invite team members, assign roles, and manage permissions for your agency.
			</p>
			<div class="mt-4 text-sm text-base-content/50">
				Currently logged in as: {data.membership.role}
			</div>
		</div>
	</div>
</div>
