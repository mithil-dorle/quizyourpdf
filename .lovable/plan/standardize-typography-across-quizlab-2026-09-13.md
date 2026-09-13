# Standardize Typography Across QuizLab

## Changes
- Define reusable typography utilities for page titles, section titles, card titles, supporting copy, body copy, labels, and captions.
- Apply the selected glass-inspired hierarchy across the quiz generator, study guide, answer checker, How It Works, FAQ, Terms, and shared footer states.
- Keep the existing Space Grotesk and DM Sans fonts, dark background, neon gradient accents, and all page content.
- Standardize semantic text colors so primary content, supporting copy, labels, links, and status colors remain consistent and readable.
- Align repeated page headers and responsive title sizing without changing navigation or behavior.

## Technical details
- Add Tailwind v4 custom typography utilities in `src/styles.css` using existing semantic tokens.
- Replace route-specific typography class combinations with those shared utilities.
- Preserve intentionally distinct score displays, timers, warnings, success states, and compact mobile labels.
- Verify representative pages on desktop and phone widths and check for text overflow.
