<script lang="ts">
	import { Users, UserPlus, MoreVertical, UserCog, Trash2, Pencil } from 'lucide-svelte';
	import { toast } from '$lib/components/shared/Toast.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import InviteMember from '$lib/components/settings/InviteMember.svelte';
	import { updateMemberRole, removeMember, updateMyDisplayName } from '$lib/api/agency.remote';
	import { invalidate } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let agency = $derived(data.agency);
	let currentUserRole = $derived(data.membership.role);
	let currentMembershipId = $derived(data.membership.id);
	let members = $derived(data.members || []);

	// Modal states
	let showInviteModal = $state(false);
	let showRoleModal = $state(false);
	let showNameModal = $state(false);
	let selectedMember = $state<(typeof members)[0] | null>(null);
	let newRole = $state<'admin' | 'member'>('member');
	let editingDisplayName = $state('');
	let isUpdating = $state(false);

	// Check if current user can manage a member
	function canManageMember(member: (typeof members)[0]) {
		if (currentUserRole === 'owner') return true;
		if (currentUserRole === 'admin' && member.role === 'member') return true;
		return false;
	}

	// Check if current user can change roles (only owner)
	function canChangeRole() {
		return currentUserRole === 'owner';
	}

	// Open role change modal
	function openRoleModal(member: (typeof members)[0]) {
		selectedMember = member;
		newRole = member.role === 'owner' ? 'admin' : (member.role as 'admin' | 'member');
		showRoleModal = true;
	}

	// Update member role
	async function handleUpdateRole() {
		if (!selectedMember || !newRole) return;

		isUpdating = true;
		try {
			await updateMemberRole({
				membershipId: selectedMember.id,
				role: newRole
			});

			toast.success('Role updated successfully');
			showRoleModal = false;
			selectedMember = null;

			await invalidate('load:members');
		} catch (error) {
			toast.error((error as Error).message || 'Failed to update role');
		} finally {
			isUpdating = false;
		}
	}

	// Remove member from agency
	async function handleRemoveMember(member: (typeof members)[0]) {
		if (!confirm(`Remove ${member.displayName || member.userEmail} from ${agency.name}?`)) return;

		try {
			await removeMember(member.id);
			toast.success('Member removed');
			await invalidate('load:members');
		} catch (error) {
			toast.error((error as Error).message || 'Failed to remove member');
		}
	}

	// Handle successful invite
	async function handleInviteSuccess() {
		showInviteModal = false;
		await invalidate('load:members');
	}

	// Check if member is current user
	function isCurrentUser(member: (typeof members)[0]) {
		return member.id === currentMembershipId;
	}

	// Open name edit modal for current user
	function openNameModal(member: (typeof members)[0]) {
		editingDisplayName = member.displayName || '';
		showNameModal = true;
	}

	// Update current user's display name
	async function handleUpdateDisplayName() {
		if (!editingDisplayName.trim()) {
			toast.error('Please enter a display name');
			return;
		}

		isUpdating = true;
		try {
			await updateMyDisplayName({ displayName: editingDisplayName.trim() });
			toast.success('Display name updated');
			showNameModal = false;
			await invalidate('load:members');
		} catch (error) {
			toast.error((error as Error).message || 'Failed to update display name');
		} finally {
			isUpdating = false;
		}
	}

	// Get role badge classes
	function getRoleBadgeClass(role: string) {
		switch (role) {
			case 'owner':
				return 'badge-primary';
			case 'admin':
				return 'badge-secondary';
			default:
				return 'badge-ghost';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Team Members</h1>
			<p class="text-base-content/70 mt-1">
				Manage who has access to {agency.name}
			</p>
		</div>
		{#if currentUserRole === 'owner' || currentUserRole === 'admin'}
			<button class="btn btn-primary" onclick={() => (showInviteModal = true)}>
				<UserPlus class="h-4 w-4" />
				Invite Member
			</button>
		{/if}
	</div>

	<!-- Members List -->
	{#if members.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<Users class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No Team Members Yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Invite team members to collaborate on consultations, proposals, and more.
				</p>
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 border border-base-300 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Member</th>
							<th>Email</th>
							<th>Role</th>
							<th>Status</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each members as member}
							<tr class="hover:bg-base-200/50">
								<td>
									<div class="flex items-center gap-3">
										<div class="avatar placeholder">
											<div
												class="bg-primary/10 text-primary w-10 h-10 rounded-full flex items-center justify-center"
											>
												{#if member.userAvatar}
													<img
														src={member.userAvatar}
														alt={member.displayName || member.userEmail}
													/>
												{:else}
													<span class="text-sm">
														{(member.displayName || member.userEmail || '?').charAt(0).toUpperCase()}
													</span>
												{/if}
											</div>
										</div>
										<div class="flex items-center gap-2">
											<span class="font-medium">
												{member.displayName || 'Unnamed'}
											</span>
											{#if isCurrentUser(member)}
												<button
													class="btn btn-ghost btn-xs btn-square"
													onclick={() => openNameModal(member)}
													title="Edit your display name"
												>
													<Pencil class="h-3 w-3" />
												</button>
												<span class="badge badge-outline badge-xs">You</span>
											{/if}
										</div>
									</div>
								</td>
								<td class="text-base-content/70">
									{member.userEmail}
								</td>
								<td>
									<span class="badge {getRoleBadgeClass(member.role)} capitalize">
										{member.role}
									</span>
								</td>
								<td>
									<span
										class="badge {member.status === 'active' ? 'badge-success' : 'badge-warning'} badge-sm"
									>
										{member.status}
									</span>
								</td>
								<td class="text-right">
									{#if canManageMember(member) && member.role !== 'owner'}
										<div class="dropdown dropdown-end">
											<div tabindex="0" role="button" class="btn btn-ghost btn-sm btn-square">
												<MoreVertical class="h-4 w-4" />
											</div>
											<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
											<ul
												tabindex="0"
												class="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-lg border border-base-300"
											>
												{#if canChangeRole()}
													<li>
														<button onclick={() => openRoleModal(member)}>
															<UserCog class="h-4 w-4" />
															Change Role
														</button>
													</li>
												{/if}
												<li>
													<button
														class="text-error"
														onclick={() => handleRemoveMember(member)}
													>
														<Trash2 class="h-4 w-4" />
														Remove
													</button>
												</li>
											</ul>
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Member count -->
	<div class="text-sm text-base-content/50">
		{members.length} member{members.length !== 1 ? 's' : ''} in this agency
	</div>
</div>

<!-- Invite Member Modal -->
<InviteMember agency={agency} bind:showModal={showInviteModal} onInvite={handleInviteSuccess} />

<!-- Role Change Modal -->
<Modal bind:isOpen={showRoleModal} title="Change Member Role" maxWidth="max-w-md">
	{#snippet children()}
		{#if selectedMember}
			<div class="p-6 space-y-4">
				<p class="text-base-content/70">
					Change role for <strong>{selectedMember.displayName || selectedMember.userEmail}</strong>
				</p>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Select Role</span>
					</label>
					<select class="select select-bordered w-full" bind:value={newRole}>
						<option value="member">Member - Can create and manage their own work</option>
						<option value="admin">Admin - Can manage all work and invite members</option>
					</select>
				</div>

				<div class="alert alert-info text-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="stroke-current shrink-0 w-5 h-5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<span>
						<strong>Members</strong> can create consultations and proposals but only manage their own.
						<strong>Admins</strong> can manage all agency work and invite new members.
					</span>
				</div>

				<div class="flex justify-end gap-3 pt-4">
					<button class="btn" onclick={() => (showRoleModal = false)} disabled={isUpdating}>
						Cancel
					</button>
					<button class="btn btn-primary" onclick={handleUpdateRole} disabled={isUpdating}>
						{#if isUpdating}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Update Role
					</button>
				</div>
			</div>
		{/if}
	{/snippet}
</Modal>

<!-- Edit Display Name Modal -->
<Modal bind:isOpen={showNameModal} title="Edit Display Name" maxWidth="max-w-md">
	{#snippet children()}
		<div class="p-6 space-y-4">
			<p class="text-base-content/70">
				This name will be shown to other team members in this agency.
			</p>

			<div class="form-control">
				<label class="label" for="displayName">
					<span class="label-text">Display Name</span>
				</label>
				<input
					id="displayName"
					type="text"
					class="input input-bordered w-full"
					placeholder="Enter your name"
					bind:value={editingDisplayName}
					disabled={isUpdating}
				/>
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<button class="btn" onclick={() => (showNameModal = false)} disabled={isUpdating}>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={handleUpdateDisplayName} disabled={isUpdating}>
					{#if isUpdating}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save Name
				</button>
			</div>
		</div>
	{/snippet}
</Modal>
