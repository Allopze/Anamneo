# Iconografía Anamneo

Fecha: 2026-05-29  
Estado: vigente — segunda iteración, set de identidad clínica completo.

## Diagnóstico

El frontend usa `react-icons/fi` (Feather) para affordances estándar, y `@/components/icons` para identidad clínica de Anamneo. Los iconos de identidad tienen su propio SVG alineado a la grilla de 24px y trazo 1.5px de Feather.

### Iconos de mayor frecuencia

| Icono | Usos | Rol |
|---|---:|---|
| FiPlus | 50 | Crear / añadir |
| FiAlertTriangle | ~40 | Warnings genéricos (no clínicos) |
| FiShield | 44 | Seguridad / legal / consentimiento |
| FiX | 44 | Cerrar / descartar |
| FiArrowLeft | 39 | Volver |
| FiDownload | 32 | Exportar |
| FiSearch | 31 | Buscar |
| FiClipboard | ~20 | Seguimientos / tareas (no atenciones) |
| FiFileText | ~30 | Documentos genéricos (legal, consents, portal) |
| FiUsers | 30 | Pacientes / usuarios |
| FiCheck | 30 | Confirmar |
| FiCalendar | 25 | Agenda / fechas |

## Política de uso

### Glyphs que permanecen en Feather (affordance estándar)

Feather comunica limpieza universal. Seguir usándolo para:

- **Navegación**: FiArrowLeft, FiChevronRight, FiChevronLeft, FiChevronDown, FiMenu, FiLogOut
- **Acciones**: FiPlus, FiX, FiCheck, FiSave, FiDownload, FiUpload, FiEdit, FiTrash2, FiRefreshCw
- **Formularios**: FiSearch, FiMail, FiEye, FiEyeOff, FiFilter
- **Warnings genéricos**: FiAlertTriangle en acciones destructivas, tareas atrasadas, validaciones de formulario — contextos NO clínicos
- **Contexto clínico general**: FiCalendar, FiClock, FiUsers, FiUser, FiActivity (en contextos no auditados)
- **Tareas / seguimientos**: FiClipboard para la bandeja de seguimiento de pacientes (no para atenciones)
- **Documentos genéricos**: FiFileText para consentimientos, documentos legales, plantillas de texto, portal de paciente
- **Layout**: FiMaximize, FiMinimize, FiGrid, FiList, FiSettings, FiSliders
- **Adjuntos**: FiPaperclip, FiImage, FiFile

### Glyphs que usan iconos de identidad Anamneo

Para superficies donde el ícono comunica **identidad clínica, confianza del sistema o alertas de seguridad del paciente**, usar el set propio de `@/components/icons`:

| Contexto | Usar |
|---|---|
| Workspace de atención (tabs, toolbar, panel) | `EncounterIcon` |
| Resumen clínico del encuentro | `EncounterIcon` |
| Quick actions de "atención clínica" | `EncounterIcon` |
| Nav "Atenciones", lista de fichas, timeline del paciente | `FichaIcon` |
| Búsqueda de atenciones (CommandPalette, MobileSearch, Sidebar) | `FichaIcon` |
| Badge de alergias GRAVE/FATAL en header del paciente | `ClinicalAlertIcon` |
| Lista de alergias cuando hay entradas (sección crítica) | `ClinicalAlertIcon` |
| Alergias en resumen clínico del encuentro | `ClinicalAlertIcon` |
| Alertas clínicas en ficha clínica (sección paciente) | `ClinicalAlertIcon` |
| Firma electrónica de atención | `ShieldIcon` |
| Paso 2FA en login | `ShieldIcon` |
| Consentimiento y revocación | `ShieldIcon` |
| Encabezados de sección de auditoría | `ActivityIcon` |
| Card de Auditoría en admin dashboard | `ActivityIcon` |
| Card de Solicitudes de derechos en admin | `ShieldIcon` |
| Inputs de contraseña en auth y 2FA | `LockIcon` |
| Atención firmada/bloqueada (lock badge) | `LockIcon` |

## Icons propios — `components/icons/`

### `EncounterIcon`
Estetoscopio minimalista: par de ear tips, arco binaural, tubo flexible y pieza de tórax. Representa el acto clínico de la atención — el encuentro médico entre profesional y paciente.

```tsx
import { EncounterIcon } from '@/components/icons';
<EncounterIcon className="h-4 w-4 text-accent-text" />
```

### `FichaIcon`
Documento con esquina doblada y cruz médica interior. Distingue el registro clínico (ficha, atención documentada) de documentos genéricos como consentimientos o plantillas de texto.

```tsx
import { FichaIcon } from '@/components/icons';
<FichaIcon className="h-5 w-5" />
```

### `ClinicalAlertIcon`
Triángulo de advertencia con cruz médica interior en lugar de exclamación. Señala una alerta de seguridad clínica (alergia GRAVE/FATAL, interacción crítica) con mayor peso visual que el triángulo genérico de Feather.

```tsx
import { ClinicalAlertIcon } from '@/components/icons';
<ClinicalAlertIcon className="h-4 w-4 text-status-red" />
```

### `ShieldIcon`
Escudo clínico con detalle de cruz interior. Distingue protección médica de escudo genérico de seguridad.

```tsx
import { ShieldIcon } from '@/components/icons';
<ShieldIcon className="h-6 w-6" />
```

### `LockIcon`
Candado con shackle redondeado y ojo de cerradura visible. Comunica confidencialidad en flujos de autenticación.

```tsx
import { LockIcon } from '@/components/icons';
<LockIcon className="h-5 w-5 text-ink-muted" />
```

### `ActivityIcon`
Forma de ECG (electrocardiograma) dentro de una ventana, sin eje Y visible. Más preciso que el chevron de pulso genérico de Feather para contextos de trazabilidad clínica.

```tsx
import { ActivityIcon } from '@/components/icons';
<ActivityIcon className="h-5 w-5" />
```

## Reglas de consistencia

1. **Tamaño**: Los iconos en botones y etiquetas van en `h-4 w-4` o `h-5 w-5`. Los iconos en encabezados de sección/hero van en `h-6 w-6`. Los iconos en ilustraciones vacías (`EmptyState`, banners) van en `h-6 w-6`.
2. **Stroke**: Todos los iconos del set propio usan `strokeWidth="1.5"` para alinearse con Feather.
3. **Accesibilidad**: Siempre `aria-hidden` en iconos decorativos (los del set propio lo hacen por defecto). Si el ícono es el único contenido visual de un botón, el padre debe tener `aria-label`.
4. **Color**: No hardcodear colores en el ícono. Usar `currentColor` (por defecto) y controlar el color con clases de texto del padre.
5. **No mezclar sets** en la misma superficie: si un bloque visual usa `EncounterIcon`, no poner `FiClipboard` al lado como si fueran equivalentes.
6. **Regla de identidad vs affordance**: un ícono de identidad va donde el glyph comunica QUÉ ES el sistema (atención, ficha, alerta clínica). Un ícono Feather va donde comunica QUÉ HACER (guardar, descargar, cerrar).
