# Design Tokens — Anamneo Visual Refresh

Este documento es la referencia viva del sistema visual actual. No es un souvenir del refactor UI: si cambian tokens semanticos, radios, escalas o sombras, el cambio deberia reflejarse aqui y en el codigo.

Contexto relacionado:

- arquitectura frontend: `frontend-architecture.md`
- material historico del refactor: `archive/ui/`

## Paleta de Colores

```
// Superficies
surface-base:       #EBE9E4   // Fondo principal de la app
surface-elevated:   #FDFCFB   // Cards y superficies elevadas
surface-muted:      #E5E4E0   // Areas inactivas, separadores tonales
surface-inset:      #F5F4F0   // Inputs, campos de formulario

// Frame
frame:              #404040   // Barra oscura, shell exterior
frame-dark:         #2B2B2B   // Hover profundo y acciones primarias

// Texto
ink-primary:        #2B2B2B   // Texto principal
ink-secondary:      #555555   // Texto secundario
ink-muted:          #767676   // Texto deshabilitado/sutil
ink-on-dark:        #FFFFFF   // Texto sobre fondos oscuros

// Acento
accent-lime:        #EAF832   // Acento principal (hitos, highlights)
accent-lime-bright: #F3FE48   // Hover/focus del acento
accent-lime-text:   #2B2B2B   // Texto sobre fondo lime

// Chips y controles
chip-dark:          #555555   // Chips con fondo oscuro
chip-dark-hover:    #404040   // Hover de chip oscuro
chart-gray:         #666666   // Lineas y ejes de charts

// Estado
status-red:         #D08C84   // Error / alertas suaves
status-yellow:      #E5D86A   // Warning suave
status-green:       #96B38A   // Éxito / positivo suave
status-red-text:    #7F1D1D   // Texto rojo para contraste
status-green-text:  #1A5D38   // Texto verde para contraste
auth-teal:          #0D9488   // Acento operativo usado por auth y portal
```

## Radios de Borde

```
radius-shell:    28px   // Shell exterior de la app
radius-card:     16px   // Cards clinicas, portal y estados
radius-input:    999px  // Inputs de formulario actuales
radius-pill:     999px  // Tabs, chips, botones pill
radius-button:   999px  // Botones regulares actuales
radius-icon-btn: 999px  // Botones circulares de icono
radius-small:    16px   // Elementos pequenos (badges, tags)
```

## Tipografía

```
font-family:      'Inter', system-ui, sans-serif
font-size-hero:    2rem      (32px)  // Títulos de página
font-size-heading: 1.25rem   (20px)  // Headings de sección
font-size-metric:  1.75rem   (28px)  // Cifras clínicas grandes  
font-size-body:    0.9375rem (15px)  // Texto general
font-size-label:   0.8125rem (13px)  // Labels, captions
font-size-small:   0.75rem   (12px)  // Micro-labels
font-weight-normal: 400
font-weight-medium: 500
font-weight-semibold: 600
font-weight-bold:  700
```

## Espaciado

```
space-xs:   4px
space-sm:   8px
space-md:   12px
space-lg:   16px
space-xl:   24px
space-2xl:  32px
space-3xl:  40px
space-4xl:  48px
```

## Sombras

```
shadow-none:     none
shadow-soft:     0 1px 4px rgba(43, 43, 43, 0.04)
shadow-card:     0 4px 14px rgba(43, 43, 43, 0.05)
shadow-elevated: 0 8px 22px rgba(43, 43, 43, 0.07)
shadow-dropdown: 0 14px 32px rgba(43, 43, 43, 0.10)
```

## Transiciones

```
ease-out:        cubic-bezier(0.23, 1, 0.32, 1)
ease-in-out:     cubic-bezier(0.77, 0, 0.175, 1)
transition-fast:   150ms var(--ease-out)
transition-normal: 200ms var(--ease-out)
transition-slow:   300ms var(--ease-out)
```
