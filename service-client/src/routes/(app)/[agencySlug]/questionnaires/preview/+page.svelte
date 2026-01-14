<script lang="ts">
	import { ArrowLeft, Info } from 'lucide-svelte';
	import QuestionnaireWizard from '$lib/components/questionnaire/QuestionnaireWizard.svelte';
	import type { QuestionnaireResponse } from '$lib/server/schema';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Create a mock questionnaire for preview purposes
	// This is never saved - it's purely for viewing the form flow
	const mockQuestionnaire: QuestionnaireResponse = {
		id: 'preview',
		slug: 'preview',
		agencyId: data.agency.id,
		contractId: null,
		proposalId: null,
		consultationId: null,
		clientBusinessName: 'Sample Business',
		clientEmail: 'sample@example.com',
		responses: {},
		currentSection: 0,
		completionPercentage: 0,
		status: 'not_started',
		startedAt: null,
		completedAt: null,
		lastActivityAt: null,
		createdAt: new Date(),
		updatedAt: new Date()
	};
</script>

<svelte:head>
	<title>Preview Questionnaire | {data.agency.name}</title>
</svelte:head>

<!-- Preview Mode Banner -->
<div class="bg-info text-info-content px-4 py-3">
	<div class="container mx-auto flex items-center justify-between gap-4">
		<div class="flex items-center gap-2">
			<Info class="h-5 w-5 shrink-0" />
			<div>
				<span class="font-medium">Preview Mode</span>
				<span class="hidden sm:inline"> - This is how your clients will see the questionnaire form. Changes are not saved.</span>
			</div>
		</div>
		<a href="/{data.agency.slug}/questionnaires" class="btn btn-sm btn-ghost gap-1">
			<ArrowLeft class="h-4 w-4" />
			<span class="hidden sm:inline">Exit Preview</span>
		</a>
	</div>
</div>

<!-- Questionnaire Form Preview -->
<QuestionnaireWizard
	questionnaire={mockQuestionnaire}
	agencyLogoUrl={data.agency.logoUrl || null}
	agencyName={data.agency.name}
	readOnly={false}
	isPreview={true}
/>
