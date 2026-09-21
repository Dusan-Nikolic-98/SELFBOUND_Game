# CONTEXT MANIFEST

## Purpose

This file records what context is intentionally provided to the coding agent and what is intentionally excluded.

The manifest must be updated whenever the context given to Codex changes materially.

## Context Priority

| Source | Included? | Why | Priority | Risk |
|---|---|---|---|---|
| `docs/GAME_SPEC.md` | Yes | Authoritative gameplay and scope definition | High | Low if kept immutable during Core implementation |
| `docs/BUILD_PROMPT_V1.md` | Yes | First implementation request and engineering constraints | High | Can become stale if the game spec changes |
| `package.json` | Yes | Existing tooling and scripts | High | May not exist in a blank repository |
| Existing repository source files | Yes | Actual implementation context | High | Starter may contain assumptions that are not obvious |
| Existing `README.md` | Yes, if present | Setup and project commands | Medium | May be stale |
| Existing test configuration | Yes, if present | Preserves established test workflow | Medium | May be incomplete in a new project |
| Old chat transcripts | No | Not authoritative project specification | Excluded | Conflicting or outdated requirements |
| Random web examples | No | Unnecessary context and potential noise | Excluded | Could introduce scope or incompatible architecture |
| Private credentials / environment secrets | No | Not needed for Week 3 | Excluded | Security risk |
| Unrelated files | No | No relevance to Core gameplay | Excluded | Context noise |

## Authority Rules

When two included sources disagree:

1. `GAME_SPEC.md` has highest authority for gameplay and scope.
2. The actual repository/tooling has authority for commands, existing structure, and starter conventions.
3. The current task prompt may narrow or sequence work, but must not silently expand the game scope.

## Deliberately Excluded Information

The following are intentionally not part of the first major coding context:

- plans for Week 4 AI tool calling;
- live provider configuration;
- API keys or credentials;
- unrelated personal notes;
- discarded gameplay ideas;
- speculative stretch features.

## Update Rule

After every significant architecture or scope decision, update this file only if the set of authoritative context sources changes.
