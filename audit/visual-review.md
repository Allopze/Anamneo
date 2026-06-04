# Anamneo visual review after premium pass

Generated: 2026-06-04

## Validation run

- `npm --prefix frontend run test:e2e:visual`: 41 passed.
- `npm --prefix frontend run test:e2e -- tests/e2e/audit-capture.spec.ts`: 5 passed, 3 skipped.
- Screenshot sets reviewed: `frontend/tests/e2e/screenshots` and `audit/screenshots`, 85 PNGs.
- Evidence file: `audit/evidence.json`.
- Contact sheets: `audit/contact-sheets/01-dashboard-admin.png`, `02-patients-encounters-catalog.png`, `03-portal-public-auth.png`, `04-audit-states.png`.

## High priority actionable issues

| Before | After | Why |
| --- | --- | --- |
| `pacientes__new--desktop` and validation states show the `Sexo` select protruding outside the form card. | Rework the desktop patient form grid so `Fecha`, `Edad calculada`, and `Sexo` use bounded grid tracks, with `minmax(0, 1fr)` and no control allowed to exceed the card width. | This is a visible layout break on a core clinical workflow. |
| `Edad calculada` truncates "Pendiente de fecha de nacimiento" in desktop patient forms. | Give read-only derived fields enough width or allow text wrapping inside the input-like surface. | Truncated clinical metadata feels broken and reduces trust. |
| `dashboard__medico--desktop` wraps "Buenas tardes, Prueba." into three short lines because CTAs compete for width. | Move CTAs to a second row or use a two-zone header where the greeting has a stable min-width. | The main cockpit screen should feel calm and intentional, not squeezed. |
| Mobile clinical action bars show icon-only controls, with some controls visually clipped in `atenciones__detail--mobile` and `atenciones__ficha--mobile`. | Collapse secondary actions into a labeled overflow menu and keep only the primary action visible. | Mobile clinical actions need clarity; icon-only clusters are hard to trust. |
| `portal__home--desktop` has a large empty "Atenciones finalizadas" panel with small icon-only actions. | Turn each finished encounter into a full clickable row with date, clinician, status, and a labeled download/open action. | The patient portal currently feels sparse rather than premium on desktop. |
| Catalog desktop makes "Eliminar" highly prominent in the row. | Make destructive actions tertiary until row hover/focus, or route through a compact confirmation affordance. | Destructive weight should not compete with normal catalog reading. |
| `audit__search-no-results--desktop` explains the empty state but offers no direct clear action. | Add "Limpiar busqueda" or "Restablecer filtros" inside the empty state. | Empty states should include the next useful action. |
| Some visual screenshots capture redirects or duplicate pages, for example `pacientes__detail--desktop` matches the list and `analitica__overview--desktop` matches the admin dashboard. | Add URL/heading assertions after navigation and use the right role fixture per route. | Visual coverage should fail when the target page was not actually captured. |

## Screenshot-by-screenshot notes

| Screenshot | Verdict | Actionable note |
| --- | --- | --- |
| `admin__auditoria--desktop.png` | Action | Filters are dense and the request ID placeholder truncates; use responsive filter rows or a details drawer for rare filters. |
| `admin__solicitudes--desktop.png` | OK | Empty state reads cleanly. No immediate visual action. |
| `admin__usuarios--desktop.png` | Action | Long email strings need explicit truncation and better wrapping in invitation/assignment rows. |
| `agenda__week--desktop.png` | Action | Empty state is polished, but should include a clear admin/contact action for "sin medico asignado". |
| `ajustes__perfil--desktop.png` | OK | Consistent rounded panels and restrained hierarchy. |
| `ajustes__sistema--desktop.png` | OK | System details are readable; no major visual issue found. |
| `analitica__casos--desktop.png` | OK | Cards and table feel consistent. |
| `analitica__casos--mobile.png` | OK | Mobile stack is readable and premium enough. |
| `analitica__overview--desktop.png` | Coverage | Appears to capture the admin dashboard, not analytics overview. Fix visual fixture/assertion. |
| `atenciones__detail--desktop.png` | OK | Strongest premium screen; clinical hierarchy is clear. |
| `atenciones__detail--mobile.png` | Action | Top action bar is icon-heavy and partly ambiguous; collapse secondary actions. |
| `atenciones__ficha--desktop.png` | OK | Signature review layout is clear. |
| `atenciones__ficha--mobile.png` | Action | Top action row appears clipped/overloaded; use labeled primary action plus overflow. |
| `atenciones__list--desktop.png` | OK | List and empty/list states are coherent. |
| `atenciones__new--desktop.png` | OK | Search-first flow reads clearly. |
| `atenciones__new--mobile.png` | OK | Mobile flow is clean. |
| `audit__login-error--desktop.png` | OK | Error state is clear and appropriately calm. |
| `audit__login-error--mobile.png` | OK | Error banner is readable and not overdramatic. |
| `audit__patient-form-blank--desktop.png` | Action | Same patient form grid overflow/truncation issue as patient new desktop. |
| `audit__patient-form-blank--mobile.png` | OK | Form stack is usable. |
| `audit__patient-form-validation-errors--desktop.png` | Action | Validation styling is fine, but the desktop form grid overflow remains. |
| `audit__patient-form-validation-errors--mobile.png` | OK | Error spacing and contrast are good on mobile. |
| `audit__protected-route-unauth--desktop.png` | OK | Redirect/login state is coherent. |
| `audit__search-no-results--desktop.png` | Action | Add direct clear/reset action in empty state. |
| `audit__search-special-chars--desktop.png` | Action | Same empty-state action as no-results search. |
| `catalogo__afeccion-edit--desktop.png` | OK | Compact edit layout is consistent. |
| `catalogo__afeccion-edit--mobile.png` | OK | Mobile edit form reads well. |
| `catalogo__afecciones--desktop.png` | Action | CSV block has more visual weight than the active list; consider collapsible import. |
| `catalogo__afecciones--mobile.png` | OK | Mobile hierarchy is good. |
| `catalogo__afeccion-new--desktop.png` | OK | Form is simple and balanced. |
| `catalogo__afeccion-new--mobile.png` | OK | Mobile form is clear. |
| `catalogo__medicamento-edit--desktop.png` | OK | Form layout is stable. |
| `catalogo__medicamento-edit--mobile.png` | OK | Mobile form is stable. |
| `catalogo__medicamento-new--desktop.png` | OK | Form layout is stable. |
| `catalogo__medicamento-new--mobile.png` | OK | Buttons sit low in screenshot but form itself is coherent. |
| `catalogo__medicamentos--desktop.png` | Action | Destructive `Eliminar` is too visually dominant; CSV block could be secondary/collapsible. |
| `catalogo__medicamentos--mobile.png` | OK | Mobile catalog composition is good. |
| `dashboard__admin--desktop.png` | Action | Top utility header has large unused space; make it more functional or reduce its height/weight. |
| `dashboard__admin--mobile.png` | Action | Header + utility pill stack consumes early viewport; tighten vertical rhythm. |
| `dashboard__medico--desktop.png` | Action | Greeting wraps awkwardly because action buttons crowd the row. |
| `global__not-found--desktop.png` | OK | Uses login-style shell because of redirect; acceptable if intentional. |
| `legal__privacidad--desktop.png` | OK | Long-form legal page is readable. |
| `legal__terminos--desktop.png` | OK | Long-form legal page is readable. |
| `live__double-click-save--desktop.png` | OK | No visual issue identified from screenshot. |
| `pacientes__admin--desktop.png` | OK | Admin patient list is readable. |
| `pacientes__admin--mobile.png` | OK | Mobile stack is clear. |
| `pacientes__detail--desktop.png` | Coverage | Appears identical to list capture; verify detail route fixture. |
| `pacientes__edit--desktop.png` | Action | Same patient form grid constraints should be checked on edit. |
| `pacientes__edit--mobile.png` | OK | Mobile edit form is usable. |
| `pacientes__history--desktop.png` | OK | History layout is structured. |
| `pacientes__history--mobile.png` | OK | Mobile history form is clean. |
| `pacientes__list--desktop.png` | OK | List row and search area are polished. |
| `pacientes__new--desktop.png` | Action | Form grid overflow and text truncation. |
| `pacientes__new--mobile.png` | OK | Mobile form is polished. |
| `plantillas__list--desktop.png` | OK | Empty state is focused and actionable. |
| `plantillas__list--mobile.png` | OK | Empty state works on mobile. |
| `portal__activar--desktop.png` | OK | Activation card is simple and readable. |
| `portal__activar--mobile.png` | OK | Mobile activation is clean. |
| `portal__atencion-detail--desktop.png` | Action | Clinical content is readable but nested panels feel heavy; reduce inner card nesting. |
| `portal__atencion-detail--mobile.png` | Action | Strong readability, but too many rounded nested blocks create card soup. |
| `portal__historial-acceso--desktop.png` | OK | Table is readable. |
| `portal__historial-acceso--mobile.png` | Action | Table is usable but dense; consider a card/list presentation on mobile. |
| `portal__home--desktop.png` | Action | Desktop portal feels sparse; make encounter row/actions more explicit. |
| `portal__home--mobile.png` | OK | Mobile portal is clear and compact. |
| `portal__login--desktop.png` | OK | Cohesive with public auth direction. |
| `portal__login--mobile.png` | OK | Mobile login is readable. |
| `portal__login-reset--desktop.png` | OK | Reset flow is coherent. |
| `portal__login-reset--mobile.png` | OK | Mobile reset is clean. |
| `portal__solicitudes--desktop.png` | OK | Request form is readable. |
| `portal__solicitudes--mobile.png` | OK | Mobile request flow is clear. |
| `public__change-password-invalid-token--desktop.png` | OK | Clear recovery state. |
| `public__change-password-invalid-token--mobile.png` | Action | Card sits very low with large empty top area; consider vertically centering slightly higher. |
| `public__derechos--desktop.png` | OK | Form page is readable. |
| `public__derechos--mobile.png` | OK | Mobile form is long but stable. |
| `public__descargar-ficha--desktop.png` | OK | Minimal state is understandable. |
| `public__forgot-password--desktop.png` | OK | Password reset screen is coherent. |
| `public__forgot-password--mobile.png` | OK | Mobile reset screen is coherent. |
| `public__login--desktop.png` | OK | Premium auth split works well. |
| `public__login--mobile.png` | OK | Mobile login hierarchy is good. |
| `public__register--desktop.png` | OK | Register layout is stable. |
| `public__register--mobile.png` | Action | Long legal/terms area makes the form feel dense; add compact checklist or clearer disabled-button reason. |
| `reportes__list--desktop.png` | OK | Empty state is calm and understandable. |
| `reportes__list--mobile.png` | OK | Mobile empty state is polished. |
| `seguimientos__list--desktop.png` | OK | Empty/list state is consistent. |
| `seguimientos__list--mobile.png` | OK | Filters and empty state are usable on mobile. |

