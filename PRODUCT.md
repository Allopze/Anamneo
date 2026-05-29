# Anamneo Product Context

register: product

## Product Purpose

Anamneo is a clinical operations product for managing patients, encounters, consents, follow-ups, legal data requests, audit trails, and patient-facing access. The interface serves sensitive healthcare work, so clarity, trust, recoverability, and low-friction task completion matter more than visual novelty.

## Primary Users

- Clinicians reviewing and completing clinical encounters.
- Assistants supporting patient intake, scheduling, and administrative continuity.
- Administrators managing users, catalogues, audit, legal requests, and operational settings.
- Patients accessing finalised encounters, access history, and data-rights workflows through the portal.

## Product Principles

- Keep controllers and screens task-first: the user should always understand current state, next action, and recovery path.
- Prefer low-maintenance UI patterns, shared primitives, and tokenized styling over one-off visual treatments.
- Use pragmatic security UX: make sensitive states visible, auditable, and reversible where the workflow allows.
- Keep feedback sober. Clinical actions should feel confirmed, not celebrated.
- Use persistent banners or inline states for risk-bearing information such as offline, conflict, permissions, legal decisions, and data delivery.

## Tone

Calm, precise, and human. Avoid exclamation, decorative language, and vague failure messages. Use sentence case for functional labels. Prefer "No se pudo guardar. Revisa tu conexión e intenta nuevamente." over "Error al guardar".

## Anti-References

- Generic SaaS cards with identical icon, title, description, arrow patterns everywhere.
- Dark glass headers, decorative blur, ornamental gradients, and exaggerated shadows.
- Toast-only communication for clinical or legal states.
- Browser-native prompts for audited or destructive decisions.
- Dense all-caps micro-labels where normal labels would be clearer.

## Strategic Direction

The product should feel like one coherent clinical workspace across internal app, public legal flows, and portal. Familiar product UI is a feature here: predictable tables, forms, tabs, banners, skeletons, and clear actions are preferred over bespoke interaction patterns.
