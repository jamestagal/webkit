<script>

let randomId = `textarea-${Math.random().toString(36).substring(2, 15)}`;
let { 
    id = randomId,
    name = randomId,
    label,
    placeholder = 'Type something...',
    value = $bindable(''),
    maxLength = 200,
    showLimit = true,
    stopLimit = false,
    onLimit = () => {},
    ...restProps
 } = $props();

 const currentLength = $derived(value?.length || 0);
 const isOverLimit = $derived(currentLength > maxLength);

 let onLimitTriggered = $state(false);

 function handleInput(event) {
    if (isOverLimit && showLimit) {
        if (stopLimit) {
            event.target.value = event.target.value.slice(0, maxLength);
            value = event.target.value;
        }
        if (!onLimitTriggered) {
            onLimit({ currentLength, maxLength });
            onLimitTriggered = true;
        }
    }

    if(onLimitTriggered && currentLength < maxLength) {
        onLimitTriggered = false;
    }
 }
</script>
<div class="flex flex-col gap-2 w-full">
    {#if label}
        <label class="text-xs font-medium" for={id}>{label}</label>
    {/if}
    <div class="relative flex p-1 w-full border border-primary-4 rounded-xl overflow-hidden
    focus-within:outline-2 [&>textarea]:w-full [&>textarea]:placeholder:text-secondary-4">

        <textarea class="w-full min-h-24 outline-none p-1" {id} {name} {placeholder} {...restProps} bind:value oninput={handleInput}></textarea>
        {#if showLimit}
            <div class="absolute bottom-3 right-3 text-xs {isOverLimit ? 'text-red-500' : 'text-zinc-500 '}">
                {currentLength || 0} / {maxLength}
            </div>
        {/if}

    </div>
</div>

<!-- @component Textarea 
### Usage
```svelte
<script>
    import Textarea from '@components/ui/Textarea.svelte';
</script>
<Textarea label="Description" name="description" maxLength={10} showLimit={true} stopLimit={false} onLimit={handleOnLimit} />
```

### Props
maxLength: number - The maximum length of the textarea.
showLimit: boolean - Whether to show the limit of the textarea.
stopLimit: boolean - Whether to stop the user from typing when the textarea is over the maxLength.
onLimit: function - A function to be called when the textarea is over the maxLength.
-->