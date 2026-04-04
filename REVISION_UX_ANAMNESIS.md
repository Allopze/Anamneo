# Revisión UX — Flujo de Anamnesis

> Revisión del flujo completo: dashboard → búsqueda de paciente → creación de atención → wizard de 10 secciones → cierre.  
> Fecha: 4 de abril de 2026

---

## Lo que funciona bien

1. **Estructura semiológica correcta**: El orden de las secciones sigue la lógica clínica clásica (Identificación → Motivo de consulta → Anamnesis próxima → Anamnesis remota → Revisión por sistemas → Examen físico → Sospecha diagnóstica → Tratamiento → Respuesta → Observaciones). Un médico no se perdería.

2. **Autosave + borradores locales**: El autoguardado cada 10 s y la persistencia de borradores es crítica — un doctor que pierde datos en medio de una consulta abandona el sistema.

3. **Dictado por voz** (`VoiceDictationButton`): Excelente decisión. Los médicos dictan más rápido de lo que escriben.

4. **Snapshot de antecedentes remotos**: El patrón de cargar la anamnesis remota desde el historial del paciente (con opción de desvincular) evita re-tipeo y es clínicamente correcto.

5. **Sugerencia automática de afección** en Motivo de consulta: Clasificar CIE/diagnóstico desde texto libre es un buen approach.

---

## Problemas y oportunidades de mejora

### 1. El wizard de secciones fuerza un orden secuencial innecesario

**Archivo**: `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`

El botón "Siguiente y completar" marca la sección como completa al avanzar. Pero un médico real **no llena las secciones en orden**:

- Puede empezar por signos vitales (los toma la enfermera antes).
- Puede saltarse "Revisión por sistemas" si no aplica.
- Puede volver a "Motivo de consulta" después de hacer el examen físico.

La navegación lateral (rail de secciones) existe, pero el énfasis visual en "Anterior/Siguiente" sugiere un flujo lineal.

**Recomendaciones:**

- Hacer el rail de secciones más prominente.
- Eliminar la marca automática de "completar" al avanzar y dejar eso como acción explícita.
- Permitir marcar secciones como "No aplica" (ej: ginecología en paciente masculino).

---

### 2. La sección "Revisión por sistemas" es tediosa

**Archivo**: `frontend/src/components/sections/RevisionSistemasSection.tsx`

Son 12 sistemas con checkbox + textarea. En la práctica:

- La mayoría de los sistemas serán negativos.
- Sería más rápido un toggle **"Nada que reportar" / "Todo negativo excepto:"** para colapsar la lista.
- Los sistemas positivos deberían poder expandirse rápido con vocabulario sugerido (ej: al marcar "Respiratorio" → sugerir "tos seca, tos productiva, disnea, sibilancias…").

---

### 3. El examen físico no tiene estructura suficiente para signos vitales

**Archivo**: `frontend/src/components/sections/ExamenFisicoSection.tsx`

Los signos vitales son inputs planos. Falta:

- **Alertas de rangos anormales** (PA > 140/90, FC > 100, SatO₂ < 92, T° > 38). El IMC tiene interpretación, pero los otros signos vitales no.
- **Estado general** como campo explícito (Buen/Regular/Mal estado general, Glasgow si aplica).
- Los signos vitales deberían poder ser pre-cargados si la enfermera ya los ingresó.

---

### 4. Sospecha diagnóstica no conecta con la afección sugerida en Motivo de consulta

**Archivos**: `MotivoConsultaSection.tsx` / `SospechaDiagnosticaSection.tsx`

En Motivo de consulta el sistema sugiere una `afeccionSeleccionada`, pero en Sospecha diagnóstica la lista de sospechas empieza vacía.

**Recomendaciones:**

- Pre-cargar la afección seleccionada como primera sospecha diagnóstica.
- Ofrecer autocompletado con catálogo CIE/diagnóstico en el campo de texto de sospechas.

---

### 5. Tratamiento: la receta en texto libre es un riesgo

**Archivo**: `frontend/src/components/sections/TratamientoSection.tsx`

Hay texto libre + medicamentos estructurados. El problema es que ambos coexisten sin jerarquía. Un doctor va a escribir en texto libre y **nunca usar los estructurados** porque es más rápido.

**Recomendaciones:**

- Hacer los medicamentos estructurados el mecanismo principal, con autocompletado de nombre de fármaco.
- Generar el texto libre automáticamente desde los estructurados (como preview).
- Agregar campo de "vía de administración" (oral, IV, IM, tópica).

---

### 6. Nota de cierre obligatoria con 15 caracteres mínimo es molesta

**Archivo**: `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` — `CLOSURE_NOTE_MIN_LENGTH = 15`

En una consulta de control rutinario, esto se siente como burocracia.

**Recomendaciones:**

- Generar automáticamente una nota de cierre desde el resumen clínico generado.
- Hacer la nota opcional si el resumen generado ya existe.

---

### 7. No hay indicador de tiempo transcurrido

Un médico necesita saber cuánto lleva la consulta para gestionar su carga. No hay un timer visible ni duración estimada de cada sección. Especialmente útil para auditoría y facturación.

---

### 8. El panel derecho está muy cargado

El `secondaryColumn` tiene: Revisión Clínica + Resumen Generado + Adjuntos + Antecedentes + Seguimiento Rápido + Cierre + Trazabilidad. Esto es demasiado para una sidebar.

Un doctor en consulta necesita:

- En la sidebar: solo navegación de secciones + acciones primarias.
- Los adjuntos, revisión y trazabilidad deberían ser tabs o secciones colapsables.

---

### 9. Mobile es un ciudadano de segunda clase

En mobile, las secciones se muestran como `<select>` dropdown en lugar del rail visual. Pero un doctor con tablet (muy común) necesita una experiencia intermedia — el dropdown no muestra estado de completitud ni permite saltar rápido.

---

## Resumen priorizado

| Prioridad | Cambio | Impacto |
|-----------|--------|---------|
| **Alta** | Alertas de rangos anormales en signos vitales | Seguridad clínica |
| **Alta** | Pre-cargar sospecha diagnóstica desde motivo de consulta | Reduce doble trabajo |
| **Alta** | Toggle "Nada que reportar" en Revisión por sistemas | Velocidad de llenado |
| **Media** | Hacer medicamentos estructurados el mecanismo principal | Calidad de datos |
| **Media** | Desenfatizar flujo secuencial, enfatizar navegación libre | UX clínica realista |
| **Media** | Colapsar panel derecho en tabs | Reducir sobrecarga visual |
| **Baja** | Timer de consulta | Gestión de carga |
| **Baja** | "No aplica" por sección | Flexibilidad |
| **Baja** | Auto-generar nota de cierre | Reducir fricción |
