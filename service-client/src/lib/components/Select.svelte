<script>
    import { fly } from 'svelte/transition';

    let randomId = `dropdown-${Math.random().toString(36).substring(2, 15)}`;
    let { 
        placeholder = 'Choose an option', 
        options = [], 
        value = $bindable(), 
        name = randomId,
        id = randomId,
        label,
        onSelect = () => {}
    } = $props();

    let isOpen = $state(false);
    let dropdownRef = $state(null);
    let shouldOpenUp = $state(false);
    
    // This selects the option that has the value that matches the value prop
    let selected = $derived(Array.isArray(options) ? (options.find(opt => opt.value === value) || {}) : {});

    function handleSelect(index) {
        if (Array.isArray(options) && options[index]) {
            value = options[index].value;
            onSelect(index);
        }
        isOpen = false;
    }

    function handleClickOutside(event) {
        if (dropdownRef && !dropdownRef.contains(event.target)) {
            isOpen = false;
        }
    }

    function checkSpace() {
        if (!dropdownRef) return;
        const rect = dropdownRef.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = options.length * 40; // Approximate height per option
        
        shouldOpenUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    }

    function toggleDropdown() {
        isOpen = !isOpen;
    }
</script>

<svelte:window onresize={checkSpace} onmouseup={handleClickOutside} />

<div class="relative z-40 flex flex-col w-full gap-2" bind:this={dropdownRef}>
    <input id={id} type="hidden" {name} value={value || ''} />
    {#if label}
        <div class="flex flex-row items-center gap-2">
            <span class="text-sm text-secondary-3">{label}</span>
            {#if selected.value}
            <button type="button" 
            class="cursor-pointer" 
            transition:fly={{ x: 10, duration: 120 }} 
            aria-label="Reset selection" onclick={() => {
                 value = '';
                 selected = {};
            }}>
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
               </svg>
            </button>
            {/if}
        </div>
    {/if}
    {@render optionSnippet(selected, null)}

    {#if isOpen}
        <div transition:fly={{ y: shouldOpenUp ? 10 : -10, duration: 80 }} 
             class="absolute z-50 w-full {shouldOpenUp ? 'bottom-full mb-2' : 'top-full mt-2'} border border-primary-3 bg-main rounded-xl shadow-lg"
        >
        {#each options as option, index}
            {@render optionSnippet(option, index)}
        {/each}
        </div>
    {/if}
</div>

{#snippet optionSnippet(option, index)}
    {@const isSelector = !index && index !== 0}
    {@const isSelectedOption = selected.value === option.value && option.value}
    <button
        type="button"
        class="flex flex-row overflow-hidden rounded-xl text-nowrap w-full cursor-pointer items-center justify-between px-4 py-2 text-left hover:bg-primary"
        class:border={isSelector}
        class:border-primary-3={isSelector}
        class:bg-primary={isSelectedOption}
        class:font-semibold={isSelectedOption}
        onclick={() => isSelector ? toggleDropdown() : handleSelect(index)}
    >
        {#if option.value}
            <span class="capitalize">{option.name || option.value}</span>
        {:else}
            <span>{isSelector ? placeholder : 'No value provided'}</span>
        {/if}
        <div class="flex flex-row items-center gap-2">
        {#if option.note}
            <span class="text-sm">{option.note}</span>
        {/if}
        {#if isSelector}
        <!-- You can replace the chevron icon with any icon you want -->
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon lucide lucide-chevrons-up-down flex-shrink-0">
           <path d="m7 15 5 5 5-5"></path>
            <path d="m7 9 5-5 5 5"></path>
        </svg>
        {/if}
        </div>
    </button>
{/snippet}


<!-- @component
### Usage
```svelte
<script>
    import Dropdown from '$lib/components/ui/Dropdown.svelte';
    let options = [
        { name: 'Option 1', value: 'option1', note: 'This is a note' },
        { name: 'Option 2', value: 'option2' },
        { value: 'option3' },
    ];
    // Only value is required, others are optional
</script>
<Dropdown {options} value={options[1].value} name="dropdown" label="Options" placeholder="Select an option" />
```
-->