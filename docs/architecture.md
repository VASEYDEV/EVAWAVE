# Architecture

> **Status: concept.** EVAWAVE has no application code yet. This document records only
> what the repository description states, so the foundation package has a baseline to
> replace. Update it in the same PR as any change that alters it (CLAUDE.md §3).

## Big picture

EvaWavE is described as two capabilities:

| Capability | Stated purpose |
| --- | --- |
| Song-creation tag generator | AI-assisted generation of the tags that steer AI song creation |
| Prompt-alignment integration | Aligning prompts to what individual AI music applications expect |

Nothing beyond that description has been decided. Components, data flow, interfaces,
and the stack all come with the foundation package and directive brief
([`runbooks/package-intake.md`](runbooks/package-intake.md)).

## Open questions

- Which AI music applications are targets, and how their tag and prompt dialects differ.
- Where the tag vocabulary comes from and who owns it.
- Whether alignment is validation, rewriting, scoring, or translation between apps.
- Whether EvaWavE calls models itself or stays a deterministic formatter over its inputs.
- Integration surface: library, API, browser extension, PWA, or MCP server.
- Stack selection, which decides the package manager, the real gate commands, and the deploy target.
