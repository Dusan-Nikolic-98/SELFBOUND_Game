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
| `AGENTS.md` | Yes | Persistent repository-specific coding instructions | High | Must stay aligned with the current frontend/backend layout |
| Existing repository source files | Yes | Actual implementation context | High | Starter may contain assumptions that are not obvious |
| `docs/w4/CODEX_PROMPT_FRONTEND_BACKEND_SPLIT.md` | Yes | Authoritative architecture-only task for the Week 4 boundary | High | Does not authorize AI functionality |
| `frontend/` and `backend/` source | Yes | Current browser/server implementation and boundary | High | Backend includes the health route and fake-provider Coach route; no live provider |
| Existing `README.md` | Yes, if present | Setup and project commands | Medium | May be stale |
| Existing test configuration | Yes, if present | Preserves established test workflow | Medium | May be incomplete in a new project |
| `.github/copilot-instructions.md` and `.github/` instruction modules | Yes | Concise always-on entry point and routed, repository-specific agent guidance | High | Must be kept aligned with shipped source and commands |
| `.specify/memory/constitution.md` and `specs/` feature artifacts | Yes, when relevant | Durable project principles and active feature contracts/plans/tasks, including `specs/001-ai-coach/` | High for the feature they govern | The AI Coach spec has a shipped fake-provider slice; Gemini integration remains planned |
| Old chat transcripts | No | Not authoritative project specification | Excluded | Conflicting or outdated requirements |
| Random web examples | No | Unnecessary context and potential noise | Excluded | Could introduce scope or incompatible architecture |
| Private credentials / environment secrets | No | Not needed for Week 3 | Excluded | Security risk |
| Unrelated files | No | No relevance to Core gameplay | Excluded | Context noise |

## Authority Rules

When two included sources disagree:

1. `docs/GAME_SPEC.md` has highest authority for Week 3 gameplay behavior and remains a historical record of the Week 3 no-backend architecture.
2. The actual repository/tooling has authority for current commands, structure, and architecture.
3. The current task prompt may narrow or sequence work in an approved feature; the active AI Coach spec authorizes only its bounded, read-only feature behavior and does not authorize live Gemini integration.

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

The `.github/` instruction index routes agents to the smallest relevant guidance modules. The constitution records durable principles; active `specs/<feature>/` files define feature-specific requirements. These documents do not replace `GAME_SPEC.md` as the detailed gameplay source of truth or repository code/scripts as the authority for shipped architecture and commands.
