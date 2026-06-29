-- CreateTable
CREATE TABLE "used_temp_token_jtis" (
    "jti" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "used_temp_token_jtis_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "used_temp_token_jtis_expires_at_idx" ON "used_temp_token_jtis"("expires_at");
