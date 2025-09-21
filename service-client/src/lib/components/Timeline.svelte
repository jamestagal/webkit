<script>
    import Check from '@icons/check.svelte';
    import Plus from '@icons/plus.svelte';

    let { data = [] } = $props();
  </script>
  
  
        <!-- Timeline Points -->
        <div class="flex flex-col gap-4 md:flex-row mx-auto border-l-2 md:border-t-2 md:border-l-0 border-secondary-3 w-full">
          {#each data as stage, i}
            <div class="relative w-full max-w-md gap-8 flex flex-row md:flex-col items-center" in:slide={{ delay: i * 100, duration: 300 }}>
              <div class="relative">
                <div class="w-[46px] h-[46px] rounded-full border-2 border-primary-2 shadow-md transform transition-transform hover:scale-110
                    {stage.isActive ? 'bg-gradient-to-br from-secondary-2 to-secondary-3 text-main' : 'bg-main text-secondary-3'} 
                    flex items-center justify-center font-medium absolute top-[50%] -translate-y-[50%] -translate-x-[50%]">
                  <span class="text-xs">{stage.label}</span>
                </div>
              </div>
            
                <div class="card shadow-lg p-6 flex flex-col gap-4 w-full max-w-md">

                  <div class="font-bold text-2xl gap-2 flex items-center">
                    <span>${stage.price}</span>
                    <span class="text-xs text-fade">USD</span>
                  </div>
                  
                  <div class="space-y-2.5">
                    <p class="text-sm font-semibold">
                      {stage.heading}
                    </p>
                    <div class="space-y-2 pt-1">
                      {#each stage.features as feature}
                        <div class="flex items-start space-x-2 group text-left">
                          {#if feature.isActive}
                              <Check size={16} class="flex-shrink-0" />
                          {:else}
                              <Plus size={16} class="text-primary-4 flex-shrink-0" />
                          {/if}
                          <p class="text-sm cursor-default {!feature.isActive ? 'text-primary-4 group-hover:text-secondary' : 'text-secondary'} transition-colors">
                            {feature.name}
                          </p>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
          {/each}
        </div>