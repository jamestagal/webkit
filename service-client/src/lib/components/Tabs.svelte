<script>

    import Slider from './Slider.svelte';

    let { children, items, activeIndex = $bindable(0), prevIndex = $bindable(0) } = $props();

    function handleClick(index) {
        prevIndex = activeIndex;
        activeIndex = index;
    }

</script>


<div class="flex flex-col gap-12">

    <!-- Menu -->
    <div class="card card-ring flex flex-row flex-wrap items-center justify-center w-fit mx-auto gap-2 p-2">
        {#each items as item, index}
            <!-- Each child wrapping -->
            <button type="button" class="button p-2 text-sm" class:action={activeIndex === index} onclick={() => handleClick(index)}>
                {item.name}
            </button>
        {/each}
    </div>

    {@render children?.({ activeIndex })}
</div>


<!-- @component 

- Will make a component that will be used to display the mini menu buttons and return the active index
- Currenly accepts array of objects with name property: items: { name: 'string' }
- activeIndex is bindable integer
- prevIndex is bindable integer

### Usage

```html
<Tabs {items} bind:activeIndex bind:prevIndex />
```
-->