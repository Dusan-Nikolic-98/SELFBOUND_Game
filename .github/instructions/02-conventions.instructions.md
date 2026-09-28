# Conventions instructions

## TypeScript and language

- Use TypeScript in strict mode. Frontend targets ES2020 with browser DOM types and Bundler module resolution; backend and tests target ES2020 with Node16 module settings. Preserve the respective config instead of weakening strictness.
- Source imports use explicit `.js` specifiers in TypeScript modules, matching the emitted JavaScript and current compiler setup.
- Use plain TypeScript objects and arrays for game state. There is no framework or game engine.
- Narrow unknown runtime input with explicit validators/type guards. A declared TypeScript type does not validate JSON or other runtime values.
- Match nearby naming and formatting. Existing source uses camelCase values/functions, PascalCase types/classes, and descriptive lowercase filenames.

## Naming and placement

- Browser/gameplay code belongs under `frontend/src/`; HTML and CSS belong under `frontend/`.
- Backend HTTP code belongs under `backend/src/`. Do not import across the frontend/backend boundary.
- Hand-authored level data belongs in `frontend/src/level.ts`; structural shapes belong in `frontend/src/types.ts`; runtime checks belong in `frontend/src/validation.ts`.
- Tests are TypeScript files under `tests/`, named by concern (currently `logic.test.ts` and `gameplay.test.ts`). Use `node:test` and `node:assert/strict` as the existing suite does.
- Keep command/launcher utilities under `scripts/`; project and decision evidence belongs under `docs/`.

## Validation

- Preserve runtime validation of both `GameConfig` and `LevelData`; validation is already implemented in `frontend/src/validation.ts`.
- Validate any future browser request at the backend boundary before business logic or provider invocation. Validate external/provider responses before treating them as successful data.
- Invalid input must fail safely; do not cast untrusted values directly into trusted game/API types.
- No schema-validation package is currently used. Do not add one without a concrete, accepted requirement.

## Dependencies and comments

- Reuse Node built-ins and existing dependencies where practical. The backend currently uses `node:http`; tests use Node's built-in test APIs.
- Do not upgrade or add packages opportunistically. Explain and document the need for a new package in the owning plan.
- Add comments for invariants, non-obvious collision/math behavior, and security boundaries. Avoid comments that merely restate the code.
