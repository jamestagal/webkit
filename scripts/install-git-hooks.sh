#!/usr/bin/env bash
# Installs repo-local git hooks by symlinking scripts/git-hooks/* into .git/hooks/.
# Run once per clone. Safe to re-run — replaces existing symlinks.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

HOOKS_SRC="scripts/git-hooks"
HOOKS_DST=".git/hooks"

for hook in "$HOOKS_SRC"/*; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  chmod +x "$hook"
  ln -sf "../../$hook" "$HOOKS_DST/$name"
  echo "Linked $HOOKS_DST/$name → $hook"
done

echo "Done. Hooks installed."
