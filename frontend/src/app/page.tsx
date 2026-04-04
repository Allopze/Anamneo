/* ──────────────────────────────────────────────────────────────
 *  This file intentionally left as a pass-through.
 *
 *  In Next.js App Router, both  src/app/page.tsx  and
 *  src/app/(dashboard)/page.tsx  resolve to the  "/"  route,
 *  but this file takes priority.
 *
 *  Previously it contained  `redirect('/pacientes')`.
 *  Now we re-export null so Next.js falls through to the
 *  (dashboard) route-group, which wraps the page in
 *  DashboardLayout.
 * ────────────────────────────────────────────────────────────── */

export { default } from './(dashboard)/page';
