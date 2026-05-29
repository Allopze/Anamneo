# Anamneo Design Context

This file complements `docs/design-tokens-anamneo.md`, which remains the detailed token reference.

## Visual Register

Product UI. Design serves clinical and legal workflows. Interfaces should feel quiet, robust, and operational rather than editorial or campaign-like.

## Color Strategy

Restrained. Use warm neutral surfaces with one operational accent:

- `surface-base`: main app background.
- `surface-elevated`: cards, panels, modals, and raised surfaces.
- `surface-inset`: inputs, table headers, subtle empty-state backgrounds.
- `ink`: primary text.
- `ink-secondary` and `ink-muted`: supporting text and labels.
- `accent`: selected states and primary highlights.
- `auth-teal`: public/legal/portal accent where an external workflow needs a recognizable marker.
- `status-red`, `status-yellow`, `status-green`: semantic feedback only.

Avoid hardcoded `slate-*`, `gray-*`, decorative gradients, and full-saturation inactive states.

## Typography

Use the product sans stack from Tailwind (`var(--font-inter), system-ui, sans-serif`). Keep headings compact, labels readable, and body copy within comfortable line lengths. Reserve all-caps for rare metadata, not routine field or card labels.

## Components

- Use `AlertBanner` for persistent or inline error, warning, info, success, and offline states.
- Use `EmptyState` for empty results and first-use states. Always explain why the view is empty or what will make content appear.
- Use `ErrorAlert` only as compatibility wrapper for `AlertBanner`.
- Use skeletons for page, table, and section loading states. Keep spinners inside short button actions only.
- Use `btn`, `toolbar-btn`, and `portal-button-*` for actions. Interactive controls should target at least 44px height where practical.

## Layout

Use predictable product layouts: page header, filters, data region, detail modal or inline panel, pagination. Cards are appropriate for repeated clinical records, state panels, and modal surfaces. Avoid nested cards and decorative side-stripe borders.

## Motion

Motion should communicate feedback or state only. Use transform and opacity, `--ease-out`, and short durations. Pressable controls should use subtle `active:scale(0.97)` unless the action is keyboard-initiated or already very dense.

## Copy Rules

- Success: state what completed.
- Warning: state the condition and what remains safe.
- Error: state what failed and the next recoverable action.
- Legal/clinical decisions: include audit reason and consequence.
- Avoid exclamation marks, emojis, and purely technical error names in user-facing copy.
