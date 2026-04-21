# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workflow-clinical.spec.ts >> Clinical flow: patient → encounter → sections >> complete and sign encounter clinically
- Location: tests/e2e/workflow-clinical.spec.ts:413:7

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /agregar medicamento/i })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - link "Saltar al contenido" [ref=e3] [cursor=pointer]:
      - /url: "#main-content"
    - generic [ref=e4]:
      - generic [ref=e5]:
        - button "Contraer barra lateral" [expanded] [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: «
        - complementary [ref=e8]:
          - link "Inicio — Anamneo" [ref=e10] [cursor=pointer]:
            - /url: /
            - generic [ref=e13]: Anamneo
          - generic [ref=e15]:
            - generic [ref=e16]: P
            - generic [ref=e17]:
              - paragraph [ref=e18]: Dra. Prueba E2E
              - paragraph [ref=e19]: Médico
          - generic [ref=e21]:
            - img [ref=e22]
            - combobox "Buscar pacientes y atenciones" [ref=e25]
          - navigation "Navegación principal" [ref=e26]:
            - link "Inicio" [ref=e27] [cursor=pointer]:
              - /url: /
              - img [ref=e29]
              - text: Inicio
            - link "Pacientes" [ref=e32] [cursor=pointer]:
              - /url: /pacientes
              - img [ref=e34]
              - text: Pacientes
            - link "Atenciones" [ref=e39] [cursor=pointer]:
              - /url: /atenciones
              - img [ref=e41]
              - text: Atenciones
            - link "Seguimientos" [ref=e44] [cursor=pointer]:
              - /url: /seguimientos
              - img [ref=e46]
              - text: Seguimientos
            - link "Analítica clínica" [ref=e49] [cursor=pointer]:
              - /url: /analitica-clinica
              - img [ref=e51]
              - text: Analítica clínica
            - link "Catálogo" [ref=e54] [cursor=pointer]:
              - /url: /catalogo
              - img [ref=e56]
              - text: Catálogo
            - link "Plantillas" [ref=e57] [cursor=pointer]:
              - /url: /plantillas
              - img [ref=e59]
              - text: Plantillas
            - link "Ajustes" [ref=e61] [cursor=pointer]:
              - /url: /ajustes
              - img [ref=e63]
              - text: Ajustes
          - button "Salir" [ref=e67] [cursor=pointer]:
            - img [ref=e68]
            - text: Salir
      - main [ref=e73]:
        - generic [ref=e74]:
          - generic [ref=e77]:
            - generic:
              - generic:
                - link "Volver al paciente" [ref=e78] [cursor=pointer]:
                  - /url: /pacientes/298a9291-3b68-4251-891e-a69852d064ca
                  - img [ref=e79]
                - generic:
                  - generic:
                    - generic [ref=e81]: Atención
                    - generic [ref=e82]: 12.345.678-5
                    - generic [ref=e83]: 21-04-2026, 8:52 p. m.
                    - generic [ref=e84]:
                      - img [ref=e85]
                      - text: 1 min
                  - heading "María Eugenia Flores Tapia" [level=1]
                  - generic:
                    - generic [ref=e88]: 45 años 10m
                    - generic [ref=e89]: FEMENINO
                    - generic [ref=e90]: FONASA
                  - generic:
                    - generic:
                      - generic [ref=e91]: Progreso de la atención
                      - generic [ref=e92]: 4/10 secciones
            - generic [ref=e93]:
              - status [ref=e94]:
                - img [ref=e95]
                - text: Guardado a las 08:52 p. m.
              - button "Guardar Ahora" [disabled] [ref=e99]:
                - img [ref=e100]
                - text: Guardar Ahora
              - button "Ficha Clínica" [ref=e104] [cursor=pointer]:
                - img [ref=e105]
                - text: Ficha Clínica
              - button "Finalizar Atención" [ref=e108] [cursor=pointer]:
                - img [ref=e109]
                - text: Finalizar Atención
              - 'button "Estado de revisión: Sin revisión pendiente. Abrir panel de revisión" [ref=e111] [cursor=pointer]':
                - img [ref=e112]
                - generic [ref=e114]: Sin revisión pendiente
              - button "Abrir panel lateral con revisión, apoyo, cierre e historial" [ref=e115] [cursor=pointer]:
                - img [ref=e116]
                - generic [ref=e118]: Panel lateral
          - generic [ref=e119]:
            - complementary [ref=e120]:
              - generic [ref=e122]:
                - generic [ref=e124]:
                  - heading "Secciones" [level=2] [ref=e125]
                  - generic [ref=e126]: 4/10
                - navigation "Secciones de la atención" [ref=e129]:
                  - generic [ref=e130]:
                    - button "4 completas" [expanded] [ref=e131] [cursor=pointer]:
                      - img [ref=e133]
                      - generic [ref=e135]: 4 completas
                      - img [ref=e136]
                    - generic [ref=e140]:
                      - button "Identificación del paciente Completa" [ref=e141] [cursor=pointer]:
                        - img [ref=e143]
                        - generic [ref=e145]:
                          - generic [ref=e146]: Identificación del paciente
                          - generic [ref=e147]: Completa
                      - button "Motivo de consulta Completa" [ref=e149] [cursor=pointer]:
                        - img [ref=e151]
                        - generic [ref=e153]:
                          - generic [ref=e154]: Motivo de consulta
                          - generic [ref=e155]: Completa
                      - button "Examen físico Completa" [ref=e157] [cursor=pointer]:
                        - img [ref=e159]
                        - generic [ref=e161]:
                          - generic [ref=e162]: Examen físico
                          - generic [ref=e163]: Completa
                      - button "Sospecha diagnóstica Completa" [ref=e165] [cursor=pointer]:
                        - img [ref=e167]
                        - generic [ref=e169]:
                          - generic [ref=e170]: Sospecha diagnóstica
                          - generic [ref=e171]: Completa
                  - button "3 Anamnesis próxima" [ref=e173] [cursor=pointer]:
                    - generic [ref=e174]: "3"
                    - generic [ref=e176]: Anamnesis próxima
                  - button "4 Anamnesis remota" [ref=e177] [cursor=pointer]:
                    - generic [ref=e178]: "4"
                    - generic [ref=e180]: Anamnesis remota
                  - button "5 Revisión por sistemas" [ref=e181] [cursor=pointer]:
                    - generic [ref=e182]: "5"
                    - generic [ref=e184]: Revisión por sistemas
                  - button "8 Tratamiento" [ref=e185] [cursor=pointer]:
                    - generic [ref=e186]: "8"
                    - generic [ref=e188]: Tratamiento
                  - button "9 Respuesta al tratamiento" [ref=e189] [cursor=pointer]:
                    - generic [ref=e190]: "9"
                    - generic [ref=e192]: Respuesta al tratamiento
                  - button "10 Observaciones" [ref=e193] [cursor=pointer]:
                    - generic [ref=e194]: "10"
                    - generic [ref=e196]: Observaciones
                - button "Colapsar barra lateral" [ref=e198] [cursor=pointer]:
                  - img [ref=e199]
                  - generic [ref=e202]: Colapsar
            - main [ref=e203]:
              - generic [ref=e205]:
                - generic [ref=e208]:
                  - generic [ref=e210]: Sección 8 de 10
                  - heading "Tratamiento" [level=2] [ref=e211]
                - generic [ref=e214]:
                  - generic [ref=e215]:
                    - heading "Plan e indicaciones" [level=3] [ref=e218]
                    - generic [ref=e220]:
                      - generic [ref=e221]:
                        - generic [ref=e222]: Plan de tratamiento e indicaciones
                        - button "Dictado" [ref=e223] [cursor=pointer]:
                          - img [ref=e224]
                          - text: Dictado
                      - textbox [ref=e227]
                  - generic [ref=e228]:
                    - heading "Medicamentos" [level=3] [ref=e231]
                    - generic [ref=e234]:
                      - generic [ref=e235]:
                        - img [ref=e236]
                        - textbox "Buscar medicamento del catálogo..." [ref=e239]
                      - button "Agregar manual" [ref=e240] [cursor=pointer]:
                        - img [ref=e241]
                        - text: Agregar manual
                    - generic [ref=e242]:
                      - generic [ref=e243]:
                        - generic [ref=e244]: Notas adicionales de receta (texto libre)
                        - button "Dictado" [ref=e245] [cursor=pointer]:
                          - img [ref=e246]
                          - text: Dictado
                      - textbox "Indicaciones adicionales que no encajen en los campos estructurados…" [ref=e249]
                  - generic [ref=e250]:
                    - heading "Exámenes solicitados" [level=3] [ref=e253]
                    - generic [ref=e254]:
                      - generic [ref=e255]: Exámenes solicitados
                      - button "Dictado" [ref=e256] [cursor=pointer]:
                        - img [ref=e257]
                        - text: Dictado
                    - textbox "Hemograma, perfil bioquímico, radiografía..." [ref=e260]
                    - button "Agregar examen estructurado" [ref=e262] [cursor=pointer]:
                      - img [ref=e263]
                      - text: Agregar examen estructurado
                  - generic [ref=e264]:
                    - heading "Derivaciones" [level=3] [ref=e267]
                    - generic [ref=e268]:
                      - generic [ref=e269]: Derivaciones
                      - button "Dictado" [ref=e270] [cursor=pointer]:
                        - img [ref=e271]
                        - text: Dictado
                    - textbox "Especialista, motivo de derivación..." [ref=e274]
                    - button "Agregar derivación estructurada" [ref=e276] [cursor=pointer]:
                      - img [ref=e277]
                      - text: Agregar derivación estructurada
                - generic [ref=e279]:
                  - button "Anterior" [ref=e280] [cursor=pointer]:
                    - img [ref=e281]
                    - text: Anterior
                  - button "Siguiente" [active] [ref=e284] [cursor=pointer]:
                    - text: Siguiente
                    - img [ref=e285]
  - alert [ref=e287]
```

# Test source

```ts
  330 |       (response) =>
  331 |         response.url().includes('/api/encounters/')
  332 |         && response.url().includes('/export/document/receta')
  333 |         && response.request().method() === 'GET',
  334 |     );
  335 |     await page.getByRole('button', { name: 'Receta' }).click();
  336 |     const recetaResponse = await recetaResponsePromise;
  337 |     expect(recetaResponse.status(), await recetaResponse.text()).toBe(200);
  338 |   });
  339 | 
  340 |   test('deletes an attachment and keeps it out of the ficha clinica', async ({ page }) => {
  341 |     test.setTimeout(60_000);
  342 |     await loginAsMedico(page);
  343 |     await openEncounter(page);
  344 | 
  345 |     const drawer = await openDrawerTab(page, 'Apoyo');
  346 |     await drawer.getByRole('button', { name: 'Adjuntos de la Atención' }).click();
  347 |     await drawer.getByRole('button', { name: 'Cerrar panel' }).click();
  348 | 
  349 |     const attachmentsDialog = page.getByRole('dialog', { name: 'Adjuntos de la atención' });
  350 |     await expect(attachmentsDialog).toBeVisible({ timeout: 5000 });
  351 |     await expect(attachmentsDialog.getByText('resultado-laboratorio-e2e.pdf')).toBeVisible({ timeout: 10000 });
  352 | 
  353 |     await attachmentsDialog
  354 |       .locator('li')
  355 |       .filter({ hasText: 'resultado-laboratorio-e2e.pdf' })
  356 |       .getByRole('button', { name: 'Eliminar' })
  357 |       .click();
  358 |     await expect(attachmentsDialog.getByText(/Vas a eliminar resultado-laboratorio-e2e\.pdf/i)).toBeVisible({ timeout: 5000 });
  359 | 
  360 |     const deleteResponsePromise = page.waitForResponse(
  361 |       (response) => response.url().includes('/attachments/') && response.request().method() === 'DELETE',
  362 |     );
  363 |     await attachmentsDialog.getByRole('button', { name: 'Confirmar eliminación' }).click();
  364 |     const deleteResponse = await deleteResponsePromise;
  365 |     expect(deleteResponse.status(), await deleteResponse.text()).toBe(200);
  366 | 
  367 |     await expect(attachmentsDialog.getByText('resultado-laboratorio-e2e.pdf')).toHaveCount(0);
  368 |     await expect(attachmentsDialog.getByText('No hay archivos adjuntos.')).toBeVisible({ timeout: 10000 });
  369 |     await attachmentsDialog.getByRole('button', { name: 'Cerrar adjuntos' }).click({ force: true });
  370 | 
  371 |     await page.getByRole('button', { name: 'Ficha Clínica' }).click();
  372 |     await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+\/ficha$/, { timeout: 15000 });
  373 |     await expect(page.getByText('resultado-laboratorio-e2e.pdf')).toHaveCount(0);
  374 |   });
  375 | 
  376 |   test('refreshes the wizard with the latest server section when another tab wins a save conflict', async ({ browser, page }) => {
  377 |     test.setTimeout(90_000);
  378 |     await loginAsMedico(page);
  379 |     await openEncounter(page);
  380 |     await goToSection(page, 'Observaciones');
  381 | 
  382 |     const firstTabNotes = page.getByPlaceholder('Cualquier observación adicional relevante para el registro...');
  383 |     await expect(firstTabNotes).toBeVisible({ timeout: 10000 });
  384 | 
  385 |     const secondContext = await browser.newContext();
  386 |     try {
  387 |       await secondContext.addCookies(medicoAuthCookies);
  388 |       const secondPage = await secondContext.newPage();
  389 | 
  390 |       await secondPage.goto(encounterPath);
  391 |       await expect(secondPage).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/);
  392 |       await goToSection(secondPage, 'Observaciones');
  393 | 
  394 |       const secondTabNotes = secondPage.getByPlaceholder('Cualquier observación adicional relevante para el registro...');
  395 |       await secondTabNotes.fill('Observación persistida desde la segunda pestaña.');
  396 |       await secondPage.getByRole('button', { name: 'Guardar Ahora' }).click();
  397 |       await expect(
  398 |         secondPage.getByRole('status').filter({ hasText: /cambios guardados|guardado a las|sin cambios/i }),
  399 |       ).toBeVisible({ timeout: 10000 });
  400 | 
  401 |       await firstTabNotes.fill('Observación local stale desde la primera pestaña.');
  402 |       await page.getByRole('button', { name: 'Guardar Ahora' }).click();
  403 | 
  404 |       await expect(page.getByText('La copia local quedó protegida y lista para comparar.')).toBeVisible({
  405 |         timeout: 10000,
  406 |       });
  407 |       await expect(firstTabNotes).toHaveValue('Observación persistida desde la segunda pestaña.', { timeout: 10000 });
  408 |     } finally {
  409 |       await secondContext.close();
  410 |     }
  411 |   });
  412 | 
  413 |   test('complete and sign encounter clinically', async ({ page }, testInfo) => {
  414 |     test.setTimeout(90_000);
  415 |     const warningMonitor = createRouterWarningMonitor(page);
  416 | 
  417 |     try {
  418 |       await loginAsMedico(page);
  419 |       await openEncounter(page);
  420 | 
  421 |       await goToSection(page, 'Examen físico');
  422 |       await page.getByPlaceholder('120/80').fill('120/80');
  423 |       await completeVisibleSection(page, 'Sospecha diagnóstica');
  424 | 
  425 |       await page.getByRole('button', { name: /agregar sospecha diagnóstica/i }).click();
  426 |       const diagnosisInput = page.getByPlaceholder('Diagnóstico sospechado...');
  427 |       await diagnosisInput.fill('Apendicitis aguda probable');
  428 |       await completeVisibleSection(page, 'Tratamiento');
  429 | 
> 430 |       await page.getByRole('button', { name: /agregar medicamento/i }).click();
      |                                                                        ^ Error: locator.click: Test timeout of 90000ms exceeded.
  431 |       await page.getByPlaceholder('Medicamento').fill('Paracetamol');
  432 |       await completeVisibleSection(page, 'Respuesta al tratamiento');
  433 | 
  434 |       const drawer = await openDrawerTab(page, 'Cierre');
  435 |       await drawer.locator('#drawer-closure-note').fill(
  436 |         'Paciente estable al cierre. Se indican analgésicos, control y reevaluación precoz ante signos de alarma.',
  437 |       );
  438 |       await drawer.getByRole('button', { name: 'Cerrar panel' }).click();
  439 | 
  440 |       await page.getByRole('button', { name: 'Finalizar Atención' }).click();
  441 |       const completionDialog = page.getByRole('alertdialog', { name: 'Finalizar atención' });
  442 |       await expect(completionDialog).toBeVisible({ timeout: 5000 });
  443 |       await completionDialog.getByRole('button', { name: 'Finalizar atención' }).click();
  444 | 
  445 |       await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+\/ficha$/, { timeout: 15000 });
  446 |       await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toHaveCount(0);
  447 |       await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveCount(0);
  448 |       await expect(page.getByRole('button', { name: 'Firmar Atención' })).toBeVisible({ timeout: 10000 });
  449 | 
  450 |       await page.getByRole('button', { name: 'Firmar Atención' }).click();
  451 |       const signDialog = page.getByRole('dialog');
  452 |       await expect(page.getByRole('heading', { name: 'Firma Electrónica Simple' })).toBeVisible({ timeout: 5000 });
  453 |       await page.getByLabel('Contraseña de su cuenta').fill(MEDICO_PASSWORD);
  454 |       await signDialog.getByRole('button', { name: 'Firmar Atención' }).click();
  455 | 
  456 |       await expect(page.getByText('Firmada', { exact: true })).toBeVisible({ timeout: 10000 });
  457 |       await expect(page.getByText('Atención firmada electrónicamente')).toBeVisible({ timeout: 10000 });
  458 |     } finally {
  459 |       warningMonitor.detach();
  460 |       const warningBody = warningMonitor.warnings.length
  461 |         ? warningMonitor.warnings.join('\n')
  462 |         : 'No router initialization warnings observed in this run.';
  463 |       testInfo.annotations.push({
  464 |         type: 'router-init-warning-count',
  465 |         description: String(warningMonitor.warnings.length),
  466 |       });
  467 |       await testInfo.attach('router-init-warning-monitor.txt', {
  468 |         body: warningBody,
  469 |         contentType: 'text/plain',
  470 |       });
  471 |     }
  472 |   });
  473 | });
  474 | 
```