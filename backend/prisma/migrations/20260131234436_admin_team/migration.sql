/*
  Warnings:

  - Added the required column `medico_id` to the `patients` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_patients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medico_id" TEXT NOT NULL,
    "rut" TEXT,
    "rut_exempt" BOOLEAN NOT NULL DEFAULT false,
    "rut_exempt_reason" TEXT,
    "nombre" TEXT NOT NULL,
    "edad" INTEGER NOT NULL,
    "sexo" TEXT NOT NULL,
    "trabajo" TEXT,
    "prevision" TEXT NOT NULL,
    "domicilio" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patients_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_patients" ("created_at", "domicilio", "edad", "id", "nombre", "prevision", "rut", "rut_exempt", "rut_exempt_reason", "sexo", "trabajo", "updated_at") SELECT "created_at", "domicilio", "edad", "id", "nombre", "prevision", "rut", "rut_exempt", "rut_exempt_reason", "sexo", "trabajo", "updated_at" FROM "patients";
DROP TABLE "patients";
ALTER TABLE "new_patients" RENAME TO "patients";
CREATE UNIQUE INDEX "patients_rut_key" ON "patients"("rut");
CREATE INDEX "patients_medico_id_idx" ON "patients"("medico_id");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ASISTENTE',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "medico_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("active", "created_at", "email", "id", "nombre", "password_hash", "role", "updated_at") SELECT "active", "created_at", "email", "id", "nombre", "password_hash", "role", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
