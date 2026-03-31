# Plan de Refactor Visual — Anamneo

## Estrategia

Refactor incremental por capas, de lo global a lo específico:

1. **Tokens y tema** → tailwind.config.js + globals.css (CSS variables)
2. **Shell y layout** → DashboardLayout.tsx (sidebar → top nav)
3. **Primitivas CSS** → globals.css @layer components actualizado
4. **Componentes reutilizables** → nuevos componentes en components/ui/
5. **Páginas** → dashboard, pacientes, atenciones, seguimientos
6. **Refinamiento** → responsive, charts, microinteracciones

## Archivos a Modificar (orden de ejecución)

| Orden | Archivo | Cambio |
|-------|---------|--------|
| 1 | `tailwind.config.js` | Nueva paleta, radios, sombras, fuentes |
| 2 | `globals.css` | CSS variables, primitivas actualizadas |
| 3 | `DashboardLayout.tsx` | De sidebar a top pill nav + shell contenido |
| 4 | `(dashboard)/page.tsx` | Dashboard con nueva estética |
| 5 | `pacientes/page.tsx` | Lista de pacientes refinada |
| 6 | `pacientes/[id]/page.tsx` | Perfil de paciente como hero screen |
| 7 | `atenciones/page.tsx` | Lista de encuentros refinada |
| 8 | `seguimientos/page.tsx` | Follow-ups refinados |
| 9 | `MiniTrendChart.tsx` | Paleta chart actualizada |
| 10 | `SectionPrimitives.tsx` | Primitivas de sección actualizadas |
| 11 | Login/Register pages | Autenticación con nueva estética |

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Sidebar → top nav cambia layout significativamente | Mantener toda la lógica JS intacta, solo reestructurar JSX/CSS |
| Clases CSS usadas en ~15 archivos | Refactorizar clases globales in-place para que apliquen automáticamente |
| Responsive puede romperse | Testear 3 breakpoints desktop/tablet/mobile |
| Inter ya está cargada como fuente | Mantener Inter, es adecuada para el objetivo |
