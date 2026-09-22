# Installation

Copy the complete `student-weekly-report` folder into a coding assistant's configured project-level or user-level skills directory, or import the folder as a skill bundle. Keep `SKILL.md`, `references/`, `assets/`, and any product metadata together; all runtime links are relative.

Typical layouts include:

```text
<project>/.codex/skills/student-weekly-report/
<Codex home>/skills/student-weekly-report/
<project>/.agents/skills/student-weekly-report/
<assistant skills root>/student-weekly-report/
```

Use the location documented or configured by the target assistant. Product-specific metadata under `agents/` is optional; assistants that do not use it can ignore it. No AI Bootcamp repository, network access, executable script, or external skill is required at runtime.

For assistants without native skill-folder support, provide `SKILL.md` as the persistent instruction entry point and make the relative `references/` and `assets/` files available in the same workspace. Do not flatten or rename the relative files unless their links are updated.
