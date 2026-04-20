# Workflow Commands — Developer Guide

A reference for the custom slash commands and git hooks that power the Webkit development loop. Everything here is local to this repo; nothing here is Claude Code–core.

## What problem this solves

Specs live in **Cowork** (a separate workspace at `~/Documents/Claude/Projects/Webkit/`, surfaced here via the `.cowork/` symlink). Implementation happens in **Claude Code** in this repo. Three things kept leaking:

1. **Specs in two places** — people forget which copy is canonical; stale plans get implemented
2. **Knowledge capture** — mid-session insights never make it back into notes; same bug gets re-debugged
3. **Shipped status** — the spec in Cowork says "READY" weeks after the code shipped

The commands below close those gaps.

## The three-layer workflow

```
   Cowork (draft)
        ↓  paste spec path
   Claude Code /spec → Plan Mode
        ↓  plan produced (saved to ~/.claude/plans/)
   exit Plan Mode + /plan-sync → copies plan into Cowork's visible dir
        ↓
   Cowork (appraise)  ←→  Claude Code (iterate)
        ↓  plan approved
   Implementation
        ↓  commit with `Spec:` trailer
   post-commit hook stamps spec with SHA
        ↓  verification passes
   /ship → archive spec + flip tracker to DONE
```

Three layers, two homes, one loop. Cowork owns **what to build**; this repo owns **how it's built**.

## Command catalog

All commands live in `.claude/commands/*.md` (gitignored — per-developer).

### `/spec <filename>`

Load a Cowork spec into Plan Mode and produce an implementation plan.

| | |
|---|---|
| **When** | Start of implementation work, after Cowork has a drafted spec |
| **Input** | Bare filename (`webkit-usage-tracking-spec.md`), partial name (`usage-tracking`), or empty (picker) |
| **Subdirs** | Transparent — `billing/foo.md` resolves as `foo.md` |
| **Output** | Implementation plan in Plan Mode, structured as goal → steps with `verify:` checks → unresolved questions |

**Example**
```
/spec webkit-usage-tracking-spec.md
```

Loads the spec, reads linked decision/reference docs it mentions, reads any repo code it points to, then enters Plan Mode. **Do not exit Plan Mode** until you've taken the plan back to Cowork for appraisal and returned with approval.

### `/plan-sync [filename | --list]`

Copy a plan from `~/.claude/plans/` into `~/Documents/Claude/Projects/Webkit/planning/plans/` so the Cowork agent can read it during appraisal.

| | |
|---|---|
| **When** | Immediately after you exit Plan Mode, before asking Cowork to appraise |
| **Input** | Bare filename, `--list` for the 5 newest, or empty for "copy newest" |
| **Why** | Cowork's sandboxed mount can't follow symlinks outside its root, so plans must be physically copied into its tree |
| **Collision** | If dest exists and differs, shows diff and asks before overwriting; if identical, prints "already in sync" |

**Example**
```
/plan-sync                                   # copies newest plan
/plan-sync wiggly-cuddling-wombat.md         # copies specific plan
/plan-sync --list                            # shows 5 newest, no copy
```

Claude Code writes plan files to `~/.claude/plans/` (outside Cowork's mount). `/plan-sync` bridges the two. Plan Mode is read-only, so the copy happens *after* you exit — not during.

### `/learn <insight>`

Append a one-line insight to `.claude/notes/{feature}/learnings.md`.

| | |
|---|---|
| **When** | Mid-session, the moment you discover a reusable pattern |
| **Feature** | Inferred from current branch name or dominant directory in your edits; asks if ambiguous |
| **Format** | `- **YYYY-MM-DD**: <your line>` |

**Example**
```
/learn agency-scoped queries must always use withAgencyScope — selecting by agencyId alone still leaks across tenants in subqueries
```

Writes to `.claude/notes/auth/learnings.md` (or wherever the branch points). **One line only** — if you need more, write it yourself; this command is fast capture, not an incident report.

### `/gotcha <pitfall>`

Same contract as `/learn`, but writes to `gotchas.md` — use when you just debugged something and want future-you to read the landmine before the pattern.

**Example**
```
/gotcha selecting * from users breaks Go sqlc codegen when adding columns — regenerate models.go + query_postgres.sql.go and restart webkit-core
```

### `/promote <path|pattern|entry>`

Stage a project-local note for curation into shared context.

| | |
|---|---|
| **When** | You notice a learning/gotcha applies across projects, not just Webkit |
| **Destination** | `~/Workspaces/shared-context/promotions-to-review/{feature}-{source}.md` |
| **Curation** | Manual — later you (or Cowork) review the staging file and move entries into `stack/` or `learnings/` |

**Why staging instead of direct write.** Cross-project standards need deliberate curation; direct writes lead to noisy, unreviewed notes in the global standards. Staging gives a review gate.

**Examples**
```
/promote billing/learnings                # lists entries, asks which to stage
/promote withAgencyScope                  # grep across all project notes
/promote                                  # shows 5 most recent entries
```

This is a **copy, not a move** — the original entry stays in project notes.

### `/ship <filename>` (with optional `--superseded`)

Archive a spec from `.cowork/planning/active/` to `.cowork/archive/completed/`, then flip its status in `.cowork/FEATURE-TRACKER.md` to `DONE`.

| | |
|---|---|
| **When** | After verification confirms a spec is implemented and passing |
| **Input** | Bare filename (nested subdirs transparent) or `--superseded <filename>` to move to superseded instead |
| **Side effects** | 1) spec file moved, 2) tracker status flipped after your confirmation, 3) remaining board printed |

**What "tracker flip" means.** Each tracker entry has a `[slug]` anchor on its headline, matching the spec filename stem:

```
READY     [webkit-usage-tracking-spec] Subscription billing + Usage tracking ...
```

`/ship` greps for that slug, shows a before/after diff, and applies the flip **only on your confirmation**. If there's no matching slug, it prints a warning and skips the flip — it won't invent a tracker entry for you.

**After the flip, `/ship` prints the remaining board** — all non-DONE entries grouped by section (`== BETA PREP ==`, `== ACTIVE FEATURES ==`, etc.), one line each. Useful for "what's next?" at the end of a session.

**Example**
```
/ship content-intelligence-nav-redesign.md
```

### `post-commit` git hook — SHA stamping

A repo-local git hook that stamps the matching Cowork spec with the commit SHA when your commit message carries a `Spec: <filename>.md` trailer.

**One-time install per clone:**
```bash
sh scripts/install-git-hooks.sh
```

**How to use it.** Add the trailer to your commit message:

```
feat(nav): consolidate content intelligence tabs

Spec: content-intelligence-nav-redesign.md
```

After the commit, the hook appends to the matching spec:
```
- shipped in `abc1234` (2026-04-17)
```

**When it no-ops silently:**
- No `Spec:` trailer in the commit message
- `.cowork` symlink missing (e.g. fresh clone without Cowork set up)
- Referenced spec not found in `.cowork/planning/active/`

No-op = safe. The hook never fails a commit.

## Typical session flow

Here's how a full feature ships end-to-end with these commands:

```
1.  User drafts spec in Cowork          → saves to planning/active/foo.md
2.  /spec foo.md                        → plan mode, produces plan
3.  exit plan mode + /plan-sync         → copies plan into Cowork-visible dir
4.  User takes plan to Cowork           → appraisal, feedback
5.  /spec foo.md (again)                → iterate plan with feedback
6.  (approved) exit plan mode, implement
7.  /learn ...                          → capture patterns mid-session
8.  /gotcha ...                         → capture pitfalls after debug
9.  git commit -m "feat: ...
                   Spec: foo.md"        → post-commit stamps foo.md
10. Verify: tests pass, manual QA, etc.
11. /ship foo.md                        → archive + tracker flip + board
12. (later, if cross-project) /promote  → stage entries to shared-context
```

Steps 1-5 = Layer 1 (spec). Steps 6-10 = Layer 2 (build). Steps 11-12 = Layer 3 (close out + knowledge harvest).

## Knowledge capture pipeline

```
.claude/notes/{feature}/               ← /learn, /gotcha write here (project-local)
     ↓ /promote
~/Workspaces/shared-context/
  promotions-to-review/                ← staging (review gate)
     ↓ manual curation
  stack/ or learnings/                 ← cross-project canonical
```

**Why the gate:** shared context is read by every project. Unreviewed direct writes = noise. `/promote` forces a deliberate review step.

**What goes where:**
- `.claude/notes/billing/learnings.md` — "this auth thing works like X in Webkit"
- `~/Workspaces/shared-context/learnings/sveltekit-gotchas.md` — "this SvelteKit thing breaks in any project"
- `~/Workspaces/shared-context/stack/svelte5-rules.md` — "Svelte 5 runes always follow pattern Y"

If the learning only applies to Webkit, stop at `.claude/notes/` — no promotion needed.

## The `.cowork/` write policy

Agents are **read-only under `.cowork/`** with two narrow exceptions, both invoked through `/ship`:

1. Move a spec between `planning/active/` and `archive/{completed,superseded}/`
2. Edit `FEATURE-TRACKER.md` to flip a status (confirmation required)

Nothing else under `.cowork/` is writable — Cowork owns that workspace. Full policy in [CLAUDE.md](../../CLAUDE.md).

## Karpathy coding principles

All commands defer to four behavioral guidelines, codified in [CLAUDE.md](../../CLAUDE.md#karpathy-coding-principles):

1. **Think before coding** — state assumptions, surface tradeoffs, ask if unclear
2. **Simplicity first** — minimum code that solves the problem, no speculative flexibility
3. **Surgical changes** — touch only what the task requires
4. **Goal-driven execution** — define success criteria, loop until verified

`/spec` enforces (4) by structuring plans as `step → verify:`. `/ship` enforces (3) by refusing to edit anything outside the tracker flip.

## Troubleshooting

**`/spec foo.md` says "spec not found"** — the file may be in a subdir. Try bare filename (subdirs are transparent) or partial name fallback (`/spec foo`).

**`/ship` says "no tracker entry found for `[slug]`"** — add one to `FEATURE-TRACKER.md` before running `/ship`, or skip the tracker step and handle manually. The `/ship` won't invent entries.

**post-commit didn't stamp the spec** — either (a) no `Spec:` trailer, (b) `.cowork` symlink missing, or (c) spec name typo in the trailer. Check the commit message; hook output prints reason when it skips.

**`/learn` asks "which feature?" every time** — your branch is probably `main` or feature-unrelated. Either switch to a branch that encodes the feature, or answer once and move on.

**Multiple specs match `/ship foo.md`** — rare, but `find` returns more than one. The command lists candidates with paths; pick the intended one.

**Cowork agent says "plan file not found"** — you forgot `/plan-sync` after exiting Plan Mode. Claude Code writes plans to `~/.claude/plans/`, which is outside Cowork's sandbox. Run `/plan-sync` and retry.

## Files & locations at a glance

| Path | Role |
|---|---|
| `.claude/commands/*.md` | Slash command definitions (gitignored) |
| `.cowork/` | Symlink to Cowork workspace (read-only except via `/ship`) |
| `.cowork/planning/active/` | Active spec files |
| `.cowork/archive/{completed,superseded}/` | Archived specs |
| `.cowork/FEATURE-TRACKER.md` | Portfolio-level status (slug-anchored entries) |
| `~/.claude/plans/` | Claude Code's plan output dir (outside Cowork's sandbox) |
| `~/Documents/Claude/Projects/Webkit/planning/plans/` | Cowork-visible plan dir (`/plan-sync` destination) |
| `.claude/notes/{feature}/` | Project-local learnings + gotchas |
| `~/Workspaces/shared-context/` | Cross-project standards, stack rules, gotchas |
| `scripts/git-hooks/post-commit` | SHA-stamping hook (repo-tracked) |
| `scripts/install-git-hooks.sh` | Per-clone installer |

## Adding a new command

All commands are markdown files with this shape:

```markdown
# Short Title

One-paragraph purpose.

## Instructions
1. Step-by-step, including tool names and exact behavior
2. ...

## Arguments
$ARGUMENTS — what the user passes

## Rules
- Hard constraints (never do X, always do Y)
```

Drop into `.claude/commands/<name>.md`, reload Claude Code (auto-discovered), invoke as `/<name>`.

Keep commands narrow. If a command starts needing branching logic, it's two commands in one.
