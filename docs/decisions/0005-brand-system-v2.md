# ADR 0005: Adopt the Vasey Multimedia Brand System v2.0 as the design source of truth

- **Status:** accepted
- **Date:** 2026-09-26
- **Supersedes:** the module hue table in SPEC §1.9 (S5); closes the lockup item in SPEC §1.11.
- **Relates to:** ADR 0002 (EVAWAVE is a VASEY/AI tool), CLAUDE.md §10 (brand and icons).

## Context

The owner supplied the *Vasey Multimedia Brand System & Capability Guide v2.0* (21 pages,
kept as ground truth at `docs/design/reference/`). Its §03–§07 are binding for anything
produced for the studio: a CORE palette of five chromatic values and two bookends, one
signature swatch per entity, three closed typefaces with full scales, a 4 px space scale,
the 25° beam as the only diagonal, named motion, and a contrast matrix computed with the
WCAG 2.x formula. EVAWAVE is a VASEY/AI product; V/AI's signature is BEAM `#22E8F5`, accent
and glow only, at most once per composition.

Three things in EVAWAVE's own spec could not stand beside it:

1. SPEC §1.9 gave each of the eleven composer modules its own `oklch(78% 0.14 H)` hue,
   thirteen chromatic values on one screen, against the guide's five-plus-two, four inks per
   composition and one signature per frame.
2. The app needs semantic states (lint block/warn/info, danger, success) and the guide
   defines none, listing them as its own open item ("Error cannot simply borrow Tomato").
3. The product lockup was open (`EVAWAVE` vs `EVA/WAVE`), and the house slash now carries
   meaning (`VASEY/AI`, `VASEY/DEV`).

## Decision

1. **The guide is the design source of truth.** `docs/design/brand-application.md` records
   how it is applied here; `src/app/styles/tokens.css` carries the values as hex literals;
   `tests/unit/brand-tokens.test.ts` reproduces the guide's contrast matrix and holds every
   pairing the interface uses to its threshold. A new colour requires a retirement, as the
   guide says.
2. **CORE only; the module hue table is retired.** Modules differentiate by their monoline
   icon (in Turquoise), number and typography. The open module's glow is Turquoise, the
   primary, so several open modules never repeat the signature. `assets/icons/modules.json`
   and its build script are unchanged; the final icon geometry still belongs to the Vector
   Iconography project.
3. **Semantics by typography, not colour.** Severity and danger read from label text,
   weight, position and a Teal or Turquoise rule, never from a colour alone (WCAG 1.4.1). No
   semantic colours are added; if the guide later defines them, they replace this.
4. **Lockup: `EVAWAVE`**, set in Bebas Neue as the product wordmark, with a `VASEY/AI` kicker
   whose slash is BEAM. That slash is the page's single signature use, and
   `tests/e2e/brand.spec.ts` counts it.
5. **Typefaces are self-hosted** (Bebas Neue, Reddit Sans, JetBrains Mono; SIL OFL) through
   `next/font/local`, so the build needs no network and no third party sees a request.
6. **Surfaces:** Deep Turquoise is the page field and Charcoal the elevated surface; Silver
   is body text; the one permitted surface tint, Silver 50 % into Charcoal (`#798389`),
   bounds controls at ≥ 3:1 on both surfaces.

## Consequences

- SPEC §1.9 is rewritten; §1.11's lockup item closes and gains "the PWA icon suite needs
  the V/AI vector mark".
- The favicon, app-icon suite and manifest wait for a vector mark: marks are traced masters,
  never invented. The README logo stays deferred for the same reason.
- The app is dark-only. The guide checks both modes where both exist; a light theme, if one
  is added, uses Teal as the action colour per the guide.
- Deviations, stated: form labels are set at 14 px/700 rather than the guide's 11 px Label
  style, for touch readability; the guide's BEAM value is itself listed as needing
  confirmation (`#22E8F5` measured vs legacy `#4BC2F0`), a one-line token change if it moves.
- CLAUDE.md Project Notes gain one invariant naming this ADR; §1–§10 are untouched.
