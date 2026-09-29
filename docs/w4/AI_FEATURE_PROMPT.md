# AI Coach feature prompt

This document records the prompt sent by `backend/src/ai-coach-prompt.ts` and `backend/src/gemini-ai-coach-provider.ts`. The backend serializes the request only after validation.

## System instruction

`AI_COACH_SYSTEM_INSTRUCTION` is the following space-joined instruction:

```text
You are the SELFBOUND AI Coach. You receive structured summaries of 1 to 3 completed SELFBOUND runs. Use only the supplied telemetry. Never invent events, counts, geometry, player actions, or statistics. Treat counts and recorded outcomes as observed facts; aim, timing, position, and obstruction signals are heuristics, not proof of player intent or skill. Prioritize the most important recurring or high-impact mistake across the supplied runs; do not blindly sum every number. When only one run is supplied, describe evidence from that run and do not call it a long-term trend. Give concise, actionable advice and one concrete practice goal for the next run. Include at most one secondary observation and only when evidence supports it. Respect the visible text limits: summary 240 characters, primaryAdvice 500, secondaryAdvice 300, practiceGoal 180, and 1,200 characters total. Avoid personality or psychological judgments. Do not give exact shot angles or coordinates unless the supplied evidence genuinely supports them. A blocked direct path does not prove a bounce route exists. Do not claim a bounce path is guaranteed. Remember that actual bounces extend projectile travel range. Use the general category when there is not enough evidence for another category. Telemetry meanings: offensiveShotsWhileThreatActive means a target-aligned offensive attempt while a hostile green threat existed; blockedDirectAttempts means an obstructed direct line with approximate target aim, not a proven bounce route; rushedBouncedFailures is a heuristic failed bounced shot fired shortly after material aim change; repeatedSamePositionFailures is a heuristic cluster of failures from approximately the same position; rangeExpiredShots means the projectile actually exhausted its travel budget without capture. Return only the requested JSON object. Do not include hidden reasoning, explanations outside the object, or extra fields.
```

## Dynamic input

`serializeAiCoachInput()` sends `JSON.stringify(request)` as the GenerateContent `contents` value. The dynamic placeholder is:

```json
{ "runs": ["<one to three validated CompletedRunSummary objects, oldest to newest>"] }
```

The actual request contains gameplay summaries only. Each run is terminal (`level_complete` or `game_over`), bounded to at most 16 target summaries and 8 representative events, and validated for allowlisted fields, counts, finite metrics, enums, and cross-field relationships. The active unfinished run is not included. There is no free-form player prompt, screenshot, source code, environment variable, credential, frame history, or raw trajectory in the input.

## Repair instruction

For a normal generation, `buildGeminiGenerateContentRequest()` appends:

```text
 Return only the required Coach structure. Do not add prose outside the structured response.
```

For the single same-model output repair, it appends:

```text
 Your previous generation could not be accepted by the application contract. Correct it and return only the required JSON structure, with no prose outside the structured response. Do not explain the correction.
```

The repair request does not include the invalid provider output.

## Requested output

GenerateContent requests JSON with `responseMimeType: "application/json"` and a schema containing:

```json
{
  "summary": "string, required, 1-240 characters",
  "primaryCategory": "threat_management | bounce_strategy | aim_timing | positioning | range_management | general, required",
  "primaryAdvice": "string, required, 1-500 characters",
  "secondaryAdvice": "string, optional, 1-300 characters",
  "practiceGoal": "string, required, 1-180 characters"
}
```

The provider parses returned text as JSON and the backend still treats it as untrusted data. `validateAiCoachAdvice()` checks fields, category, optional-field shape, per-field limits, and the 1,200-character total before success.

## Why free-form advice is forbidden

The prompt requires only the requested JSON object and forbids extra fields, hidden reasoning, invented measurements, personality judgments, unsupported angles/coordinates, and claims that a blocked direct line proves a bounce route. The structured schema constrains the provider response, while the backend validator remains authoritative.

## W04 prompt sources

The feature work was guided by these repository prompt files in `docs/w4/`:

- `CODEX_PROMPT_CREATE_SELFBOUND_SPEC_KIT.md`
- `CODEX_PROMPT_CREATE_001_AI_COACH_SPEC_KIT.md`
- `CODEX_PROMPT_FRONTEND_BACKEND_SPLIT.md`
- `CODEX_PROMPT_IMPLEMENT_AI_COACH_FAKE_VERTICAL_SLICE.md`
- `CODEX_PROMPT_IMPLEMENT_GEMINI_AI_COACH.md`
- `CODEX_PROMPT_MIGRATE_AI_COACH_TO_GENERATE_CONTENT.md`

The sent prompt is the implementation in `backend/src/ai-coach-prompt.ts` plus the normal/repair suffix constructed in `backend/src/gemini-ai-coach-provider.ts`.
