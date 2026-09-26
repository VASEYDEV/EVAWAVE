#!/usr/bin/env bash
# Verification gate (CLAUDE.md §3): repo standards, then lint · typecheck · unit · build ·
# e2e (Playwright on the production build), then the client-bundle secret check (§5) and
# npm audit (§6, criticals block).
# CI runs this same script after `npm ci`, so local and CI verification never diverge.
# Integration tests (tests/integration/, the RLS tests on PGlite) run in the unit step.
# Written for bash 3.2 (macOS default): no mapfile, no empty-array expansion under set -u.
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_TELEMETRY_DISABLED=1

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

printf '== standards\n'

required=(README.md LICENSE CHANGELOG.md SECURITY.md CODE_OF_CONDUCT.md CLAUDE.md AGENTS.md SKILLS.md
  .editorconfig .gitignore .env.example package.json package-lock.json)
for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING required file: $f"
    fail=1
  fi
done

# Unfilled template placeholders (bootstrap protocol): a closed double-brace token such as
# the starter kit's own, in non-code text files. Excluded: docs/legal/, docs/archive/
# (superseded and legacy reference, ADR 0004), this script, code
# (JSX object literals look like tokens), the lockfile, and GitHub Actions expressions
# (always "$" + double brace). Bare double braces in prose, such as the verbatim brief quoting
# this very check, are not placeholders. -I skips binary files.
placeholder='(^|[^$])\{\{[[:space:]]*[A-Za-z_][A-Za-z0-9_.-]*[[:space:]]*\}\}'
collect_files . ':!docs/legal/**' ':!docs/archive/**' ':!scripts/gate.sh' ':!src/**' ':!tests/**' \
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
  echo "GATE: FAIL (standards)"
  exit 1
fi

step() {
  printf '\n== %s\n' "$1"
  shift
  "$@"
}

step "lint" npm run -s lint
step "typecheck" npm run -s typecheck
step "unit" npm test --silent
step "build" npm run -s build
step "e2e" npx playwright test
step "client bundle" bash scripts/check-client-bundle.sh
step "audit (criticals block)" npm audit --audit-level=critical

echo
echo "GATE: PASS (standards · lint · typecheck · unit · build · e2e · client bundle · audit)"
