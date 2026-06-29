PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_patients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_by_id" TEXT NOT NULL,
    "rut" TEXT,
    "rut_exempt" BOOLEAN NOT NULL DEFAULT false,
    "rut_exempt_reason" TEXT,
    "nombre" TEXT NOT NULL,
    "edad" INTEGER,
    "edad_meses" INTEGER,
    "sexo" TEXT,
    "trabajo" TEXT,
    "prevision" TEXT,
    "registration_mode" TEXT NOT NULL DEFAULT 'COMPLETO',
    "completeness_status" TEXT NOT NULL DEFAULT 'VERIFICADA',
    "demographics_verified_at" DATETIME,
    "demographics_verified_by_id" TEXT,
    "domicilio" TEXT,
    "archived_at" DATETIME,
    "archived_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_patients" (
    "id",
    "created_by_id",
    "rut",
    "rut_exempt",
    "rut_exempt_reason",
    "nombre",
    "edad",
    "edad_meses",
    "sexo",
    "trabajo",
    "prevision",
    "registration_mode",
    "completeness_status",
    "demographics_verified_at",
    "demographics_verified_by_id",
    "domicilio",
    "archived_at",
    "archived_by_id",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "created_by_id",
    "rut",
    "rut_exempt",
    "rut_exempt_reason",
    "nombre",
    CASE
        WHEN "edad" = 0 AND "sexo" = 'PREFIERE_NO_DECIR' AND "prevision" = 'DESCONOCIDA' THEN NULL
        ELSE "edad"
    END,
    "edad_meses",
    CASE
        WHEN "edad" = 0 AND "sexo" = 'PREFIERE_NO_DECIR' AND "prevision" = 'DESCONOCIDA' THEN NULL
        ELSE "sexo"
    END,
    "trabajo",
    CASE
        WHEN "edad" = 0 AND "sexo" = 'PREFIERE_NO_DECIR' AND "prevision" = 'DESCONOCIDA' THEN NULL
        ELSE "prevision"
    END,
    CASE
        WHEN "edad" = 0 AND "sexo" = 'PREFIERE_NO_DECIR' AND "prevision" = 'DESCONOCIDA' THEN 'RAPIDO'
        ELSE 'COMPLETO'
    END,
    CASE
        WHEN "edad" = 0 AND "sexo" = 'PREFIERE_NO_DECIR' AND "prevision" = 'DESCONOCIDA' THEN 'INCOMPLETA'
        ELSE 'VERIFICADA'
    END,
    CASE
        WHEN "edad" = 0 AND "sexo" = 'PREFIERE_NO_DECIR' AND "prevision" = 'DESCONOCIDA' THEN NULL
        ELSE "updated_at"
    END,
    NULL,
    "domicilio",
    "archived_at",
    "archived_by_id",
    "created_at",
    "updated_at"
FROM "patients";

DROP TABLE "patients";
ALTER TABLE "new_patients" RENAME TO "patients";

CREATE INDEX "patients_archived_at_idx" ON "patients"("archived_at");
CREATE UNIQUE INDEX "patients_rut_key" ON "patients"("rut");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
