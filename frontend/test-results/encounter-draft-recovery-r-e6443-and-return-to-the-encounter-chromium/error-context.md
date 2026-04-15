# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: encounter-draft-recovery.spec.ts >> recovers the local draft after 401, login and return to the encounter
- Location: tests/e2e/encounter-draft-recovery.spec.ts:72:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Paciente Demo')
Expected: visible
Error: strict mode violation: getByText('Paciente Demo') resolved to 2 elements:
    1) <h1 class="mt-1 truncate text-[1.75rem] font-extrabold tracking-tight text-ink lg:text-[2rem]">Paciente Demo</h1> aka getByRole('heading', { name: 'Paciente Demo' })
    2) <p class="mt-1 min-h-[44px] rounded-input border border-surface-muted/30 bg-surface-base/40 px-5 py-3 text-sm text-ink">Paciente Demo</p> aka getByRole('paragraph').filter({ hasText: 'Paciente Demo' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Paciente Demo')
    - locator resolved to <h1 class="mt-1 truncate text-[1.75rem] font-extrabold tracking-tight text-ink lg:text-[2rem]">Paciente Demo</h1>
    - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "Saltar al contenido" [ref=e3] [cursor=pointer]:
      - /url: "#main-content"
    - generic [ref=e4]:
      - complementary [ref=e5]:
        - link "Inicio — Anamneo" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e10]: Anamneo
        - generic [ref=e12]:
          - generic [ref=e13]: R
          - generic [ref=e14]:
            - paragraph [ref=e15]: Dra. Rivera
            - paragraph [ref=e16]: Médico
        - generic [ref=e18]:
          - img [ref=e19]
          - combobox "Buscar pacientes y atenciones" [ref=e22]
        - navigation "Navegación principal" [ref=e23]:
          - link "Inicio" [ref=e24] [cursor=pointer]:
            - /url: /
            - img [ref=e25]
            - text: Inicio
          - link "Pacientes" [ref=e28] [cursor=pointer]:
            - /url: /pacientes
            - img [ref=e29]
            - text: Pacientes
          - link "Atenciones" [ref=e34] [cursor=pointer]:
            - /url: /atenciones
            - img [ref=e35]
            - text: Atenciones
          - link "Seguimientos" [ref=e38] [cursor=pointer]:
            - /url: /seguimientos
            - img [ref=e39]
            - text: Seguimientos
          - link "Catálogo" [ref=e43] [cursor=pointer]:
            - /url: /catalogo
            - img [ref=e44]
            - text: Catálogo
          - link "Plantillas" [ref=e45] [cursor=pointer]:
            - /url: /plantillas
            - img [ref=e46]
            - text: Plantillas
          - link "Ajustes" [ref=e48] [cursor=pointer]:
            - /url: /ajustes
            - img [ref=e49]
            - text: Ajustes
        - button "Salir" [ref=e53] [cursor=pointer]:
          - img [ref=e54]
          - text: Salir
      - main [ref=e58]:
        - generic [ref=e59]:
          - generic [ref=e62]:
            - generic:
              - generic:
                - link "Volver al paciente" [ref=e63] [cursor=pointer]:
                  - /url: /pacientes/patient-1
                  - img [ref=e64]
                - generic:
                  - generic:
                    - generic [ref=e66]: Atención
                    - generic [ref=e67]: 11.111.111-1
                    - generic [ref=e68]: 04-04-2026, 12:00 p. m.
                    - generic [ref=e69]:
                      - img [ref=e70]
                      - text: 252h 54m
                  - heading "Paciente Demo" [level=1]
                  - generic:
                    - generic [ref=e73]: 44 años
                    - generic [ref=e74]: FEMENINO
                    - generic [ref=e75]: FONASA
                  - generic:
                    - generic:
                      - generic [ref=e76]: Progreso de la atención
                      - generic [ref=e77]: 1/2 secciones
            - generic [ref=e78]:
              - status [ref=e79]:
                - img [ref=e80]
                - text: Sin cambios
              - button "Guardar Ahora" [disabled] [ref=e84]:
                - img [ref=e85]
                - text: Guardar Ahora
              - button "Ficha Clínica" [ref=e89] [cursor=pointer]:
                - img [ref=e90]
                - text: Ficha Clínica
              - button "Finalizar Atención" [ref=e93] [cursor=pointer]:
                - img [ref=e94]
                - text: Finalizar Atención
              - 'button "Estado de revisión: Sin revisión pendiente. Abrir panel de revisión" [ref=e96] [cursor=pointer]':
                - img [ref=e97]
                - generic [ref=e99]: Sin revisión pendiente
              - button "Abrir panel lateral con revisión, apoyo, cierre e historial" [ref=e100] [cursor=pointer]:
                - img [ref=e101]
                - generic [ref=e103]: Panel lateral
          - paragraph [ref=e106]: "La identificación de esta atención sigue incompleta. Faltan: edad, sexo, previsión."
          - generic [ref=e107]:
            - complementary [ref=e108]:
              - generic [ref=e110]:
                - generic [ref=e112]:
                  - heading "Secciones" [level=2] [ref=e113]
                  - generic [ref=e114]: 1/2
                - navigation "Secciones de la atención" [ref=e117]:
                  - button "Identificación Completa" [ref=e118] [cursor=pointer]:
                    - img [ref=e120]
                    - generic [ref=e122]:
                      - generic [ref=e123]: Identificación
                      - generic [ref=e124]: Completa
                  - button "2 Motivo de Consulta" [ref=e126] [cursor=pointer]:
                    - generic [ref=e127]: "2"
                    - generic [ref=e129]: Motivo de Consulta
                - button "Colapsar barra lateral" [ref=e131] [cursor=pointer]:
                  - img [ref=e132]
                  - generic [ref=e135]: Colapsar
            - main [ref=e136]:
              - generic [ref=e138]:
                - generic [ref=e141]:
                  - generic [ref=e142]:
                    - generic [ref=e143]: Sección 1 de 2
                    - generic [ref=e144]: Completa
                  - heading "Identificación" [level=2] [ref=e146]
                - generic [ref=e149]:
                  - generic [ref=e150]:
                    - paragraph [ref=e151]: Snapshot administrativo de la atención
                    - paragraph [ref=e152]: "Esta sección representa la identificación usada dentro de esta atención. No se edita aquí: si necesitas corregir el dato maestro, hazlo en la ficha del paciente y luego restaura este snapshot."
                    - generic [ref=e154]:
                      - img [ref=e155]
                      - generic [ref=e157]:
                        - paragraph [ref=e158]: Identificación incompleta en esta atención
                        - paragraph [ref=e159]: "Faltan campos demográficos clave: edad, sexo, previsión."
                  - generic [ref=e160]:
                    - heading "Datos personales" [level=3] [ref=e163]
                    - generic [ref=e164]:
                      - generic [ref=e165]:
                        - generic [ref=e166]:
                          - generic [ref=e167]: Nombre completo
                          - paragraph [ref=e168]: Paciente Demo
                        - generic [ref=e169]:
                          - generic [ref=e170]: RUT
                          - paragraph [ref=e171]: 11.111.111-1
                      - generic [ref=e172]:
                        - generic [ref=e173]:
                          - generic [ref=e174]: Edad (años)
                          - paragraph [ref=e175]: —
                        - generic [ref=e176]:
                          - generic [ref=e177]: Meses
                          - paragraph [ref=e178]: —
                        - generic [ref=e179]:
                          - generic [ref=e180]: Sexo
                          - paragraph [ref=e181]: —
                        - generic [ref=e182]:
                          - generic [ref=e183]: Previsión
                          - paragraph [ref=e184]: —
                  - generic [ref=e185]:
                    - heading "Contexto y contacto" [level=3] [ref=e188]
                    - generic [ref=e189]:
                      - generic [ref=e190]:
                        - generic [ref=e191]: Trabajo / Ocupación
                        - paragraph [ref=e192]: —
                      - generic [ref=e193]:
                        - generic [ref=e194]: Domicilio
                        - paragraph [ref=e195]: —
                - generic [ref=e197]:
                  - button "Anterior" [disabled] [ref=e198]:
                    - img [ref=e199]
                    - text: Anterior
                  - button "Siguiente" [ref=e202] [cursor=pointer]:
                    - text: Siguiente
                    - img [ref=e203]
  - button "Open Next.js Dev Tools" [ref=e210] [cursor=pointer]:
    - img [ref=e211]
  - alert [ref=e214]
```

# Test source

```ts
  129 | 
  130 |   await page.route('**/api/encounters/enc-1', async (route) => {
  131 |     await route.fulfill({
  132 |       status: 200,
  133 |       contentType: 'application/json',
  134 |       body: JSON.stringify(encounterPayload),
  135 |     });
  136 |   });
  137 | 
  138 |   await page.route('**/api/encounters/stats/dashboard', async (route) => {
  139 |     await route.fulfill({
  140 |       status: 200,
  141 |       contentType: 'application/json',
  142 |       body: JSON.stringify({
  143 |         counts: {
  144 |           enProgreso: 1,
  145 |           completado: 0,
  146 |           cancelado: 0,
  147 |           total: 1,
  148 |           pendingReview: 0,
  149 |           upcomingTasks: 0,
  150 |           overdueTasks: 0,
  151 |           patientIncomplete: 0,
  152 |           patientPendingVerification: 0,
  153 |           patientVerified: 1,
  154 |           patientNonVerified: 0,
  155 |         },
  156 |         recent: [],
  157 |         upcomingTasks: [],
  158 |       }),
  159 |     });
  160 |   });
  161 | 
  162 |   await page.route('**/api/alerts/unacknowledged-count', async (route) => {
  163 |     await route.fulfill({
  164 |       status: 200,
  165 |       contentType: 'application/json',
  166 |       body: JSON.stringify({ count: 0 }),
  167 |     });
  168 |   });
  169 | 
  170 |   await page.route('**/api/alerts/unacknowledged', async (route) => {
  171 |     await route.fulfill({
  172 |       status: 200,
  173 |       contentType: 'application/json',
  174 |       body: JSON.stringify({ data: [] }),
  175 |     });
  176 |   });
  177 | 
  178 |   await page.route('**/api/patients/patient-1', async (route) => {
  179 |     await route.fulfill({
  180 |       status: 200,
  181 |       contentType: 'application/json',
  182 |       body: JSON.stringify({
  183 |         id: 'patient-1',
  184 |         nombre: 'Paciente Demo',
  185 |         rut: '11.111.111-1',
  186 |         rutExempt: false,
  187 |         rutExemptReason: null,
  188 |         edad: 44,
  189 |         sexo: 'FEMENINO',
  190 |         trabajo: null,
  191 |         prevision: 'FONASA',
  192 |         domicilio: null,
  193 |         createdAt: '2026-04-04T12:00:00.000Z',
  194 |         updatedAt: '2026-04-04T12:00:00.000Z',
  195 |         history: {},
  196 |         problems: [],
  197 |         tasks: [],
  198 |       }),
  199 |     });
  200 |   });
  201 | 
  202 |   await page.route('**/api/patients/patient-1/encounters?page=1&limit=1', async (route) => {
  203 |     await route.fulfill({
  204 |       status: 200,
  205 |       contentType: 'application/json',
  206 |       body: JSON.stringify({
  207 |         data: [],
  208 |         pagination: {
  209 |           page: 1,
  210 |           limit: 1,
  211 |           total: 0,
  212 |           totalPages: 0,
  213 |         },
  214 |       }),
  215 |     });
  216 |   });
  217 | 
  218 |   await page.route('**/api/templates**', async (route) => {
  219 |     await route.fulfill({
  220 |       status: 200,
  221 |       contentType: 'application/json',
  222 |       body: JSON.stringify([]),
  223 |     });
  224 |   });
  225 | 
  226 |   const draftNote = 'Paciente relata cefalea pulsátil con fotofobia desde hace 3 días.';
  227 | 
  228 |   await page.goto('/atenciones/enc-1');
> 229 |   await expect(page.getByText('Paciente Demo')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  230 | 
  231 |   await page.getByRole('button', { name: 'Siguiente' }).click();
  232 |   await expect(page.getByRole('heading', { name: 'Motivo de Consulta' })).toBeVisible();
  233 | 
  234 |   const motivoTextarea = page.getByPlaceholder('Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz...');
  235 |   await motivoTextarea.fill(draftNote);
  236 | 
  237 |   await page.waitForURL('**/login?from=*');
  238 |   await expect(page).toHaveURL(/\/login\?from=%2Fatenciones%2Fenc-1/);
  239 | 
  240 |   await page.getByLabel('Correo electrónico').fill('medico@anamneo.cl');
  241 |   await page.getByLabel('Contraseña').fill('Admin123');
  242 |   await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  243 | 
  244 |   await page.waitForURL('**/atenciones/enc-1');
  245 |   await expect(page.getByRole('heading', { name: 'Motivo de Consulta' })).toBeVisible();
  246 |   await expect(motivoTextarea).toHaveValue(draftNote);
  247 | });
  248 | 
```