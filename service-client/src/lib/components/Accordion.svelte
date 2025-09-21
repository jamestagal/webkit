<script>
    import { slide } from 'svelte/transition';
    import ChevronDown from '@icons/chevron-down.svelte';

    let { title = "", children } = $props();
    let isOpen = $state(false);
    
    function toggleAccordion() {
      isOpen = !isOpen;
    }
    
  </script>
  
  <div class="card card-ring flex flex-col mb-2">
    <!-- Trigger section -->
    <button 
      class="w-full p-4 flex justify-between cursor-pointer items-center text-left focus:outline-none"
      onclick={toggleAccordion}
      aria-expanded={isOpen}
    >
      <span class="font-bold">{title}</span>
      <ChevronDown size={16} class={isOpen ? 'transition-transform duration-300 rotate-180' : 'transition-transform duration-300'} />
    </button>
    
    <!-- Content section -->
    {#if isOpen}
      <div 
        class="p-4"
        transition:slide={{ duration: 300 }}
      >
        {@render children?.()}
      </div>
    {/if}
  </div>
  
  
  