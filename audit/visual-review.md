# Anamneo visual review after premium fix pass

Generated: 2026-06-04

## Validation run

- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run test`: 76 suites passed, 399 tests passed.
- `npm --prefix frontend run test:e2e:visual`: 41 passed.
- `npm --prefix frontend run test:e2e -- tests/e2e/audit-capture.spec.ts`: 5 passed, 3 skipped.
- `npm --prefix frontend run build`: passed.
- Screenshot sets reviewed: `frontend/tests/e2e/screenshots` and `audit/screenshots`, 85 PNGs.
- Evidence file: `audit/evidence.json`.
- Contact sheets: `audit/contact-sheets/01-dashboard-admin.png`, `02-patients-encounters-catalog.png`, `03-portal-public-auth.png`, `04-audit-states.png`.

## Fixes completed

| Before | After | Why |
| --- | --- | --- |
| `pacientes__new--desktop`, `pacientes__edit--desktop`, and audit patient-form states let the `Sexo` select protrude from the form grid. | New/edit patient forms now use bounded grid tracks and derived age fields wrap inside their surface. | Core clinical forms should never look physically broken. |
| `dashboard__medico--desktop` compressed the greeting because CTAs competed for the same row. | The clinical hero now gives greeting and actions stable zones. | The primary medical cockpit should feel calm and intentional. |
| Mobile encounter/ficha action bars were icon-heavy and visually crowded. | Secondary actions moved into a labeled overflow menu, with primary workflow actions still visible. | Clinical mobile actions need explicit meaning, not mystery icons. |
| Catalog destructive actions and CSV import panels had too much visual weight. | Destructive row actions are softer and import surfaces are lighter. | Repeated destructive affordances should not compete with reading/scanning. |
| Patient search empty states explained the problem but did not provide a direct reset. | Empty states now include a reset action. | Recovery should be one click when filters cause the empty state. |
| `portal__home--desktop` felt sparse and under-actioned. | Finished encounters now read as fuller rows with clearer actions. | Patient-facing record access should feel substantial and understandable. |
| Portal clinical detail used too many nested panel surfaces. | Inner clinical data surfaces were reduced and separated more by structure than card stacking. | This keeps the portal premium instead of card-heavy. |
| `admin__auditoria--desktop` filter controls were dense and request ID felt cramped. | Audit filters now use a calmer six-column responsive layout. | Rare filters can exist without making the audit view feel overloaded. |
| `admin__usuarios--desktop` invitation/user rows could be pushed around by long emails. | User, invitation, and assignment rows now truncate/wrap deliberately. | Admin tables need robust text behavior for real email strings. |
| `agenda__week--desktop` had a polished empty state but no direct next action for assistants without a doctor. | The empty state now includes a `Solicitar asignación` CTA and names the admin route required. | Empty states should convert uncertainty into a concrete next step. |
| `portal__historial-acceso--mobile` relied on a dense horizontally scrollable table. | Mobile now renders audit events as native list cards while desktop keeps the table. | Patient portal mobile should be readable without sideways scrolling. |
| `public__register--mobile` legal acceptance felt wordy and dense. | The legal acceptance block is compact, bordered, and keeps version metadata as microcopy. | Registration should feel secure without making the last step visually heavy. |
| `pacientes__detail--desktop` and `analitica__overview--desktop` captured redirected/duplicated states. | Visual specs now assert URL/heading and use the correct medico fixture. | Screenshot coverage must fail when the target page was not actually captured. |

## Current actionable notes

| Screenshot | Verdict | Actionable note |
| --- | --- | --- |
| `admin__auditoria--desktop.png` | OK | Filters are materially calmer after the responsive layout change. Future improvement: add saved filter presets if audit usage grows. |
| `admin__usuarios--desktop.png` | OK | Long emails and assignment labels now have explicit truncation. Future improvement: table/list density could be tightened for clinics with many users. |
| `agenda__week--desktop.png` | OK | The no-doctor state now includes an action and admin route guidance. |
| `analitica__overview--desktop.png` | OK | Coverage now captures the actual analytics overview under medico credentials. |
| `atenciones__detail--mobile.png` | OK | Primary action remains visible and secondary actions are in overflow. |
| `atenciones__ficha--mobile.png` | OK | Mobile top actions no longer read as a clipped icon strip. |
| `audit__patient-form-blank--desktop.png` | OK | Form grid is contained. |
| `audit__patient-form-validation-errors--desktop.png` | OK | Validation state is contained and readable. |
| `audit__search-no-results--desktop.png` | OK | Empty state now has a direct reset action. |
| `audit__search-special-chars--desktop.png` | OK | Same reset path is available for special-character searches. |
| `catalogo__afecciones--desktop.png` | OK | Import panel and destructive actions are less dominant. |
| `catalogo__medicamentos--desktop.png` | OK | Destructive action visual weight is reduced. |
| `dashboard__admin--desktop.png` | Follow-up | Header still has some unused utility space. It is acceptable, but could become a denser operational summary. |
| `dashboard__admin--mobile.png` | Follow-up | Header plus utility controls still consume a lot of first viewport. Tightening the mobile app shell would help. |
| `dashboard__medico--desktop.png` | OK | Greeting no longer wraps awkwardly. |
| `pacientes__detail--desktop.png` | OK | Coverage now captures the actual detail page. |
| `pacientes__edit--desktop.png` | OK | Form grid constraints are stable. |
| `pacientes__new--desktop.png` | OK | Form grid constraints are stable. |
| `portal__atencion-detail--desktop.png` | OK | Nested clinical surfaces are lighter. |
| `portal__atencion-detail--mobile.png` | OK | Still information-dense, but card nesting is reduced. |
| `portal__historial-acceso--mobile.png` | OK | Mobile-native list replaces the dense table. Future improvement: group long histories by date/month. |
| `portal__home--desktop.png` | OK | Finished encounters are clearer and more actionable. |
| `public__change-password-invalid-token--mobile.png` | Follow-up | Card still sits low with a large empty top area. Center slightly higher. |
| `public__register--mobile.png` | OK | Legal acceptance is more compact. |

## Still worth doing next

- Tighten the mobile dashboard app shell so header utility controls consume less early viewport.
- Move `public__change-password-invalid-token--mobile` slightly higher in the viewport.
- Add date/month grouping or filters to `portal__historial-acceso--mobile` for patients with long histories.
- Replace the remaining audit-capture skips with deterministic fixtures for reload guard, unsaved changes, and patient-detail console monitoring.
