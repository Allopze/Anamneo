# Auditoría Visual UI — Anamneo

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, React 18) |
| Styling | Tailwind CSS 3.4 + globals.css con @layer components |
| State | Zustand + React Query |
| Icons | react-icons (Feather set) |
| Charts | SVG custom (`MiniTrendChart`) |
| Fonts | Inter (Google Fonts vía CSS variable) |

## Paleta Actual

- **Superficie:** blanco puro (`bg-white`) + `bg-slate-50` de fondo.
- **Primario:** Teal/turquesa (`primary-50` a `primary-950`, ej. `#179a98`).
- **Clínico:** Verde (`clinical-50` a `clinical-900`, ej. `#10b981`).
- **Texto:** `text-slate-900` / `text-slate-600` / `text-slate-400`.
- **Estados:** Rojo (`red-600`), ámbar (`amber-600`), azul (`blue-600`).
- **Background:** Gradiente lineal de `#f8fafc` a `#f1f5f9`.

## Brecha Visual vs. Referencia Objetivo

| Aspecto | Estado Actual | Objetivo |
|---------|---------------|----------|
| Paleta | Blanco frío + teal + slate azulado | Gris cálido `#DFDFD5` + lima `#E9F34A` + carbón |
| Radios | `rounded-lg` / `rounded-xl` (8-12px) | `rounded-3xl` / `rounded-full` (24-44px / pill) |
| Densidad | Media-alta, grids compactas | Media-baja, aire, superficies flotantes |
| Layout | Sidebar fija izquierda tipo backoffice | Shell contenido, nav superior tipo pills |
| Tipografía | Inter estándar, títulos moderados | Sans geométrica, títulos amplios, métricas grandes |
| Separación | Bordes finos + sombras box-shadow | Contraste tonal, sombras mínimas |
| Cards | `rounded-xl border border-slate-200` + sombras | Superficies suaves, radios altos, sin bordes duros |
| Nav | Sidebar vertical con links + labels | Top bar con pills/cápsulas horizontales |
| Timeline | Lista cronológica plana de encounters | Workspace temporal con rail, hitos y tarjetas conectadas |
| Chips/Tabs | Estándar Bootstrap-like | Cápsulas pill con iconos finos |

## Inventario de Componentes a Refactorizar

### Nivel 1 — Shell y Layout
- `DashboardLayout.tsx` — sidebar + topbar + main area
- `globals.css` — tokens, body, scrollbar, todas las clases @layer components
- `tailwind.config.js` — colors, fonts, animations

### Nivel 2 — Navegación
- Primary nav links (sidebar vertical → pills top)
- Secondary nav links
- User menu dropdown
- Command palette search bar
- Mobile hamburger/sidebar

### Nivel 3 — Componentes Clínicos
- Patient detail page (perfil + historial + encounters timeline)
- Patient list page (tabla + filtros + paginación)
- Dashboard page (metric cards + recent encounters + tasks)
- Encounter ficha page (secciones clínicas)
- Follow-ups page (task list + filters)

### Nivel 4 — Primitivas
- `.btn`, `.btn-primary`, `.btn-secondary` etc.
- `.card`, `.card-hover`
- `.metric-card`, `.metric-icon`, `.metric-value`
- `.form-input`, `.form-label`, `.form-error`
- `.section-block`, `.section-callout`, `.section-intro`
- `.stepper-*` (steps del encounter)
- `.empty-state-*`
- `.dropdown-*`
- `.page-header`, `.filter-surface`

### Nivel 5 — Gráficos y Data
- `MiniTrendChart.tsx` — SVG polyline simple
- Status badges (EN_PROGRESO, COMPLETADO, etc.)
- Progress indicators

## Dependencias Críticas

1. La sidebar DashboardLayout contiene TODA la lógica de auth bootstrap, routing guard, keyboard shortcuts y user menu. El refactor debe mantener esta lógica intacta.
2. Las clases CSS en `globals.css` son ampliamente usadas en todas las páginas. El refactor de tokens debe ser global y coherente.
3. `MiniTrendChart` usa SVG programático; debe adaptarse a la nueva paleta.
4. Los `SectionPrimitives` son base de todos los formularios clínicos.
