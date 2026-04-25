/**
 * Dirty tracker for branding form state.
 *
 * JSON.stringify equality matches the iframe re-post pattern already used in
 * the branding page (+page.svelte:209). Stable since branding state is plain
 * data — no Date / Map / Set / function values that stringify lossy.
 */
export function createDirtyTracker<T>(getValue: () => T) {
	let baseline = $state(JSON.stringify(getValue()));
	return {
		get isDirty() {
			return JSON.stringify(getValue()) !== baseline;
		},
		reset() {
			baseline = JSON.stringify(getValue());
		},
	};
}
