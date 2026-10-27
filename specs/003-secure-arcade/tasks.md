# W08 Secure Arcade — Verifiable Tasks

All tasks are planned and **none are marked complete**. This file describes future implementation; in the current phase none of the listed source, test, or configuration files are changed.

## Phase 1 — checkpoint

### W08-T001 — Save the initial checkpoint

- **Goal:** confirm the exact branch/commit, Node environment, and pre-hardening state.
- **Files:** future `docs/EVIDENCE_W08.md`; read-only repository metadata.
- **Dependencies:** none.
- **Test:** `git status --short`, `git log -1`, `node --version`, `npm run typecheck`, `npm test`, `npm run build`, `node scripts/check-reachability.mjs` after frontend build; normal fake W05 round-trip.
- **Acceptance criterion:** actual output/status is recorded, or clearly marked `NOT RUN`; no initial version/result is invented.
- **Risk if not done:** before/after comparison and reproducibility are unreliable.

### W08-T002 — Confirm the W05/W04 fake-first baseline

- **Goal:** prove W05 has two model steps and one real tool execution, while W04 remains available.
- **Files:** future `docs/EVIDENCE_W08.md`; existing tests are read-only in this pass.
- **Dependencies:** T001.
- **Test:** existing successful cases in `tests/training-plan.test.ts`, `tests/training-plan-backend.test.ts`, and the W04 backend route case.
- **Acceptance criterion:** record `goal_completed`, W05 counters `2/1/2` for the first plan, and a valid W04 response; do not use a live provider.
- **Risk if not done:** hardening may prove only that all requests are rejected.

## Phase 2 — threat model/specification

### W08-T003 — Lock the threat model and data inventory

- **Goal:** connect every real data item and risk to a boundary, control, and test.
- **Files:** `specs/003-secure-arcade/spec.md`.
- **Dependencies:** T001–T002; review `docs/GAME_SPEC.md`, W04/W05 artifacts, and actual code.
- **Test:** review checklist for data inventory, trust boundaries, R1–R9, and three priorities.
- **Acceptance criterion:** no risk is only “possible XSS”; each has a precondition, resource, existing control, and evidence.
- **Risk if not done:** implementation may protect the wrong layer or expand scope.

### W08-T004 — Lock I1–I8, CSRF, and limits

- **Goal:** define invariants, the local-only model, CSRF decision, and concrete numbers before code.
- **Files:** `specs/003-secure-arcade/spec.md`.
- **Dependencies:** T003.
- **Test:** requirements review against the W08 assignment and existing W05 limits.
- **Acceptance criterion:** spec contains I1–I8, W04/W05 body/output/step/tool/attempt/timeout/deadline limits, global `2` concurrency, and `5/60s` rate limit.
- **Risk if not done:** later tests may implement an unclear or incompatible policy.

## Phase 3 — HTTP/body hardening

### W08-T005 — Preserve route-specific body contracts

- **Goal:** retain W05 `48 KiB` and W04 `32 KiB` UTF-8 caps with stable 400/413 envelopes.
- **Files:** `backend/src/server.ts`, `tests/training-plan-backend.test.ts`, `tests/ai-coach-backend.test.ts`.
- **Dependencies:** T004.
- **Test:** T01/T02; valid maximum boundary, malformed JSON, wrong content type, unknown keys, oversized W04/W05 body.
- **Acceptance criterion:** valid boundaries pass; invalid/oversized requests stop before provider work; provider/tool count is 0.
- **Risk if not done:** the parser may accept unnecessary input or break W04 behavior.

### W08-T006 — Stop oversized/slow body reads

- **Goal:** prevent the server from continuing to read a stream without bound after the body cap.
- **Files:** `backend/src/server.ts` or a small testable HTTP helper; backend route tests.
- **Dependencies:** T005.
- **Test:** T02/T17 with delayed chunks, early connection termination/abort, and cleanup assertions.
- **Acceptance criterion:** after the cap, body is not parsed/stored, provider/tool is not called, request lifecycle ends in a controlled way, and no uncaught error occurs.
- **Risk if not done:** oversized and slow senders still consume connection/CPU despite 413.

### W08-T007 — Reject client privilege/configuration fields

- **Goal:** prove `role`, `ownerId`, `provider`, `model`, `maxSteps`, `maxToolCalls`, and similar fields cannot change server policy.
- **Files:** `backend/src/server.ts`, existing W05 validators only if a defect is found, backend tests.
- **Dependencies:** T005.
- **Test:** T02/T15 direct HTTP fixtures with extra fields and attempted limit increases.
- **Acceptance criterion:** unknown fields are rejected or safely ignored only where explicitly defined; provider uses server configuration.
- **Risk if not done:** client/model input may bypass authorization or resource policy.

## Phase 4 — concurrency/rate limit

### W08-T008 — Implement a process-local global permit limiter

- **Goal:** cap W04+W05 at two active accepted AI executions.
- **Files:** `backend/src/server.ts` or new `backend/src/request-limits.ts`; backend tests.
- **Dependencies:** T005–T007.
- **Test:** T13 with delayed fake provider, active counter, and mixed W04/W05 requests.
- **Acceptance criterion:** two valid jobs may run; a third receives stable `429 server_busy` without a provider call; permit releases exactly once in success/failure/timeout/cancel paths.
- **Risk if not done:** concurrent requests can exhaust the local process/provider.

### W08-T009 — Implement the rolling global rate limit

- **Goal:** cap accepted W04/W05 starts at 5 per 60 seconds per local process.
- **Files:** limiter helper or `server.ts`; W04/W05 backend tests.
- **Dependencies:** T008.
- **Test:** T13 with an injected clock; invalid requests before the limiter; sixth accepted start.
- **Acceptance criterion:** first five accepted starts follow policy; sixth returns `429 rate_limited` with no provider/tool work; window expiry permits the next valid request.
- **Risk if not done:** a caller can reset browser pending state and consume provider/CPU without bound.

### W08-T010 — Test cancellation and permit cleanup

- **Goal:** prevent a permanently occupied slot or premature release while work continues.
- **Files:** limiter/server tests; W05 backend disconnect tests.
- **Dependencies:** T008–T009.
- **Test:** T12/T13 disconnect, provider timeout, delayed late result, and success after release.
- **Acceptance criterion:** aborted requests do not write a response; slot releases exactly once, late output cannot succeed, and the next legitimate request passes.
- **Risk if not done:** false denial of service or concurrency bypass through hanging promises.

## Phase 5 — security headers/CSP

### W08-T011 — Add security headers to the static frontend server

- **Goal:** set enforcing CSP, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer` on frontend responses.
- **Files:** `scripts/serve.mjs`.
- **Dependencies:** T004; frontend build contract.
- **Test:** T16 raw header inspection for `/`, HTML, JS, and CSS.
- **Acceptance criterion:** headers are present on production-like static responses; CSP is enforcing and does not allow arbitrary script/eval.
- **Risk if not done:** the browser lacks defense-in-depth against script/resource injection regressions.

### W08-T012 — Align the backend response security profile

- **Goal:** add appropriate shared JSON security headers without changing CORS allowlist or response contracts.
- **Files:** `backend/src/server.ts`, backend tests.
- **Dependencies:** T011.
- **Test:** T16/T01 for success, 400, 413, 429, and 503 responses.
- **Acceptance criterion:** headers are consistent; CORS and `Vary: Origin` remain limited to existing local origins; status/body remain stable.
- **Risk if not done:** sibling routes may have inconsistent browser security assumptions.

### W08-T013 — Verify CSP against real assets/API sources

- **Goal:** ensure CSP is not a placebo and does not break the game.
- **Files:** `frontend/index.html`, `scripts/serve.mjs`, browser harness/evidence.
- **Dependencies:** T011–T012.
- **Test:** T16 actual browser load, API round-trip, and controlled blocked script/resource.
- **Acceptance criterion:** game controls, W04/W05 UI, and fake API work; browser reports a concrete CSP block for a forbidden resource; it is not a 404-based result.
- **Risk if not done:** a policy can be too broad to protect or too strict to preserve functionality.

## Phase 6 — browser tests

### W08-T014 — Add a text-only/XSS browser regression test

- **Goal:** prove I5 through the actual render path.
- **Files:** browser test/harness; `frontend/src/main.ts` only if an unsafe sink is found.
- **Dependencies:** T011–T013.
- **Test:** T04 with `<img src=x onerror=...>`, `<script>`, apostrophe, Unicode, and `a < b` fake output.
- **Acceptance criterion:** output is a text node or safely rejected; no dangerous DOM element/attribute exists; normal text remains visible.
- **Risk if not done:** backend validation alone does not guarantee browser XSS safety.

### W08-T015 — Define HTML/Markdown/link policy

- **Goal:** explicitly preserve the plain-text contract and prevent implicit rich-text scope.
- **Files:** browser tests/docs; `frontend/src/main.ts` only if an `innerHTML` or URL sink is found.
- **Dependencies:** T014.
- **Test:** T05 with `javascript:` and HTML-like strings; DOM/link inspection.
- **Acceptance criterion:** no automatic navigation, raw HTML, or event handler; plain-text policy is documented.
- **Risk if not done:** a future UI change may introduce an XSS/phishing sink without a contract change.

## Phase 7 — adversarial fake-provider tests

### W08-T016 — Extend closed-registry negative cases

- **Goal:** prove unknown/inherited tool names never become functions.
- **Files:** `tests/training-plan.test.ts`; optionally `backend/src/fake-training-plan-provider.ts`.
- **Dependencies:** T004.
- **Test:** T07/T09 with `read_files`, `open_url`, `constructor`, `toString`, and malformed proposals.
- **Acceptance criterion:** handler counters remain 0 for forbidden proposals; terminal/safe response is expected.
- **Risk if not done:** model output could gain filesystem/network capability through dynamic dispatch.

### W08-T017 — Test tool argument/scope and result boundaries

- **Goal:** confirm I3 and I7 for invalid arguments, extra result fields, oversized results, and a sentinel.
- **Files:** `tests/training-plan.test.ts`, `tests/training-plan-backend.test.ts`, `backend/src/training-plan-tools.ts` only for a defect.
- **Dependencies:** T016.
- **Test:** T08/T10 with invalid/valid `limit`, forged metrics, extra keys, synthetic secret, and custom handler counter.
- **Acceptance criterion:** exact valid result passes; invalid result is not sent to the next model; no raw result/sentinel appears in response/log/context.
- **Risk if not done:** provider output could forge evidence or introduce data outside the allowed scope.

### W08-T018 — Test the prompt-injection limitation through the fake provider

- **Goal:** prove execution control independently of model instructions.
- **Files:** `backend/src/fake-training-plan-provider.ts` if a scenario is needed; `tests/training-plan.test.ts`.
- **Dependencies:** T016–T017.
- **Test:** T09; fake provider returns a forbidden proposal and injection-like fixture text.
- **Acceptance criterion:** proposal is rejected, forbidden tool/state mutation count is 0, and evidence states that W05 has no free user text in model context and that the fake test does not prove live-model immunity.
- **Risk if not done:** prompt/system instructions could be mistaken for authorization.

### W08-T019 — Repeat the W05 step/tool/attempt/deadline matrix

- **Goal:** ensure shared hardening does not weaken inner budgets.
- **Files:** `tests/training-plan.test.ts`, `tests/training-plan-backend.test.ts`.
- **Dependencies:** T008–T010, T016–T018.
- **Test:** T11/T12 with existing fake scenarios and injected clock.
- **Acceptance criterion:** 3 steps, 2 tools, 4 provider attempts, 15 s per-call, 45 s total, and repeated-action remain enforced; late output cannot succeed.
- **Risk if not done:** outer limits could mask drift in the inner agent loop.

## Phase 8 — dependency/secret checks

### W08-T020 — Run the dependency audit

- **Goal:** check runtime and development dependency advisories without adding unnecessary packages.
- **Files:** `package.json`, `package-lock.json` read-only review; future evidence.
- **Dependencies:** T001.
- **Test:** `npm audit --omit=dev`, `npm audit --include=dev`, and lockfile review.
- **Acceptance criterion:** actual output is recorded; every advisory has exposure/mitigation/decision, or is `NOT RUN` with the reason.
- **Risk if not done:** known dependency risk remains unclassified.

### W08-T021 — Run the synthetic secret-sentinel scan

- **Goal:** confirm the sentinel cannot leave the backend secret boundary.
- **Files:** W04/W05 backend tests, build artifacts, future evidence.
- **Dependencies:** T017–T020.
- **Test:** T14/T16 with `W08_SERVER_SECRET_DO_NOT_EXPOSE_7F2A` in test-only error/tool/env fixtures; search frontend bundle/source maps, HTTP, model input, and captured logs.
- **Acceptance criterion:** marker is absent from bundle/source maps/HTTP/model/log; fake mode does not read the key; evidence does not copy the value.
- **Risk if not done:** a secret can leak even when normal schema tests pass.

### W08-T022 — Sanitize security event/log fields

- **Goal:** record only bounded allowlisted metadata and prevent log injection/raw content leakage.
- **Files:** `backend/src/server.ts`, `backend/src/training-plan-orchestrator.ts`, W04 provider/log path, relevant tests.
- **Dependencies:** T017–T021.
- **Test:** T14 with newline, raw provider error, tool name, and sentinel; captured logger assertions.
- **Acceptance criterion:** events contain only safe event/reason/status/count/timing fields; no prompt, summary, args/results, key, stack, or forged line.
- **Risk if not done:** operational logs become an exfiltration or misleading-audit channel.

## Phase 9 — final verification

### W08-T023 — Run the complete automated checks

- **Goal:** verify compile, full offline suite, build, reachability, and diff hygiene.
- **Files:** all implemented source/test files; evidence output.
- **Dependencies:** T005–T022.
- **Test:** `npm run typecheck`; `npm test`; `npm run build`; `node scripts/check-reachability.mjs`; `git diff --check`.
- **Acceptance criterion:** each command has actual exit/output; gameplay reachability and W04/W05 tests remain green; no live provider call.
- **Risk if not done:** regressions or false completion claims remain undiscovered.

### W08-T024 — Run browser/CSP smoke testing

- **Goal:** connect automated server checks to actual browser behavior.
- **Files:** production frontend build/server, browser harness, evidence.
- **Dependencies:** T011–T015, T023.
- **Test:** T04/T05/T16 with real local servers and fake backend.
- **Acceptance criterion:** game loads, controls work, W04/W05 UI works, XSS marker is text-only, headers/CSP and the controlled block are observed.
- **Risk if not done:** server header/string tests may miss actual browser behavior.

### W08-T025 — Record before/after comparisons

- **Goal:** preserve at least three identical scenarios before and after hardening.
- **Files:** future `docs/EVIDENCE_W08.md`; checkpoint diff references.
- **Dependencies:** T001, T008–T024.
- **Test:** T13 concurrency/rate, T16 CSP/headers, T04/T02 XSS/body boundary.
- **Acceptance criterion:** for every scenario record input, expected result, actual before, diff, actual after, counters/state, and a narrow claim/limitation.
- **Risk if not done:** final evidence will not show hardening impact or distinguish existing good controls from new controls.

## Phase 10 — evidence documentation

### W08-T026 — Complete `EVIDENCE_W08.md`

- **Goal:** turn actual results into a reproducible evidence record following the W08 template.
- **Files:** future `docs/EVIDENCE_W08.md` (not created in this phase).
- **Dependencies:** T001–T025.
- **Test:** evidence self-review: T00–T17 rows, CSRF, dependency audit, sentinel, before/after, and limitations.
- **Acceptance criterion:** no `NOT RUN` is presented as PASS; fake/live distinction, local-only scope, and residual risk are explicit.
- **Risk if not done:** security claims cannot be reproduced or defended in a demo.

### W08-T027 — Update usage/evidence records only for real changes

- **Goal:** keep repository evidence aligned with `AGENTS.md` without inventing agent calls or defect results.
- **Files:** later `docs/AI_USAGE_LOG.md`, `docs/EVIDENCE_003.md`, `docs/EVALS.md` only when actual implementation/defects require them.
- **Dependencies:** T026.
- **Test:** diff review and consistency check between evidence, evals, and actual command output.
- **Acceptance criterion:** no chain-of-thought, secrets, or fabricated tests; W08 documentation is limited to controls actually performed.
- **Risk if not done:** documentation may claim a control existed or a test passed when it did not.

## Task dependency summary

```text
T001 → T002 → T003/T004
T004 → T005 → T006/T007
T005 → T008 → T009 → T010
T004 → T011 → T012 → T013 → T014/T015
T016 → T017 → T018 → T019
T001 → T020 → T021 → T022
T006..T022 → T023 → T024/T025 → T026 → T027
```
