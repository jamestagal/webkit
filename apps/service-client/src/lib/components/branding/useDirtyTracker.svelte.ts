/**
 * Dirty tracker for branding form state.
 *
 * JSON.stringify equality matches the iframe re-post pattern already used in
 * the branding page (+page.svelte:209). Stable since branding state is plain
 * data — no Date / Map / Set / function values that stringify lossy.
 *
 * `baseline` is exposed so callers can implement "discard changes" by
 * Object.assign(state, JSON.parse(tracker.baseline)).
 */
export function createDirtyTracker<T>(getValue: () => T) {
	let baseline = $state(JSON.stringify(getValue()));
	return {
		get isDirty() {
			return JSON.stringify(getValue()) !== baseline;
		},
		get baseline() {
			return baseline;
		},
		reset() {
			baseline = JSON.stringify(getValue());
		},
	};
}

export const useDirtyTracker = createDirtyTracker;
