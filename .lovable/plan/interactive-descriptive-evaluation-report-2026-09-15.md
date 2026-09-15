# Interactive descriptive evaluation report

## Goal
Turn the answer-check result into a clear, interactive report without changing the marking formula.

## Changes
- Keep the score, maximum marks, grade, verdict, word count, and exam time together in a compact summary.
- Add a five-axis comparison radar showing the full expected standard against the student's achieved percentage in each marking pillar.
- Turn the marks breakdown into expandable rows showing marks earned, marks deducted, percentage achieved, and the evaluator's reason.
- Present strengths, scope for improvement, and missed points as distinct, easy-to-scan sections.
- Replace the always-visible model answer with a clear reveal/hide button so users can review feedback first.
- Preserve the existing mobile layout, theme, both checking modes, and weighted scoring behavior.

## Validation
- Run the project checks.
- Submit a real answer and verify the report, interactions, graph, and mobile fit in the live preview.

## Technical details
- Derive radar percentages and deductions from the existing server-calculated breakdown so the visual always matches the awarded score.
- Use accessible disclosure controls and semantic labels for expandable feedback and the model-answer reveal.
