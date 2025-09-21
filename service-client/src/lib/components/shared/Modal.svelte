<script>
  let {
    title,
    maxWidth = 'max-w-2xl',
    height = 'h-auto',
    position = 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    showCloseButton = true,
    children
  } = $props();

  let modalElement = $state();

  export function close() {
    modalElement.close();
  }

  export function showModal() {
    modalElement.showModal();
  }
</script>

<dialog
  bind:this={modalElement}
  class={`${maxWidth} ${position} z-50 w-11/12 fixed max-h-svh bg-main shadow-xl text-secondary overflow-x-hidden rounded-xl`}
>
  {#if title || showCloseButton}
    <div class="flex items-center px-4 h-14 {title ? 'justify-between' : 'justify-end'}">
      {#if title}
        <h1 class="font-semibold p-2">{title}</h1>
      {/if}
      {#if showCloseButton}
        <button
          class="button p-2"
          onclick={close}
          aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      {/if}
    </div>
  {/if}
  {@render children?.()}
</dialog>

<style>
  dialog {
    animation: scaleIn 100ms ease-in forwards;
    scrollbar-width: thin;
    -ms-overflow-style: none;
  }

  dialog::backdrop {
    background-color: color-mix(in srgb, var(--color-secondary-2) 50%, transparent);
    backdrop-filter: blur(4px);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>

<!-- @component Modal
### Usage
```svelte
<script>
    import Modal from '$lib/components/ui/Modal.svelte';
    let modalReference = $state();
</script>
<button type="button" onclick={() => modalReference?.showModal()}>Open Modal</button>
<Modal bind:this={modalReference} title="Modal Title" showCloseButton>
    <div class="flex flex-col gap-8 p-4">
        <p>This is a modal! It's a dialog that can be used to display information or ask for user input.</p>
        <button onclick={() => modalReference?.close()}>Okay</button>
    </div>
</Modal>
```
-->