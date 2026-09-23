#!/usr/bin/env bash
# Client-bundle secret check (CLAUDE.md §5). Run after `npm run build`.
# Fails if any server-only variable name from .env.example (every name without the
# NEXT_PUBLIC_ prefix) appears in the browser bundle. A name there means client code
# reads a server secret. .env.example is the source of truth, so new variables are
# covered as soon as they are documented.
set -euo pipefail
cd "$(dirname "$0")/.."

bundle=.next/static
if [[ ! -d "$bundle" ]]; then
  echo "No client bundle at $bundle: run 'npm run build' first"
  exit 1
fi

names=()
while IFS= read -r name; do
  names+=("$name")
done < <(sed -nE 's/^([A-Z][A-Z0-9_]*)=.*/\1/p' .env.example | grep -v '^NEXT_PUBLIC_' || true)

if (( ${#names[@]} == 0 )); then
  echo "No server-only variable names found in .env.example"
  exit 1
fi

hit=0
for name in "${names[@]}"; do
  if grep -rlwF -- "$name" "$bundle"; then
    echo "Server-only variable name in the client bundle: $name (files above)"
    hit=1
  fi
done

if (( hit )); then
  exit 1
fi
echo "Client bundle clean: ${#names[@]} server-only names checked (${names[*]})"
