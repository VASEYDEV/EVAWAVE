# Runbook — package + directive brief intake

How a session installs an owner-supplied **package** (an archive or folder of specs,
prompts, templates, assets, and possibly code) together with a **directive brief**,
without losing the repo standard or silently accepting conflicting rules.

## Inputs

| Input | How it arrives | System of record |
| --- | --- | --- |
| Package | Uploaded to `main` (GitHub → Add file → Upload files; the web UI caps each file at 25 MB) **or** attached in the session | Installed tree; the archive itself is removed after extraction and stays in git history |
| Directive brief | Pasted into the session's first message **or** committed to `docs/briefs/` | `docs/briefs/YYYY-MM-DD-topic.md`, verbatim (see [`docs/briefs/README.md`](../briefs/README.md)) |

Precedence, as set in `CLAUDE.md` Project Notes: **brief > package > CLAUDE.md
defaults**. The package cannot override §1 operating rules, §5 security, or §10 brand
separation. Only an explicit owner instruction can change those, and it has to be recorded in an ADR.

## Procedure

1. **Locate and inventory.** Find the archive, list its contents, and report the file
   count. If it ships a manifest with checksums, verify every file and stop on any
   mismatch. If it has a read-me-first or install-order file, that file governs the
   install mechanics.
2. **Record the brief.** Commit the brief verbatim to `docs/briefs/`. Pull out its
   objective, scope, non-goals, acceptance criteria, and authority. If a decision the work
   depends on is missing (stack, brand, license, deploy target, target music apps), ask
   one question (§1.5) or go ahead with a flagged assumption.
3. **Conflict scan, before installing anything.** Compare the package against the tree and
   list every conflict with a proposed resolution:
   - path collisions, including **case-only** ones (`docs/architecture.md` vs
     `docs/ARCHITECTURE.md` collide on macOS and Windows);
   - competing agent contracts (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `prompts/`
     that restate policy);
   - license text or headers that differ from Apache-2.0;
   - brand claims, marks, palettes (check VASEY/AI vs VASEY.AUDIO per §10);
   - `.gitignore` fragments, CI workflows, editor configs.
4. **Install.** Follow the package's own install instructions if it has them. Otherwise
   place files per the §7 layout. Fold append-style fragments (such as `.gitignore.append`)
   into their targets and delete the fragment. Remove the archive from the tree.
5. **Reconcile the contract.** The default is that `CLAUDE.md` (Standard v3.0) stays canonical.
   Package product invariants either go into Project Notes, if they are short, or stay in
   a product doc (for example `docs/PRODUCT.md`) that Project Notes points to. Making the package's
   `AGENTS.md` canonical and reducing `CLAUDE.md` to a shim (the TRAKTION outcome)
   happens only when the brief directs it. Either way, record the outcome in the next ADR.
6. **Gate and records, in the same PR.** Run `bash scripts/gate.sh`. If the package
   introduces a stack, replace the gate with the real §3 gate in this PR (see
   [`verification.md`](verification.md)). Update `CHANGELOG.md`, `docs/architecture.md`,
   `README.md` (current claims only, §8) and `CLAUDE.md` Project Notes (stack, package
   manager, commands, deploy), and add a dated note in `docs/notes/`.
7. **Ship intake separately from implementation.** Put the install and reconcile work in its own PR
   (what / why / verified). Implementation work from the brief follows in later PRs, one
   task per PR, unless the brief authorizes a different cadence.

## Carried over from TRAKTION's intake (2026-08-20)

- The package can redefine the product. Treat its product statement as the new baseline
  and rewrite README and architecture docs to match. Don't leave the concept-stage text
  standing beside it.
- TRAKTION verified all 49 kit files against the kit's `MANIFEST.json` sha256 checksums.
  That check is the only evidence the install is byte-faithful, so always run it when a
  manifest exists.
- Do not scaffold a stack in an environment that cannot run its build and tests. Record
  it as a blocker instead, because the standard requires running the gate before claiming
  anything is done.
