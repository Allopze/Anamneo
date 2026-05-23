-- CreateTable
CREATE TABLE "user_onboarding_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "completed_step_ids" TEXT NOT NULL DEFAULT '[]',
    "dismissed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_onboarding_progress_user_id_version_key" ON "user_onboarding_progress"("user_id", "version");

-- CreateIndex
CREATE INDEX "user_onboarding_progress_user_id_idx" ON "user_onboarding_progress"("user_id");

-- AddForeignKey
ALTER TABLE "user_onboarding_progress" ADD CONSTRAINT "user_onboarding_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
