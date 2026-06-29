-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "contacto_emergencia_nombre_enc" TEXT,
ADD COLUMN     "contacto_emergencia_telefono_enc" TEXT,
ADD COLUMN     "domicilio_enc" TEXT,
ADD COLUMN     "email_enc" TEXT,
ADD COLUMN     "nombre_enc" TEXT,
ADD COLUMN     "rut_enc" TEXT,
ADD COLUMN     "rut_lookup_hash" TEXT,
ADD COLUMN     "telefono_enc" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "patients_rut_lookup_hash_key" ON "patients"("rut_lookup_hash");

