CREATE TABLE "login_attempts" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "last_attempt_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE INDEX "login_attempts_locked_until_idx" ON "login_attempts"("locked_until");
