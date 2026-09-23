#!/usr/bin/env bash
# Verification gate (CLAUDE.md §3) — docs-only stage.
# Replace with real lint / typecheck / test / build when application code lands
# (see docs/decisions/0001-repo-bootstrap.md).
# Written for bash 3.2 (macOS default): no mapfile, no empty-array expansion under set -u.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

# Collects tracked plus untracked-but-not-ignored files into FILES, so ignored trees
# (node_modules/, .next/) are never scanned. Arguments are git pathspecs.
collect_files() {
  FILES=()
  local f
  while IFS= read -r -d '' f; do
    if [[ -f "$f" ]]; then FILES+=("$f"); fi
  done < <(git ls-files -z --cached --others --exclude-standard -- "$@")
}

required=(README.md LICENSE CHANGELOG.md SECURITY.md CODE_OF_CONDUCT.md CLAUDE.md .editorconfig .gitignore)
for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING required file: $f"
    fail=1
  fi
done

# Unfilled template placeholders (bootstrap protocol): a closed double-brace token such as
# the starter kit's own, in non-code text files. Excluded: docs/legal/, this script, code
# (JSX object literals look like tokens), the lockfile, and GitHub Actions expressions
# (always "$" + double brace). Bare double braces in prose, such as the verbatim brief quoting
# this very check, are not placeholders. -I skips binary files.
placeholder='(^|[^$])\{\{[[:space:]]*[A-Za-z_][A-Za-z0-9_.-]*[[:space:]]*\}\}'
collect_files . ':!docs/legal/**' ':!scripts/gate.sh' ':!src/**' ':!tests/**' \
  ':!*.ts' ':!*.tsx' ':!*.mts' ':!*.cts' ':!*.js' ':!*.mjs' ':!*.cjs' ':!package-lock.json'
if (( ${#FILES[@]} )) && grep -nIE -- "$placeholder" "${FILES[@]}"; then
  echo "Unfilled template placeholders found (see lines above)"
  fail=1
fi

# CLAUDE.md stays under 200 lines (§2)
lines=$(wc -l < CLAUDE.md)
if (( lines >= 200 )); then
  echo "CLAUDE.md is $lines lines (limit: under 200)"
  fail=1
fi

# No committed env files (§5); .env.example is the documented exception
if git ls-files | grep -E '(^|/)\.env(\..*)?$' | grep -v '\.env\.example$'; then
  echo "Committed env file detected (see lines above)"
  fail=1
fi

# No private-key material in the repo's own files (§5).
# Pattern is split across quotes so this script never matches itself.
collect_files .
if (( ${#FILES[@]} )) && grep -lI -- '-----BEGIN .*PRIVATE KEY''-----' "${FILES[@]}"; then
  echo "Private key material detected (see files above)"
  fail=1
fi

if (( fail )); then
  echo "GATE: FAIL"
  exit 1
fi
echo "GATE: PASS (docs-only stage: required files · placeholders · CLAUDE.md size · secrets)"
