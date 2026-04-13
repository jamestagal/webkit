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

## Never Read Form $state Inside $effect That Syncs Server Data

**Bug:** `$effect` that re-populates form from server data after `invalidateAll()` also called `takeSnapshot()` which reads form `$state` variables. This creates a circular dependency:
1. User edits field → `$state` changes
2. `$effect` re-runs (depends on form state via `takeSnapshot()`)
3. Effect overwrites field back to server value
4. `loadedForm` resets → `hasChanges` stays false

**Symptoms:** 20+ second delay entering edit mode (reactive cascade), changes never detected.

**Fix:** Build the baseline snapshot directly from server data parameters (`data.quotation`, `data.sections`), never from form `$state` variables. Use a `snapshotFromServer(q, s)` helper.

```typescript
// BAD — creates circular dependency
$effect(() => {
    const q = data.quotation;
    if (!isEditing) return;
    quotationName = q.title;
    loadedForm = takeSnapshot(); // reads quotationName → circular!
});

// GOOD — only depends on server data + isEditing
$effect(() => {
    const q = data.quotation;
    if (!isEditing) return;
    const snapshot = snapshotFromServer(q, s);
    quotationName = snapshot.title;
    loadedForm = snapshot; // built from server data, not form state
});
```
