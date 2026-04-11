# Propuesta de características (por rol)

Este documento es el backlog funcional del producto. Sirve para priorizar mejoras y discutir alcance; no debe leerse como manual operativo ni como promesa contractual de que todo lo listado ya existe, funciona perfecto o fue bendecido por la realidad.

El backlog se basa en lo que **ya existe en el código** del proyecto (módulos NestJS + Prisma + pantallas Next.js) y en huecos detectados durante auditorías recientes.

**Alcance**: funcionalidades clínicas y operativas. Infraestructura, base de datos, release y observabilidad viven en `docs/`.

## Leyenda (Estado)

- **[YA]**: ya existe (o existe parcialmente) y conviene pulir UX/permisos
- **[QW]**: quick win (principalmente UI/flujo; backend ya da soporte o requiere cambios mínimos)
- **[BE]**: requiere cambios backend (DTO/endpoint/reglas/DB)
- **[NEW]**: requiere un módulo nuevo (o cambios estructurales relevantes)

## Como leer este archivo

- Si necesitas operar el sistema o entender el comportamiento actual, revisa primero `README.md` y `docs/`.
- Si necesitas entender que conviene construir despues, este archivo si es el lugar correcto.
- Si una feature aparece como `[YA]`, igual conviene validar implementacion real y tests. La etiqueta no es una absolucion preventiva.

## Actualizaciones recientes (implementado)

- Edición de paciente por rol: médico (completo) / asistente (solo administrativo) + endpoint dedicado.
- Mensajes de error consistentes en pantallas clave con helper + componente UI.
- Timeline de atenciones en ficha de paciente con acciones rápidas.
- Catálogo de afecciones con importación CSV global (admin) y catálogo local por instancia (médico/asistente).
- Rol administrador disponible solo en primer registro (bootstrap).

---

## Médico/a (prioridad alta → baja)

1. **Borradores de atención por secciones** — Mantener atenciones “en progreso” visibles como borradores y reanudar desde la última sección completada. **Estado:** [YA]
2. **Cierre de atención con bloqueo** — Al “Completar”, bloquear edición de secciones salvo rol permitido y registrar responsable/fecha de cierre. **Estado:** [BE]
3. **Historial del paciente en línea de tiempo** — Ver atenciones + adjuntos + cambios de antecedentes en una sola vista cronológica. **Estado:** [YA]
4. **Sugeridor de afecciones en contexto** — Mejorar el sugeridor (resaltar coincidencias, explicar “por qué sugirió”, permitir “fijar” diagnóstico elegido). **Estado:** [YA]
5. **Diagnóstico elegido como dato clínico del encuentro** — Guardar el diagnóstico “final” dentro de la atención (no solo log de sugerencias). **Estado:** [BE]
6. **Vista “Ficha” de encuentro exportable** — Exportar/Imprimir ficha clínica consistente (PDF o HTML imprimible) desde la vista existente. **Estado:** [QW]
7. **Atajos y plantillas de texto (SOAP, control crónico, etc.)** — Plantillas reutilizables por médico para acelerar documentación. **Estado:** [NEW]
8. **Adjuntos con previsualización segura** — Previsualizar imágenes/PDF desde la atención, con control de acceso estricto y expiración de links. **Estado:** [BE]
9. **Comparación entre versiones de una sección** — Ver “qué cambió” entre guardados de una sección (útil para auditoría clínica). **Estado:** [BE]
10. **Búsqueda avanzada de pacientes** — Filtros por edad/sexo/previsión/fecha última atención y ordenamientos clínicos. **Estado:** [BE]
11. **Alertas clínicas suaves** — Recordatorios no intrusivos (ej. alergias, hábitos, antecedentes relevantes) visibles al abrir una atención. **Estado:** [NEW]
12. **Panel de pendientes** — Atenciones abiertas, secciones incompletas, adjuntos sin revisar, sugerencias sin confirmar. **Estado:** [NEW]

---

## Asistente (prioridad alta → baja)

1. **Alta rápida de paciente (modo recepción)** — Formulario mínimo + validación de duplicados (RUT u otros) y luego completar datos. **Estado:** [QW]
2. **Edición “solo administrativa” de ficha** — Permitir actualizar domicilio/trabajo/previsión/edad/sexo sin tocar contenido clínico. **Estado:** [YA]
3. **Carga de antecedentes (flujo guiado)** — Un flujo de antecedentes con checklist y validaciones para evitar campos incompletos. **Estado:** [YA]
4. **Creación de atención “preparada” para el médico** — Crear atención en estado en progreso, cargar adjuntos y dejar lista para completar. **Estado:** [QW]
5. **Clasificación de adjuntos** — Etiquetar adjuntos (tipo, fecha del examen, origen) y ordenarlos en la atención. **Estado:** [BE]
6. **Búsqueda por criterios administrativos** — Buscar por previsión, rango etario, estado RUT exento, etc. **Estado:** [BE]
7. **Marcado de tareas del paciente** — “Falta documento”, “traer examen”, “pendiente firma consentimiento”. **Estado:** [NEW]
8. **Derivación interna / reasignación de médico** — Cambiar médico responsable del paciente con motivo y registro. **Estado:** [BE]
9. **Checklist pre-consulta** — Confirmación de datos + adjuntos + antecedentes antes de pasar a consulta. **Estado:** [NEW]

---

## Admin (prioridad alta → baja)

1. **Gestión completa de usuarios** — Crear/editar/desactivar usuarios, asignar rol y relación asistente→médico desde UI admin. **Estado:** [YA]
2. **Bootstrap de administrador** — Permitir un rol de administrador solo cuando no existen usuarios registrados. **Estado:** [YA]
2. **Reset de contraseña + política mínima** — Reset administrado, invalidación de refresh tokens/sesiones y reglas de complejidad. **Estado:** [BE]
3. **Auditoría central filtrable** — Búsqueda por entidad/usuario/acción/fecha con detalle legible del diff. **Estado:** [YA]
4. **Catálogo de afecciones: gobierno del dato** — Activar/desactivar, sinónimos/tags, evitar duplicados, historial de cambios. **Estado:** [YA]
5. **Importación CSV global de afecciones** — Carga masiva inicial del catálogo global por admin. **Estado:** [YA]
6. **Catálogo local por instancia** — Médicos/asistentes pueden crear/editar/ocultar afecciones sin afectar el global. **Estado:** [YA]
5. **Permisos más consistentes por rol** — Revisar endpoints “solo autenticado” y aplicar reglas uniformes (médico efectivo vs admin). **Estado:** [BE]
6. **Permisos finos por acción** — Matriz “quién puede editar qué” (ej. asistente puede editar datos administrativos pero no plan terapéutico). **Estado:** [NEW]
7. **Herramientas de saneamiento seguras** — Reemplazar scripts destructivos por acciones admin con confirmación, limitaciones y auditoría. **Estado:** [BE]
8. **Exportación de datos (operativa)** — Exportar pacientes/atenciones por rango de fechas y médico para soporte administrativo. **Estado:** [BE]
9. **Configuración de secciones del encuentro** — Habilitar/deshabilitar secciones, nombres, orden, campos obligatorios. **Estado:** [NEW]

---

## “Quick wins” transversales (alto impacto, baja fricción)

1. **Ruta de edición de paciente en UI** — Falta una pantalla dedicada de edición (ya hay intención de link). **Estado:** [YA]
2. **Mensajes de error consistentes** — Normalizar errores de API (validación/403/404) y mostrarlos con UX consistente. **Estado:** [YA]
3. **Mejoras de permisos en frontend** — Ocultar/mostrar acciones según `isMedico/isAdmin` y capacidades reales. **Estado:** [YA]
4. **Acciones rápidas** — Botones “Nueva atención”, “Adjuntar archivo”, “Ver ficha imprimible” en vistas clave. **Estado:** [QW]

---

## Notas de alineación con el código actual

- El sistema ya tiene módulos claros: pacientes, atenciones (encounters), catálogo de afecciones (conditions), adjuntos (attachments), usuarios/auth y auditoría.
- Muchas mejoras pueden implementarse como **pulido de flujo/UI** apoyándose en endpoints existentes; las marcadas [BE]/[NEW] requieren acordar reglas de negocio antes.
