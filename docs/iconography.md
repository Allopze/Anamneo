# Iconografía Anamneo

Fecha: 2026-05-29  
Estado: vigente — primera iteración de identidad propia.

## Diagnóstico

El frontend usa exclusivamente `react-icons/fi` (Feather). La librería está presente en **126 archivos** y cubre todas las superficies: auth, dashboard, pacientes, atenciones, portal, admin, catálogo y componentes comunes.

### Iconos de mayor frecuencia

| Icono | Usos | Rol |
|---|---:|---|
| FiPlus | 50 | Crear / añadir |
| FiAlertTriangle | 47 | Alertas clínicas / warnings |
| FiFileText | 46 | Documentos / ficha |
| FiShield | 44 | Seguridad / legal / consentimiento |
| FiX | 44 | Cerrar / descartar |
| FiArrowLeft | 39 | Volver |
| FiDownload | 32 | Exportar |
| FiSearch | 31 | Buscar |
| FiClipboard | 31 | Atenciones |
| FiUsers | 30 | Pacientes / usuarios |
| FiCheck | 30 | Confirmar |
| FiChevronRight | 29 | Disclosure / nav |
| FiAlertCircle | 26 | Info / error |
| FiCalendar | 25 | Agenda / fechas |
| FiClock | 24 | Tiempo / seguimientos |
| FiSave | 23 | Guardar |
| FiActivity | 17 | Auditoría / vitales |
| FiLock | 15 | Auth / seguridad |

## Política de uso

### Glyphs que permanecen en Feather (affordance estándar)

Feather comunica limpieza universal. Seguir usándolo para:

- **Navegación**: FiArrowLeft, FiChevronRight, FiChevronLeft, FiChevronDown, FiMenu, FiLogOut
- **Acciones**: FiPlus, FiX, FiCheck, FiSave, FiDownload, FiUpload, FiEdit, FiTrash2, FiRefreshCw
- **Formularios**: FiSearch, FiMail, FiEye, FiEyeOff, FiFilter
- **Estado**: FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiInfo, FiWifiOff
- **Contexto clínico general**: FiCalendar, FiClock, FiClipboard, FiFileText, FiUsers, FiUser, FiActivity (en contextos no auditados)
- **Layout**: FiMaximize, FiMinimize, FiGrid, FiList, FiSettings, FiSliders
- **Adjuntos**: FiPaperclip, FiImage, FiFile

### Glyphs que migran a iconos de identidad Anamneo

Para superficies donde el ícono comunica **confianza clínica, seguridad del sistema o identidad de marca**, usar el set propio de `@/components/icons`:

| Contexto | Usar |
|---|---|
| Firma electrónica de atención | `ShieldIcon` |
| Paso 2FA en login | `ShieldIcon` |
| Consentimiento y revocación | `ShieldIcon` |
| Encabezados de sección de auditoría | `ActivityIcon` |
| Card de Auditoría en admin dashboard | `ActivityIcon` |
| Card de Solicitudes de derechos en admin | `ShieldIcon` |
| Inputs de contraseña en auth y 2FA | `LockIcon` |
| Atención firmada/bloqueada (lock badge) | `LockIcon` |

## Icons propios — `components/icons/`

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
3. **Accesibilidad**: Siempre `aria-hidden="true"` en iconos decorativos. Si el ícono es el único contenido visual de un botón, el padre debe tener `aria-label`.
4. **Color**: No hardcodear colores en el ícono. Usar `currentColor` (por defecto) y controlar el color con clases de texto del padre.
5. **No mezclar sets** en la misma superficie: si una sección usa `ShieldIcon`, no usar `FiShield` en el mismo bloque visual.

## Pendientes de segunda pasada

- Evaluar `FiClipboard` en encabezados de atención (candidato a icono propio con estetoscopio o carpeta clínica).
- Evaluar `FiFileText` en ficha clínica (candidato a documento con cruz médica).
- Decidir si `FiAlertTriangle` en alertas críticas debe tener variante propia con gradiente visual de severidad.
- Revisar tamaños y pesos de stroke en uso con pantalla retina / 1x.
