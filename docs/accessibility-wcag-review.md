# Accessibility WCAG Review

Current gate: `npm --prefix frontend run test:e2e:a11y`.

## Automated Coverage

- Public routes: `/login`, `/forgot-password`, `/politica-de-privacidad`, `/terminos-y-condiciones`.
- Authenticated routes: `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id`, `/atenciones`, `/seguimientos`, `/plantillas`, `/catalogo`, `/ajustes`.
- Ruleset: axe WCAG 2.0/2.1 A and AA tags.
- CI failure threshold: serious or critical axe violations.
- Keyboard smoke: authenticated shell must expose multiple tabbable focus targets in primary navigation/content.

## Manual WCAG Checklist

Use this checklist when reviewing a UI change that affects routes, forms, navigation, modals, or clinical workflows.

| Area | WCAG target | Manual check |
|---|---|---|
| Keyboard access | 2.1.1, 2.1.2 | Navigate the route with Tab, Shift+Tab, Enter and Escape. Confirm no keyboard trap and every action is reachable. |
| Focus visible | 2.4.7 | Confirm the active element has a visible focus indicator in side navigation, table rows, form controls and modal actions. |
| Reading order | 1.3.2, 2.4.3 | Confirm tab order follows the visual order and headings describe each page section. |
| Names and labels | 2.4.6, 3.3.2, 4.1.2 | Confirm icon buttons, inputs, selects and comboboxes expose accessible names. |
| Error handling | 3.3.1, 3.3.3 | Submit invalid forms and confirm errors are text-visible, tied to fields, and do not rely only on color. |
| Contrast | 1.4.3, 1.4.11 | Check text, chips, badges, focus rings and disabled states against normal and hover states. |
| Dynamic updates | 4.1.3 | Confirm toast/status messages are announced or otherwise available to assistive technology. |
| Motion and timing | 2.2.1, 2.3.3 | Confirm critical workflows do not depend on timed interactions or non-essential animation. |

## Current Manual Review Notes

- 2026-05-22: Reviewed authenticated coverage list for patient registry, patient detail, encounter/task/template/catalog/settings pages.
- 2026-05-22: Keyboard smoke is now automated for `/pacientes`; deeper manual pass should be repeated when navigation or form primitives change.
- 2026-05-22: Remaining manual review depth is route-by-route screen reader validation with NVDA/VoiceOver before a formal WCAG conformance claim.
