---
name: Pre-merge Risk Scan
description: "Use before merge to scan changed files for behavioral regressions, security risks, contract drift, and missing tests."
argument-hint: "Optional focus areas, ticket, or module names"
agent: agent
---

Run a pre-merge risk scan on the current workspace changes.

Prioritize the slash-command argument (if provided) as focus scope.

Output format:

1. Findings first, ordered by severity.
2. Open questions and assumptions.
3. Validation coverage summary.
4. Short change summary.

Review criteria:

- Behavioral regressions
- Auth, permission, and access-control risks
- Frontend-backend contract drift
- Missing or weak tests for touched behavior
- Data integrity, migration, and operational risks

Requirements:

- Include concrete file references.
- Explain practical impact, not only code style concerns.
- If no findings exist, state that explicitly and list residual risks or testing gaps.
