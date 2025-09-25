<script>
	let randomId = `input-${Math.random().toString(36).substring(2, 15)}`;
	let {
		label,
		value = $bindable(""),
		id = randomId,
		name = randomId,
		Icon,
		IconSize = 14,
		buttonText,
		buttonType,
		buttonStyle,
		onButtonClick,
		...restProps
	} = $props();

	// Pre-defined button styles
	const styles = {
		outline: `border border-primary`,
		action: `bg-secondary text-primary`,
		accent: `bg-primary-accent text-secondary-accent`,
	};
</script>

<div class="flex w-full flex-col gap-1">
	{#if label}
		<label class="text-xs font-medium" for={id}>{label}</label>
	{/if}
	<div
		class="border-primary-4 [&>input]:placeholder:text-secondary-4 flex flex-row items-center gap-2 rounded-xl border px-2 py-2
                focus-within:outline-2 [&>input]:w-full [&>input]:focus:outline-none"
	>
		{#if Icon}
			<Icon size={IconSize} class="text-secondary-2 flex-shrink-0" />
		{/if}
		<input {id} bind:value {...restProps} />
		{#if buttonText}
			<button
				type={buttonType}
				class="cursor-pointer rounded-lg px-2 py-1 text-xs transition-all duration-100 active:scale-95 {styles[
					buttonStyle
				] ?? ''}"
				onclick={onButtonClick}
			>
				{buttonText}
			</button>
		{/if}
	</div>
</div>

<!-- @component 
### Usage
```svelte
<script>
    import Input from "$lib/components/ui/Input.svelte";
    import { Lock } from "@lucide/svelte";
    // All attributes are optional 
    // You can add your own just like in a normal input element
</script>
<Input Icon={Lock} label="Search" name="search" class="bg-red-500" buttonText="Send" buttonType="button" buttonStyle="action" />
```
-->
