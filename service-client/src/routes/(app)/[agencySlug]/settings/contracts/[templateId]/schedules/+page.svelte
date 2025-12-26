<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createContractSchedule,
		updateContractSchedule,
		deleteContractSchedule
	} from '$lib/api/contract-templates.remote';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import MergeFieldPicker from '$lib/components/contracts/MergeFieldPicker.svelte';
	import {
		Plus,
		ArrowLeft,
		Save,
		Trash2,
		GripVertical,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);

	// Modal state for creating/editing schedules
	let showModal = $state(false);
	let editingSchedule = $state<(typeof data.schedules)[0] | null>(null);
	let isSubmitting = $state(false);

	// Form state
	let scheduleName = $state('');
	let schedulePackageId = $state<string | null>(null);
	let scheduleContent = $state('');
	let richTextEditor: RichTextEditor | undefined = $state();

	// Expanded state for viewing content
	let expandedSchedules = $state<Set<string>>(new Set());

	function openCreateModal() {
		editingSchedule = null;
		scheduleName = '';
		schedulePackageId = null;
		scheduleContent = '';
		showModal = true;
	}

	function openEditModal(schedule: (typeof data.schedules)[0]) {
		editingSchedule = schedule;
		scheduleName = schedule.name;
		schedulePackageId = schedule.packageId;
		scheduleContent = schedule.content;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingSchedule = null;
	}

	async function handleSubmit() {
		if (!scheduleName.trim()) {
			toast.error('Schedule name is required');
			return;
		}

		isSubmitting = true;

		try {
			if (editingSchedule) {
				await updateContractSchedule({
					scheduleId: editingSchedule.id,
					name: scheduleName,
					packageId: schedulePackageId,
					content: scheduleContent
				});
				toast.success('Schedule updated');
			} else {
				await createContractSchedule({
					templateId: data.template.id,
					name: scheduleName,
					packageId: schedulePackageId,
					content: scheduleContent
				});
				toast.success('Schedule created');
			}

			await invalidateAll();
			closeModal();
		} catch (err) {
			toast.error('Failed to save schedule', err instanceof Error ? err.message : '');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete(scheduleId: string) {
		if (!confirm('Are you sure you want to delete this schedule?')) {
			return;
		}

		try {
			await deleteContractSchedule(scheduleId);
			await invalidateAll();
			toast.success('Schedule deleted');
		} catch (err) {
			toast.error('Failed to delete schedule', err instanceof Error ? err.message : '');
		}
	}

	function toggleExpanded(scheduleId: string) {
		if (expandedSchedules.has(scheduleId)) {
			expandedSchedules.delete(scheduleId);
			expandedSchedules = new Set(expandedSchedules);
		} else {
			expandedSchedules.add(scheduleId);
			expandedSchedules = new Set(expandedSchedules);
		}
	}

	function getPackageName(packageId: string | null) {
		if (!packageId) return 'No package (applies to all)';
		const pkg = data.packages.find((p) => p.id === packageId);
		return pkg?.name || 'Unknown package';
	}

	function handleMergeFieldInsert(field: string) {
		if (richTextEditor) {
			richTextEditor.insertText(`{{${field}}}`);
		}
	}

	function handleContentUpdate(html: string) {
		scheduleContent = html;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<div class="flex items-center gap-2 text-sm text-base-content/60 mb-1">
				<a href="/{agencySlug}/settings/contracts" class="hover:text-primary">
					Contract Templates
				</a>
				<span>/</span>
				<a
					href="/{agencySlug}/settings/contracts/{data.template.id}"
					class="hover:text-primary"
				>
					{data.template.name}
				</a>
			</div>
			<h1 class="text-2xl font-bold">Schedule Management</h1>
			<p class="text-base-content/70 mt-1">
				Define package-specific terms for "{data.template.name}"
			</p>
		</div>
		<button type="button" class="btn btn-primary" onclick={openCreateModal}>
			<Plus class="h-4 w-4" />
			Add Schedule
		</button>
	</div>

	<!-- Info box -->
	<div class="alert">
		<div>
			<p class="text-sm">
				<strong>Schedules</strong> are package-specific terms that get added to contracts.
				When a contract is generated from a proposal, the schedule linked to the selected package is automatically included.
			</p>
		</div>
	</div>

	<!-- Schedules List -->
	{#if data.schedules.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<GripVertical class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No schedules yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Add schedules to define package-specific terms that will be included in contracts.
				</p>
				<button type="button" class="btn btn-primary mt-4" onclick={openCreateModal}>
					<Plus class="h-4 w-4" />
					Add Schedule
				</button>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.schedules as schedule, index (schedule.id)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-center gap-3">
							<div class="text-base-content/40">
								<GripVertical class="h-5 w-5" />
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="badge badge-ghost badge-sm">#{index + 1}</span>
									<h3 class="font-semibold">{schedule.name}</h3>
								</div>
								<p class="text-sm text-base-content/60 mt-0.5">
									{getPackageName(schedule.packageId)}
								</p>
							</div>

							<div class="flex items-center gap-2">
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => toggleExpanded(schedule.id)}
								>
									{#if expandedSchedules.has(schedule.id)}
										<ChevronUp class="h-4 w-4" />
									{:else}
										<ChevronDown class="h-4 w-4" />
									{/if}
								</button>
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => openEditModal(schedule)}
								>
									Edit
								</button>
								<button
									type="button"
									class="btn btn-ghost btn-sm text-error"
									onclick={() => handleDelete(schedule.id)}
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>

						{#if expandedSchedules.has(schedule.id)}
							<div
								class="mt-4 pt-4 border-t border-base-200 prose prose-sm max-w-none"
							>
								{#if schedule.content}
									{@html schedule.content}
								{:else}
									<p class="text-base-content/60 italic">No content defined</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Back button -->
	<div class="pt-4">
		<a href="/{agencySlug}/settings/contracts/{data.template.id}" class="btn btn-ghost">
			<ArrowLeft class="h-4 w-4" />
			Back to Template
		</a>
	</div>
</div>

<!-- Create/Edit Modal -->
{#if showModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-4xl">
			<h3 class="font-bold text-lg mb-4">
				{editingSchedule ? 'Edit Schedule' : 'New Schedule'}
			</h3>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<div class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="form-control">
							<label class="label" for="scheduleName">
								<span class="label-text font-medium">Schedule Name *</span>
							</label>
							<input
								type="text"
								id="scheduleName"
								bind:value={scheduleName}
								class="input input-bordered"
								placeholder="e.g., Lump Sum Package Terms"
								required
							/>
						</div>

						<div class="form-control">
							<label class="label" for="schedulePackage">
								<span class="label-text font-medium">Linked Package</span>
							</label>
							<select
								id="schedulePackage"
								bind:value={schedulePackageId}
								class="select select-bordered"
							>
								<option value={null}>No package (applies to all)</option>
								{#each data.packages as pkg (pkg.id)}
									<option value={pkg.id}>{pkg.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="form-control">
						<div class="flex items-center justify-between mb-2">
							<label class="label-text font-medium">Schedule Content</label>
							<MergeFieldPicker onInsert={handleMergeFieldInsert} />
						</div>
						<RichTextEditor
							bind:this={richTextEditor}
							content={scheduleContent}
							onUpdate={handleContentUpdate}
							placeholder="Enter the schedule content here..."
							minHeight="300px"
						/>
					</div>
				</div>

				<div class="modal-action">
					<button type="button" class="btn btn-ghost" onclick={closeModal}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={isSubmitting}>
						{#if isSubmitting}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Save class="h-4 w-4" />
						{/if}
						{editingSchedule ? 'Update' : 'Create'}
					</button>
				</div>
			</form>
		</div>
		<div class="modal-backdrop" onclick={closeModal}></div>
	</div>
{/if}
