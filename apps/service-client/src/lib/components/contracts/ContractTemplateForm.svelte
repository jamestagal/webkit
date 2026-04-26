<script lang="ts">
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createContractTemplate,
		updateContractTemplate
	} from '$lib/api/contract-templates.remote';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import MergeFieldPicker from './MergeFieldPicker.svelte';
	import { Save, ArrowLeft } from 'lucide-svelte';
	import type { ContractTemplate, CoverPageConfig, SignatureConfig } from '$lib/server/schema';

	let {
		agencySlug,
		template
	}: {
		agencySlug: string;
		template?: ContractTemplate | null;
	} = $props();

	const toast = getToast();
	let isSubmitting = $state(false);
	let richTextEditor: RichTextEditor | undefined = $state();

	// Form state
	let name = $state(template?.name || '');
	let description = $state(template?.description || '');
	let termsContent = $state(template?.termsContent || '');
	let isDefault = $state(template?.isDefault || false);

	// Cover page config
	let coverPageConfig = $state<CoverPageConfig>({
		showLogo: true,
		showAgencyAddress: true,
		showClientAddress: true,
		...(template?.coverPageConfig as CoverPageConfig)
	});

	// Signature config
	let signatureConfig = $state<SignatureConfig>({
		agencySignatory: '',
		agencyTitle: '',
		requireClientTitle: true,
		requireWitness: false,
		...(template?.signatureConfig as SignatureConfig)
	});

	let isEditing = $derived(!!template);

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!name.trim()) {
			toast.error('Template name is required');
			return;
		}

		isSubmitting = true;

		try {
			if (isEditing && template) {
				await updateContractTemplate({
					templateId: template.id,
					name,
					description,
					termsContent,
					coverPageConfig,
					signatureConfig,
					isDefault
				});
				toast.success('Template updated');
			} else {
				await createContractTemplate({
					name,
					description,
					termsContent,
					coverPageConfig,
					signatureConfig,
					isDefault
				});
				toast.success('Template created');
			}

			goto(`/${agencySlug}/settings/contracts`);
		} catch (err) {
			toast.error('Failed to save template', err instanceof Error ? err.message : '');
		} finally {
			isSubmitting = false;
		}
	}

	function handleMergeFieldInsert(field: string) {
		if (richTextEditor) {
			richTextEditor.insertText(`{{${field}}}`);
		}
	}

	function handleTermsUpdate(html: string) {
		termsContent = html;
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Basic Info -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Template Details</h2>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="form-control sm:col-span-2">
					<label class="label" for="name">
						<span class="label-text font-medium">Template Name *</span>
					</label>
					<input
						type="text"
						id="name"
						bind:value={name}
						class="input input-bordered"
						placeholder="e.g., Service Agreement 2026"
						required
					/>
				</div>

				<div class="form-control sm:col-span-2">
					<label class="label" for="description">
						<span class="label-text font-medium">Description</span>
					</label>
					<textarea
						id="description"
						bind:value={description}
						class="textarea textarea-bordered w-full"
						placeholder="Internal description for this template..."
						rows="2"
					></textarea>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							bind:checked={isDefault}
							class="checkbox checkbox-primary"
						/>
						<span class="label-text">Set as default template</span>
					</label>
				</div>
			</div>
		</div>
	</div>

	<!-- Cover Page Configuration -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Cover Page</h2>
			<p class="text-sm text-base-content/60">
				Configure which elements appear on the contract cover page
			</p>

			<div class="grid gap-4 sm:grid-cols-2 mt-4">
				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							bind:checked={coverPageConfig.showLogo}
							class="checkbox checkbox-primary"
						/>
						<span class="label-text">Show agency logo</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							bind:checked={coverPageConfig.showAgencyAddress}
							class="checkbox checkbox-primary"
						/>
						<span class="label-text">Show agency address</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							bind:checked={coverPageConfig.showClientAddress}
							class="checkbox checkbox-primary"
						/>
						<span class="label-text">Show client address</span>
					</label>
				</div>
			</div>
		</div>
	</div>

	<!-- Terms & Conditions -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 class="card-title text-lg">Terms & Conditions</h2>
					<p class="text-sm text-base-content/60">
						Your contract terms. Use merge fields to auto-populate client and project data.
					</p>
				</div>
				<MergeFieldPicker onInsert={handleMergeFieldInsert} />
			</div>

			<div class="mt-4">
				<RichTextEditor
					bind:this={richTextEditor}
					content={termsContent}
					onUpdate={handleTermsUpdate}
					placeholder="Enter your terms and conditions here..."
					minHeight="400px"
				/>
			</div>
		</div>
	</div>

	<!-- Signature Configuration -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Signature Block</h2>
			<p class="text-sm text-base-content/60">
				Configure the signature section of the contract
			</p>

			<div class="grid gap-4 sm:grid-cols-2 mt-4">
				<div class="form-control">
					<label class="label" for="agencySignatory">
						<span class="label-text font-medium">Agency Signatory Name</span>
					</label>
					<input
						type="text"
						id="agencySignatory"
						bind:value={signatureConfig.agencySignatory}
						class="input input-bordered"
						placeholder="e.g., Benjamin Waller"
					/>
				</div>

				<div class="form-control">
					<label class="label" for="agencyTitle">
						<span class="label-text font-medium">Agency Signatory Title</span>
					</label>
					<input
						type="text"
						id="agencyTitle"
						bind:value={signatureConfig.agencyTitle}
						class="input input-bordered"
						placeholder="e.g., Director"
					/>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							bind:checked={signatureConfig.requireClientTitle}
							class="checkbox checkbox-primary"
						/>
						<span class="label-text">Require client job title</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							bind:checked={signatureConfig.requireWitness}
							class="checkbox checkbox-primary"
						/>
						<span class="label-text">Require witness signature</span>
					</label>
				</div>
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex justify-between items-center">
		<a href="/{agencySlug}/settings/contracts" class="btn btn-ghost">
			<ArrowLeft class="h-4 w-4" />
			Back
		</a>

		<button type="submit" class="btn btn-primary" disabled={isSubmitting}>
			{#if isSubmitting}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<Save class="h-4 w-4" />
			{/if}
			{isEditing ? 'Update Template' : 'Create Template'}
		</button>
	</div>
</form>
