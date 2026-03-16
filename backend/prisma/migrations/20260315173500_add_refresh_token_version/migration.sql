-- Track refresh-token rotation/revocation state per user
ALTER TABLE "users" ADD COLUMN "refresh_token_version" INTEGER NOT NULL DEFAULT 0;
