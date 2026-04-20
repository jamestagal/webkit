<script lang="ts">
	import { getToast } from '$lib/ui/toast_store.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';

	const toast = getToast();
	import { inviteMember } from '$lib/api/agency.remote';

	interface Props {
		agency: { id: string; name: string; slug: string };
		showModal: boolean;
		onInvite?: () => void;
	}

	let { agency, showModal = $bindable(false), onInvite = () => {} }: Props = $props();

	let email = $state('');
	let displayName = $state('');
	let role = $state<'admin' | 'member'>('member');
	let isLoading = $state(false);
	let errors = $state<{ email?: string }>({});

	// Plan-limit error state — rendered as an inline alert at the top of the
	// modal with an Upgrade CTA. Mirrors the New Client modal pattern.
	let inviteError = $state('');
	let inviteAtLimit = $state(false);
	let upgradeHref = $derived(`/${agency.slug}/settings/billing`);

	const roles = [
		{
			value: 'member' as const,
			label: 'Member',
			description: 'Can create and manage their own consultations and proposals'
		},
		{
			value: 'admin' as const,
			label: 'Admin',
			description: 'Can manage all consultations, proposals, and invite members'
		}
	];

	let currentRoleDescription = $derived(
		roles.find((r) => r.value === role)?.description ?? ''
	);

	async function handleInvite() {
		// Reset errors
		errors = {};
		inviteError = '';
		inviteAtLimit = false;

		// Validate
		if (!email) {
			errors.email = 'Email is required';
			return;
		}

		if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
			errors.email = 'Please enter a valid email address';
			return;
		}

		isLoading = true;

		try {
			await inviteMember({
				email,
				role,
				displayName: displayName.trim() || undefined
			});

			toast.success(`Invitation sent to ${email}`);

			// Reset form
			email = '';
			displayName = '';
			role = 'member';
			showModal = false;

			// Notify parent
			onInvite();
		} catch (err) {
			console.error('Failed to invite member:', err);

			// SvelteKit's error() throws HttpError, so read status + body.message
			// directly (same pattern as commit 9704e02).
			const status = (err as { status?: number } | null)?.status;
			let message = 'Something went wrong';
			if (err && typeof err === 'object' && 'body' in err) {
				const body = (err as { body?: { message?: string } }).body;
				if (body?.message) message = body.message;
			} else if (err instanceof Error && err.message) {
				message = err.message;
			}

			const isLimit =
				status === 429 ||
				((status === 403 || status === 422) &&
					/limit|not available|upgrade|plan supports/i.test(message));

			// Keep the existing per-field handling for validation-style errors so
			// the message attaches to the email input. Route everything else —
			// including plan-limit errors — through the top-of-modal alert.
			if (message.includes('already a member')) {
				errors.email = 'This user is already a member of the agency';
			} else if (message.includes('already invited')) {
				errors.email = 'This user has already been invited';
			} else if (!isLimit && message.includes('permission')) {
				errors.email = 'You do not have permission to invite members';
			} else {
				inviteError = message;
				inviteAtLimit = isLimit;
			}
		} finally {
			isLoading = false;
		}
	}

	function handleClose() {
		if (!isLoading) {
			email = '';
			displayName = '';
			role = 'member';
			errors = {};
			inviteError = '';
			inviteAtLimit = false;
			showModal = false;
		}
	}
</script>

<Modal bind:isOpen={showModal} title="Invite Team Member" maxWidth="max-w-md">
	{#snippet children()}
		<div class="p-5">
			<p class="text-base-content/70 text-sm mb-4">
				Send an invitation to join {agency.name}.
			</p>

			{#if inviteError}
				<div class="mb-4">
					<div class="alert alert-error">
						<span>{inviteError}</span>
					</div>
					{#if inviteAtLimit}
						<a href={upgradeHref} class="btn btn-sm btn-primary mt-2">Upgrade plan →</a>
					{/if}
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleInvite();
				}}
			>
				<div class="space-y-3">
					<!-- Email Input -->
					<div class="form-control">
						<label for="email" class="label">
							<span class="label-text">Email Address</span>
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="colleague@example.com"
							class="input input-bordered w-full"
							class:input-error={errors.email}
							disabled={isLoading}
						/>
						{#if errors.email}
							<label class="label">
								<span class="label-text-alt text-error">{errors.email}</span>
							</label>
						{/if}
					</div>

					<!-- Display Name Input (Optional) -->
					<div class="form-control">
						<label for="displayName" class="label">
							<span class="label-text">Display Name</span>
							<span class="label-text-alt text-base-content/50">Optional</span>
						</label>
						<input
							id="displayName"
							type="text"
							bind:value={displayName}
							placeholder="John Smith"
							class="input input-bordered w-full"
							disabled={isLoading}
						/>
					</div>

					<!-- Role Selection — compact segmented control + dynamic description -->
					<div class="form-control">
						<div class="label">
							<span class="label-text">Role</span>
						</div>
						<div class="join w-full" role="radiogroup" aria-label="Role">
							{#each roles as roleOption}
								<button
									type="button"
									class="join-item btn btn-sm flex-1 {role === roleOption.value
										? 'btn-primary'
										: 'btn-outline'}"
									onclick={() => (role = roleOption.value)}
									disabled={isLoading}
									aria-pressed={role === roleOption.value}
								>
									{roleOption.label}
								</button>
							{/each}
						</div>
						<p class="text-base-content/60 text-xs mt-2">{currentRoleDescription}</p>
					</div>

				</div>

				<div class="flex justify-end gap-3 mt-4">
					<button type="button" class="btn" onclick={handleClose} disabled={isLoading}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={isLoading || !email}>
						{#if isLoading}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Send Invitation
					</button>
				</div>
			</form>
		</div>
	{/snippet}
</Modal>
