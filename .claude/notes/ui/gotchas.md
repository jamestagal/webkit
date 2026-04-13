# UI Gotchas

## Never Use Native `confirm()` Dialogs

**Anti-pattern:**
```typescript
async function handleDelete(id: string) {
    if (!confirm('Are you sure?')) return;
    // ...
}
```

**Why it's wrong:** Native `confirm()` uses the browser's unstyled dialog, which looks out of place in a DaisyUI-themed app.

**Correct pattern:** Use a DaisyUI styled modal with `modal modal-open`.

### Single Action Pattern (delete only)

```typescript
// State
let showDeleteModal = $state(false);
let deletingItem = $state<{ id: string; name: string } | null>(null);
let isDeleting = $state(false);

// Open/close
function openDeleteModal(id: string, name: string) {
    deletingItem = { id, name };
    showDeleteModal = true;
}

function closeDeleteModal() {
    showDeleteModal = false;
    deletingItem = null;
}

// Confirm
async function confirmDelete() {
    if (!deletingItem) return;
    isDeleting = true;
    try {
        await deleteItem(deletingItem.id);
        closeDeleteModal();
        await invalidateAll();
        toast.success("Item deleted");
    } catch (err) {
        toast.error("Failed to delete", err instanceof Error ? err.message : "");
    } finally {
        isDeleting = false;
    }
}
```

```svelte
{#if showDeleteModal && deletingItem}
    <div class="modal modal-open">
        <div class="modal-box">
            <h3 class="text-lg font-bold">Delete Item</h3>
            <p class="py-4">
                Are you sure you want to delete <strong>{deletingItem.name}</strong>? This action cannot be undone.
            </p>
            <div class="modal-action">
                <button class="btn btn-ghost" onclick={closeDeleteModal} disabled={isDeleting}>
                    Cancel
                </button>
                <button class="btn btn-error" onclick={confirmDelete} disabled={isDeleting}>
                    {#if isDeleting}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Delete
                </button>
            </div>
        </div>
        <div class="modal-backdrop" onclick={closeDeleteModal}></div>
    </div>
{/if}
```

### Multi-Action Pattern (delete + cancel, revoke, etc.)

When a page has multiple confirm actions, use a generic confirm modal:

```typescript
let confirmModal = $state<{
    title: string;
    message: string;
    actionLabel: string;
    actionClass: string;
    onConfirm: () => Promise<void>;
} | null>(null);
let isConfirming = $state(false);

async function handleConfirm() {
    if (!confirmModal) return;
    isConfirming = true;
    try {
        await confirmModal.onConfirm();
        confirmModal = null;
    } finally {
        isConfirming = false;
    }
}
```

```svelte
{#if confirmModal}
    <div class="modal modal-open">
        <div class="modal-box">
            <h3 class="text-lg font-bold">{confirmModal.title}</h3>
            <p class="py-4">{confirmModal.message}</p>
            <div class="modal-action">
                <button class="btn btn-ghost" onclick={() => confirmModal = null} disabled={isConfirming}>
                    Cancel
                </button>
                <button class="btn {confirmModal.actionClass}" onclick={handleConfirm} disabled={isConfirming}>
                    {#if isConfirming}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    {confirmModal.actionLabel}
                </button>
            </div>
        </div>
        <div class="modal-backdrop" onclick={() => confirmModal = null}></div>
    </div>
{/if}
```

### Button Color Guide

| Action | Button Class |
|--------|-------------|
| Delete / Remove | `btn-error` |
| Cancel / Revoke | `btn-warning` |

### Checklist

- [ ] No native `confirm()` calls
- [ ] Modal uses `modal modal-open` wrapper
- [ ] Loading spinner on action button during async operation
- [ ] Both buttons disabled during async operation
- [ ] Backdrop click closes modal (disabled during operation)
- [ ] Item name shown in bold in confirmation message

## Never Use $effect to Write to Form $state Variables

**Bug:** `$effect` that re-populates form from server data after `invalidateAll()` wrote to multiple `$state` variables. In production builds, Svelte 5 tracks effect dependencies more aggressively, causing `effect_update_depth_exceeded` — an infinite loop. Works in dev mode but crashes in production.

**Symptoms:** `effect_update_depth_exceeded` error in console (production only), 20+ second delay entering edit mode, changes never detected.

**Fix:** Remove the `$effect` entirely. Sync form state imperatively in `handleSave()` after `invalidateAll()`:

```typescript
// BAD — causes effect_update_depth_exceeded in production
$effect(() => {
    const q = data.quotation;
    if (!isEditing) return;
    quotationName = q.title;        // writes trigger cascading updates
    loadedForm = snapshot;
});

// GOOD — imperative sync, no $effect
function syncFormFromServer() {
    const snapshot = snapshotFromServer(data.quotation, data.sections);
    quotationName = snapshot.title;
    loadedForm = snapshot;
}

// In handleSave:
await invalidateAll();
syncFormFromServer();  // called imperatively, not reactively
```
