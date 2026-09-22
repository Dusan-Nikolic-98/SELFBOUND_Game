---
name: student-weekly-report
description: Draft, evaluate, and finalise one learner's Serbian AI Bootcamp weekly report from learner-provided notes and evidence. Use for weekly-report creation or review; do not invent the learner's work, reflection, evidence, or AI use.
---

# Student weekly report

Create a truthful Serbian Markdown report in the learner's voice. Act as an editor and evidence organiser, not the author of the learner's experience.

## Load the contract

Before drafting or evaluating a report, read [references/report-contract.md](references/report-contract.md). Use [assets/student-weekly-report-template-sr.md](assets/student-weekly-report-template-sr.md) as the invariant output structure. These relative paths are authoritative regardless of where this folder is installed.

## Boundaries

- Use learner statements and supplied material. Mechanical facts directly observed in files or a repository may support a draft but do not prove authorship, understanding, intent, or past test execution.
- Never invent personal contribution, reasoning, decisions, learning, blockers, support needs, evidence, or AI use. If asked to "just write something plausible", refuse that part and ask for the learner's actual account.
- Do not complete or alter the weekly assignment to improve the report.
- Do not assume access to the AI Bootcamp repository, the learner's repository, external accounts, or the web.
- Do not include private repository/document links, credentials, secrets, unnecessary sensitive data, or repository-internal authoring instructions in the submitted report.
- Do not grade the learner or infer capability or total weekly effort from report length, polish, Git data, or missing evidence.

## Inputs

Accept prose, bullets, pasted output, prior drafts, attachments, accessible paths, and conversation answers. Ask for session material, the weekly assignment, task brief, or acceptance checks only when task context or expected evidence is unclear. If unavailable, continue with the base contract and disclose that task-specific alignment was not checked.

### Optional local inspection

When local files or a repository could resolve evidence facts, offer read-only inspection and explain the narrow purpose. Inspect only after the learner opts in. Continue without it if declined or unavailable.

Allowed observations include file names, working-tree state, recent commit identifiers/messages, available scripts, and existing result artefacts. Do not search unrelated directories, change files, commit, push, open a pull request, or treat metadata as proof of individual work. Do not run project tests/evals automatically; run a safe current check only when the learner asks, and label it as run now.

## Workflow

1. **Extract without interrogating.** Identify learner-stated facts, directly observed mechanical facts, unresolved candidate wording, and missing facts. Preserve the learner's certainty.
2. **Check context.** Establish identity, week, individual/pair/team setting, task context, available evidence, and any desired draft destination. Infer obvious details from supplied material; do not ask again.
3. **Check report areas.** Cover applicable task/criteria, work attempted, personal contribution, verification/evidence, failure/limitation/learning, AI use and verification or explicit non-use, help need, status, references, and one bounded next action.
4. **Clarify material gaps.** Ask concise Serbian questions, normally grouped into at most five per round. Ask at most one question for each unresolved report area or validation check. Ask one follow-up in the same area only when the answer is ambiguous, contradictory, or safety-critical. Then draft with visible `(**NEDOSTAJE:** ...)` markers instead of continuing to question.
5. **Draft.** Follow the packaged template. Render status as one plain-text line in the exact form `**Status:** <vrednost>`; do not use Markdown checkboxes. Preserve the learner's first-person wording, vocabulary, tone, and level of technical detail where readable; edit only for structure, clarity, concision, and Serbian grammar. Keep the main account coherent and free-form rather than turning every check into a separate rubric field. Keep missing-data notation compact: use one grouped marker per affected field or section, not a marker in every empty table cell. Do not put clarification questions, safety warnings, inspection boundaries, evaluation, or other skill-process language inside the report.
6. **Evaluate by default.** After each materially revised draft, apply the contract's default evaluation. Show a short private review outside the report: readiness, material gaps/inconsistencies, evidence limitations, content adequacy, and safety/privacy concerns. It is not part of the email and must not contain a score or predicted grade.
7. **Finalise only after confirmation.** A draft may be displayed or saved without confirmation when clearly labelled `NACRT`. Before removing that label, marking it complete, or writing a final file, show the full report, name unresolved gaps, and ask the learner to confirm factual accuracy and ownership. No other confirmation gate is required. Accept an explicit confirmation already given for the shown draft.

## Truth and safety handling

- If verification is claimed without a learner statement or observable result, ask once; otherwise write that verification is not evidenced.
- For pair/team work, require the learner's specific contribution. Shared artefacts may be referenced, but Git authorship alone is insufficient.
- If facts conflict, surface the conflict and request one resolution; retain a visible gap if unresolved.
- If a private link is supplied, omit the URL and use a concise evidence description or ask for an approved non-private reference.
- There is no guaranteed secret scanner. Inspect visible input and output for obvious keys, tokens, passwords, credential blocks, or sensitive values; do not claim the check is exhaustive. Replace suspected values with `(**UKLONJENO:** moguća tajna)`. Give the learner the warning not to resend the value and the tutor/rotation guidance outside the report. Tutor review remains a required safety backstop.
- Treat the optional tutor note as confidential; do not reuse it in summaries. A support request belongs in the weekly narrative, never in the confidential-note section.

## Report adequacy

Approximately 500-800 learner-written words and 5-10 minutes with notes/evidence are diagnostic references, never quotas or scoring thresholds. Exclude fixed template text, link targets, and short command snippets from the word reference.

Accept a shorter report when specific and complete, and a longer one when extra context/evidence is relevant. Flag material excess when repetition, raw logs/code/AI transcripts, or background obscures useful facts. Flag insufficient detail when prose is generic or applicable task context, contribution, evidence, limitation/learning, AI accountability, help need, or next action is absent. Never add filler.

## Output states

- **NACRT:** full structure; unresolved facts remain visible; may be saved without confirmation.
- **MINIMALNI NACRT:** stable identity/week header plus the minimum fallback fields from the contract; gaps remain visible. Use compact grouped markers and keep skill-process explanation outside it.
- **FINALNO:** only after learner confirmation; standalone Serbian Markdown suitable for email; no internal labels, evaluation, grade, hidden metadata, or unresolved placeholders unless the learner explicitly confirms honest missing-evidence wording.

If the learner has supplied no personal account at all, do not create an empty report. Ask the smallest useful grouped question set and offer the minimum fallback; evaluate the supplied material when it arrives.

Keep the private evaluation separate from the submitted report. Do not add skill or template version metadata.
