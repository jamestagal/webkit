<script>
    import Check from '@icons/check.svelte'
    import X from '@icons/x.svelte'
    import ArrowRight from '@icons/arrow-right.svelte'
    
    let { product } = $props();
    
    function formatInterval(interval) {
        switch(interval) {
            case 'one_time':
                return 'One-time payment';
            case 'month':
                return `per month`;
            case 'year':
                return `per year`;
            default:
                return interval;
        }
    }
    
    function formatPrice(amount) {
        const price = amount / 100;
        return price.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: price % 1 === 0 ? 0 : 2
        });
    }
    
    let displayPrice = $derived.by(() => {
        const monthlyPrice = product.prices?.find(p => p.amountType === 'fixed' && p.interval === 'month');
        const yearlyPrice = product.prices?.find(p => p.amountType === 'fixed' && p.interval === 'year');
        const oneTimePrice = product.prices?.find(p => p.amountType === 'fixed' && p.interval === 'one_time');
        
        return monthlyPrice || yearlyPrice || oneTimePrice || null;
    });
    
    // For backward compatibility with the hardcoded structure
    let included = $derived(product.included || product.features || []);
    let excluded = $derived(product.excluded || []);
    let benefits = $derived(product.benefits || []);
    let special = $derived(product.special || false);
</script>

<div class={special ? `animate-border rounded-xl` : ''}>
  <div class="card space-y-8  max-w-xs bg-white {special ? '!border-transparent shadow-xl' : 'card-ring'} rounded-2xl p-6">
        <div class="space-y-6">
            {#if product.title}
                <p class="text-gradient font-medium tracking-widest uppercase">{product.title}</p>
            {/if}

            {#if product.name}
                <p class="text-3xl font-bold">{product.name}</p>
            {/if}

            <div class="flex flex-row items-center gap-2">
                {#if displayPrice}
                    <p class="text-4xl font-extrabold">{formatPrice(displayPrice.amount)}</p>
                    <p class="text-sm font-medium"> / {formatInterval(displayPrice.interval)}</p>
                {:else}
                    <p class="text-4xl font-bold">Contact us</p>
                {/if}
            </div>

            <p class="text-sm text-secondary-4 break-words whitespace-break-spaces">{product.description}</p>
            <div class="flex flex-col gap-2">
                <a href={product.url || "/settings/billing"} class="button center cta">
                    Get {product.name} <ArrowRight size={18} strokeWidth={2.5} class="ml-1" />
                </a>
                <p class="text-xxs text-center">
                    By purchasing, you agree to our <a href="/legal/tos" class="link">Terms of Service</a>.
                </p>
            </div>
        </div>

        {#if included.length > 0}
        <div class="space-y-4 border-t border-primary-2 pt-4">
            <h4 class="font-medium ">Everything included now:</h4>
            <ul class="space-y-4 text-sm">
                {#each included as item}
                    <li class="flex items-center gap-3">
                        <Check class="w-5 h-5 text-emerald-500" />
                        <span>{item}</span>
                    </li>
                {/each}
                {#each excluded as item}
                    <li class="flex items-center gap-3">
                        <X class="w-5 h-5 text-red-500" />
                        <span>{item}</span>
                    </li>
                {/each}
            </ul>
        </div>
        {/if}

        {#if benefits.length > 0}
        <div class="p-4 bg-primary rounded-lg">
            <h4 class="font-medium text-zinc-900 mb-2">After purchase, you'll get:</h4>
            <ul class="space-y-2 text-sm">
                {#each benefits as item}
                    <li class="flex items-center gap-3">
                        <Check size={16} strokeWidth={3} class="text-primary-accent" />
                        <span>{item}</span>
                    </li>
                {/each}
            </ul>
        </div>
        {/if}
</div>
</div>