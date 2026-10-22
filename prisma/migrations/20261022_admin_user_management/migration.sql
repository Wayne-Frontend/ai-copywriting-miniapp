ALTER TABLE "admin_users"
  ADD COLUMN "nickname" VARCHAR(80),
  ADD COLUMN "real_name" VARCHAR(80),
  ADD COLUMN "gender" VARCHAR(8),
  ADD COLUMN "phone" VARCHAR(20),
  ADD COLUMN "email" VARCHAR(254),
  ADD COLUMN "department" VARCHAR(80),
  ADD COLUMN "avatar_key" VARCHAR(20),
  ADD COLUMN "address" VARCHAR(200),
  ADD COLUMN "bio" VARCHAR(500),
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "updated_by" UUID;

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_gender_check"
  CHECK ("gender" IS NULL OR "gender" IN ('male', 'female', 'other'));
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_check"
  CHECK ("role" IN ('super_admin', 'operator'));
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_status_check"
  CHECK ("status" IN ('pending_mfa', 'active', 'disabled'));
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_avatar_key_check"
  CHECK ("avatar_key" IS NULL OR "avatar_key" ~ '^avatar(10|[1-9])$');
CREATE INDEX "admin_users_created_at_idx" ON "admin_users"("created_at" DESC);
