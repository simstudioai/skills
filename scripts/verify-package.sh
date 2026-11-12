#!/usr/bin/env bash
# Verifies a packed sim-skills tarball ships the CLI, both plugin manifests,
# and the skills. Usage: scripts/verify-package.sh <package.tgz>
set -euo pipefail

PACKAGE_PATH="${1:?usage: verify-package.sh <package.tgz>}"
PACKAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$PACKAGE_DIR"' EXIT

tar -xzf "$PACKAGE_PATH" -C "$PACKAGE_DIR"
test -x "$PACKAGE_DIR/package/dist/index.js"
test -f "$PACKAGE_DIR/package/.codex-plugin/plugin.json"
test -f "$PACKAGE_DIR/package/.claude-plugin/plugin.json"
test -f "$PACKAGE_DIR/package/skills/build-workflow/SKILL.md"
test -f "$PACKAGE_DIR/package/skills/sync-workspaces/SKILL.md"
echo "Package contents verified."
