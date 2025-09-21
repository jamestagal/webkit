<script>
    let randomId = `input-${Math.random().toString(36).substring(2, 15)}`;
    let { 
        label,
        value = $bindable(''),
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
        accent: `bg-primary-accent text-secondary-accent`
    }
</script>


<div class="flex flex-col w-full gap-1">
    {#if label}
        <label class="text-xs font-medium" for={id}>{label}</label>
    {/if}
    <div class="flex flex-row gap-2 items-center border border-primary-4 px-2 py-2 rounded-xl focus-within:outline-2
                [&>input]:focus:outline-none [&>input]:w-full [&>input]:placeholder:text-secondary-4">
        {#if Icon}
            <Icon size={IconSize} class="flex-shrink-0 text-secondary-2" />
        {/if}
        <input {id} bind:value={value} {...restProps} />
        {#if buttonText}
            <button type={buttonType} 
            class="text-xs cursor-pointer rounded-lg px-2 py-1 active:scale-95 transition-all duration-100 {styles[buttonStyle] ?? ''}"
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


