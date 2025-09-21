<script>
    import { fly } from 'svelte/transition';
    import Plus from '@icons/plus.svelte';
    import Minus from '@icons/minus.svelte';

    let { 
        value = $bindable(0),
        step = 1,
        min,
        max,
        label,
        name,
        disabled = false,
        showRange = false,
        onchange = () => {},
        ...restProps
    } = $props();

    let direction = $state(1); // 1 for increment, -1 for decrement
    let key = $state(0); // Force re-render for transition

    // Calculate decimal places for proper rounding
    const decimalPlaces = $derived(() => {
        const stepStr = step.toString();
        return stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
    });

    function roundToPrecision(num) {
        return parseFloat(num.toFixed(decimalPlaces()));
    }

    function increment() {
        if (disabled || (max !== undefined && value >= max)) return;
        direction = 1;
        value = roundToPrecision(value + step);
        key++;
        onchange?.(value);
    }

    function decrement() {
        if (disabled || (min !== undefined && value <= min)) return;
        direction = -1;
        value = roundToPrecision(value - step);
        key++;
        onchange?.(value);
    }

    function handleKeydown(event) {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            increment();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            decrement();
        }
    }

    function handleInput(event) {
        let inputValue = event.target.value;

  
        // Handle empty input
        if (inputValue === '' || inputValue === '-') {
            return; // Allow empty or just minus sign for typing
        }
        
        let numValue = parseFloat(inputValue);
        
        // Handle invalid numbers
        if (isNaN(numValue)) {
            // Reset to current valid value
            event.target.value = value;
            return;
        }
        
        // Apply min/max constraints
        if (min !== undefined && numValue < min) {
            numValue = min;
        }
        if (max !== undefined && numValue > max) {
            numValue = max;
        }

        
        // Round to proper precision and update
        value = roundToPrecision(numValue);

        onchange?.(value);
        
        // Update input field if value was constrained
        if (event.target.value !== value.toString()) {
            event.target.value = value;
        }
    }

</script>

<div class="flex flex-col font-medium gap-1 w-full">
    {#if label}
        <span class="text-xs font-medium">{label}</span>
    {/if}
    <div class="flex items-center border border-primary-4 rounded-xl overflow-hidden">
        <button
            aria-label="Decrement"
            type="button"
            onclick={decrement}
            disabled={disabled || (min !== undefined && value <= min)}
            class="p-2 hover:bg-primary-2 active:scale-95 transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus-icon lucide-minus">
            <path d="M5 12h14"/>
        </svg>
        </button>
        
        <div class="flex-1 relative h-8 overflow-hidden flex items-center justify-center min-w-16 focus-within:outline-2">
            {#key key}
                <input 
                    id="abc"
                    {name}
                    type="number"
                    {min}
                    {max}
                    {step}
                    oninput={handleInput}
                    value={value}
                    disabled={disabled}
                    class="absolute inset-0 text-center border-0 outline-none z-10"
                    in:fly={{ y: direction * -15, duration: 200 }}
                    out:fly={{ y: direction * 15, duration: 100 }}
                />
            {/key}
        </div>
        
        <button
            aria-label="Increment"
            type="button"
            onclick={increment}
            disabled={disabled || (max !== undefined && value >= max)}
            class="p-2 hover:bg-primary-2 active:scale-95 transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-icon lucide-plus">
                <path d="M5 12h14"/>
                <path d="M12 5v14"/>
            </svg>
        </button>
    </div>
    {#if showRange}
        <div class="flex items-center gap-2 text-xs text-secondary-4">
            {min ? min : '∞'} - {max ? max : '∞'}
        </div>
    {/if}
</div>

<style>
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  </style>
  

<!-- @component Number
### Usage
```svelte
<script>
    import Number from '@components/ui/Number.svelte';
    let quantity = $state(0);
</script>

<Number 
    bind:value={quantity} 
    name="quantity"
    step={1} 
    min={0} 
    max={100} 
    label="Quantity" 
/>
```
-->
