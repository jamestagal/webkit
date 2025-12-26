<script lang="ts">
	import { Building2, Plus } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="card bg-base-100 border border-base-300 max-w-md w-full">
		<div class="card-body items-center text-center">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
			>
				<Building2 class="h-8 w-8" />
			</div>
			<h1 class="text-2xl font-bold">Welcome to Webkit</h1>
			<p class="text-base-content/70">
				You don't have an agency yet. Create one to get started with consultations and proposals.
			</p>
			<div class="mt-6 flex flex-col gap-3 w-full">
				<a href="/agencies/new" class="btn btn-primary">
					<Plus class="h-4 w-4" />
					Create Agency
				</a>
			</div>
			<div class="mt-4 text-sm text-base-content/50">
				Logged in as {data.email}
			</div>
		</div>
	</div>
</div>
