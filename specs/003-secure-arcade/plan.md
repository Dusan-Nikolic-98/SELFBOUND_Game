# W08 Secure Arcade — Implementation Plan

## Plan status

This is the SpecKit/SDD plan for a later implementation. In the current phase only W08 planning documents are changed. Source code, tests, `package.json`, and configuration are untouched; no live Gemini/provider calls are used. Any check not explicitly executed remains `NOT RUN`.

## 1. Checkpoint

**Goal:** preserve a reproducible starting point and a normal fake W05 result before hardening.

**Existing:** W05 has a fake provider, normal first/later flows, a bounded orchestrator, an exact two-tool registry, and offline tests. `docs/EVIDENCE_W08.md` does not exist.

**Plan:** record branch/commit, Node version, `npm run typecheck`, `npm test`, `npm run build`, frontend build plus reachability, and a normal W05 fake HTTP round-trip. Store only a synthetic request/expected shape, never keys or raw model output.

**Files:** future `docs/EVIDENCE_W08.md`; it is not created in this planning phase.

**Gate:** do not claim a before/after result without a confirmed checkpoint. If a read-only Git check is blocked, record `NOT RUN` and the reason.

## 2. Threat model and specification

**Goal:** lock W08 scope, trust boundaries, data inventory, risks, I1–I8, limits, CSRF decision, and T00–T17 before code changes.

**Existing:** authoritative `docs/GAME_SPEC.md`, W04/W05 specs and review documents; local-only/no accounts/persistence; W05 model context is bounded workflow metadata plus tool results.

**Plan:** use `spec.md` as the W08 behavioral/security contract. Do not expand scope to login, database, new tools, or public deployment.

**Files:** `specs/003-secure-arcade/spec.md`; later `docs/EVIDENCE_W08.md` only for actual results.

**Gate:** review the matrix and three priorities; every planned control has an enforcement location and an executable test.

## 3. HTTP/body hardening

**Goal:** limit requests before provider/tool work and reduce unnecessary reads of oversized or slow bodies.

**Existing:** `server.ts` has W04 32 KiB and W05 48 KiB caps, strict W05 UTF-8 parsing, 400/413 envelopes, and zero provider calls on invalid input; `readJsonBody` still drains the stream after the limit.

**Plan:** retain W04/W05 contract caps; add carefully tested early termination/read-time behavior for oversized bodies without accepting or parsing the remainder. Preserve valid W04 public semantics.

**Files:** future `backend/src/server.ts`, `tests/training-plan-backend.test.ts`, `tests/ai-coach-backend.test.ts`; add a helper only if it creates a testable boundary.

**Gate:** T01/T02/T17: invalid/oversized input does not start provider/tool work, byte counting is UTF-8, valid boundary values pass, and a slow oversized stream is not left unbounded. Test cleanup and uncaught-error behavior.

## 4. Concurrency/rate limit

**Goal:** add a server-side global resource budget covering both sibling AI routes.

**Existing:** there is no global concurrency or rate limiter; frontend pending flags are not a server control; W05 individual budgets exist.

**Plan:** one in-memory limiter per `createServer` instance/process: at most 2 active accepted W04/W05 operations and 5 accepted starts in a rolling 60 seconds. Invalid requests consume no permit. Excess receives stable `429` (`server_busy` or `rate_limited`) with no provider call. Release permits in `finally` on success, failure, timeout, and cancellation. Provide a clock/test seam; avoid global singleton state leaking between tests.

**Files:** future `backend/src/server.ts` or small `backend/src/request-limits.ts`; both backend route suites and W05 adversarial tests.

**Gate:** T11/T13 verify active maximum, rolling window, mixed W04/W05 accounting, cancellation/release, and legitimate recovery. Do not test only a disabled button.

## 5. Security headers/CSP

**Goal:** protect the locally served production frontend and verify actual response headers.

**Existing:** `scripts/serve.mjs` currently sets cache/content-type headers but no CSP, `X-Content-Type-Options`, or `Referrer-Policy`. Backend `sendJson` also lacks a shared security-header profile.

**Plan:** the static server adds an enforcing CSP matching the real module/style/API sources, plus `nosniff` and `Referrer-Policy: no-referrer`. Add suitable backend response headers without changing the CORS allowlist semantics. Do not use `unsafe-inline`/`unsafe-eval` without evidence of need.

**Files:** future `scripts/serve.mjs`, `backend/src/server.ts`, and a browser test/harness compatible with existing tooling; do not add a framework.

**Gate:** T16 reads headers from the real server, loads the build, confirms game/UI/API behavior, and observes a concrete CSP block. A 404 or unexecuted test is not evidence.

## 6. Browser tests

**Goal:** prove that untrusted final and error content cannot become executable DOM.

**Existing:** `main.ts` uses `textContent` for W04/W05 fields; no `innerHTML`, Markdown, or rich-text path exists; there is no real browser security test.

**Plan:** use the smallest browser runner the repository can support, or a local test harness, without expanding production scope. Test the XSS marker, normal Unicode/apostrophe/`a < b`, link/HTML strings, and CSP. If a test dependency is added, audit the lockfile and document why; do not render rich text.

**Files:** future browser test/harness; modify `frontend/src/main.ts` only if an actual unsafe sink is found.

**Gate:** T04/T05/T16 include DOM/header evidence. If a browser runner is unavailable, status is `NOT RUN`, not PASS.

## 7. Adversarial fake-provider tests

**Goal:** extend the existing fake/scripted W05 provider matrix with W08 boundaries.

**Existing:** the fake provider already supports unknown tools, invalid arguments, malformed proposals, invalid results, repeated action, timeout/delay, step/tool/attempt exhaustion, and invalid final output; W05 tests confirm the bounded orchestrator.

**Plan:** add forbidden `constructor`/`toString`/URL/filesystem proposals, extra-key/oversized tool results with a sentinel, log-injection text, a prompt-injection provider-output scenario, and mixed-route limiter cases. Handler counters, state snapshots, and captured model input must be explicit.

**Files:** future `backend/src/fake-training-plan-provider.ts` only if new deterministic scenarios are needed; `tests/training-plan.test.ts`, `tests/training-plan-backend.test.ts`, `tests/ai-coach-backend.test.ts`.

**Gate:** T06–T12 and T14/T17; forbidden-operation count is zero, invalid results do not reach the next model context, and safe envelopes contain no raw detail.

## 8. Dependency/secret checks

**Goal:** check dependency risk and the secret boundary without real keys or private data.

**Existing:** `@google/genai` is the only runtime dependency; W04/W05 keys are backend-only; `.env` is not committed; W05 fake mode does not read the W05 key; existing evidence documents W04/W05 secret boundaries.

**Plan:** run `npm audit` checks, review the lockfile, and use a synthetic sentinel through error/tool/logger/model captures. Do not use a live provider. Do not log the sentinel value in evidence.

**Files:** future W04/W05 backend tests, optional small existing-style scripts, and `docs/EVIDENCE_W08.md` for results.

**Gate:** T14/T16 plus dependency-audit status. If the registry is unavailable, record `NOT RUN` and the open risk.

## 9. Final verification

**Goal:** prove hardening did not break gameplay, W04, or normal W05 behavior.

**Plan:** run `npm run typecheck`, `npm test`, `npm run build`, `node scripts/check-reachability.mjs` after frontend build, `git diff --check`, T00–T17, and browser smoke. No live Gemini test is part of this scope; an opt-in live check, if ever performed, is separate from offline PASS evidence.

**Gate:** every required automated check is PASS or honestly `NOT RUN`/FAIL with a reason; W04 public behavior and the W05 two-step/tool path remain available.

## 10. Evidence documentation

**Goal:** create a reproducible W08 record from actual work, without invented output.

**Plan:** `docs/EVIDENCE_W08.md` must contain checkpoint, actual architecture/data inventory, six or more risks, I1–I8 mapping, limits, T00–T17 status, CSRF decision, dependency audit, sentinel results, at least three before/after scenarios, limitations, and contributions. Change `docs/AI_USAGE_LOG.md`/`docs/EVIDENCE_003.md` only if later implementation requires it and according to `AGENTS.md`; they are not part of this documentation-only phase.

**Gate:** every claim has a command/test and actual output; `NOT RUN` remains explicit. Fake evidence must not be presented as live-model evidence.

## Compatibility and migration

- W04 route, contract, fake/Gemini provider boundary, and public success/failure semantics remain separate from W05.
- W05 exact two-tool allowlist, model-step limits, tool/result/final validators, and read-only semantics remain unchanged unless a test identifies a concrete W08 defect.
- The global limiter is process-local and resets on restart; it introduces no persistent state.
- The frontend gains no authentication, persistence, or cookie dependency.
- The security-header/CSP profile must be tested with the real build, not only a string snapshot.

## Risks and decisions to revisit

1. Early body abort can change Node request lifecycle; test `aborted`/`close` and cleanup before accepting it.
2. A concurrency permit must remain held until controlled async work is actually finished; `Promise.race` alone is not cancellation.
3. An in-memory rolling window does not solve multi-process/public deployment; that is intentionally out of scope.
4. Browser test infrastructure is unconfirmed; do not add a large framework for one test without review.
5. Existing W04 Gemini reliability policy is separate; W08 shares outer resource/header/secret controls without refactoring the W04 adapter into W05.
6. CSP `connect-src` must cover real `localhost`/`127.0.0.1` development variants, but not arbitrary internet origins.
