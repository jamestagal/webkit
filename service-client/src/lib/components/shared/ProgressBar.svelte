<script lang="ts">
	import { consultationStore } from "$lib/stores/consultation.svelte";

	// Props
	let {
		showPercentage = true,
		showStepCount = true,
		showLabels = false,
		animate = true,
		size = "medium",
		variant = "default",
		customProgress = null,
	}: {
		showPercentage?: boolean;
		showStepCount?: boolean;
		showLabels?: boolean;
		animate?: boolean;
		size?: "small" | "medium" | "large";
		variant?: "default" | "success" | "warning" | "info";
		customProgress?: number | null;
	} = $props();

	// Get store references
	let completedSteps = $derived.by(() => {
		const stepsData = consultationStore.formState.completedSteps;
		return Array.isArray(stepsData) ? stepsData : [];
	});
	let currentStep = $derived(consultationStore.formState.currentStep);
	let totalSteps = $derived(consultationStore.totalSteps);
	let steps = consultationStore.steps;

	// Calculate progress
	const progress = $derived(() => {
		if (customProgress !== null) return Math.max(0, Math.min(100, customProgress));
		const completed = completedSteps;
		const total = totalSteps;
		const completedCount = Array.isArray(completed) ? completed.length : 0;
		return total > 0 ? Math.round((completedCount / total) * 100) : 0;
	});

	const completedCount = $derived(() => {
		const completed = completedSteps;
		return Array.isArray(completed) ? completed.length : 0;
	});

	// Get current step info
	const currentStepInfo = $derived(() => steps[currentStep]);

	// Styling classes
	const sizeClasses = {
		small: "h-1",
		medium: "h-2",
		large: "h-3",
	};

	const variantClasses = {
		default: "bg-indigo-600",
		success: "bg-green-600",
		warning: "bg-yellow-600",
		info: "bg-blue-600",
	};

	const textSizeClasses = {
		small: "text-xs",
		medium: "text-sm",
		large: "text-base",
	};

	// Animation classes
	const animationClass = animate ? "transition-all duration-700 ease-in-out" : "";

	// Progress width style
	const progressWidth = $derived(() => `${progress()}%`);

	// Status message
	const statusMessage = $derived(() => {
		const progressValue = progress();
		if (progressValue === 100) {
			return "Consultation complete!";
		} else if (progressValue >= 75) {
			return "Almost finished!";
		} else if (progressValue >= 50) {
			return "Halfway there!";
		} else if (progressValue >= 25) {
			return "Making good progress!";
		} else if (progressValue > 0) {
			return "Getting started...";
		} else {
			return "Ready to begin";
		}
	});

	// Get step status
	function getStepStatus(stepIndex: number): "completed" | "current" | "pending" {
		if (completedSteps.includes(stepIndex)) return "completed";
		if (stepIndex === currentStep) return "current";
		return "pending";
	}

	// Get step label
	function getStepLabel(step: any, stepIndex: number): string {
		const status = getStepStatus(stepIndex);
		switch (status) {
			case "completed":
				return ` ${step.title}`;
			case "current":
				return `� ${step.title}`;
			default:
				return `� ${step.title}`;
		}
	}
</script>

<div class="w-full">
	<!-- Header with stats -->
	{#if showPercentage || showStepCount}
		<div class="mb-2 flex items-center justify-between">
			{#if showStepCount}
				<div class="flex items-center space-x-2">
					<span class="{textSizeClasses[size]} font-medium text-gray-700">Progress</span>
					{#if currentStepInfo()}
						<span class="{textSizeClasses[size]} text-gray-500">
							({currentStepInfo().title})
						</span>
					{/if}
				</div>
			{/if}

			<div class="flex items-center space-x-3">
				{#if showStepCount}
					<span class="{textSizeClasses[size]} text-gray-600">
						{completedCount()} of {totalSteps} steps
					</span>
				{/if}

				{#if showPercentage}
					<span class="{textSizeClasses[size]} font-semibold text-gray-900">
						{progress()}%
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Progress Bar -->
	<div class="relative">
		<div class="w-full rounded-full bg-gray-200 {sizeClasses[size]} overflow-hidden">
			<div
				class="{variantClasses[variant]} {sizeClasses[
					size
				]} rounded-full {animationClass} relative overflow-hidden"
				style="width: {progressWidth()}"
				role="progressbar"
				aria-valuenow={progress()}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Consultation completion progress"
			>
				<!-- Shine effect for completed sections -->
				{#if animate && progress() > 0}
					<div
						class="absolute inset-0 translate-x-full -skew-x-12 transform animate-pulse bg-white opacity-20"
					></div>
				{/if}
			</div>
		</div>

		<!-- Step markers -->
		{#if totalSteps > 1}
			<div class="absolute top-0 left-0 flex h-full w-full items-center justify-between px-1">
				{#each steps as step, index}
					{@const total = totalSteps}
					{#if index > 0 && index < total - 1}
						{@const stepProgress = total > 1 ? (index / (total - 1)) * 100 : 0}
						{@const completed = completedSteps}
						{@const isCompleted = Array.isArray(completed) && completed.includes(index)}
						<div
							class="w-1 {sizeClasses[size]} -translate-x-1/2 transform rounded-full {isCompleted
								? 'bg-white'
								: 'bg-gray-400'}"
							style="left: {stepProgress}%"
							title="Step {index + 1}: {step.title}"
						></div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Status message -->
	{#if showLabels}
		<div class="mt-2">
			<p class="{textSizeClasses[size]} text-center text-gray-600">
				{statusMessage()}
			</p>
		</div>
	{/if}

	<!-- Step list (optional detailed view) -->
	{#if showLabels && steps.length <= 6}
		<div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each steps as step, index}
				{@const status = getStepStatus(index)}
				<div class="flex items-center space-x-2 {textSizeClasses[size]}">
					<span
						class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-xs {status ===
						'completed'
							? 'bg-green-500 text-white'
							: status === 'current'
								? 'bg-indigo-500 text-white'
								: 'bg-gray-300 text-gray-600'}"
					>
						{#if status === "completed"}
							<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						{:else}
							{index + 1}
						{/if}
					</span>
					<span
						class={status === "completed"
							? "text-green-700 line-through"
							: status === "current"
								? "font-medium text-indigo-700"
								: "text-gray-500"}
					>
						{step.title}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Milestone celebrations -->
	{#if animate && progress() === 100}
		<div class="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
			<div class="flex items-center">
				<svg class="mr-2 h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="text-sm font-medium text-green-800">
					Congratulations! You've completed the consultation form.
				</p>
			</div>
		</div>
	{:else if animate && [25, 50, 75].includes(progress())}
		<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
			<div class="flex items-center">
				<svg class="mr-2 h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="text-sm font-medium text-blue-800">
					Great progress! Keep going to complete your consultation.
				</p>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes shine {
		0% {
			transform: translateX(-100%) skewX(-12deg);
		}
		100% {
			transform: translateX(300%) skewX(-12deg);
		}
	}

	.animate-shine {
		animation: shine 2s infinite;
	}
</style>
