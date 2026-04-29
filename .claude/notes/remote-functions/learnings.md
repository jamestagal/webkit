# Remote Functions — Learnings

- **2026-04-30**: SvelteKit experimental remote functions — the `.run()` boundary is anchored-at-setup (no `.run()` needed, can `await` anywhere) vs fresh-unanchored-in-imperative-path (needs `.run()` OR refactor to anchored `$derived(getX(...))`). Dual-path sites (called from BOTH lifecycle AND event handlers) require the anchored `$derived` refactor — neither raw `.run()` nor raw `await` works. See [reference.md §"Query Instance Anchoring"](reference.md) and [gotchas.md](gotchas.md). Reference impls: Phase A `e7e095e`, A.5 `b573580`, B `9771e2a`.
